package dockerstats

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

type ContainerStats struct {
	ContainerID  string  `json:"containerId"`
	Name         string  `json:"name"`
	CPUPercent   float64 `json:"cpuPercent"`
	MemoryUsage  int64   `json:"memoryUsage"`
	MemoryLimit  int64   `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetRx        int64   `json:"netRx"`
	NetTx        int64   `json:"netTx"`
	BlockRead    int64   `json:"blockRead"`
	BlockWrite   int64   `json:"blockWrite"`
	Pids         int     `json:"pids"`
	Timestamp    string  `json:"timestamp"`
}

type ContainerStatsHistory struct {
	ID           int64   `json:"id"`
	ContainerID  string  `json:"containerId"`
	Name         string  `json:"name"`
	CPUPercent   float64 `json:"cpuPercent"`
	MemoryUsage  int64   `json:"memoryUsage"`
	MemoryLimit  int64   `json:"memoryLimit"`
	MemoryPercent float64 `json:"memoryPercent"`
	NetRx        int64   `json:"netRx"`
	NetTx        int64   `json:"netTx"`
	BlockRead    int64   `json:"blockRead"`
	BlockWrite   int64   `json:"blockWrite"`
	Pids         int     `json:"pids"`
	CreatedAt    string  `json:"createdAt"`
}

// dockerStatsJSON represents the raw JSON output from `docker stats --no-stream --format '{{json .}}'`
type dockerStatsJSON struct {
	BlockIO   string `json:"BlockIO"`
	CPUPerc   string `json:"CPUPerc"`
	Container string `json:"Container"`
	ID        string `json:"ID"`
	MemPerc   string `json:"MemPerc"`
	MemUsage  string `json:"MemUsage"`
	Name      string `json:"Name"`
	NetIO     string `json:"NetIO"`
	PIDs      string `json:"PIDs"`
}

// InitTable creates the docker_stats_history table if it does not exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS docker_stats_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		container_id TEXT NOT NULL,
		name TEXT,
		cpu_percent REAL,
		memory_usage INTEGER,
		memory_limit INTEGER,
		memory_percent REAL,
		net_rx INTEGER,
		net_tx INTEGER,
		block_read INTEGER,
		block_write INTEGER,
		pids INTEGER,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_docker_stats_container_id ON docker_stats_history(container_id)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_docker_stats_created_at ON docker_stats_history(created_at)`)
}

// GetContainerStats runs `docker stats --no-stream` and parses the output.
func GetContainerStats() ([]ContainerStats, error) {
	result, err := systemadapter.Run("docker", []string{"stats", "--no-stream", "--format", "{{json .}}"}, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("docker stats failed: %w", err)
	}
	if result.ExitCode != 0 {
		return nil, fmt.Errorf("docker stats failed: %s", result.Stderr)
	}

	stats := make([]ContainerStats, 0)
	lines := splitLines([]byte(result.Stdout))
	now := time.Now().Format("2006-01-02 15:04:05")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		var raw dockerStatsJSON
		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			continue
		}

		s := ContainerStats{
			ContainerID: raw.ID,
			Name:        raw.Name,
			Timestamp:   now,
		}

		s.CPUPercent = parsePercent(raw.CPUPerc)
		s.MemoryPercent = parsePercent(raw.MemPerc)
		s.MemoryUsage, s.MemoryLimit = parseMemoryUsage(raw.MemUsage)
		s.NetRx, s.NetTx = parseIO(raw.NetIO)
		s.BlockRead, s.BlockWrite = parseIO(raw.BlockIO)
		s.Pids = parseInt(raw.PIDs)

		stats = append(stats, s)
	}

	return stats, nil
}

// RecordStats fetches current stats, inserts them into the history table, and returns the stats.
func RecordStats() ([]ContainerStats, error) {
	stats, err := GetContainerStats()
	if err != nil {
		return nil, err
	}

	db := database.GetDB()
	for _, s := range stats {
		db.Exec(
			`INSERT INTO docker_stats_history
			 (container_id, name, cpu_percent, memory_usage, memory_limit, memory_percent,
			  net_rx, net_tx, block_read, block_write, pids)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ContainerID, s.Name, s.CPUPercent, s.MemoryUsage, s.MemoryLimit,
			s.MemoryPercent, s.NetRx, s.NetTx, s.BlockRead, s.BlockWrite, s.Pids,
		)
	}
	return stats, nil
}

// GetHistory returns historical stats for a container from the last N minutes.
func GetHistory(containerID string, minutes int) ([]ContainerStatsHistory, error) {
	db := database.GetDB()
	cutoff := time.Now().Add(-time.Duration(minutes) * time.Minute).UTC().Format("2006-01-02 15:04:05")

	rows, err := db.Query(
		`SELECT id, container_id, name, cpu_percent, memory_usage, memory_limit,
		        memory_percent, net_rx, net_tx, block_read, block_write, pids, created_at
		 FROM docker_stats_history
		 WHERE container_id = ? AND created_at >= ?
		 ORDER BY created_at ASC`,
		containerID, cutoff,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []ContainerStatsHistory
	for rows.Next() {
		var r ContainerStatsHistory
		if err := rows.Scan(&r.ID, &r.ContainerID, &r.Name, &r.CPUPercent,
			&r.MemoryUsage, &r.MemoryLimit, &r.MemoryPercent,
			&r.NetRx, &r.NetTx, &r.BlockRead, &r.BlockWrite, &r.Pids, &r.CreatedAt); err != nil {
			continue
		}
		records = append(records, r)
	}
	return records, nil
}

// Cleanup deletes rows older than N days.
func Cleanup(olderThanDays int) {
	db := database.GetDB()
	cutoff := time.Now().AddDate(0, 0, -olderThanDays).UTC().Format("2006-01-02 15:04:05")
	db.Exec(`DELETE FROM docker_stats_history WHERE created_at < ?`, cutoff)
}

func splitLines(data []byte) []string {
	lines := make([]string, 0)
	start := 0
	for i, b := range data {
		if b == '\n' {
			lines = append(lines, string(data[start:i]))
			start = i + 1
		}
	}
	if start < len(data) {
		lines = append(lines, string(data[start:]))
	}
	return lines
}
