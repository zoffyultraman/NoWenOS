package firewall

import (
	"database/sql"
	"fmt"
	"strings"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

// FirewallRule represents a single firewall rule.
type FirewallRule struct {
	ID          int64  `json:"id"`
	Name        string `json:"name"`
	Chain       string `json:"chain"`
	Protocol    string `json:"protocol"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Port        string `json:"port"`
	Action      string `json:"action"`
	Enabled     bool   `json:"enabled"`
	Position    int    `json:"position"`
	CreatedAt   string `json:"createdAt"`
}

// FirewallStatus reports which firewall backend is available.
type FirewallStatus struct {
	Backend   string `json:"backend"`   // "iptables", "nftables", or "none"
	Installed bool   `json:"installed"`
	Running   bool   `json:"running"`
	Version   string `json:"version,omitempty"`
	RuleCount int    `json:"ruleCount"`
}

// CreateRuleRequest is the payload for creating/updating a firewall rule.
type CreateRuleRequest struct {
	Name        string `json:"name"`
	Chain       string `json:"chain"`
	Protocol    string `json:"protocol"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Port        string `json:"port"`
	Action      string `json:"action"`
}

// PresetTemplate is a pre-defined rule template.
type PresetTemplate struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Chain       string `json:"chain"`
	Protocol    string `json:"protocol"`
	Port        string `json:"port"`
	Action      string `json:"action"`
}

// GetPresetTemplates returns built-in rule templates.
func GetPresetTemplates() []PresetTemplate {
	return []PresetTemplate{
		{ID: "ssh", Name: "Allow SSH", Description: "Allow incoming SSH connections on port 22", Chain: "INPUT", Protocol: "tcp", Port: "22", Action: "ACCEPT"},
		{ID: "http", Name: "Allow HTTP", Description: "Allow incoming HTTP traffic on port 80", Chain: "INPUT", Protocol: "tcp", Port: "80", Action: "ACCEPT"},
		{ID: "https", Name: "Allow HTTPS", Description: "Allow incoming HTTPS traffic on port 443", Chain: "INPUT", Protocol: "tcp", Port: "443", Action: "ACCEPT"},
		{ID: "dns", Name: "Allow DNS", Description: "Allow DNS queries on port 53 (TCP & UDP)", Chain: "INPUT", Protocol: "tcp", Port: "53", Action: "ACCEPT"},
		{ID: "ping", Name: "Allow ICMP/Ping", Description: "Allow incoming ICMP echo requests", Chain: "INPUT", Protocol: "icmp", Port: "", Action: "ACCEPT"},
		{ID: "ftp", Name: "Allow FTP", Description: "Allow FTP data and control on ports 20-21", Chain: "INPUT", Protocol: "tcp", Port: "20:21", Action: "ACCEPT"},
		{ID: "smtp", Name: "Allow SMTP", Description: "Allow SMTP mail on port 25", Chain: "INPUT", Protocol: "tcp", Port: "25", Action: "ACCEPT"},
		{ID: "mysql", Name: "Allow MySQL", Description: "Allow MySQL connections on port 3306", Chain: "INPUT", Protocol: "tcp", Port: "3306", Action: "ACCEPT"},
		{ID: "postgres", Name: "Allow PostgreSQL", Description: "Allow PostgreSQL connections on port 5432", Chain: "INPUT", Protocol: "tcp", Port: "5432", Action: "ACCEPT"},
		{ID: "rdp", Name: "Allow RDP", Description: "Allow Remote Desktop on port 3389", Chain: "INPUT", Protocol: "tcp", Port: "3389", Action: "ACCEPT"},
		{ID: "samba", Name: "Allow Samba/SMB", Description: "Allow Samba file sharing on ports 139,445", Chain: "INPUT", Protocol: "tcp", Port: "139,445", Action: "ACCEPT"},
		{ID: "docker", Name: "Allow Docker API", Description: "Allow Docker API on port 2376 (TCP)", Chain: "INPUT", Protocol: "tcp", Port: "2376", Action: "ACCEPT"},
	}
}

