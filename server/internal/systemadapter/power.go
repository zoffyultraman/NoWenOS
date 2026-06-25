package systemadapter

import (
	"errors"
	"fmt"
	"regexp"
	"time"
)

var deviceNameRegex = regexp.MustCompile(`^[a-z]+[0-9]*$`)

// SpinDownDevice spins down the specified block device using hdparm -y.
// The device name must match ^[a-z]+[0-9]*$ (e.g., "sda", "sdb1").
// It must not be the device containing the root filesystem "/".
func SpinDownDevice(device string) error {
	if device == "" {
		return errors.New("device name is empty")
	}
	if !deviceNameRegex.MatchString(device) {
		return fmt.Errorf("invalid device name: %q (must match ^[a-z]+[0-9]*$)", device)
	}

	// Check that this device is not the root disk
	rootDev, err := getRootDevice()
	if err == nil && rootDev != "" {
		// rootDev is like "/dev/sda2" - extract base device "sda"
		baseRoot := extractBaseDevice(rootDev)
		if device == baseRoot || device == rootDev {
			return errors.New("cannot spin down the system disk")
		}
	}

	devPath := "/dev/" + device
	result, err := Run("hdparm", []string{"-y", devPath}, 10*time.Second)
	if err != nil {
		return fmt.Errorf("hdparm failed: %w", err)
	}
	if result.ExitCode != 0 {
		return fmt.Errorf("hdparm exited with code %d: %s", result.ExitCode, result.Stderr)
	}
	return nil
}

// getRootDevice returns the device path of the root filesystem (e.g., "/dev/sda2").
func getRootDevice() (string, error) {
	result, err := Run("findmnt", []string{"-n", "-o", "SOURCE", "/"}, 5*time.Second)
	if err != nil {
		return "", err
	}
	dev := trimNewline(result.Stdout)
	if dev == "" {
		return "", errors.New("could not determine root device")
	}
	return dev, nil
}

// extractBaseDevice extracts the base disk name from a partition device.
// e.g., "/dev/sda2" -> "sda", "/dev/nvme0n1p1" -> "nvme0n1"
func extractBaseDevice(dev string) string {
	// Remove /dev/ prefix
	name := dev
	if len(name) > 5 && name[:5] == "/dev/" {
		name = name[5:]
	}
	// NVMe style: nvme0n1p1 -> nvme0n1
	if matched, _ := regexp.MatchString(`^nvme\d+n\d+`, name); matched {
		re := regexp.MustCompile(`^(nvme\d+n\d+)`)
		if m := re.FindStringSubmatch(name); len(m) > 1 {
			return m[1]
		}
	}
	// SCSI/SATA style: sda2 -> sda
	re := regexp.MustCompile(`^([a-z]+)`)
	if m := re.FindStringSubmatch(name); len(m) > 1 {
		return m[1]
	}
	return name
}

func trimNewline(s string) string {
	for len(s) > 0 && (s[len(s)-1] == '\n' || s[len(s)-1] == '\r') {
		s = s[:len(s)-1]
	}
	return s
}
