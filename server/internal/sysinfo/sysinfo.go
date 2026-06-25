package sysinfo

import (
	"bufio"
	"fmt"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"nowenos-server/internal/systemadapter"
)

type SystemStats struct {
	CPU    CPUStats    `json:"cpu"`
	Memory MemoryStats `json:"memory"`
	Disk   DiskStats   `json:"disk"`
	Uptime string      `json:"uptime"`
}

type CPUStats struct {
	Usage float64 `json:"usage"`
	Cores int     `json:"cores"`
}

type MemoryStats struct {
	Total     string  `json:"total"`
	Used      string  `json:"used"`
	Available string  `json:"available"`
	Usage     float64 `json:"usage"`
}

type DiskStats struct {
	Total string  `json:"total"`
	Used  string  `json:"used"`
	Free  string  `json:"free"`
	Usage float64 `json:"usage"`
}

func GetStats() (*SystemStats, error) {
	stats := &SystemStats{
		CPU: CPUStats{Cores: runtime.NumCPU()},
	}

	cpuUsage, err := getCPUUsage()
	if err == nil {
		stats.CPU.Usage = cpuUsage
	}

	memStats, err := getMemoryStats()
	if err == nil {
		stats.Memory = *memStats
	}

	diskStats, err := getDiskStats("/")
	if err == nil {
		stats.Disk = *diskStats
	}

	uptime, err := getUptime()
	if err == nil {
		stats.Uptime = uptime
	}

	return stats, nil
}

func getCPUUsage() (float64, error) {
	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) < 5 {
				return 0, fmt.Errorf("invalid cpu line")
			}

			user, _ := strconv.ParseUint(fields[1], 10, 64)
			nice, _ := strconv.ParseUint(fields[2], 10, 64)
			system, _ := strconv.ParseUint(fields[3], 10, 64)
			idle, _ := strconv.ParseUint(fields[4], 10, 64)

			total := user + nice + system + idle
			if total == 0 {
				return 0, nil
			}

			usage := float64(total-idle) / float64(total) * 100
			return usage, nil
		}
	}

	return 0, fmt.Errorf("cpu line not found")
}

func getMemoryStats() (*MemoryStats, error) {
	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stats := &MemoryStats{}
	scanner := bufio.NewScanner(file)

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		key := strings.TrimSuffix(fields[0], ":")
		value, _ := strconv.ParseUint(fields[1], 10, 64)

		switch key {
		case "MemTotal":
			stats.Total = formatKB(value)
		case "MemFree":
			stats.Available = formatKB(value)
		case "MemAvailable":
			stats.Available = formatKB(value)
		}
	}

	totalKB, _ := strconv.ParseUint(strings.Fields(stats.Total)[0], 10, 64)
	availKB, _ := strconv.ParseUint(strings.Fields(stats.Available)[0], 10, 64)

	if totalKB > 0 {
		usedKB := totalKB - availKB
		stats.Used = formatKB(usedKB)
		stats.Usage = float64(usedKB) / float64(totalKB) * 100
	}

	return stats, nil
}

func getDiskStats(path string) (*DiskStats, error) {
	// Use df command for cross-platform dev compatibility
	out, err := execDF(path)
	if err != nil {
		return &DiskStats{Total: "N/A", Used: "N/A", Free: "N/A", Usage: 0}, nil
	}

	lines := strings.Split(strings.TrimSpace(out), "\n")
	if len(lines) < 2 {
		return &DiskStats{Total: "N/A", Used: "N/A", Free: "N/A", Usage: 0}, nil
	}

	// df -k output: Filesystem 1K-blocks Used Available Use% Mounted_on
	fields := strings.Fields(lines[1])
	if len(fields) < 5 {
		return &DiskStats{Total: "N/A", Used: "N/A", Free: "N/A", Usage: 0}, nil
	}

	totalKB, _ := strconv.ParseUint(fields[1], 10, 64)
	usedKB, _ := strconv.ParseUint(fields[2], 10, 64)
	availKB, _ := strconv.ParseUint(fields[3], 10, 64)

	var usage float64
	if totalKB > 0 {
		usage = float64(usedKB) / float64(totalKB) * 100
	}

	return &DiskStats{
		Total: formatKB(totalKB),
		Used:  formatKB(usedKB),
		Free:  formatKB(availKB),
		Usage: usage,
	}, nil
}

func execDF(path string) (string, error) {
	result, err := systemadapter.Run("df", []string{"-k", path}, 10*time.Second)
	if err != nil {
		return "", err
	}
	return result.Stdout, nil
}

func getUptime() (string, error) {
	file, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return "", err
	}

	fields := strings.Fields(string(file))
	if len(fields) < 1 {
		return "", fmt.Errorf("invalid uptime format")
	}

	seconds, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return "", err
	}

	duration := time.Duration(seconds * float64(time.Second))
	days := int(duration.Hours()) / 24
	hours := int(duration.Hours()) % 24
	minutes := int(duration.Minutes()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes), nil
	}
	return fmt.Sprintf("%dh %dm", hours, minutes), nil
}

func formatKB(kb uint64) string {
	units := []string{"KB", "MB", "GB", "TB"}
	value := float64(kb)

	for _, unit := range units {
		if value < 1024 {
			return fmt.Sprintf("%.1f %s", value, unit)
		}
		value /= 1024
	}

	return fmt.Sprintf("%.1f PB", value)
}
