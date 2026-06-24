package twofa

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"database/sql"
	"encoding/base32"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"
	"time"

	"nowenos-server/internal/database"
)

var (
	ErrTwoFANotEnabled  = errors.New("2FA is not enabled")
	ErrTwoFAAlreadyOn   = errors.New("2FA is already enabled")
	ErrInvalidTOTP      = errors.New("invalid TOTP code")
	ErrInvalidBackup    = errors.New("invalid backup code")
	ErrSetupNotStarted = errors.New("2FA setup has not been started")
)

// InitDB creates the user_2fa table if it doesn't exist.
func InitDB() {
	db := database.GetDB()
	queries := []string{
		`CREATE TABLE IF NOT EXISTS user_2fa (
			user_id TEXT PRIMARY KEY,
			secret TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 0,
			backup_codes TEXT NOT NULL DEFAULT '[]',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}
	for _, q := range queries {
		if _, err := db.Exec(q); err != nil {
			log.Printf("Failed to create user_2fa table: %v", err)
		}
	}
}

// generateSecret creates a random 20-byte base32-encoded TOTP secret.
func generateSecret() (string, error) {
	buf := make([]byte, 20)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(buf), nil
}

// generateBackupCodes creates 10 random 8-character alphanumeric backup codes.
func generateBackupCodes() ([]string, error) {
	codes := make([]string, 10)
	const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
	for i := 0; i < 10; i++ {
		buf := make([]byte, 8)
		if _, err := rand.Read(buf); err != nil {
			return nil, err
		}
		for j := 0; j < 8; j++ {
			buf[j] = chars[int(buf[j])%len(chars)]
		}
		codes[i] = string(buf)
	}
	return codes, nil
}

// generateTOTP computes a 6-digit TOTP code for the given secret and time.
func generateTOTP(secret string, t time.Time) (string, error) {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return "", err
	}

	// Time step: 30 seconds, T = floor(seconds / 30)
	timeStep := t.Unix() / 30

	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(timeStep))

	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)

	// Dynamic truncation (RFC 4226)
	offset := sum[len(sum)-1] & 0x0F
	code := binary.BigEndian.Uint32(sum[offset:offset+4]) & 0x7FFFFFFF

	return fmt.Sprintf("%06d", code%1000000), nil
}

// verifyTOTP checks if the provided code matches the expected TOTP.
// It allows a +/- 1 time step window to account for clock skew.
func verifyTOTP(secret, code string) bool {
	now := time.Now()
	for _, offset := range []int{-1, 0, 1} {
		t := now.Add(time.Duration(offset) * 30 * time.Second)
		expected, err := generateTOTP(secret, t)
		if err != nil {
			continue
		}
		if hmac.Equal([]byte(expected), []byte(code)) {
			return true
		}
	}
	return false
}

// GenerateOTPUri returns an otpauth:// URI for use with QR code generators.
func GenerateOTPUri(secret, username, issuer string) string {
	params := url.Values{}
	params.Set("secret", secret)
	params.Set("issuer", issuer)
	params.Set("algorithm", "SHA1")
	params.Set("digits", "6")
	params.Set("period", "30")

	return fmt.Sprintf("otpauth://totp/%s:%s?%s",
		url.PathEscape(issuer),
		url.PathEscape(username),
		params.Encode(),
	)
}

// ── API request/response types ──

type EnableResponse struct {
	Secret     string   `json:"secret"`
	OTPUri     string   `json:"otpUri"`
	BackupCodes []string `json:"backupCodes"`
}

type VerifyRequest struct {
	Code string `json:"code"`
}

type StatusResponse struct {
	Enabled bool `json:"enabled"`
}

// ── API functions ──

// Enable starts the 2FA setup process. Generates a secret and backup codes
// but does NOT enable 2FA yet. The user must verify a TOTP code first.
func Enable(username string) (*EnableResponse, error) {
	db := database.GetDB()

	// Check if already enabled
	var enabled int
	err := db.QueryRow("SELECT enabled FROM user_2fa WHERE user_id = ?", username).Scan(&enabled)
	if err == nil && enabled == 1 {
		return nil, ErrTwoFAAlreadyOn
	}

	secret, err := generateSecret()
	if err != nil {
		return nil, err
	}

	backupCodes, err := generateBackupCodes()
	if err != nil {
		return nil, err
	}

	codesJSON, err := json.Marshal(backupCodes)
	if err != nil {
		return nil, err
	}

	// Insert or update with enabled=0 (pending verification)
	_, err = db.Exec(
		`INSERT INTO user_2fa (user_id, secret, enabled, backup_codes) VALUES (?, ?, 0, ?)
		 ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret, enabled=0, backup_codes=excluded.backup_codes`,
		username, secret, string(codesJSON),
	)
	if err != nil {
		return nil, err
	}

	otpUri := GenerateOTPUri(secret, username, "NoWenOS")

	return &EnableResponse{
		Secret:      secret,
		OTPUri:      otpUri,
		BackupCodes: backupCodes,
	}, nil
}

// Verify confirms a TOTP code during the setup process and activates 2FA.
func Verify(username, code string) error {
	db := database.GetDB()

	var secret string
	var enabled int
	err := db.QueryRow("SELECT secret, enabled FROM user_2fa WHERE user_id = ?", username).Scan(&secret, &enabled)
	if err == sql.ErrNoRows {
		return ErrSetupNotStarted
	}
	if err != nil {
		return err
	}

	if enabled == 1 {
		return ErrTwoFAAlreadyOn
	}

	if !verifyTOTP(secret, code) {
		return ErrInvalidTOTP
	}

	// Activate 2FA
	_, err = db.Exec("UPDATE user_2fa SET enabled = 1 WHERE user_id = ?", username)
	return err
}

// Disable turns off 2FA for the user after verifying a TOTP code or backup code.
func Disable(username, code string) error {
	db := database.GetDB()

	var secret string
	var enabled int
	var backupCodesJSON string
	err := db.QueryRow("SELECT secret, enabled, backup_codes FROM user_2fa WHERE user_id = ?", username).
		Scan(&secret, &enabled, &backupCodesJSON)
	if err == sql.ErrNoRows {
		return ErrTwoFANotEnabled
	}
	if err != nil {
		return err
	}

	if enabled == 0 {
		return ErrTwoFANotEnabled
	}

	// Verify TOTP code or backup code
	valid := verifyTOTP(secret, code)
	if !valid {
		valid = verifyBackupCode(username, code, &backupCodesJSON)
	}
	if !valid {
		return ErrInvalidTOTP
	}

	// Delete the 2FA record
	_, err = db.Exec("DELETE FROM user_2fa WHERE user_id = ?", username)
	return err
}

// GetStatus returns whether 2FA is enabled for the user.
func GetStatus(username string) *StatusResponse {
	db := database.GetDB()

	var enabled int
	err := db.QueryRow("SELECT enabled FROM user_2fa WHERE user_id = ?", username).Scan(&enabled)
	if err != nil {
		return &StatusResponse{Enabled: false}
	}

	return &StatusResponse{Enabled: enabled == 1}
}

// LoginVerify verifies a TOTP code during login. Returns true if valid.
func LoginVerify(username, code string) bool {
	db := database.GetDB()

	var secret string
	var enabled int
	var backupCodesJSON string
	err := db.QueryRow("SELECT secret, enabled, backup_codes FROM user_2fa WHERE user_id = ?", username).
		Scan(&secret, &enabled, &backupCodesJSON)
	if err != nil || enabled == 0 {
		// 2FA not enabled, allow login
		return true
	}

	// Try TOTP code
	if verifyTOTP(secret, code) {
		return true
	}

	// Try backup code
	return verifyBackupCode(username, code, &backupCodesJSON)
}

// BackupVerify verifies a backup code during login.
func BackupVerify(username, code string) (bool, error) {
	db := database.GetDB()

	var backupCodesJSON string
	var enabled int
	err := db.QueryRow("SELECT enabled, backup_codes FROM user_2fa WHERE user_id = ?", username).
		Scan(&enabled, &backupCodesJSON)
	if err == sql.ErrNoRows || enabled == 0 {
		return false, ErrTwoFANotEnabled
	}
	if err != nil {
		return false, err
	}

	if verifyBackupCode(username, code, &backupCodesJSON) {
		return true, nil
	}
	return false, ErrInvalidBackup
}

// HasTwoFA returns true if the user has 2FA enabled.
func HasTwoFA(username string) bool {
	db := database.GetDB()
	var enabled int
	err := db.QueryRow("SELECT enabled FROM user_2fa WHERE user_id = ?", username).Scan(&enabled)
	return err == nil && enabled == 1
}

// verifyBackupCode checks if the provided code matches any unused backup code
// and removes it from the list if valid.
func verifyBackupCode(username, code string, backupCodesJSON *string) bool {
	var codes []string
	if err := json.Unmarshal([]byte(*backupCodesJSON), &codes); err != nil {
		return false
	}

	code = strings.ToLower(strings.TrimSpace(code))
	found := -1
	for i, c := range codes {
		if strings.ToLower(c) == code {
			found = i
			break
		}
	}

	if found == -1 {
		return false
	}

	// Remove used code
	codes = append(codes[:found], codes[found+1:]...)
	newJSON, err := json.Marshal(codes)
	if err != nil {
		return false
	}

	db := database.GetDB()
	db.Exec("UPDATE user_2fa SET backup_codes = ? WHERE user_id = ?", string(newJSON), username)
	return true
}

// GetSetupInfo returns the current pending setup info (for the frontend to re-display QR code).
func GetSetupInfo(username string) (*EnableResponse, error) {
	db := database.GetDB()

	var secret string
	var enabled int
	var backupCodesJSON string
	err := db.QueryRow("SELECT secret, enabled, backup_codes FROM user_2fa WHERE user_id = ?", username).
		Scan(&secret, &enabled, &backupCodesJSON)
	if err == sql.ErrNoRows {
		return nil, ErrSetupNotStarted
	}
	if err != nil {
		return nil, err
	}

	var backupCodes []string
	json.Unmarshal([]byte(backupCodesJSON), &backupCodes)

	otpUri := GenerateOTPUri(secret, username, "NoWenOS")

	return &EnableResponse{
		Secret:      secret,
		OTPUri:      otpUri,
		BackupCodes: backupCodes,
	}, nil
}
