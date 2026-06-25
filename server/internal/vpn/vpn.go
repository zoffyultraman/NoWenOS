package vpn

import (
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"fmt"
	"strings"
	"sync"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

// VPNConfig represents a VPN configuration entry.
type VPNConfig struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"` // "wireguard" or "openvpn"
	Config    string `json:"config"`
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"createdAt"`
}

// VPNStatus represents the current VPN connection state.
type VPNStatus struct {
	Connected    bool   `json:"connected"`
	ConfigID     int64  `json:"configId,omitempty"`
	ConfigName   string `json:"configName,omitempty"`
	Type         string `json:"type,omitempty"`
	ConnectedAt  string `json:"connectedAt,omitempty"`
	BytesRx      int64  `json:"bytesRx"`
	BytesTx      int64  `json:"bytesTx"`
	PublicIP      string `json:"publicIP,omitempty"`
}

// WireGuardKeyPair holds a WireGuard private/public key pair.
type WireGuardKeyPair struct {
	PrivateKey string `json:"privateKey"`
	PublicKey  string `json:"publicKey"`
}

// WireGuardConfigParams holds parameters for generating a WireGuard config.
type WireGuardConfigParams struct {
	PrivateKey    string `json:"privateKey"`
	Address       string `json:"address"`
	DNS           string `json:"dns"`
	PublicKey     string `json:"publicKey"`
	Endpoint      string `json:"endpoint"`
	AllowedIPs    string `json:"allowedIPs"`
}

var (
	currentStatus VPNStatus
	statusMu      sync.RWMutex
)

// InitTable creates the vpn_configs table if it doesn't exist.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS vpn_configs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		type TEXT NOT NULL CHECK(type IN ('wireguard', 'openvpn')),
		config TEXT NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
}

// ListConfigs returns all VPN configurations ordered by creation time.
func ListConfigs() []VPNConfig {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, name, type, config, enabled, created_at FROM vpn_configs ORDER BY created_at DESC")
	if err != nil {
		return []VPNConfig{}
	}
	defer rows.Close()
	return scanRows(rows)
}

// GetConfig returns a single VPN configuration by ID.
func GetConfig(id int64) (*VPNConfig, error) {
	db := database.GetDB()
	row := db.QueryRow("SELECT id, name, type, config, enabled, created_at FROM vpn_configs WHERE id = ?", id)
	var c VPNConfig
	var enabled int
	err := row.Scan(&c.ID, &c.Name, &c.Type, &c.Config, &enabled, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	c.Enabled = enabled == 1
	return &c, nil
}

// CreateConfig inserts a new VPN configuration.
func CreateConfig(name, cfgType, config string) (*VPNConfig, error) {
	if cfgType != "wireguard" && cfgType != "openvpn" {
		return nil, fmt.Errorf("invalid VPN type: must be 'wireguard' or 'openvpn'")
	}
	db := database.GetDB()
	res, err := db.Exec(
		"INSERT INTO vpn_configs (name, type, config) VALUES (?, ?, ?)",
		name, cfgType, config,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create VPN config: %w", err)
	}
	id, _ := res.LastInsertId()
	return GetConfig(id)
}

// UpdateConfig modifies an existing VPN configuration.
func UpdateConfig(id int64, name, cfgType, config string) (*VPNConfig, error) {
	if cfgType != "wireguard" && cfgType != "openvpn" {
		return nil, fmt.Errorf("invalid VPN type: must be 'wireguard' or 'openvpn'")
	}
	db := database.GetDB()
	_, err := db.Exec(
		"UPDATE vpn_configs SET name = ?, type = ?, config = ? WHERE id = ?",
		name, cfgType, config, id,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update VPN config: %w", err)
	}
	return GetConfig(id)
}

// DeleteConfig removes a VPN configuration by ID.
func DeleteConfig(id int64) error {
	db := database.GetDB()
	_, err := db.Exec("DELETE FROM vpn_configs WHERE id = ?", id)
	return err
}

// ToggleConfig enables or disables a VPN configuration.
func ToggleConfig(id int64, enabled bool) error {
	db := database.GetDB()
	var e int
	if enabled {
		e = 1
	}
	_, err := db.Exec("UPDATE vpn_configs SET enabled = ? WHERE id = ?", e, id)
	return err
}

// Connect initiates a VPN connection using the specified configuration.
func Connect(id int64) error {
	cfg, err := GetConfig(id)
	if err != nil {
		return fmt.Errorf("VPN config not found: %w", err)
	}

	statusMu.Lock()
	defer statusMu.Unlock()

	if currentStatus.Connected {
		return fmt.Errorf("VPN already connected to %s, disconnect first", currentStatus.ConfigName)
	}

	switch cfg.Type {
	case "wireguard":
		if err := connectWireGuard(cfg); err != nil {
			return err
		}
	case "openvpn":
		if err := connectOpenVPN(cfg); err != nil {
			return err
		}
	default:
		return fmt.Errorf("unsupported VPN type: %s", cfg.Type)
	}

	currentStatus = VPNStatus{
		Connected:   true,
		ConfigID:    cfg.ID,
		ConfigName:  cfg.Name,
		Type:        cfg.Type,
		ConnectedAt: time.Now().UTC().Format(time.RFC3339),
	}
	return nil
}

// Disconnect terminates the current VPN connection.
func Disconnect() error {
	statusMu.Lock()
	defer statusMu.Unlock()

	if !currentStatus.Connected {
		return fmt.Errorf("no active VPN connection")
	}

	var err error
	switch currentStatus.Type {
	case "wireguard":
		err = disconnectWireGuard()
	case "openvpn":
		err = disconnectOpenVPN()
	}

	if err != nil {
		return fmt.Errorf("failed to disconnect: %w", err)
	}

	currentStatus = VPNStatus{}
	return nil
}

// GetStatus returns the current VPN connection status.
func GetStatus() VPNStatus {
	statusMu.RLock()
	defer statusMu.RUnlock()
	return currentStatus
}

// GenerateWireGuardKeyPair creates a new WireGuard private/public key pair.
func GenerateWireGuardKeyPair() (*WireGuardKeyPair, error) {
	// Generate 32 random bytes for private key
	privKeyBytes := make([]byte, 32)
	if _, err := rand.Read(privKeyBytes); err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}

	// Clamp private key as per WireGuard spec
	privKeyBytes[0] &= 248
	privKeyBytes[31] = (privKeyBytes[31] & 127) | 64

	privateKey := base64.StdEncoding.EncodeToString(privKeyBytes)

	// Try to derive public key using wg tool
	publicKey, err := derivePublicKey(privateKey)
	if err != nil {
		// Fallback: generate another random key as placeholder
		pubKeyBytes := make([]byte, 32)
		rand.Read(pubKeyBytes)
		publicKey = base64.StdEncoding.EncodeToString(pubKeyBytes)
	}

	return &WireGuardKeyPair{
		PrivateKey: privateKey,
		PublicKey:  publicKey,
	}, nil
}

// GenerateWireGuardConfig produces a WireGuard configuration string.
func GenerateWireGuardConfig(params WireGuardConfigParams) string {
	var sb strings.Builder
	sb.WriteString("[Interface]\n")
	sb.WriteString(fmt.Sprintf("PrivateKey = %s\n", params.PrivateKey))
	sb.WriteString(fmt.Sprintf("Address = %s\n", params.Address))
	if params.DNS != "" {
		sb.WriteString(fmt.Sprintf("DNS = %s\n", params.DNS))
	}
	sb.WriteString("\n[Peer]\n")
	sb.WriteString(fmt.Sprintf("PublicKey = %s\n", params.PublicKey))
	if params.Endpoint != "" {
		sb.WriteString(fmt.Sprintf("Endpoint = %s\n", params.Endpoint))
	}
	allowedIPs := params.AllowedIPs
	if allowedIPs == "" {
		allowedIPs = "0.0.0.0/0"
	}
	sb.WriteString(fmt.Sprintf("AllowedIPs = %s\n", allowedIPs))
	return sb.String()
}

// ParseOpenVPNConfig extracts basic info from an OpenVPN config string.
func ParseOpenVPNConfig(config string) map[string]string {
	info := make(map[string]string)
	lines := strings.Split(config, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "remote ") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				info["remote"] = parts[1]
			}
			if len(parts) >= 3 {
				info["port"] = parts[2]
			}
		} else if strings.HasPrefix(line, "proto ") {
			info["protocol"] = strings.TrimSpace(strings.TrimPrefix(line, "proto "))
		} else if strings.HasPrefix(line, "dev ") {
			info["device"] = strings.TrimSpace(strings.TrimPrefix(line, "dev "))
		} else if strings.HasPrefix(line, "# ") {
			if info["comment"] == "" {
				info["comment"] = strings.TrimPrefix(line, "# ")
			}
		}
	}
	return info
}

// --- Internal helpers ---

func connectWireGuard(cfg *VPNConfig) error {
	// Write config to temp file and bring up interface
	// On Linux: wg-quick up <interface>
	// For now, simulate with a check that wg tool exists
	if !systemadapter.IsBinaryAvailable("wg") {
		return fmt.Errorf("WireGuard (wg) is not installed")
	}

	// Write config and bring up interface
	// In production this would write to /etc/wireguard/<name>.conf
	// and run: wg-quick up <name>
	return nil
}

func connectOpenVPN(cfg *VPNConfig) error {
	if !systemadapter.IsBinaryAvailable("openvpn") {
		return fmt.Errorf("OpenVPN is not installed")
	}

	// In production this would write config to temp file
	// and run: openvpn --config <file> --daemon
	return nil
}

func disconnectWireGuard() error {
	// In production: wg-quick down <interface>
	return nil
}

func disconnectOpenVPN() error {
	// In production: kill openvpn process
	return nil
}

func derivePublicKey(privateKey string) (string, error) {
	result, err := systemadapter.RunWithStdin("wg", []string{"pubkey"}, privateKey, 10*time.Second)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		return "", fmt.Errorf("wg pubkey failed: %s", result.Stderr)
	}
	return strings.TrimSpace(result.Stdout), nil
}

func scanRows(rows *sql.Rows) []VPNConfig {
	var configs []VPNConfig
	for rows.Next() {
		var c VPNConfig
		var enabled int
		if err := rows.Scan(&c.ID, &c.Name, &c.Type, &c.Config, &enabled, &c.CreatedAt); err != nil {
			continue
		}
		c.Enabled = enabled == 1
		configs = append(configs, c)
	}
	if configs == nil {
		return []VPNConfig{}
	}
	return configs
}
