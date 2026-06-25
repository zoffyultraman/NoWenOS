package systemadapter

import (
	"fmt"
	"regexp"
	"time"
)

// ifaceNameRe validates network interface names.
// Only alphanumeric characters, underscores, and hyphens are allowed.
var ifaceNameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// validateIfaceName checks that the interface name is safe for use as an argument
// to ip/dhclient commands. This is stricter than ValidateInterfaceName which also
// allows dots -- network commands should only receive sanitized names.
func validateIfaceName(name string) error {
	if name == "" {
		return fmt.Errorf("interface name is empty")
	}
	if !ifaceNameRe.MatchString(name) {
		return fmt.Errorf("invalid interface name: %q", name)
	}
	if len(name) > 15 {
		return fmt.Errorf("interface name too long: %q", name)
	}
	return nil
}

// LinkSetUp brings a network interface up by running `ip link set <name> up`.
func LinkSetUp(name string) (*CommandResult, error) {
	if err := validateIfaceName(name); err != nil {
		return nil, err
	}
	return Run("ip", []string{"link", "set", name, "up"}, 10*time.Second)
}

// LinkDown brings a network interface down by running `ip link set <name> down`.
func LinkDown(name string) (*CommandResult, error) {
	if err := validateIfaceName(name); err != nil {
		return nil, err
	}
	return Run("ip", []string{"link", "set", name, "down"}, 10*time.Second)
}

// AddrFlush removes all addresses from a device by running `ip addr flush dev <dev>`.
func AddrFlush(dev string) (*CommandResult, error) {
	if err := validateIfaceName(dev); err != nil {
		return nil, err
	}
	return Run("ip", []string{"addr", "flush", "dev", dev}, 10*time.Second)
}

// AddrAdd adds an address in CIDR notation to a device by running
// `ip addr add <cidr> dev <dev>`.
func AddrAdd(cidr, dev string) (*CommandResult, error) {
	if err := validateIfaceName(dev); err != nil {
		return nil, err
	}
	// Validate CIDR format doesn't contain shell metacharacters
	if err := ValidateNoShellMeta(cidr); err != nil {
		return nil, fmt.Errorf("invalid CIDR: %w", err)
	}
	return Run("ip", []string{"addr", "add", cidr, "dev", dev}, 10*time.Second)
}

// RouteReplaceDefault sets the default route via a gateway on a device by running
// `ip route replace default via <gateway> dev <dev>`.
func RouteReplaceDefault(gateway, dev string) (*CommandResult, error) {
	if err := validateIfaceName(dev); err != nil {
		return nil, err
	}
	if err := ValidateNoShellMeta(gateway); err != nil {
		return nil, fmt.Errorf("invalid gateway: %w", err)
	}
	return Run("ip", []string{"route", "replace", "default", "via", gateway, "dev", dev}, 10*time.Second)
}

// DHClient runs the DHCP client on a device by running `dhclient -nw <dev>`.
func DHClient(dev string) (*CommandResult, error) {
	if err := validateIfaceName(dev); err != nil {
		return nil, err
	}
	return Run("dhclient", []string{"-nw", dev}, 30*time.Second)
}
