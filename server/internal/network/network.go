package network

import (
	"bufio"
	"fmt"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
)

const (
	interfacesFile    = "/etc/network/interfaces"
	interfacesDir     = "/etc/network/interfaces.d"
	resolvConfFile    = "/etc/resolv.conf"
	procNetDevFile    = "/proc/net/dev"
	sysClassNetDir    = "/sys/class/net"
)

// InterfaceConfig represents the configuration mode for an interface.
type InterfaceConfig struct {
	Name      string   `json:"name"`
	Mode      string   `json:"mode"` // "dhcp" or "static"
	Address   string   `json:"address,omitempty"`
	Netmask   string   `json:"netmask,omitempty"`
	Gateway   string   `json:"gateway,omitempty"`
	DNSServer []string `json:"dns,omitempty"`
}

// InterfaceInfo represents detailed information about a network interface.
type InterfaceInfo struct {
	Name       string `json:"name"`
	MAC        string `json:"mac"`
	IPAddress  string `json:"ipAddress"`
	Netmask    string `json:"netmask"`
	Gateway    string `json:"gateway"`
	Status     string `json:"status"` // "up" or "down"
	Speed      string `json:"speed"`
	MTU        int    `json:"mtu"`
	RxBytes    int64  `json:"rxBytes"`
	TxBytes    int64  `json:"txBytes"`
	RxPackets  int64  `json:"rxPackets"`
	TxPackets  int64  `json:"txPackets"`
	RxErrors   int64  `json:"rxErrors"`
	TxErrors   int64  `json:"txErrors"`
	RxDropped  int64  `json:"rxDropped"`
	TxDropped  int64  `json:"txDropped"`
	IsConfigured bool `json:"isConfigured"`
	Config     *InterfaceConfig `json:"config,omitempty"`
}

// DNSConfig represents the DNS configuration.
type DNSConfig struct {
	Servers    []string `json:"servers"`
	Search     []string `json:"search,omitempty"`
}

var (
	mu sync.RWMutex
)

// ListInterfaces returns all network interfaces on the system.
func ListInterfaces() ([]InterfaceInfo, error) {
	mu.RLock()
	defer mu.RUnlock()

	ifaces, err := net.Interfaces()
	if err != nil {
		return nil, fmt.Errorf("failed to list interfaces: %w", err)
	}

	configs := loadConfigs()
	procStats := readProcNetDev()

	var result []InterfaceInfo
	for _, iface := range ifaces {
		// Skip loopback
		if iface.Flags&net.FlagLoopback != 0 {
			continue
		}

		info := buildInterfaceInfo(iface, configs, procStats)
		result = append(result, info)
	}

	return result, nil
}

// GetInterface returns detailed info for a specific interface.
func GetInterface(name string) (*InterfaceInfo, error) {
	mu.RLock()
	defer mu.RUnlock()

	iface, err := net.InterfaceByName(name)
	if err != nil {
		return nil, fmt.Errorf("interface %s not found: %w", name, err)
	}

	configs := loadConfigs()
	procStats := readProcNetDev()
	info := buildInterfaceInfo(*iface, configs, procStats)

	return &info, nil
}

