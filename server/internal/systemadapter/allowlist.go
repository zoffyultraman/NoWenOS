package systemadapter

import (
	"errors"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// AllowedBinaries is the set of binaries that the systemadapter is permitted to execute.
// Each entry maps the binary name to a human-readable description.
var AllowedBinaries = map[string]string{
	"sudo":          "execute a command as another user",
	"docker":        "Docker container runtime",
	"systemctl":     "systemd service manager",
	"nft":           "nftables firewall",
	"iptables":      "iptables firewall",
	"ip":            "iproute2 network configuration",
	"df":            "disk free utility",
	"lsblk":         "list block devices",
	"ps":            "process snapshot",
	"cp":            "copy files",
	"smbd":          "Samba daemon",
	"smbpasswd":     "Samba password tool",
	"a2enmod":       "Apache enable module",
	"a2ensite":      "Apache enable site",
	"exportfs":      "NFS export management",
	"caddy":         "Caddy web server",
	"pgrep":         "process grep",
	"certbot":       "Let's Encrypt client",
	"openssl":       "OpenSSL toolkit",
	"logrotate":     "log rotation utility",
	"uname":         "system information",
	"wg":            "WireGuard VPN tool",
	"openvpn":       "OpenVPN client",
	"dhclient":      "DHCP client",
	"mount":         "mount filesystem",
	"umount":        "unmount filesystem",
	"tasklist":      "Windows process list",
	"curl":          "HTTP client (for DDNS updates)",
	"mdadm":    "Linux software RAID management (read-only: --detail, --examine)",
	"pvs":      "LVM physical volume display",
	"vgs":      "LVM volume group display",
	"lvs":      "LVM logical volume display",
	"zpool":    "ZFS pool management (read-only: status, list)",
	"zfs":      "ZFS dataset management (read-only: list)",
	"hdparm":   "get/set hard disk parameters",
	"smartctl": "SMART disk health monitoring",
	"findmnt":  "find mounted filesystems",
	"cat":      "concatenate files",
	// NOTE: Destructive disk commands (fdisk, parted, sgdisk, mkfs.*, wipefs,
	// dd, vgcreate, lvcreate) have been moved to the diskcmd package.
	// They are no longer accessible through systemadapter.Run/RunStreamed.
}

// shellMetachars matches characters that have special meaning in shell contexts.
// These are rejected by ValidateArgs to prevent command injection.
var shellMetachars = regexp.MustCompile(`[;&|` + "`" + `$(){}!<>\n\r]`)

var (
	// ErrBinaryNotAllowed is returned when a binary is not in the allowlist.
	ErrBinaryNotAllowed = errors.New("binary not in allowlist")
	// ErrBinaryNotFound is returned when a binary is not found on the system.
	ErrBinaryNotFound = errors.New("binary not found on system")
	// ErrArgsInvalid is returned when arguments contain shell metacharacters.
	ErrArgsInvalid = errors.New("arguments contain invalid characters")
)

// ValidateBinary checks whether the given binary name is in the allowlist.
// Returns nil if allowed, ErrBinaryNotAllowed otherwise.
func ValidateBinary(binary string) error {
	if _, ok := AllowedBinaries[binary]; ok {
		return nil
	}
	return fmt.Errorf("%w: %s", ErrBinaryNotAllowed, binary)
}

// IsBinaryAvailable checks whether a binary exists on the system PATH
// and is in the allowlist. Returns true if both conditions hold.
func IsBinaryAvailable(binary string) bool {
	if err := ValidateBinary(binary); err != nil {
		return false
	}
	_, err := exec.LookPath(binary)
	return err == nil
}

// ValidateArgs checks a slice of arguments for shell metacharacters
// that could be used for command injection. Returns nil if all args
// are safe, ErrArgsInvalid otherwise.
func ValidateArgs(args []string) error {
	for i, arg := range args {
		if shellMetachars.MatchString(arg) {
			return fmt.Errorf("%w: arg[%d] contains metacharacters: %q", ErrArgsInvalid, i, arg)
		}
	}
	return nil
}

// ValidateInterfaceName checks that a network interface name contains
// only safe characters (alphanumeric, dots, dashes, underscores).
func ValidateInterfaceName(name string) error {
	if name == "" {
		return errors.New("interface name is empty")
	}
	valid := regexp.MustCompile(`^[a-zA-Z0-9._-]{1,15}$`)
	if !valid.MatchString(name) {
		return fmt.Errorf("invalid interface name: %q", name)
	}
	return nil
}

// ValidateNoShellMeta is a convenience that validates a single string
// for shell metacharacters (for use with values that will become arguments).
func ValidateNoShellMeta(value string) error {
	if strings.ContainsAny(value, ";&|`$(){}!<>\n\r") {
		return fmt.Errorf("%w: value contains metacharacters", ErrArgsInvalid)
	}
	return nil
}

// RequiresSudo determines if a given binary needs to be executed with elevated privileges.
func RequiresSudo(binary string) bool {
	privileged := map[string]bool{
		"systemctl": true,
		"nft":       true,
		"iptables":  true,
		"ip":        true,
		"smbpasswd": true,
		"a2enmod":   true,
		"a2ensite":  true,
		"exportfs":  true,
		"certbot":   true,
		"wg":        true,
		"openvpn":   true,
		"dhclient":  true,
		"mount":     true,
		"umount":    true,
		"mdadm":     true, // read-only queries only (via diskcmd for writes)
		"zpool":     true, // read-only queries only (via diskcmd for writes)
		"zfs":       true, // read-only queries only (via diskcmd for writes)
		"hdparm":    true,
		"smartctl":  true,
		// NOTE: Destructive disk commands (fdisk, parted, sgdisk, mkfs.*, wipefs,
		// dd, vgcreate, lvcreate) are now handled by the diskcmd package which
		// manages its own sudo elevation internally.
	}
	return privileged[binary]
}
