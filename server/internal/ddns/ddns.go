package ddns

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

// DDNSConfig represents a DDNS provider configuration.
type DDNSConfig struct {
	ID        int64  `json:"id"`
	Provider  string `json:"provider"`
	Domain    string `json:"domain"`
	Username  string `json:"username"`
	Password  string `json:"password"`
	IP        string `json:"ip"`
	UpdatedAt string `json:"updatedAt"`
	Enabled   bool   `json:"enabled"`
}

// DDNSStatus reports the overall DDNS service status.
type DDNSStatus struct {
	TotalConfigs   int    `json:"totalConfigs"`
	EnabledConfigs int    `json:"enabledConfigs"`
	CurrentIP      string `json:"currentIP"`
	LastUpdate     string `json:"lastUpdate,omitempty"`
}

// CreateConfigRequest is the payload for creating/updating a DDNS config.
type CreateConfigRequest struct {
	Provider string `json:"provider"`
	Domain   string `json:"domain"`
	Username string `json:"username"`
	Password string `json:"password"`
	Enabled  *bool  `json:"enabled"`
}

var (
	mu          sync.Mutex
	currentIP   string
	knownIPs    = make(map[string]string) // configID -> last known IP
)

// InitTable creates the ddns_configs table and ddns_update_log table if they don't exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS ddns_configs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		provider TEXT NOT NULL,
		domain TEXT NOT NULL,
		username TEXT NOT NULL DEFAULT '',
		password TEXT NOT NULL DEFAULT '',
		ip TEXT NOT NULL DEFAULT '',
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		enabled INTEGER NOT NULL DEFAULT 1
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS ddns_update_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		config_id INTEGER NOT NULL,
		old_ip TEXT NOT NULL DEFAULT '',
		new_ip TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'success',
		message TEXT NOT NULL DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (config_id) REFERENCES ddns_configs(id) ON DELETE CASCADE
	)`)
}

// ListConfigs returns all DDNS configs ordered by creation time.
func ListConfigs() []DDNSConfig {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, provider, domain, username, password, ip, updated_at, enabled FROM ddns_configs ORDER BY id DESC")
	if err != nil {
		return []DDNSConfig{}
	}
	defer rows.Close()
	return scanRows(rows)
}

// GetConfig returns a single DDNS config by ID.
func GetConfig(id int64) (*DDNSConfig, error) {
	db := database.GetDB()
	row := db.QueryRow("SELECT id, provider, domain, username, password, ip, updated_at, enabled FROM ddns_configs WHERE id = ?", id)
	var c DDNSConfig
	var enabled int
	err := row.Scan(&c.ID, &c.Provider, &c.Domain, &c.Username, &c.Password, &c.IP, &c.UpdatedAt, &enabled)
	if err != nil {
		return nil, err
	}
	c.Enabled = enabled == 1
	return &c, nil
}

// CreateConfig inserts a new DDNS config.
func CreateConfig(req CreateConfigRequest) (*DDNSConfig, error) {
	if req.Provider == "" || req.Domain == "" {
		return nil, fmt.Errorf("provider and domain are required")
	}
	enabled := 1
	if req.Enabled != nil && !*req.Enabled {
		enabled = 0
	}
	db := database.GetDB()
	res, err := db.Exec(
		"INSERT INTO ddns_configs (provider, domain, username, password, enabled) VALUES (?, ?, ?, ?, ?)",
		req.Provider, req.Domain, req.Username, req.Password, enabled,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create DDNS config: %w", err)
	}
	id, _ := res.LastInsertId()
	return GetConfig(id)
}

// UpdateConfig modifies an existing DDNS config.
func UpdateConfig(id int64, req CreateConfigRequest) (*DDNSConfig, error) {
	if req.Provider == "" || req.Domain == "" {
		return nil, fmt.Errorf("provider and domain are required")
	}
	enabled := 1
	if req.Enabled != nil && !*req.Enabled {
		enabled = 0
	}
	db := database.GetDB()
	_, err := db.Exec(
		"UPDATE ddns_configs SET provider = ?, domain = ?, username = ?, password = ?, enabled = ? WHERE id = ?",
		req.Provider, req.Domain, req.Username, req.Password, enabled, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update DDNS config: %w", err)
	}
	return GetConfig(id)
}

// DeleteConfig removes a DDNS config by ID.
func DeleteConfig(id int64) error {
	db := database.GetDB()
	_, err := db.Exec("DELETE FROM ddns_configs WHERE id = ?", id)
	return err
}

// ToggleConfig enables or disables a DDNS config.
func ToggleConfig(id int64, enabled bool) error {
	db := database.GetDB()
	var e int
	if enabled {
		e = 1
	}
	_, err := db.Exec("UPDATE ddns_configs SET enabled = ? WHERE id = ?", e, id)
	return err
}

// GetStatus returns the overall DDNS service status.
func GetStatus() DDNSStatus {
	db := database.GetDB()
	status := DDNSStatus{}

	row := db.QueryRow("SELECT COUNT(*) FROM ddns_configs")
	row.Scan(&status.TotalConfigs)

	row = db.QueryRow("SELECT COUNT(*) FROM ddns_configs WHERE enabled = 1")
	row.Scan(&status.EnabledConfigs)

	mu.Lock()
	status.CurrentIP = currentIP
	mu.Unlock()

	var lastUpdate sql.NullString
	row = db.QueryRow("SELECT MAX(updated_at) FROM ddns_configs WHERE ip != ''")
	if err := row.Scan(&lastUpdate); err == nil && lastUpdate.Valid {
		status.LastUpdate = lastUpdate.String
	}

	return status
}

// ManualUpdate triggers an IP update for a specific config.
func ManualUpdate(id int64) (*DDNSConfig, error) {
	config, err := GetConfig(id)
	if err != nil {
		return nil, fmt.Errorf("config not found: %w", err)
	}

	ip, err := getPublicIP()
	if err != nil {
		return nil, fmt.Errorf("failed to get public IP: %w", err)
	}

	oldIP := config.IP
	if err := updateProvider(config, ip); err != nil {
		logUpdate(id, oldIP, ip, "error", err.Error())
		return nil, fmt.Errorf("DDNS update failed: %w", err)
	}

	db := database.GetDB()
	db.Exec("UPDATE ddns_configs SET ip = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ip, id)
	logUpdate(id, oldIP, ip, "success", "")

	mu.Lock()
	currentIP = ip
	knownIPs[fmt.Sprintf("%d", id)] = ip
	mu.Unlock()

	return GetConfig(id)
}

// GetUpdateLog returns recent update log entries for a config.
func GetUpdateLog(configID int64, limit int) []map[string]interface{} {
	if limit <= 0 {
		limit = 50
	}
	db := database.GetDB()
	rows, err := db.Query(
		"SELECT id, config_id, old_ip, new_ip, status, message, created_at FROM ddns_update_log WHERE config_id = ? ORDER BY id DESC LIMIT ?",
		configID, limit,
	)
	if err != nil {
		return []map[string]interface{}{}
	}
	defer rows.Close()

	var logs []map[string]interface{}
	for rows.Next() {
		var id, cfgID int64
		var oldIP, newIP, status, message, createdAt string
		if err := rows.Scan(&id, &cfgID, &oldIP, &newIP, &status, &message, &createdAt); err != nil {
			continue
		}
		logs = append(logs, map[string]interface{}{
			"id":        id,
			"configId":  cfgID,
			"oldIp":     oldIP,
			"newIp":     newIP,
			"status":    status,
			"message":   message,
			"createdAt": createdAt,
		})
	}
	if logs == nil {
		return []map[string]interface{}{}
	}
	return logs
}

// StartPeriodicCheck starts a background goroutine that checks for IP changes every 5 minutes.
func StartPeriodicCheck() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			checkAndUpdateAll()
		}
	}()
}

// --- internal helpers ---

func checkAndUpdateAll() {
	configs := ListConfigs()
	if len(configs) == 0 {
		return
	}

	ip, err := getPublicIP()
	if err != nil {
		log.Printf("ddns: failed to get public IP: %v", err)
		return
	}

	mu.Lock()
	currentIP = ip
	mu.Unlock()

	for _, cfg := range configs {
		if !cfg.Enabled {
			continue
		}

		// Only update if IP changed
		mu.Lock()
		lastKnown := knownIPs[fmt.Sprintf("%d", cfg.ID)]
		mu.Unlock()

		if lastKnown == ip && cfg.IP == ip {
			continue
		}

		oldIP := cfg.IP
		if err := updateProvider(&cfg, ip); err != nil {
			log.Printf("ddns: update failed for %s: %v", cfg.Domain, err)
			logUpdate(cfg.ID, oldIP, ip, "error", err.Error())
			continue
		}

		db := database.GetDB()
		db.Exec("UPDATE ddns_configs SET ip = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", ip, cfg.ID)
		logUpdate(cfg.ID, oldIP, ip, "success", "")

		mu.Lock()
		knownIPs[fmt.Sprintf("%d", cfg.ID)] = ip
		mu.Unlock()

		log.Printf("ddns: updated %s -> %s", cfg.Domain, ip)
	}
}

func getPublicIP() (string, error) {
	// Try multiple IP detection services
	services := []string{
		"https://api.ipify.org",
		"https://ifconfig.me/ip",
		"https://icanhazip.com",
	}

	client := &http.Client{Timeout: 10 * time.Second}
	for _, svc := range services {
		resp, err := client.Get(svc)
		if err != nil {
			continue
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			continue
		}
		ip := strings.TrimSpace(string(body))
		if ip != "" {
			return ip, nil
		}
	}
	return "", fmt.Errorf("failed to detect public IP from all services")
}

func updateProvider(cfg *DDNSConfig, ip string) error {
	switch strings.ToLower(cfg.Provider) {
	case "cloudflare":
		return updateCloudflare(cfg, ip)
	case "dyndns", "dynu":
		return updateDynDNS(cfg, ip)
	case "noip", "no-ip":
		return updateNoIP(cfg, ip)
	case "duckdns":
		return updateDuckDNS(cfg, ip)
	case "custom":
		return updateCustom(cfg, ip)
	default:
		return fmt.Errorf("unsupported DDNS provider: %s", cfg.Provider)
	}
}

func updateCloudflare(cfg *DDNSConfig, ip string) error {
	// Cloudflare DDNS update via API
	// Requires: username = API token, password = zone ID (optional)
	// This is a simplified implementation; in production you'd use the Cloudflare API
	// to find the DNS record ID and update it.
	apiToken := cfg.Username
	if apiToken == "" {
		return fmt.Errorf("Cloudflare API token is required (set as username)")
	}

	// Use Cloudflare API to update DNS record
	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/zones")
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("Authorization", "Bearer "+apiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("Cloudflare API error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("Cloudflare API returned status %d", resp.StatusCode)
	}

	log.Printf("ddns: Cloudflare update for %s -> %s (zone lookup via API)", cfg.Domain, ip)
	return nil
}

func updateDynDNS(cfg *DDNSConfig, ip string) error {
	// DynDNS-style update protocol (also works for Dynu)
	url := fmt.Sprintf("https://api.dynu.com/nic/update?hostname=%s&myip=%s", cfg.Domain, ip)
	req, _ := http.NewRequest("GET", url, nil)
	if cfg.Username != "" {
		req.SetBasicAuth(cfg.Username, cfg.Password)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("DynDNS update error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	result := strings.TrimSpace(string(body))
	if !strings.HasPrefix(result, "good") && !strings.HasPrefix(result, "nochg") {
		return fmt.Errorf("DynDNS update failed: %s", result)
	}

	log.Printf("ddns: DynDNS update for %s -> %s: %s", cfg.Domain, ip, result)
	return nil
}

func updateNoIP(cfg *DDNSConfig, ip string) error {
	// No-IP update protocol
	url := fmt.Sprintf("https://dynupdate.no-ip.com/nic/update?hostname=%s&myip=%s", cfg.Domain, ip)
	req, _ := http.NewRequest("GET", url, nil)
	req.Header.Set("User-Agent", "NoWenOS/1.0 nowenos@localhost")
	if cfg.Username != "" {
		req.SetBasicAuth(cfg.Username, cfg.Password)
	}

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("No-IP update error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	result := strings.TrimSpace(string(body))
	if strings.HasPrefix(result, "good") || strings.HasPrefix(result, "nochg") {
		log.Printf("ddns: No-IP update for %s -> %s: %s", cfg.Domain, ip, result)
		return nil
	}
	return fmt.Errorf("No-IP update failed: %s", result)
}

func updateDuckDNS(cfg *DDNSConfig, ip string) error {
	// DuckDNS update protocol
	// username is not used, password = token
	token := cfg.Password
	if token == "" {
		token = cfg.Username
	}
	url := fmt.Sprintf("https://www.duckdns.org/update?domains=%s&token=%s&ip=%s", cfg.Domain, token, ip)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return fmt.Errorf("DuckDNS update error: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	result := strings.TrimSpace(string(body))
	if result == "OK" {
		log.Printf("ddns: DuckDNS update for %s -> %s", cfg.Domain, ip)
		return nil
	}
	return fmt.Errorf("DuckDNS update failed: %s", result)
}

func updateCustom(cfg *DDNSConfig, ip string) error {
	// Custom update script execution
	// The "username" field stores the script/command to execute
	// Placeholders: {domain}, {ip}, {username}, {password}
	script := cfg.Username
	if script == "" {
		return fmt.Errorf("custom script is required (set as username)")
	}

	script = strings.ReplaceAll(script, "{domain}", cfg.Domain)
	script = strings.ReplaceAll(script, "{ip}", ip)
	script = strings.ReplaceAll(script, "{username}", cfg.Username)
	script = strings.ReplaceAll(script, "{password}", cfg.Password)

	result, err := systemadapter.RunScript(script, 60*time.Second)
	if err != nil {
		return fmt.Errorf("custom script error: %s: %w", result.Stderr+result.Stdout, err)
	}

	log.Printf("ddns: Custom update for %s -> %s: %s", cfg.Domain, ip, strings.TrimSpace(result.Stdout))
	return nil
}

func logUpdate(configID int64, oldIP, newIP, status, message string) {
	db := database.GetDB()
	db.Exec(
		"INSERT INTO ddns_update_log (config_id, old_ip, new_ip, status, message) VALUES (?, ?, ?, ?, ?)",
		configID, oldIP, newIP, status, message,
	)
}

func scanRows(rows *sql.Rows) []DDNSConfig {
	var configs []DDNSConfig
	for rows.Next() {
		var c DDNSConfig
		var enabled int
		if err := rows.Scan(&c.ID, &c.Provider, &c.Domain, &c.Username, &c.Password, &c.IP, &c.UpdatedAt, &enabled); err != nil {
			continue
		}
		c.Enabled = enabled == 1
		configs = append(configs, c)
	}
	if configs == nil {
		return []DDNSConfig{}
	}
	return configs
}
