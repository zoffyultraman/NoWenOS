package systemadapter

import (
	"errors"
	"strings"
	"time"
)

const firewallTimeout = 30 * time.Second

// FirewallBackend represents the detected firewall backend.
type FirewallBackend struct {
	Name    string // "iptables", "nftables", or "none"
	Version string
	Running bool
}

// DetectFirewallBackend checks which firewall backend is available
// (iptables or nftables) and returns the first one found.
func DetectFirewallBackend() (*FirewallBackend, error) {
	// Try iptables first
	if IsBinaryAvailable("iptables") {
		result, err := Run("iptables", []string{"--version"}, firewallTimeout)
		if err == nil && result.ExitCode == 0 {
			backend := &FirewallBackend{
				Name:    "iptables",
				Version: strings.TrimSpace(result.Stdout),
			}
			// Check if running (iptables -L should succeed)
			if checkResult, err := Run("iptables", []string{"-L", "-n"}, firewallTimeout); err == nil && checkResult.ExitCode == 0 {
				backend.Running = true
			}
			return backend, nil
		}
	}

	// Try nftables
	if IsBinaryAvailable("nft") {
		result, err := Run("nft", []string{"--version"}, firewallTimeout)
		if err == nil && result.ExitCode == 0 {
			backend := &FirewallBackend{
				Name:    "nftables",
				Version: strings.TrimSpace(result.Stdout),
			}
			if checkResult, err := Run("nft", []string{"list", "tables"}, firewallTimeout); err == nil && checkResult.ExitCode == 0 {
				backend.Running = true
			}
			return backend, nil
		}
	}

	return nil, errors.New("no supported firewall backend found (iptables or nftables required)")
}

// FlushIptables flushes all iptables rules (iptables -F).
func FlushIptables() error {
	result, err := Run("iptables", []string{"-F"}, firewallTimeout)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New("iptables flush failed: " + result.Stderr)
	}
	return nil
}

// ApplyIptablesRule applies a single iptables rule with the given arguments.
// The args should be the iptables arguments (e.g., ["-A", "INPUT", "-p", "tcp", "--dport", "22", "-j", "ACCEPT"]).
func ApplyIptablesRule(args []string) error {
	result, err := Run("iptables", args, firewallTimeout)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New("iptables rule failed: " + strings.TrimSpace(result.Stdout+result.Stderr))
	}
	return nil
}

// FlushNftRuleset flushes all nftables rules (nft flush ruleset).
func FlushNftRuleset() error {
	result, err := Run("nft", []string{"flush", "ruleset"}, firewallTimeout)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New("nft flush failed: " + result.Stderr)
	}
	return nil
}

// ApplyNftRule applies a single nftables rule with the given arguments.
// The args should be the nft arguments (e.g., ["add", "rule", "inet", "filter", "input", "tcp", "dport", "22", "accept"]).
func ApplyNftRule(args []string) error {
	result, err := Run("nft", args, firewallTimeout)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New("nft rule failed: " + strings.TrimSpace(result.Stdout+result.Stderr))
	}
	return nil
}

// ListIptables returns the output of iptables -L -n (listing all rules).
func ListIptables() (string, error) {
	result, err := Run("iptables", []string{"-L", "-n"}, firewallTimeout)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		return "", errors.New("iptables list failed: " + result.Stderr)
	}
	return result.Stdout, nil
}

// ListNftTables returns the output of nft list tables.
func ListNftTables() (string, error) {
	result, err := Run("nft", []string{"list", "tables"}, firewallTimeout)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		return "", errors.New("nft list tables failed: " + result.Stderr)
	}
	return result.Stdout, nil
}
