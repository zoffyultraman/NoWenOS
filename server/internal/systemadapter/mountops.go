package systemadapter

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// blocklistMountpoints are critical system paths that must never be unmounted.
var blocklistMountpoints = map[string]bool{
	"/":     true,
	"/boot": true,
	"/sys":  true,
	"/proc": true,
	"/dev":  true,
	"/run":  true,
}

// mountTargetPrefix is the required prefix for user-initiated mount targets.
const mountTargetPrefix = "/mnt/nowenos/"

var validDeviceForMount = regexp.MustCompile(`^[a-z]+[0-9]*$`)

// MountDevice mounts /dev/<device> to the specified mountpoint.
// Device and mountpoint are validated for safety.
func MountDevice(device, mountpoint string) (*CommandResult, error) {
	if !validDeviceForMount.MatchString(device) {
		return nil, fmt.Errorf("invalid device name: %q", device)
	}

	if err := validateMountTarget(mountpoint); err != nil {
		return nil, err
	}

	result, err := Run("mount", []string{"/dev/" + device, mountpoint}, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("mount failed: %w", err)
	}

	if result.ExitCode != 0 {
		return nil, fmt.Errorf("mount failed (exit %d): %s", result.ExitCode, result.Stderr)
	}

	return result, nil
}

// UnmountDevice unmounts the specified mountpoint.
// Critical system mountpoints are blocked.
func UnmountDevice(mountpoint string) (*CommandResult, error) {
	if err := validateMountTarget(mountpoint); err != nil {
		return nil, err
	}

	result, err := Run("umount", []string{mountpoint}, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("umount failed: %w", err)
	}

	if result.ExitCode != 0 {
		return nil, fmt.Errorf("umount failed (exit %d): %s", result.ExitCode, result.Stderr)
	}

	return result, nil
}

// validateMountTarget checks that the mountpoint is under /mnt/nowenos/
// and is not in the blocklist.
func validateMountTarget(mountpoint string) error {
	// Normalize: remove trailing slashes (except root)
	mp := strings.TrimRight(mountpoint, "/")
	if mp == "" {
		return fmt.Errorf("mountpoint cannot be empty")
	}

	if blocklistMountpoints[mp] {
		return fmt.Errorf("mountpoint %q is a critical system path and cannot be used", mp)
	}

	if !strings.HasPrefix(mp+"/", mountTargetPrefix) && mp+"/" != mountTargetPrefix {
		return fmt.Errorf("mountpoint must be under %s, got %q", mountTargetPrefix, mountpoint)
	}

	return nil
}
