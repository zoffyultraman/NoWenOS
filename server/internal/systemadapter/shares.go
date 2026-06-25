package systemadapter

import (
	"fmt"
	"time"
)

const (
	defaultServiceTimeout = 30 * time.Second
	defaultCopyTimeout    = 10 * time.Second
)

// RestartSamba restarts both smbd and nmbd services.
func RestartSamba() error {
	if _, err := Run("systemctl", []string{"restart", "smbd"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("restart smbd: %w", err)
	}
	if _, err := Run("systemctl", []string{"restart", "nmbd"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("restart nmbd: %w", err)
	}
	return nil
}

// RestartNMBD restarts the nmbd service.
func RestartNMBD() error {
	if _, err := Run("systemctl", []string{"restart", "nmbd"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("restart nmbd: %w", err)
	}
	return nil
}

// EnableApacheModule enables one or more Apache modules via a2enmod.
func EnableApacheModule(mods []string) error {
	if len(mods) == 0 {
		return nil
	}
	if _, err := Run("a2enmod", mods, defaultServiceTimeout); err != nil {
		return fmt.Errorf("a2enmod %v: %w", mods, err)
	}
	return nil
}

// EnableApacheSite enables an Apache site via a2ensite.
func EnableApacheSite(site string) error {
	if _, err := Run("a2ensite", []string{site}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("a2ensite %s: %w", site, err)
	}
	return nil
}

// ReloadApache reloads the Apache2 service.
func ReloadApache() error {
	if _, err := Run("systemctl", []string{"reload", "apache2"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("reload apache2: %w", err)
	}
	return nil
}

// ExportFS runs exportfs -ra to re-export NFS shares.
func ExportFS() error {
	if _, err := Run("exportfs", []string{"-ra"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("exportfs -ra: %w", err)
	}
	return nil
}

// ReloadNFS reloads the nfs-kernel-server service.
func ReloadNFS() error {
	if _, err := Run("systemctl", []string{"reload", "nfs-kernel-server"}, defaultServiceTimeout); err != nil {
		return fmt.Errorf("reload nfs-kernel-server: %w", err)
	}
	return nil
}

// IsServiceActive checks whether a systemd service is currently active.
func IsServiceActive(service string) (bool, error) {
	result, err := Run("systemctl", []string{"is-active", service}, 5*time.Second)
	if err != nil {
		return false, err
	}
	return result.ExitCode == 0, nil
}

// CopyFile copies a file from src to dest using the cp command.
func CopyFile(src, dest string) error {
	if err := ValidateBinary("cp"); err != nil {
		return err
	}
	if _, err := Run("cp", []string{src, dest}, defaultCopyTimeout); err != nil {
		return fmt.Errorf("cp %s %s: %w", src, dest, err)
	}
	return nil
}
