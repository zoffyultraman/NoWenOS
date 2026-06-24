package logrotate

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"nowenos-server/internal/database"
)

// LogRotateConfig represents a logrotate configuration entry.
type LogRotateConfig struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	LogPaths   string `json:"logPaths"`
	Frequency  string `json:"frequency"`
	RotateCount int   `json:"rotateCount"`
	MaxSize    string `json:"maxSize"`
	Compress   bool   `json:"compress"`
	CreateMode string `json:"createMode"`
	PostRotate string `json:"postRotate"`
	Enabled    bool   `json:"enabled"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// CreateConfigRequest is the payload for creating/updating a logrotate config.
type CreateConfigRequest struct {
	Name        string `json:"name" binding:"required"`
	LogPaths    string `json:"logPaths" binding:"required"`
	Frequency   string `json:"frequency"`
	RotateCount int    `json:"rotateCount"`
	MaxSize     string `json:"maxSize"`
	Compress    bool   `json:"compress"`
	CreateMode  string `json:"createMode"`
	PostRotate  string `json:"postRotate"`
}

// TestResult holds the output of a logrotate dry-run.
type TestResult struct {
	Output string `json:"output"`
}

const configDir = "/etc/logrotate.d"

// validNameRe ensures the config name contains only safe characters.
var validNameRe = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$`)

// InitTable creates the logrotate_configs table if it does not exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS logrotate_configs (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		name        TEXT NOT NULL UNIQUE,
		log_paths   TEXT NOT NULL,
		frequency   TEXT NOT NULL DEFAULT 'daily',
		rotate_count INTEGER NOT NULL DEFAULT 7,
		max_size    TEXT NOT NULL DEFAULT '100M',
		compress    INTEGER NOT NULL DEFAULT 1,
		create_mode TEXT NOT NULL DEFAULT '0644',
		post_rotate TEXT NOT NULL DEFAULT '',
		enabled     INTEGER NOT NULL DEFAULT 1,
		created_at  TEXT NOT NULL,
		updated_at  TEXT NOT NULL
	)`)
}

// GetConfigs returns all logrotate configurations.
func GetConfigs() []LogRotateConfig {
	db := database.GetDB()
	rows, err := db.Query(`SELECT id, name, log_paths, frequency, rotate_count, max_size, compress, create_mode, post_rotate, enabled, created_at, updated_at FROM logrotate_configs ORDER BY id DESC`)
	if err != nil {
		return []LogRotateConfig{}
	}
	defer rows.Close()

	configs := make([]LogRotateConfig, 0)
	for rows.Next() {
		var c LogRotateConfig
		var compressInt int
		var enabledInt int
		if err := rows.Scan(&c.ID, &c.Name, &c.LogPaths, &c.Frequency, &c.RotateCount, &c.MaxSize, &compressInt, &c.CreateMode, &c.PostRotate, &enabledInt, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		c.Compress = compressInt == 1
		c.Enabled = enabledInt == 1
		configs = append(configs, c)
	}
	return configs
}

// GetConfig returns a single logrotate configuration by ID.
func GetConfig(id int64) (*LogRotateConfig, error) {
	db := database.GetDB()
	var c LogRotateConfig
	var compressInt int
	var enabledInt int
	err := db.QueryRow(`SELECT id, name, log_paths, frequency, rotate_count, max_size, compress, create_mode, post_rotate, enabled, created_at, updated_at FROM logrotate_configs WHERE id = ?`, id).
		Scan(&c.ID, &c.Name, &c.LogPaths, &c.Frequency, &c.RotateCount, &c.MaxSize, &compressInt, &c.CreateMode, &c.PostRotate, &enabledInt, &c.CreatedAt, &c.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("config not found")
	}
	c.Compress = compressInt == 1
	c.Enabled = enabledInt == 1
	return &c, nil
}

// CreateConfig inserts a new logrotate configuration.
func CreateConfig(req CreateConfigRequest) (*LogRotateConfig, error) {
	if err := validateName(req.Name); err != nil {
		return nil, err
	}
	if err := validatePaths(req.LogPaths); err != nil {
		return nil, err
	}
	if err := validateCreateMode(req.CreateMode); err != nil {
		return nil, err
	}
	if err := validatePostRotate(req.PostRotate); err != nil {
		return nil, err
	}

	freq := req.Frequency
	if freq == "" {
		freq = "daily"
	}
	if freq != "daily" && freq != "weekly" && freq != "monthly" {
		return nil, fmt.Errorf("frequency must be daily, weekly, or monthly")
	}

	rotateCount := req.RotateCount
	if rotateCount <= 0 {
		rotateCount = 7
	}

	maxSize := req.MaxSize
	if maxSize == "" {
		maxSize = "100M"
	}

	createMode := req.CreateMode
	if createMode == "" {
		createMode = "0644"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	db := database.GetDB()
	result, err := db.Exec(`INSERT INTO logrotate_configs (name, log_paths, frequency, rotate_count, max_size, compress, create_mode, post_rotate, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
		req.Name, req.LogPaths, freq, rotateCount, maxSize, boolToInt(req.Compress), createMode, req.PostRotate, now, now)
	if err != nil {
		return nil, fmt.Errorf("failed to create config: %v", err)
	}

	id, _ := result.LastInsertId()
	return GetConfig(id)
}

