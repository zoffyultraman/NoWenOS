package storagemgr

import (
	"fmt"
	"strings"
	"time"

	"nowenos-server/internal/systemadapter"
)

// CheckDeviceSafety runs all four hardware-state guardrail checks on the
// given device path.  It returns nil when the device is safe to operate on,
// or an error describing the first reason the operation must be blocked.
func CheckDeviceSafety(devicePath string) error {
	devicePath = normalizeDevicePath(devicePath)

	// 1. Mounted?
	if mounted, mp, err := isDeviceMounted(devicePath); err != nil {
		return fmt.Errorf("mount check failed: %w", err)
	} else if mounted {
		return fmt.Errorf("device %s is currently mounted at %s", devicePath, mp)
	}

	// 2. Contains / or /boot?
	if ok, err := isRootOrBoot(devicePath); err != nil {
		return fmt.Errorf("root/boot check failed: %w", err)
	} else if ok {
		return fmt.Errorf("device %s contains a root (/) or boot (/boot) partition", devicePath)
	}

	// 3. Part of RAID / LVM / ZFS?
	if ok, detail, err := isPartOfArray(devicePath); err != nil {
		return fmt.Errorf("array check failed: %w", err)
	} else if ok {
		return fmt.Errorf("device %s is part of an active array: %s", devicePath, detail)
	}

	// 4. Used as swap?
	if ok, err := isSwapDevice(devicePath); err != nil {
		return fmt.Errorf("swap check failed: %w", err)
	} else if ok {
		return fmt.Errorf("device %s is used as swap memory", devicePath)
	}

	return nil
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// normalizeDevicePath ensures the path starts with "/dev/".
func normalizeDevicePath(path string) string {
	if !strings.HasPrefix(path, "/dev/") {
		return "/dev/" + path
	}
	return path
}

// isDigitChar returns true when b is an ASCII digit.
func isDigitChar(b byte) bool {
	return b >= '0' && b <= '9'
}

// ─── 1. mount check ─────────────────────────────────────────────────────────

// isDeviceMounted returns true (and the first non-empty mountpoint) when the
// device or any of its partitions appear in lsblk with a MOUNTPOINT.
func isDeviceMounted(devicePath string) (bool, string, error) {
	res, err := systemadapter.Run("lsblk",
		[]string{"-Pn", "-o", "NAME,MOUNTPOINT", devicePath},
		10*time.Second)
	if err != nil {
		return false, "", err
	}
	if res.ExitCode != 0 {
		return false, "", fmt.Errorf("lsblk exited %d: %s", res.ExitCode, res.Stderr)
	}

	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		mp := parseLsblkField(line, "MOUNTPOINT")
		if mp != "" {
			return true, mp, nil
		}
	}
	return false, "", nil
}

// ─── 2. root / boot check ───────────────────────────────────────────────────

// isRootOrBoot returns true when any mount source that belongs to devicePath
// is mounted at "/" or "/boot".
func isRootOrBoot(devicePath string) (bool, error) {
	res, err := systemadapter.Run("findmnt",
		[]string{"-rn", "-o", "SOURCE,TARGET"},
		10*time.Second)
	if err != nil {
		return false, err
	}
	if res.ExitCode != 0 {
		return false, fmt.Errorf("findmnt exited %d: %s", res.ExitCode, res.Stderr)
	}

	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		source, target := fields[0], fields[1]
		if sourceMatchesDevice(source, devicePath) && (target == "/" || target == "/boot") {
			return true, nil
		}
	}
	return false, nil
}

// ─── 3. array check (RAID / LVM / ZFS) ─────────────────────────────────────

// isPartOfArray returns true with a human-readable detail string when the
// device is a member of any active software-RAID, LVM, or ZFS pool.
func isPartOfArray(devicePath string) (bool, string, error) {
	if ok, detail, err := isPartOfRAID(devicePath); err != nil {
		return false, "", err
	} else if ok {
		return true, "RAID: " + detail, nil
	}

	if ok, err := isPartOfLVM(devicePath); err != nil {
		return false, "", err
	} else if ok {
		return true, "LVM physical volume", nil
	}

	if ok, err := isPartOfZFS(devicePath); err != nil {
		return false, "", err
	} else if ok {
		return true, "ZFS pool member", nil
	}

	return false, "", nil
}

// isPartOfRAID uses mdadm --examine to detect an md superblock on the device.
func isPartOfRAID(devicePath string) (bool, string, error) {
	res, err := systemadapter.Run("mdadm",
		[]string{"--examine", devicePath},
		10*time.Second)
	if err != nil {
		return false, "", nil // binary missing or device inaccessible – not an error
	}
	if res.ExitCode == 0 {
		return true, "md superblock detected", nil
	}
	return false, "", nil
}

// isPartOfLVM checks whether the device is listed as an LVM physical volume.
func isPartOfLVM(devicePath string) (bool, error) {
	res, err := systemadapter.Run("pvs",
		[]string{"--noheadings", "-o", "pv_name"},
		10*time.Second)
	if err != nil {
		return false, nil // pvs not installed
	}
	if res.ExitCode != 0 {
		return false, nil
	}

	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		if strings.TrimSpace(line) == devicePath {
			return true, nil
		}
	}
	return false, nil
}

// isPartOfZFS checks whether the device path appears in any zpool status output.
func isPartOfZFS(devicePath string) (bool, error) {
	res, err := systemadapter.Run("zpool",
		[]string{"status"},
		10*time.Second)
	if err != nil {
		return false, nil // zpool not installed
	}
	if res.ExitCode != 0 {
		return false, nil
	}
	return strings.Contains(res.Stdout, devicePath), nil
}

// ─── 4. swap check ──────────────────────────────────────────────────────────

// isSwapDevice reads /proc/swaps and returns true when devicePath (or a
// partition of it) is listed.
func isSwapDevice(devicePath string) (bool, error) {
	res, err := systemadapter.Run("cat",
		[]string{"/proc/swaps"},
		10*time.Second)
	if err != nil {
		return false, err
	}
	if res.ExitCode != 0 {
		return false, fmt.Errorf("cat /proc/swaps exited %d: %s", res.ExitCode, res.Stderr)
	}

	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		// skip header / comments
		if strings.HasPrefix(line, "#") || strings.HasPrefix(line, "Filename") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		swapDev := fields[0]
		if sourceMatchesDevice(swapDev, devicePath) {
			return true, nil
		}
	}
	return false, nil
}

// ─── parsing utilities ──────────────────────────────────────────────────────

// parseLsblkField extracts the value of a key from an lsblk -P output line.
// Example line:  NAME="sda1" MOUNTPOINT="/boot"
func parseLsblkField(line, field string) string {
	search := field + "=\""
	idx := strings.Index(line, search)
	if idx < 0 {
		return ""
	}
	start := idx + len(search)
	end := strings.Index(line[start:], "\"")
	if end < 0 {
		return ""
	}
	return line[start : start+end]
}

// sourceMatchesDevice returns true when source equals devicePath exactly, or
// when source is a partition of devicePath (devicePath followed by digits).
// This prevents "/dev/sda" from matching "/dev/sdaa".
func sourceMatchesDevice(source, devicePath string) bool {
	if source == devicePath {
		return true
	}
	if strings.HasPrefix(source, devicePath) && len(source) > len(devicePath) {
		return isDigitChar(source[len(devicePath)])
	}
	return false
}
