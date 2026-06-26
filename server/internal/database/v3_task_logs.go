package database

import "database/sql"

func init() {
	Register(Migration{
		Version:     4,
		Description: "Add task_logs table for streaming terminal output",
		Up: func(db *sql.DB) error {
			queries := []string{
				`CREATE TABLE IF NOT EXISTS task_logs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					task_id INTEGER NOT NULL,
					stream TEXT NOT NULL DEFAULT 'stdout',
					content TEXT NOT NULL,
					timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
					FOREIGN KEY (task_id) REFERENCES tasks(id)
				)`,
				`CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id)`,
				`CREATE INDEX IF NOT EXISTS idx_task_logs_task_id_id ON task_logs(task_id, id)`,
			}
			for _, q := range queries {
				if _, err := db.Exec(q); err != nil {
					return err
				}
			}
			return nil
		},
	})
}
