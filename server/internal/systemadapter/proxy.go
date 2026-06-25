package systemadapter

import (
	"errors"
	"os"
	"strings"
	"time"
)

const proxyTimeout = 30 * time.Second

// GetCaddyVersion returns the Caddy version string, or an error if Caddy is not installed.
func GetCaddyVersion() (string, error) {
	result, err := Run("caddy", []string{"version"}, proxyTimeout)
	if err != nil {
		return "", err
	}
	if result.ExitCode != 0 {
		return "", errors.New("caddy version check failed: " + result.Stderr)
	}
	return strings.TrimSpace(result.Stdout), nil
}

// IsCaddyRunning checks whether a Caddy process is currently running.
func IsCaddyRunning() bool {
	result, err := Run("pgrep", []string{"-x", "caddy"}, proxyTimeout)
	if err != nil {
		return false
	}
	return result.ExitCode == 0
}

// WriteCaddyfile writes the given content to /etc/caddy/Caddyfile using os.WriteFile.
// This eliminates the shell injection vector from using bash -c echo.
func WriteCaddyfile(content string) error {
	const caddyfilePath = "/etc/caddy/Caddyfile"
	if err := os.MkdirAll("/etc/caddy", 0755); err != nil {
		return errors.New("failed to create caddy directory: " + err.Error())
	}
	if err := os.WriteFile(caddyfilePath, []byte(content), 0644); err != nil {
		return errors.New("failed to write Caddyfile: " + err.Error())
	}
	return nil
}

// ReloadCaddy sends a reload signal to the Caddy service via systemctl.
func ReloadCaddy() error {
	result, err := Run("systemctl", []string{"reload", "caddy"}, proxyTimeout)
	if err != nil {
		return err
	}
	if result.ExitCode != 0 {
		return errors.New("failed to reload caddy: " + strings.TrimSpace(result.Stdout+result.Stderr))
	}
	return nil
}