// InitTable creates the firewall_rules table if it doesn't exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS firewall_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL DEFAULT '',
		chain TEXT NOT NULL DEFAULT 'INPUT',
		protocol TEXT NOT NULL DEFAULT 'tcp',
		source TEXT NOT NULL DEFAULT '',
		destination TEXT NOT NULL DEFAULT '',
		port TEXT NOT NULL DEFAULT '',
		action TEXT NOT NULL DEFAULT 'ACCEPT',
		enabled INTEGER NOT NULL DEFAULT 1,
		position INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
}

// ListRules returns all firewall rules ordered by position then creation time.
func ListRules() []FirewallRule {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, name, chain, protocol, source, destination, port, action, enabled, position, created_at FROM firewall_rules ORDER BY position ASC, created_at DESC")
	if err != nil {
		return []FirewallRule{}
	}
	defer rows.Close()
	return scanRows(rows)
}

// CreateRule inserts a new firewall rule.
func CreateRule(req CreateRuleRequest) (*FirewallRule, error) {
	if req.Chain == "" {
		req.Chain = "INPUT"
	}
	if req.Protocol == "" {
		req.Protocol = "tcp"
	}
	if req.Action == "" {
		req.Action = "ACCEPT"
	}
	db := database.GetDB()

	// Get next position
	var maxPos int
	db.QueryRow("SELECT COALESCE(MAX(position), 0) FROM firewall_rules").Scan(&maxPos)

	res, err := db.Exec(
		"INSERT INTO firewall_rules (name, chain, protocol, source, destination, port, action, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		req.Name, req.Chain, req.Protocol, req.Source, req.Destination, req.Port, req.Action, maxPos+1,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create firewall rule: %w", err)
	}
	id, _ := res.LastInsertId()
	return getRuleByID(id)
}

// UpdateRule modifies an existing firewall rule.
func UpdateRule(id int64, req CreateRuleRequest) (*FirewallRule, error) {
	db := database.GetDB()
	_, err := db.Exec(
		"UPDATE firewall_rules SET name = ?, chain = ?, protocol = ?, source = ?, destination = ?, port = ?, action = ? WHERE id = ?",
		req.Name, req.Chain, req.Protocol, req.Source, req.Destination, req.Port, req.Action, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update firewall rule: %w", err)
	}
	return getRuleByID(id)
}

// DeleteRule removes a firewall rule by ID.
func DeleteRule(id int64) error {
	db := database.GetDB()
	_, err := db.Exec("DELETE FROM firewall_rules WHERE id = ?", id)
	return err
}

// ToggleRule enables or disables a firewall rule.
func ToggleRule(id int64, enabled bool) error {
	db := database.GetDB()
	var e int
	if enabled {
		e = 1
	}
	_, err := db.Exec("UPDATE firewall_rules SET enabled = ? WHERE id = ?", e, id)
	return err
}

