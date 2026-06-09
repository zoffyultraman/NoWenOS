package sysinfo

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type NetworkStats struct {
	Interfaces []NetworkInterface `json:"interfaces"`
	TotalRx    string             `json:"totalRx"`
	TotalTx    string             `json:"totalTx"`
}

type NetworkInterface struct {
	Name string `json:"name"`
	Rx   string `json:"rx"`
	Tx   string `json:"tx"`
	RxBps int64 `json:"rxBps"`
	TxBps int64 `json:"txBps"`
}

func GetNetworkStats() (*NetworkStats, error) {
	file, err := os.Open("/proc/net/dev")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stats := &NetworkStats{
		Interfaces: make([]NetworkInterface, 0),
	}

	var totalRx, totalTx int64

	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		if lineNum <= 2 {
			continue // Skip header lines
		}

		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		name := strings.TrimSpace(parts[0])
		if name == "lo" {
			continue // Skip loopback
		}

		fields := strings.Fields(parts[1])
		if len(fields) < 10 {
			continue
		}

		rx, _ := strconv.ParseInt(fields[0], 10, 64)
		tx, _ := strconv.ParseInt(fields[8], 10, 64)

		totalRx += rx
		totalTx += tx

		stats.Interfaces = append(stats.Interfaces, NetworkInterface{
			Name: name,
			Rx:   formatBytes(rx),
			Tx:   formatBytes(tx),
		})
	}

	stats.TotalRx = formatBytes(totalRx)
	stats.TotalTx = formatBytes(totalTx)

	return stats, nil
}

func formatBytes(bytes int64) string {
	units := []string{"B", "KB", "MB", "GB", "TB"}
	value := float64(bytes)

	for _, unit := range units {
		if value < 1024 {
			return fmt.Sprintf("%.1f %s", value, unit)
		}
		value /= 1024
	}

	return fmt.Sprintf("%.1f PB", value)
}
