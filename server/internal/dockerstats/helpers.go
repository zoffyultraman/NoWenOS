package dockerstats

import (
	"strconv"
	"strings"
)

// parsePercent parses "12.34%" into 12.34
func parsePercent(s string) float64 {
	s = strings.TrimSpace(s)
	s = strings.TrimSuffix(s, "%")
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

// parseMemoryUsage parses "123.4MiB / 1.5GiB" into (usage, limit) in bytes
func parseMemoryUsage(s string) (int64, int64) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, 0
	}
	return parseSize(strings.TrimSpace(parts[0])), parseSize(strings.TrimSpace(parts[1]))
}

// parseIO parses "1.23MB / 456kB" into (rx, tx) in bytes
func parseIO(s string) (int64, int64) {
	parts := strings.Split(s, "/")
	if len(parts) != 2 {
		return 0, 0
	}
	return parseSize(strings.TrimSpace(parts[0])), parseSize(strings.TrimSpace(parts[1]))
}

// parseSize converts Docker size strings like "123.4MiB" to bytes
func parseSize(s string) int64 {
	s = strings.TrimSpace(s)
	if s == "" || s == "--" || s == "0B" {
		return 0
	}

	multipliers := map[string]int64{
		"B":   1,
		"kB":  1000,
		"KB":  1000,
		"KiB": 1024,
		"MB":  1000 * 1000,
		"MiB": 1024 * 1024,
		"GB":  1000 * 1000 * 1000,
		"GiB": 1024 * 1024 * 1024,
		"TB":  1000 * 1000 * 1000 * 1000,
		"TiB": 1024 * 1024 * 1024 * 1024,
	}

	var numStr string
	var unit string
	for i, r := range s {
		if r >= '0' && r <= '9' || r == '.' {
			continue
		}
		numStr = s[:i]
		unit = s[i:]
		break
	}
	if numStr == "" {
		numStr = s
	}

	f, err := strconv.ParseFloat(numStr, 64)
	if err != nil {
		return 0
	}

	if mul, ok := multipliers[unit]; ok {
		return int64(f * float64(mul))
	}
	return int64(f)
}

// parseInt parses "12" into int
func parseInt(s string) int {
	s = strings.TrimSpace(s)
	i, _ := strconv.Atoi(s)
	return i
}