// ConfigureInterface sets the configuration for a network interface.
func ConfigureInterface(name string, config InterfaceConfig) error {
	mu.Lock()
	defer mu.Unlock()

	// Validate interface exists
	if _, err := net.InterfaceByName(name); err != nil {
		return fmt.Errorf("interface %s not found: %w", name, err)
	}

	// Validate config
	if config.Mode == "static" {
		if config.Address == "" {
			return fmt.Errorf("address is required for static configuration")
		}
		if config.Netmask == "" {
			config.Netmask = "255.255.255.0"
		}
	}

	config.Name = name
	if err := writeConfigFile(name, &config); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// UpInterface brings a network interface up.
func UpInterface(name string) error {
	mu.Lock()
	defer mu.Unlock()

	if _, err := net.InterfaceByName(name); err != nil {
		return fmt.Errorf("interface %s not found: %w", name, err)
	}

	cmd := exec.Command("ip", "link", "set", name, "up")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to bring up interface: %s", string(out))
	}

	// If configured as static, apply the address
	configs := loadConfigs()
	if cfg, ok := configs[name]; ok && cfg.Mode == "static" && cfg.Address != "" {
		// Flush existing addresses
		exec.Command("ip", "addr", "flush", "dev", name).Run()

		cidr := cfg.Address
		if cfg.Netmask != "" {
			mask := net.IPMask(net.ParseIP(cfg.Netmask).To4())
			ones, _ := mask.Size()
			cidr = fmt.Sprintf("%s/%d", cfg.Address, ones)
		}

		cmd = exec.Command("ip", "addr", "add", cidr, "dev", name)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("failed to set address: %s", string(out))
		}

		// Set gateway if specified
		if cfg.Gateway != "" {
			cmd = exec.Command("ip", "route", "replace", "default", "via", cfg.Gateway, "dev", name)
			if out, err := cmd.CombinedOutput(); err != nil {
				return fmt.Errorf("failed to set gateway: %s", string(out))
			}
		}
	} else if cfg, ok := configs[name]; ok && cfg.Mode == "dhcp" {
		// Try dhclient
		go func() {
			exec.Command("dhclient", "-nw", name).Run()
		}()
	}

	return nil
}

// DownInterface brings a network interface down.
func DownInterface(name string) error {
	mu.Lock()
	defer mu.Unlock()

	if _, err := net.InterfaceByName(name); err != nil {
		return fmt.Errorf("interface %s not found: %w", name, err)
	}

	cmd := exec.Command("ip", "link", "set", name, "down")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("failed to bring down interface: %s", string(out))
	}

	return nil
}

// GetDNS returns the current DNS configuration.
func GetDNS() (*DNSConfig, error) {
	mu.RLock()
	defer mu.RUnlock()

	return readResolvConf()
}

// SetDNS updates the DNS configuration.
func SetDNS(config DNSConfig) error {
	mu.Lock()
	defer mu.Unlock()

	if len(config.Servers) == 0 {
		return fmt.Errorf("at least one DNS server is required")
	}

	// Validate each DNS server
	for _, server := range config.Servers {
		if net.ParseIP(server) == nil {
			return fmt.Errorf("invalid DNS server address: %s", server)
		}
	}

	return writeResolvConf(config)
}

// --- internal helpers ---

// procNetStat holds per-interface byte/packet counters from /proc/net/dev.
type procNetStat struct {
	rxBytes   int64
	txBytes   int64
	rxPackets int64
	txPackets int64
	rxErrors  int64
	txErrors  int64
	rxDropped int64
	txDropped int64
}

// readProcNetDev parses /proc/net/dev into a map.
func readProcNetDev() map[string]procNetStat {
	stats := make(map[string]procNetStat)

	file, err := os.Open(procNetDevFile)
	if err != nil {
		return stats
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		if lineNum <= 2 {
			continue // skip headers
		}

		line := scanner.Text()
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}

		name := strings.TrimSpace(parts[0])
		fields := strings.Fields(parts[1])
		if len(fields) < 16 {
			continue
		}

		stats[name] = procNetStat{
			rxBytes:   parseInt64(fields[0]),
			rxPackets: parseInt64(fields[1]),
			rxErrors:  parseInt64(fields[2]),
			rxDropped: parseInt64(fields[3]),
			txBytes:   parseInt64(fields[8]),
			txPackets: parseInt64(fields[9]),
			txErrors:  parseInt64(fields[10]),
			txDropped: parseInt64(fields[11]),
		}
	}

	return stats
}

func parseInt64(s string) int64 {
	v, _ := strconv.ParseInt(s, 10, 64)
	return v
}

