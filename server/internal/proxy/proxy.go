package proxy

import (
	"database/sql"
	"fmt"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

// ProxyRule represents a reverse proxy routing rule.
type ProxyRule struct {
	ID        int64  `json:"id"`
	Domain    string `json:"domain"`
	Target    string `json:"target"`
	Protocol  string `json:"protocol"`
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"createdAt"`
}

// ProxyStatus reports whether the reverse proxy service (Caddy) is available.
type ProxyStatus struct {
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	Version   string `json:"version,omitempty"`
}

// InitTable creates the proxy_rules table if it doesn't exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS proxy_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		domain TEXT NOT NULL,
		target TEXT NOT NULL,
		protocol TEXT NOT NULL DEFAULT 'http',
		enabled INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_proxy_rules_domain ON proxy_rules(domain)")
}

// ListRules returns all proxy rules ordered by creation time.
func ListRules() []ProxyRule {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, domain, target, protocol, enabled, created_at FROM proxy_rules ORDER BY created_at DESC")
	if err != nil {
		return []ProxyRule{}
	}
	defer rows.Close()
	return scanRows(rows)
}

// CreateRule inserts a new proxy rule.
func CreateRule(domain, target, protocol string) (*ProxyRule, error) {
	if protocol == "" {
		protocol = "http"
	}
	db := database.GetDB()
	res, err := db.Exec(
		"INSERT INTO proxy_rules (domain, target, protocol) VALUES (?, ?, ?)",
		domain, target, protocol,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create proxy rule: %w", err)
	}
	id, _ := res.LastInsertId()
	return getRuleByID(id)
}

// UpdateRule modifies an existing proxy rule.
func UpdateRule(id int64, domain, target, protocol string) (*ProxyRule, error) {
	db := database.GetDB()
	_, err := db.Exec(
		"UPDATE proxy_rules SET domain = ?, target = ?, protocol = ? WHERE id = ?",
		domain, target, protocol, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update proxy rule: %w", err)
	}
	return getRuleByID(id)
}

// DeleteRule removes a proxy rule by ID.
func DeleteRule(id int64) error {
	db := database.GetDB()
	_, err := db.Exec("DELETE FROM proxy_rules WHERE id = ?", id)
	return err
}

// ToggleRule enables or disables a proxy rule.
func ToggleRule(id int64, enabled bool) error {
	db := database.GetDB()
	var e int
	if enabled {
		e = 1
	}
	_, err := db.Exec("UPDATE proxy_rules SET enabled = ? WHERE id = ?", e, id)
	return err
}

// GetStatus checks if Caddy is installed and running.
func GetStatus() ProxyStatus {
	status := ProxyStatus{}

	version, err := systemadapter.GetCaddyVersion()
	if err == nil {
		status.Installed = true
		status.Version = version
		status.Running = systemadapter.IsCaddyRunning()
	}

	return status
}

// GenerateCaddyfile produces a Caddyfile from the enabled rules.
func GenerateCaddyfile() (string, error) {
	rules := ListRules()
	if len(rules) == 0 {
		return "# No proxy rules configured\n", nil
	}

	var caddyfile string
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		upstream := rule.Target
		if rule.Protocol == "https" {
			upstream = "https://" + rule.Target
		} else {
			upstream = "http://" + rule.Target
		}
		caddyfile += fmt.Sprintf("%s {\n\treverse_proxy %s\n}\n\n", rule.Domain, upstream)
	}

	if caddyfile == "" {
		caddyfile = "# No enabled proxy rules\n"
	}

	return caddyfile, nil
}

// ReloadCaddy generates and applies a new Caddy config.
func ReloadCaddy() error {
	caddyfile, err := GenerateCaddyfile()
	if err != nil {
		return err
	}
	// Write to Caddyfile using os.WriteFile (eliminates shell injection vector)
	if err := systemadapter.WriteCaddyfile(caddyfile); err != nil {
		return fmt.Errorf("failed to write Caddyfile: %w", err)
	}
	// Reload Caddy
	if err := systemadapter.ReloadCaddy(); err != nil {
		return fmt.Errorf("failed to reload Caddy: %w", err)
	}
	return nil
}

// GetCaddyConfig returns the current generated Caddyfile contents.
func GetCaddyConfig() (string, error) {
	return GenerateCaddyfile()
}

// --- helpers ---

func getRuleByID(id int64) (*ProxyRule, error) {
	db := database.GetDB()
	row := db.QueryRow("SELECT id, domain, target, protocol, enabled, created_at FROM proxy_rules WHERE id = ?", id)
	var r ProxyRule
	var enabled int
	err := row.Scan(&r.ID, &r.Domain, &r.Target, &r.Protocol, &enabled, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	r.Enabled = enabled == 1
	return &r, nil
}

func scanRows(rows *sql.Rows) []ProxyRule {
	var rules []ProxyRule
	for rows.Next() {
		var r ProxyRule
		var enabled int
		if err := rows.Scan(&r.ID, &r.Domain, &r.Target, &r.Protocol, &enabled, &r.CreatedAt); err != nil {
			continue
		}
		r.Enabled = enabled == 1
		rules = append(rules, r)
	}
	if rules == nil {
		return []ProxyRule{}
	}
	return rules
}
