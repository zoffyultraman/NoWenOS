package database

import (
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"

	_ "modernc.org/sqlite"
)

var (
	db        *sql.DB
	once      sync.Once
	testMode  atomic.Bool
)

func GetDB() *sql.DB {
	if testMode.Load() {
		return db
	}
	once.Do(func() {
		initDB()
	})
	return db
}

func initDB() {
	// Ensure data directory exists
	dataDir := "data"
	os.MkdirAll(dataDir, 0755)

	dbPath := filepath.Join(dataDir, "nowenos.db")

	var err error
	db, err = sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatalf("Failed to open database: %v", err)
	}

	// Enable WAL mode for better performance
	db.Exec("PRAGMA journal_mode=WAL")

	// Create tables
	createTables()
}

func createTables() {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		`CREATE TABLE IF NOT EXISTS user_2fa (
			user_id TEXT PRIMARY KEY,
			secret TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 0,
			backup_codes TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, query := range queries {
		if _, err := db.Exec(query); err != nil {
			log.Printf("Failed to execute query: %v", err)
		}
	}
}

func Close() {
	if db != nil {
		db.Close()
	}
}

// ── Test helpers ──

func InitTestDB() {
	if db != nil {
		db.Close()
	}

	var err error
	db, err = sql.Open("sqlite", ":memory:")
	if err != nil {
		log.Fatalf("Failed to open test database: %v", err)
	}
	db.Exec("PRAGMA journal_mode=WAL")
	testMode.Store(true)

	// Create tables
	queries := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT UNIQUE NOT NULL,
			password TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'user',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
		`CREATE TABLE IF NOT EXISTS user_2fa (
			user_id TEXT PRIMARY KEY,
			secret TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 0,
			backup_codes TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, q := range queries {
		db.Exec(q)
	}
}

func CloseTestDB() {
	if db != nil {
		db.Close()
		db = nil
	}
	testMode.Store(false)
}