// buildInterfaceInfo assembles an InterfaceInfo from system data.
func buildInterfaceInfo(iface net.Interface, configs map[string]*InterfaceConfig, procStats map[string]procNetStat) InterfaceInfo {
	info := InterfaceInfo{
		Name: iface.Name,
		MAC:  iface.HardwareAddr.String(),
		MTU:  iface.MTU,
	}

	// Status
	if iface.Flags&net.FlagUp != 0 {
		info.Status = "up"
	} else {
		info.Status = "down"
	}

	// IP address
	addrs, err := iface.Addrs()
	if err == nil {
		for _, addr := range addrs {
			if ipNet, ok := addr.(*net.IPNet); ok && ipNet.IP.To4() != nil {
				info.IPAddress = ipNet.IP.String()
				mask := ipNet.Mask
				info.Netmask = net.IP(mask).String()
				break
			}
		}
	}

	// Gateway - try reading from /proc/net/route
	info.Gateway = readGateway(iface.Name)

	// Speed
	info.Speed = readInterfaceSpeed(iface.Name)

	// Proc stats
	if stat, ok := procStats[iface.Name]; ok {
		info.RxBytes = stat.rxBytes
		info.TxBytes = stat.txBytes
		info.RxPackets = stat.rxPackets
		info.TxPackets = stat.txPackets
		info.RxErrors = stat.rxErrors
		info.TxErrors = stat.txErrors
		info.RxDropped = stat.rxDropped
		info.TxDropped = stat.txDropped
	}

	// Configuration
	if cfg, ok := configs[iface.Name]; ok {
		info.IsConfigured = true
		info.Config = cfg
	}

	return info
}

// readGateway reads the default gateway for an interface from /proc/net/route.
func readGateway(ifaceName string) string {
	file, err := os.Open("/proc/net/route")
	if err != nil {
		return ""
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 8 {
			continue
		}
		if fields[0] != ifaceName {
			continue
		}
		// Destination == 0.0.0.0 means default route
		if fields[1] == "00000000" {
			gwHex := fields[2]
			gw, err := parseHexIP(gwHex)
			if err == nil && gw != "0.0.0.0" {
				return gw
			}
		}
	}

	return ""
}

// parseHexIP converts a little-endian hex IP (from /proc/net/route) to dotted notation.
func parseHexIP(hexStr string) (string, error) {
	if len(hexStr) != 8 {
		return "", fmt.Errorf("invalid hex IP length")
	}

	b := make([]byte, 4)
	for i := 0; i < 4; i++ {
		v, err := strconv.ParseUint(hexStr[i*2:(i+1)*2], 16, 8)
		if err != nil {
			return "", err
		}
		b[i] = byte(v)
	}

	return fmt.Sprintf("%d.%d.%d.%d", b[0], b[1], b[2], b[3]), nil
}

// readInterfaceSpeed reads link speed from /sys/class/net/<name>/speed.
func readInterfaceSpeed(ifaceName string) string {
	speedFile := filepath.Join(sysClassNetDir, ifaceName, "speed")
	data, err := os.ReadFile(speedFile)
	if err != nil {
		return "N/A"
	}
	speed, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil || speed <= 0 {
		return "N/A"
	}
	if speed >= 1000 {
		return fmt.Sprintf("%d Gbps", speed/1000)
	}
	return fmt.Sprintf("%d Mbps", speed)
}

// loadConfigs reads all interface config files from /etc/network/interfaces.d/.
func loadConfigs() map[string]*InterfaceConfig {
	configs := make(map[string]*InterfaceConfig)

	// Read /etc/network/interfaces.d/
	entries, err := os.ReadDir(interfacesDir)
	if err == nil {
		for _, entry := range entries {
			if entry.IsDir() {
				continue
			}
			cfg := parseInterfaceFile(filepath.Join(interfacesDir, entry.Name()))
			if cfg != nil {
				configs[cfg.Name] = cfg
			}
		}
	}

	// Also read /etc/network/interfaces for any configured interfaces
	mainCfgs := parseMainInterfacesFile()
	for name, cfg := range mainCfgs {
		if _, exists := configs[name]; !exists {
			configs[name] = cfg
		}
	}

	return configs
}

// parseInterfaceFile parses a single interfaces.d file.
func parseInterfaceFile(path string) *InterfaceConfig {
	file, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer file.Close()

	var cfg InterfaceConfig
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		switch fields[0] {
		case "iface":
			if len(fields) >= 4 {
				cfg.Name = fields[1]
				// fields[2] is "inet", fields[3] is "dhcp" or "static"
				cfg.Mode = fields[3]
			}
		case "address":
			if len(fields) >= 2 {
				cfg.Address = fields[1]
			}
		case "netmask":
			if len(fields) >= 2 {
				cfg.Netmask = fields[1]
			}
		case "gateway":
			if len(fields) >= 2 {
				cfg.Gateway = fields[1]
			}
		case "dns-nameservers":
			for _, s := range fields[1:] {
				cfg.DNSServer = append(cfg.DNSServer, s)
			}
		}
	}

	if cfg.Name == "" {
		return nil
	}
	return &cfg
}

