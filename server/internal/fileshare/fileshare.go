package fileshare

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"math/big"
	"os"
	"path/filepath"
	"time"

	"nowenos-server/internal/database"
)

var (
	ErrShareNotFound  = errors.New("share not found")
	ErrShareExpired   = errors.New("share has expired")
	ErrDownloadLimit  = errors.New("download limit reached")
	ErrFileNotFound   = errors.New("shared file not found")
	ErrPathRequired   = errors.New("file path is required")
)

const tokenChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
const tokenLength = 16

// FileShare represents a file sharing link.
type FileShare struct {
	ID            int64  `json:"id"`
	FilePath      string `json:"filePath"`
	FileName      string `json:"fileName"`
	Token         string `json:"token"`
	ExpiresAt     string `json:"expiresAt"`
	MaxDownloads  int    `json:"maxDownloads"`
	DownloadCount int    `json:"downloadCount"`
	CreatedAt     string `json:"createdAt"`
}

// CreateShareRequest is the payload for creating a file share.
type CreateShareRequest struct {
	FilePath     string `json:"filePath" binding:"required"`
	ExpiresHours int    `json:"expiresHours"`
	MaxDownloads int    `json:"maxDownloads"`
}

// InitTable creates the file_shares table if it does not exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS file_shares (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		file_path TEXT NOT NULL,
		file_name TEXT NOT NULL,
		token TEXT UNIQUE NOT NULL,
		expires_at DATETIME,
		max_downloads INTEGER NOT NULL DEFAULT 0,
		download_count INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec(`CREATE INDEX IF NOT EXISTS idx_file_shares_token ON file_shares(token)`)
}

func generateToken() (string, error) {
	b := make([]byte, tokenLength)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(tokenChars))))
		if err != nil {
			return "", err
		}
		b[i] = tokenChars[n.Int64()]
	}
	return string(b), nil
}

// CreateShare creates a new file sharing link.
func CreateShare(req CreateShareRequest) (*FileShare, error) {
	if req.FilePath == "" {
		return nil, ErrPathRequired
	}

	cleanPath := filepath.Clean(req.FilePath)
	info, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrFileNotFound
		}
		return nil, err
	}
	if info.IsDir() {
		return nil, errors.New("cannot share a directory")
	}

	token, err := generateToken()
	if err != nil {
		return nil, fmt.Errorf("failed to generate token: %w", err)
	}

	var expiresAt *time.Time
	if req.ExpiresHours > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresHours) * time.Hour)
		expiresAt = &t
	}

	if req.MaxDownloads < 0 {
		req.MaxDownloads = 0
	}

	db := database.GetDB()

	if expiresAt != nil {
		_, err = db.Exec(
			"INSERT INTO file_shares (file_path, file_name, token, expires_at, max_downloads) VALUES (?, ?, ?, ?, ?)",
			cleanPath, info.Name(), token, expiresAt.Format(time.RFC3339), req.MaxDownloads,
		)
	} else {
		_, err = db.Exec(
			"INSERT INTO file_shares (file_path, file_name, token, max_downloads) VALUES (?, ?, ?, ?)",
			cleanPath, info.Name(), token, req.MaxDownloads,
		)
	}
	if err != nil {
		return nil, err
	}

	return GetShareByToken(token)
}

// GetShareByToken retrieves a share by its token.
func GetShareByToken(token string) (*FileShare, error) {
	db := database.GetDB()
	var s FileShare
	var expiresAt sql.NullString
	err := db.QueryRow(
		"SELECT id, file_path, file_name, token, expires_at, max_downloads, download_count, created_at FROM file_shares WHERE token = ?",
		token,
	).Scan(&s.ID, &s.FilePath, &s.FileName, &s.Token, &expiresAt, &s.MaxDownloads, &s.DownloadCount, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrShareNotFound
	}
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		s.ExpiresAt = expiresAt.String
	}
	return &s, nil
}

// GetShareByID retrieves a share by its ID.
func GetShareByID(id int64) (*FileShare, error) {
	db := database.GetDB()
	var s FileShare
	var expiresAt sql.NullString
	err := db.QueryRow(
		"SELECT id, file_path, file_name, token, expires_at, max_downloads, download_count, created_at FROM file_shares WHERE id = ?",
		id,
	).Scan(&s.ID, &s.FilePath, &s.FileName, &s.Token, &expiresAt, &s.MaxDownloads, &s.DownloadCount, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, ErrShareNotFound
	}
	if err != nil {
		return nil, err
	}
	if expiresAt.Valid {
		s.ExpiresAt = expiresAt.String
	}
	return &s, nil
}

// ListShares returns all file shares.
func ListShares() []FileShare {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, file_path, file_name, token, expires_at, max_downloads, download_count, created_at FROM file_shares ORDER BY id DESC")
	if err != nil {
		return []FileShare{}
	}
	defer rows.Close()

	shares := make([]FileShare, 0)
	for rows.Next() {
		var s FileShare
		var expiresAt sql.NullString
		if err := rows.Scan(&s.ID, &s.FilePath, &s.FileName, &s.Token, &expiresAt, &s.MaxDownloads, &s.DownloadCount, &s.CreatedAt); err != nil {
			continue
		}
		if expiresAt.Valid {
			s.ExpiresAt = expiresAt.String
		}
		shares = append(shares, s)
	}
	return shares
}

// ValidateAndIncrement checks if a share is valid (not expired, not over download limit)
// and increments the download counter. Returns the share if valid.
func ValidateAndIncrement(token string) (*FileShare, error) {
	share, err := GetShareByToken(token)
	if err != nil {
		return nil, err
	}

	// Check expiration
	if share.ExpiresAt != "" {
		expires, err := time.Parse(time.RFC3339, share.ExpiresAt)
		if err == nil && time.Now().After(expires) {
			return nil, ErrShareExpired
		}
	}

	// Check download limit
	if share.MaxDownloads > 0 && share.DownloadCount >= share.MaxDownloads {
		return nil, ErrDownloadLimit
	}

	// Verify file still exists
	if _, err := os.Stat(share.FilePath); err != nil {
		return nil, ErrFileNotFound
	}

	// Increment download count
	db := database.GetDB()
	db.Exec("UPDATE file_shares SET download_count = download_count + 1 WHERE token = ?", token)
	share.DownloadCount++

	return share, nil
}

// DeleteShare removes a file share by token.
func DeleteShare(token string) error {
	db := database.GetDB()
	result, err := db.Exec("DELETE FROM file_shares WHERE token = ?", token)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrShareNotFound
	}
	return nil
}

// DeleteShareByID removes a file share by ID.
func DeleteShareByID(id int64) error {
	db := database.GetDB()
	result, err := db.Exec("DELETE FROM file_shares WHERE id = ?", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return ErrShareNotFound
	}
	return nil
}

// CleanupExpired removes all expired shares.
func CleanupExpired() {
	db := database.GetDB()
	db.Exec("DELETE FROM file_shares WHERE expires_at IS NOT NULL AND expires_at < ?", time.Now().Format(time.RFC3339))
}
