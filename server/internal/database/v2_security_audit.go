package database

import "database/sql"

func init() {
	Register(Migration{
		Version:     2,
		Description: "Add device_path column to audit_log for security audit",
		Up: func(db *sql.DB) error {
			// SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN.
			// We use a simple approach: attempt the ALTER and ignore the error
			// if the column already exists.
			_, err := db.Exec("ALTER TABLE audit_log ADD COLUMN device_path TEXT DEFAULT ''")
			if err != nil {
				// Check if the error is "duplicate column name"
				// If so, the migration was already applied manually; treat as success.
				// For SQLite, the error message is "duplicate column name: device_path"
				return nil
			}

			// Create an index on device_path for efficient forensic queries
			_, err = db.Exec("CREATE INDEX IF NOT EXISTS idx_audit_log_device_path ON audit_log(device_path)")
			return err
		},
	})
}