// UpdateConfig updates an existing logrotate configuration.
func UpdateConfig(id int64, req CreateConfigRequest) (*LogRotateConfig, error) {
	if err := validatePaths(req.LogPaths); err != nil {
		return nil, err
	}
	if err := validateCreateMode(req.CreateMode); err != nil {
		return nil, err
	}
	if err := validatePostRotate(req.PostRotate); err != nil {
		return nil, err
	}

	freq := req.Frequency
	if freq == "" {
		freq = "daily"
	}
	if freq != "daily" && freq != "weekly" && freq != "monthly" {
		return nil, fmt.Errorf("frequency must be daily, weekly, or monthly")
	}

	rotateCount := req.RotateCount
	if rotateCount <= 0 {
		rotateCount = 7
	}

	maxSize := req.MaxSize
	if maxSize == "" {
		maxSize = "100M"
	}

	createMode := req.CreateMode
	if createMode == "" {
		createMode = "0644"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	db := database.GetDB()
	_, err := db.Exec(`UPDATE logrotate_configs SET name = ?, log_paths = ?, frequency = ?, rotate_count = ?, max_size = ?, compress = ?, create_mode = ?, post_rotate = ?, updated_at = ? WHERE id = ?`,
		req.Name, req.LogPaths, freq, rotateCount, maxSize, boolToInt(req.Compress), createMode, req.PostRotate, now, id)
	if err != nil {
		return nil, fmt.Errorf("failed to update config: %v", err)
	}

	return GetConfig(id)
}

// DeleteConfig removes a logrotate configuration and its file if present.
func DeleteConfig(id int64) error {
	cfg, err := GetConfig(id)
	if err != nil {
		return err
	}

	// Remove config file if it exists
	configPath := filepath.Join(configDir, "nowenos-"+cfg.Name)
	os.Remove(configPath)

	db := database.GetDB()
	_, err = db.Exec(`DELETE FROM logrotate_configs WHERE id = ?`, id)
	return err
}

// ToggleConfig enables or disables a logrotate configuration.
func ToggleConfig(id int64, enabled bool) error {
	db := database.GetDB()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(`UPDATE logrotate_configs SET enabled = ?, updated_at = ? WHERE id = ?`, boolToInt(enabled), now, id)
	return err
}

// ApplyConfig generates a logrotate config file and writes it to /etc/logrotate.d/.
func ApplyConfig(id int64) error {
	cfg, err := GetConfig(id)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %v", err)
	}

	content := generateConfigContent(cfg)
	configPath := filepath.Join(configDir, "nowenos-"+cfg.Name)
	tmpPath := configPath + ".tmp"

	// Atomic write: write to temp file first, then rename
	if err := os.WriteFile(tmpPath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write config file: %v", err)
	}
	if err := os.Rename(tmpPath, configPath); err != nil {
		os.Remove(tmpPath) // cleanup temp file on failure
		return fmt.Errorf("failed to rename config file: %v", err)
	}

	return nil
}

// ApplyAllConfigs regenerates config files for all enabled configurations.
func ApplyAllConfigs() error {
	configs := GetConfigs()
	var errs []string
	for _, cfg := range configs {
		if !cfg.Enabled {
			// Remove config file for disabled configs
			configPath := filepath.Join(configDir, "nowenos-"+cfg.Name)
			os.Remove(configPath)
			continue
		}
		if err := ApplyConfig(cfg.ID); err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", cfg.Name, err))
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("errors: %s", strings.Join(errs, "; "))
	}
	return nil
}