// ReorderRules updates positions for a batch of rules.
func ReorderRules(order []int64) error {
	db := database.GetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for i, id := range order {
		if _, err := tx.Exec("UPDATE firewall_rules SET position = ? WHERE id = ?", i, id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// BatchToggle enables or disables multiple rules at once.
func BatchToggle(ids []int64, enabled bool) error {
	db := database.GetDB()
	var e int
	if enabled {
		e = 1
	}
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := tx.Exec("UPDATE firewall_rules SET enabled = ? WHERE id = ?", e, id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// BatchDelete removes multiple rules at once.
func BatchDelete(ids []int64) error {
	db := database.GetDB()
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	for _, id := range ids {
		if _, err := tx.Exec("DELETE FROM firewall_rules WHERE id = ?", id); err != nil {
			tx.Rollback()
			return err
		}
	}
	return tx.Commit()
}

// GetStatus detects which firewall backend is available.
func GetStatus() FirewallStatus {
	status := FirewallStatus{Backend: "none"}

	backend, err := systemadapter.DetectFirewallBackend()
	if err == nil {
		status.Installed = true
		status.Backend = backend.Name
		status.Version = backend.Version
		status.Running = backend.Running
	}

	// Count enabled rules
	db := database.GetDB()
	var count int
	db.QueryRow("SELECT COUNT(*) FROM firewall_rules WHERE enabled = 1").Scan(&count)
	status.RuleCount = count

	return status
}

// ApplyRules applies all enabled rules to the system firewall.
func ApplyRules(backend string) error {
	if backend == "" {
		status := GetStatus()
		backend = status.Backend
	}

	switch backend {
	case "iptables":
		return applyIptables()
	case "nftables":
		return applyNftables()
	default:
		return fmt.Errorf("no supported firewall backend found (iptables or nftables required)")
	}
}

func applyIptables() error {
	// Flush existing rules
	if err := systemadapter.FlushIptables(); err != nil {
		return fmt.Errorf("failed to flush iptables: %w", err)
	}

	rules := ListRules()
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		args := buildIptablesArgs(rule)
		if err := systemadapter.ApplyIptablesRule(args); err != nil {
			return fmt.Errorf("failed to apply rule '%s': %w", rule.Name, err)
		}
	}
	return nil
}

func applyNftables() error {
	// Flush existing ruleset and recreate
	if err := systemadapter.FlushNftRuleset(); err != nil {
		return fmt.Errorf("failed to flush nft ruleset: %w", err)
	}

	rules := ListRules()
	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		args := buildNftArgs(rule)
		if err := systemadapter.ApplyNftRule(args); err != nil {
			return fmt.Errorf("failed to apply rule '%s': %w", rule.Name, err)
		}
	}
	return nil
}

func buildIptablesArgs(rule FirewallRule) []string {
	args := []string{"-A", rule.Chain}
	if rule.Protocol != "" && rule.Protocol != "any" {
		args = append(args, "-p", rule.Protocol)
	}
	if rule.Source != "" {
		args = append(args, "-s", rule.Source)
	}
	if rule.Destination != "" {
		args = append(args, "-d", rule.Destination)
	}
	if rule.Port != "" {
		if rule.Protocol == "tcp" || rule.Protocol == "udp" {
			args = append(args, "--dport", rule.Port)
		}
	}
	args = append(args, "-j", rule.Action)
	return args
}

// buildNftArgs returns the nft command arguments for applying a rule.
// Returns args suitable for systemadapter.ApplyNftRule (e.g., ["add", "rule", "inet", "filter", "input", ...]).
func buildNftArgs(rule FirewallRule) []string {
	chain := strings.ToLower(rule.Chain)
	// Map to nft chain names
	nftChain := "input"
	if chain == "forward" {
		nftChain = "forward"
	} else if chain == "output" {
		nftChain = "output"
	}

	args := []string{"add", "rule", "inet", "filter", nftChain}

	proto := rule.Protocol
	if proto == "any" || proto == "" {
		proto = ""
	}

	if proto != "" {
		args = append(args, proto)
	}
	if rule.Source != "" {
		args = append(args, "ip", "saddr", rule.Source)
	}
	if rule.Destination != "" {
		args = append(args, "ip", "daddr", rule.Destination)
	}
	if rule.Port != "" && (proto == "tcp" || proto == "udp") {
		args = append(args, "dport", rule.Port)
	}
	action := strings.ToLower(rule.Action)
	if action == "accept" {
		args = append(args, "accept")
	} else if action == "drop" {
		args = append(args, "drop")
	} else if action == "reject" {
		args = append(args, "reject")
	}

	return args
}

// --- helpers ---

func getRuleByID(id int64) (*FirewallRule, error) {
	db := database.GetDB()
	row := db.QueryRow("SELECT id, name, chain, protocol, source, destination, port, action, enabled, position, created_at FROM firewall_rules WHERE id = ?", id)
	var r FirewallRule
	var enabled int
	err := row.Scan(&r.ID, &r.Name, &r.Chain, &r.Protocol, &r.Source, &r.Destination, &r.Port, &r.Action, &enabled, &r.Position, &r.CreatedAt)
	if err != nil {
		return nil, err
	}
	r.Enabled = enabled == 1
	return &r, nil
}

func scanRows(rows *sql.Rows) []FirewallRule {
	var rules []FirewallRule
	for rows.Next() {
		var r FirewallRule
		var enabled int
		if err := rows.Scan(&r.ID, &r.Name, &r.Chain, &r.Protocol, &r.Source, &r.Destination, &r.Port, &r.Action, &enabled, &r.Position, &r.CreatedAt); err != nil {
			continue
		}
		r.Enabled = enabled == 1
		rules = append(rules, r)
	}
	if rules == nil {
		return []FirewallRule{}
	}
	return rules
}
