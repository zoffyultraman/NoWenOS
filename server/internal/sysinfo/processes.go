package sysinfo

import (
	"runtime"
	"strconv"
	"strings"
	"time"

	"nowenos-server/internal/systemadapter"
)

type ProcessInfo struct {
	PID     int     `json:"pid"`
	Name    string  `json:"name"`
	User    string  `json:"user"`
	CPU     float64 `json:"cpu"`
	Memory  float64 `json:"memory"`
	State   string  `json:"state"`
	Command string  `json:"command"`
}

func GetProcesses() ([]ProcessInfo, error) {
	if runtime.GOOS == "windows" {
		return getProcessesWindows()
	}
	return getProcessesLinux()
}

func getProcessesLinux() ([]ProcessInfo, error) {
	// Use ps command: ps aux --sort=-%mem
	result, err := systemadapter.Run("ps", []string{"aux", "--sort=-%mem"}, 10*time.Second)
	if err != nil {
		return nil, err
	}

	procs := make([]ProcessInfo, 0)
	lines := strings.Split(result.Stdout, "\n")
	for i, line := range lines {
		if i == 0 || strings.TrimSpace(line) == "" {
			continue // skip header
		}
		fields := strings.Fields(line)
		if len(fields) < 11 {
			continue
		}

		pid, _ := strconv.Atoi(fields[1])
		cpu, _ := strconv.ParseFloat(fields[2], 64)
		mem, _ := strconv.ParseFloat(fields[3], 64)

		// Command is everything from field 10 onwards
		command := strings.Join(fields[10:], " ")
		// Truncate long commands
		if len(command) > 80 {
			command = command[:80] + "..."
		}

		procs = append(procs, ProcessInfo{
			PID:     pid,
			Name:    fields[10],
			User:    fields[0],
			CPU:     cpu,
			Memory:  mem,
			State:   "",
			Command: command,
		})
	}

	return procs, nil
}

func getProcessesWindows() ([]ProcessInfo, error) {
	// tasklist /FO CSV /NH
	result, err := systemadapter.Run("tasklist", []string{"/FO", "CSV", "/NH"}, 10*time.Second)
	if err != nil {
		return nil, err
	}

	procs := make([]ProcessInfo, 0)
	lines := strings.Split(result.Stdout, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// CSV format: "name","pid","session","mem"
		parts := strings.Split(line, "\",\"")
		if len(parts) < 4 {
			continue
		}
		name := strings.Trim(parts[0], "\"")
		pid, _ := strconv.Atoi(strings.Trim(parts[1], "\""))
		memStr := strings.Trim(parts[len(parts)-1], "\"")
		memStr = strings.ReplaceAll(memStr, ",", "")
		memStr = strings.ReplaceAll(memStr, " K", "")
		memKB, _ := strconv.ParseFloat(memStr, 64)

		procs = append(procs, ProcessInfo{
			PID:     pid,
			Name:    name,
			User:    "",
			CPU:     0,
			Memory:  memKB / 1024, // MB
			State:   "",
			Command: name,
		})
	}

	// Sort by memory descending (simple bubble, limited to top 50)
	if len(procs) > 50 {
		procs = procs[:50]
	}

	return procs, nil
}

func GetTopProcesses(limit int) ([]ProcessInfo, error) {
	procs, err := GetProcesses()
	if err != nil {
		return nil, err
	}
	if limit > 0 && len(procs) > limit {
		procs = procs[:limit]
	}
	return procs, nil
}