// TestRotation runs logrotate in debug/dry-run mode for a specific config.
func TestRotation(id int64) (*TestResult, error) {
	cfg, err := GetConfig(id)
	if err != nil {
		return nil, err
	}

	configPath := filepath.Join(configDir, "nowenos-"+cfg.Name)

	// First, write the config so logrotate can read it
	if err := ApplyConfig(id); err != nil {
		return nil, fmt.Errorf("failed to write config for test: %v", err)
	}

	cmd := exec.Command("logrotate", "-d", configPath)
	output, err := cmd.CombinedOutput()
	if err != nil {
		// logrotate -d returns exit 0 on success, non-zero on config errors.
		// We still return the output for diagnostic purposes.
		return &TestResult{Output: string(output)}, fmt.Errorf("logrotate test failed: %v\n%s", err, string(output))
	}

	return &TestResult{Output: string(output)}, nil
}

// GetRotationLogs reads the logrotate status file to show last rotation info.
func GetRotationLogs() (string, error) {
	statusFile := "/var/lib/logrotate/status"
	data, err := os.ReadFile(statusFile)
	if err != nil {
		return "No logrotate status file found. Logrotate may not have run yet.", nil
	}
	return string(data), nil
}

// generateConfigContent builds a logrotate config string from a LogRotateConfig.
func generateConfigContent(cfg *LogRotateConfig) string {
	var b strings.Builder

	// Log paths
	paths := strings.Split(cfg.LogPaths, ",")
	for i, p := range paths {
		paths[i] = strings.TrimSpace(p)
	}
	b.WriteString(strings.Join(paths, " "))
	b.WriteString(" {\n")

	// Frequency
	b.WriteString("    " + cfg.Frequency + "\n")

	// Rotate count
	b.WriteString(fmt.Sprintf("    rotate %d\n", cfg.RotateCount))

	// Max size
	if cfg.MaxSize != "" {
		b.WriteString(fmt.Sprintf("    size %s\n", cfg.MaxSize))
	}

	// Compress
	if cfg.Compress {
		b.WriteString("    compress\n")
		b.WriteString("    delaycompress\n")
	}

	// Create mode
	if cfg.CreateMode != "" {
		b.WriteString(fmt.Sprintf("    create %s root root\n", cfg.CreateMode))
	}

	// Missing ok - don't error if log file doesn't exist
	b.WriteString("    missingok\n")

	// Not if empty
	b.WriteString("    notifempty\n")

	// Post rotate script
	if cfg.PostRotate != "" {
		b.WriteString("    postrotate\n")
		b.WriteString("        " + cfg.PostRotate + "\n")
		b.WriteString("    endscript\n")
	}

	b.WriteString("}\n")
	return b.String()
}

// validateName checks that the config name is safe for use as a filename.
func validateName(name string) error {
	if name == "" {
		return fmt.Errorf("name is required")
	}
	if !validNameRe.MatchString(name) {
		return fmt.Errorf("name must contain only alphanumeric characters, hyphens, and underscores, starting with alphanumeric")
	}
	return nil
}

// validatePaths checks that log paths are non-empty, absolute, and don't contain path traversal.
func validatePaths(paths string) error {
	if strings.TrimSpace(paths) == "" {
		return fmt.Errorf("log paths are required")
	}
	parts := strings.Split(paths, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		if !filepath.IsAbs(p) {
			return fmt.Errorf("log path must be absolute: %s", p)
		}
		cleaned := filepath.Clean(p)
		if strings.Contains(cleaned, "..") {
			return fmt.Errorf("log path must not contain '..': %s", p)
		}
	}
	return nil
}

// validateCreateMode checks that create mode is a valid octal string.
func validateCreateMode(mode string) error {
	if mode == "" {
		return nil
	}
	matched, _ := regexp.MatchString(`^0[0-7]{3}$`, mode)
	if !matched {
		return fmt.Errorf("create mode must be a 4-digit octal string like 0644, got: %s", mode)
	}
	return nil
}

// validatePostRotate checks that postRotate command is safe (single line, reasonable length).
func validatePostRotate(cmd string) error {
	if cmd == "" {
		return nil
	}
	if len(cmd) > 500 {
		return fmt.Errorf("postRotate command too long (max 500 chars)")
	}
	if strings.Contains(cmd, "\n") || strings.Contains(cmd, "\r") {
		return fmt.Errorf("postRotate command must be a single line")
	}

	// Block dangerous commands to prevent injection
	blockedCommands := []string{"rm ", "mkfs", "dd ", "fdisk", "parted", "wipefs", "chmod 777", "curl ", "wget ", "nc "}
	lower := strings.ToLower(cmd)
	for _, blocked := range blockedCommands {
		if strings.Contains(lower, blocked) {
			return fmt.Errorf("postRotate contains blocked command: %s", blocked)
		}
	}

	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