// parseMainInterfacesFile parses /etc/network/interfaces for configured interfaces.
func parseMainInterfacesFile() map[string]*InterfaceConfig {
	configs := make(map[string]*InterfaceConfig)

	file, err := os.Open(interfacesFile)
	if err != nil {
		return configs
	}
	defer file.Close()

	var currentCfg *InterfaceConfig
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		switch fields[0] {
		case "iface":
			if len(fields) >= 4 {
				name := fields[1]
				// Skip "lo"
				if name == "lo" {
					currentCfg = nil
					continue
				}
				cfg := &InterfaceConfig{
					Name: name,
					Mode: fields[3],
				}
				currentCfg = cfg
				configs[name] = cfg
			}
		case "address":
			if currentCfg != nil && len(fields) >= 2 {
				currentCfg.Address = fields[1]
			}
		case "netmask":
			if currentCfg != nil && len(fields) >= 2 {
				currentCfg.Netmask = fields[1]
			}
		case "gateway":
			if currentCfg != nil && len(fields) >= 2 {
				currentCfg.Gateway = fields[1]
			}
		case "dns-nameservers":
			if currentCfg != nil {
				for _, s := range fields[1:] {
					currentCfg.DNSServer = append(currentCfg.DNSServer, s)
				}
			}
		}
	}

	return configs
}

// writeConfigFile writes interface configuration to /etc/network/interfaces.d/.
func writeConfigFile(name string, config *InterfaceConfig) error {
	// Ensure directory exists
	if err := os.MkdirAll(interfacesDir, 0755); err != nil {
		return fmt.Errorf("failed to create interfaces.d directory: %w", err)
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# Auto-generated by NoWenOS for %s\n", name))
	sb.WriteString(fmt.Sprintf("auto %s\n", name))
	sb.WriteString(fmt.Sprintf("iface %s inet %s\n", name, config.Mode))

	if config.Mode == "static" {
		if config.Address != "" {
			sb.WriteString(fmt.Sprintf("    address %s\n", config.Address))
		}
		if config.Netmask != "" {
			sb.WriteString(fmt.Sprintf("    netmask %s\n", config.Netmask))
		}
		if config.Gateway != "" {
			sb.WriteString(fmt.Sprintf("    gateway %s\n", config.Gateway))
		}
		if len(config.DNSServer) > 0 {
			sb.WriteString(fmt.Sprintf("    dns-nameservers %s\n", strings.Join(config.DNSServer, " ")))
		}
	}

	filePath := filepath.Join(interfacesDir, name)
	return os.WriteFile(filePath, []byte(sb.String()), 0644)
}

// readResolvConf parses /etc/resolv.conf.
func readResolvConf() (*DNSConfig, error) {
	file, err := os.Open(resolvConfFile)
	if err != nil {
		// Return empty config if file doesn't exist
		return &DNSConfig{}, nil
	}
	defer file.Close()

	config := &DNSConfig{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		switch fields[0] {
		case "nameserver":
			config.Servers = append(config.Servers, fields[1])
		case "search":
			config.Search = append(config.Search, fields[1:]...)
		}
	}

	return config, nil
}

// writeResolvConf writes DNS config to /etc/resolv.conf.
func writeResolvConf(config DNSConfig) error {
	var sb strings.Builder
	sb.WriteString("# Generated by NoWenOS\n")

	if len(config.Search) > 0 {
		sb.WriteString(fmt.Sprintf("search %s\n", strings.Join(config.Search, " ")))
	}

	for _, server := range config.Servers {
		sb.WriteString(fmt.Sprintf("nameserver %s\n", server))
	}

	// Backup original
	if _, err := os.Stat(resolvConfFile); err == nil {
		data, _ := os.ReadFile(resolvConfFile)
		os.WriteFile(resolvConfFile+".bak", data, 0644)
	}

	return os.WriteFile(resolvConfFile, []byte(sb.String()), 0644)
}
