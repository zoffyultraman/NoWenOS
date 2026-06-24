package database

import (
	"database/sql"
	"log"
	"sort"
)

type Migration struct {
	Version     int
	Description string
	Up          func(db *sql.DB) error
}

var migrations []Migration

// Register adds a migration to the pending list.
func Register(m Migration) {
	migrations = append(migrations, m)
}

// AutoMigrate applies all pending migrations in version order.
func AutoMigrate() {
	db := GetDB()

	// Create migrations tracking table
	db.Exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		version INTEGER PRIMARY KEY,
		description TEXT,
		applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)

	// Get already-applied versions
	applied := make(map[int]bool)
	rows, _ := db.Query("SELECT version FROM schema_migrations")
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var v int
			rows.Scan(&v)
			applied[v] = true
		}
	}

	// Sort migrations by version
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})

	// Apply pending migrations
	for _, m := range migrations {
		if applied[m.Version] {
			continue
		}
		log.Printf("[migrate] applying v%d: %s", m.Version, m.Description)
		if err := m.Up(db); err != nil {
			log.Printf("[migrate] v%d failed: %v", m.Version, err)
			continue
		}
		db.Exec("INSERT INTO schema_migrations (version, description) VALUES (?, ?)", m.Version, m.Description)
	}
}
