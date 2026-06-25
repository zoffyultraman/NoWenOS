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

	// Use the same migration path as production
	AutoMigrate()
}

func CloseTestDB() {
	if db != nil {
		db.Close()
		db = nil
	}
	testMode.Store(false)
}
