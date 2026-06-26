package taskqueue

import (
	"database/sql"
	"fmt"
	"time"

	"nowenos-server/internal/database"
)

// TaskLog represents a single log entry in the task_logs table.
type TaskLog struct {
	ID        int64  `json:"id"`
	TaskID    int64  `json:"task_id"`
	Stream    string `json:"stream"` // stdout, stderr, system
	Content   string `json:"content"`
	Timestamp string `json:"timestamp"`
}

// AppendLog writes a log line to the task_logs table.
func AppendLog(taskID int64, stream, content string) error {
	db := database.GetDB()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(
		`INSERT INTO task_logs (task_id, stream, content, timestamp) VALUES (?, ?, ?, ?)`,
		taskID, stream, content, now,
	)
	if err != nil {
		return fmt.Errorf("failed to append task log: %w", err)
	}
	return nil
}

// GetTaskLogs returns log entries for a task. If sinceID > 0, only entries
// with id > sinceID are returned (for incremental/streaming polling).
func GetTaskLogs(taskID int64, sinceID int64) ([]TaskLog, error) {
	db := database.GetDB()

	var rows *sql.Rows
	var err error
	if sinceID > 0 {
		rows, err = db.Query(
			`SELECT id, task_id, stream, content, timestamp
			 FROM task_logs WHERE task_id = ? AND id > ? ORDER BY id ASC`,
			taskID, sinceID,
		)
	} else {
		rows, err = db.Query(
			`SELECT id, task_id, stream, content, timestamp
			 FROM task_logs WHERE task_id = ? ORDER BY id ASC`,
			taskID,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get task logs: %w", err)
	}
	defer rows.Close()

	var logs []TaskLog
	for rows.Next() {
		var l TaskLog
		if err := rows.Scan(&l.ID, &l.TaskID, &l.Stream, &l.Content, &l.Timestamp); err != nil {
			return nil, fmt.Errorf("failed to scan task log: %w", err)
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []TaskLog{}
	}
	return logs, nil
}
