package database

import "database/sql"

func init() {
	Register(Migration{
		Version:     3,
		Description: "Add tasks table for background task queue",
		Up: func(db *sql.DB) error {
			queries := []string{
				`CREATE TABLE IF NOT EXISTS tasks (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					type TEXT NOT NULL,
					payload TEXT NOT NULL DEFAULT '{}',
					status TEXT NOT NULL DEFAULT 'pending',
					progress INTEGER NOT NULL DEFAULT 0,
					log TEXT NOT NULL DEFAULT '',
					error_msg TEXT NOT NULL DEFAULT '',
					result TEXT NOT NULL DEFAULT '{}',
					created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
					updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
				)`,
				`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
				`CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)`,
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
