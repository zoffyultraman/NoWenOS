package logviewer

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

type LogEntry struct {
	Timestamp string `json:"timestamp"`
	Level     string `json:"level"`
	Message   string `json:"message"`
	Source    string `json:"source"`
}

type LogResult struct {
	Entries []LogEntry `json:"entries"`
	Total   int        `json:"total"`
}

// Common log file paths on Linux
var logPaths = []string{
	"/var/log/syslog",
	"/var/log/messages",
	"/var/log/auth.log",
	"/var/log/daemon.log",
	"/var/log/kern.log",
}

func GetLogs(source string, limit int) (*LogResult, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	// If specific source requested
	if source != "" {
		return readLogFile(source, limit)
	}

	// Default: read syslog or messages
	for _, path := range logPaths {
		if _, err := os.Stat(path); err == nil {
			return readLogFile(path, limit)
		}
	}

	// Fallback: return empty
	return &LogResult{Entries: []LogEntry{}, Total: 0}, nil
}

func GetAvailableLogs() []string {
	available := make([]string, 0)
	for _, path := range logPaths {
		if _, err := os.Stat(path); err == nil {
			available = append(available, filepath.Base(path))
		}
	}
	return available
}

func readLogFile(path string, limit int) (*LogResult, error) {
	file, err := os.Open(path)
	if err != nil {
		return &LogResult{Entries: []LogEntry{}, Total: 0}, nil
	}
	defer file.Close()

	entries := make([]LogEntry, 0)
	scanner := bufio.NewScanner(file)

	// Increase buffer size for long lines
	scanner.Buffer(make([]byte, 1024*1024), 1024*1024)

	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue
		}

		entry := parseLogLine(line, filepath.Base(path))
		entries = append(entries, entry)
	}

	// Reverse to show newest first
	sort.Slice(entries, func(i, j int) bool {
		return i > j
	})

	// Apply limit
	if len(entries) > limit {
		entries = entries[:limit]
	}

	return &LogResult{
		Entries: entries,
		Total:   len(entries),
	}, nil
}

func parseLogLine(line, source string) LogEntry {
	entry := LogEntry{
		Message: line,
		Source:  source,
		Level:   "info",
	}

	// Try to extract timestamp and level
	lower := strings.ToLower(line)

	if strings.Contains(lower, "error") || strings.Contains(lower, "fail") || strings.Contains(lower, "critical") {
		entry.Level = "error"
	} else if strings.Contains(lower, "warn") {
		entry.Level = "warn"
	} else if strings.Contains(lower, "debug") {
		entry.Level = "debug"
	}

	// Try to extract timestamp from common formats
	// Format: "Jan  2 15:04:05"
	if len(line) > 15 {
		prefix := line[:15]
		if _, err := time.Parse("Jan  2 15:04:05", prefix); err == nil {
			entry.Timestamp = prefix
		}
	}

	if entry.Timestamp == "" {
		entry.Timestamp = time.Now().Format("2006-01-02 15:04:05")
	}

	return entry
}
