// Package diskcmd is an isolated command execution channel for disk-management
// high-risk operations. It maintains a private binary whitelist that is NOT
// accessible to external packages, enforcing the principle of least privilege.
//
// All disk write/mutate operations MUST flow through this package. Read-only
// queries (lsblk, findmnt, pvs, mdadm --detail, zpool status, zfs list) remain
// in the public systemadapter.
package diskcmd

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"sync"
	"time"

	"nowenos-server/internal/systemadapter"
)

// ── Private whitelist ────────────────────────────────────────────────────────
// Only this package can reference these binaries. External packages cannot
// import or access this map.

var diskBinaries = map[string]bool{
	"fdisk":      true,
	"parted":     true,
	"sgdisk":     true,
	"mkfs.ext4":  true,
	"mkfs.btrfs": true,
	"mkfs.xfs":   true,
	"mkfs.vfat":  true,
	"wipefs":     true,
	"dd":         true,
	"mdadm":      true,
	"vgcreate":   true,
	"lvcreate":   true,
	"zpool":      true,
	"zfs":        true,
}

// All disk commands require root privileges.
var diskRequiresSudo = map[string]bool{
	"fdisk":      true,
	"parted":     true,
	"sgdisk":     true,
	"mkfs.ext4":  true,
	"mkfs.btrfs": true,
	"mkfs.xfs":   true,
	"mkfs.vfat":  true,
	"wipefs":     true,
	"dd":         true,
	"mdadm":      true,
	"vgcreate":   true,
	"lvcreate":   true,
	"zpool":      true,
	"zfs":        true,
}

// shellMetachars detects characters that have special meaning in shell contexts.
var shellMetachars = regexp.MustCompile("[;&|`$(){}!<>\\n\\r]")

// devicePathRe validates a /dev/ path: alphanumeric, slashes, dots, dashes.
var devicePathRe = regexp.MustCompile(`^/[a-zA-Z0-9._/\-]+$`)

var (
	ErrBinaryNotAllowed = errors.New("binary not in diskcmd allowlist")
	ErrArgsInvalid      = errors.New("arguments contain invalid characters")
	ErrDeviceInvalid    = errors.New("invalid device path")
)

// ── Validation helpers ───────────────────────────────────────────────────────

func validateBinary(binary string) error {
	if !diskBinaries[binary] {
		return fmt.Errorf("%w: %s", ErrBinaryNotAllowed, binary)
	}
	if _, err := exec.LookPath(binary); err != nil {
		return fmt.Errorf("binary not found on system: %s", binary)
	}
	return nil
}

func validateArgs(args []string) error {
	for i, arg := range args {
		if shellMetachars.MatchString(arg) {
			return fmt.Errorf("%w: arg[%d] contains metacharacters: %q", ErrArgsInvalid, i, arg)
		}
	}
	return nil
}

func validateDevice(device string) error {
	if device == "" {
		return fmt.Errorf("%w: device path is empty", ErrDeviceInvalid)
	}
	if !devicePathRe.MatchString(device) {
		return fmt.Errorf("%w: %q contains invalid characters", ErrDeviceInvalid, device)
	}
	return nil
}

// ── Core execution ───────────────────────────────────────────────────────────

// runDiskCommand validates the binary against the private whitelist and executes
// it directly via os/exec. This is the ONLY path through which disk commands
// reach the OS. It does NOT call systemadapter.RunStreamed (which would fail
// because these binaries are no longer in AllowedBinaries).
func runDiskCommand(binary string, args []string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if err := validateBinary(binary); err != nil {
		return nil, err
	}
	if err := validateArgs(args); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	var cmd *exec.Cmd
	if diskRequiresSudo[binary] {
		sudoArgs := append([]string{"-n", binary}, args...)
		cmd = exec.CommandContext(ctx, "sudo", sudoArgs...)
	} else {
		cmd = exec.CommandContext(ctx, binary, args...)
	}

	// When onLine is nil, use simple buffer capture.
	if onLine == nil {
		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()
		exitCode := 0
		if err != nil {
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				return nil, fmt.Errorf("command execution failed: %w", err)
			}
		}
		return &systemadapter.CommandResult{
			Stdout:   stdout.String(),
			Stderr:   stderr.String(),
			ExitCode: exitCode,
		}, nil
	}

	// Streaming mode: use pipes and goroutines to capture line-by-line.
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stdout pipe: %w", err)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		return nil, fmt.Errorf("failed to create stderr pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start command: %w", err)
	}

	var stdoutBuf, stderrBuf bytes.Buffer
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stdoutPipe)
		for scanner.Scan() {
			line := scanner.Text()
			stdoutBuf.WriteString(line + "\n")
			onLine("stdout", line)
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := scanner.Text()
			stderrBuf.WriteString(line + "\n")
			onLine("stderr", line)
		}
	}()

	wg.Wait()
	err = cmd.Wait()

	if rest := drainReader(stdoutPipe); rest != "" {
		stdoutBuf.WriteString(rest)
		onLine("stdout", rest)
	}
	if rest := drainReader(stderrPipe); rest != "" {
		stderrBuf.WriteString(rest)
		onLine("stderr", rest)
	}

	exitCode := 0
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			exitCode = exitErr.ExitCode()
		} else {
			return nil, fmt.Errorf("command execution failed: %w", err)
		}
	}

	return &systemadapter.CommandResult{
		Stdout:   stdoutBuf.String(),
		Stderr:   stderrBuf.String(),
		ExitCode: exitCode,
	}, nil
}

func drainReader(r io.ReadCloser) string {
	remaining, err := io.ReadAll(r)
	if err != nil || len(remaining) == 0 {
		return ""
	}
	return string(remaining)
}

// ── Public API: typed disk operations ────────────────────────────────────────

// WipeDisk runs wipefs -a on the device. If full is true, also zero-fills
// the first 1MB with dd. Returns an error if any step fails.
func WipeDisk(device string, full bool, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if err := validateDevice(device); err != nil {
		return nil, err
	}

	res, err := runDiskCommand("wipefs", []string{"-a", device}, timeout, onLine)
	if err != nil {
		return nil, fmt.Errorf("wipefs failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("wipefs exited with code %d", res.ExitCode)
	}

	if full {
		res, err = runDiskCommand("dd", []string{"if=/dev/zero", "of=" + device, "bs=1M", "count=1", "conv=notrunc"}, timeout, onLine)
		if err != nil {
			return res, fmt.Errorf("dd failed: %w", err)
		}
		if res.ExitCode != 0 {
			return res, fmt.Errorf("dd exited with code %d", res.ExitCode)
		}
	}

	return res, nil
}

// FormatDisk creates a filesystem on the given device. fsType must be one of
// "ext4", "xfs", "btrfs", "vfat".
func FormatDisk(device, fsType, label string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if err := validateDevice(device); err != nil {
		return nil, err
	}

	validFSTypes := map[string]bool{
		"ext4": true, "xfs": true, "btrfs": true, "vfat": true,
	}
	if !validFSTypes[fsType] {
		return nil, fmt.Errorf("unsupported filesystem type: %s", fsType)
	}

	binary := "mkfs." + fsType
	args := []string{}
	if label != "" {
		if err := validateArgs([]string{label}); err != nil {
			return nil, fmt.Errorf("invalid label: %w", err)
		}
		switch fsType {
		case "vfat":
			args = append(args, "-n", label)
		default:
			args = append(args, "-L", label)
		}
	}
	args = append(args, device)

	res, err := runDiskCommand(binary, args, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("%s failed: %w", binary, err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("%s exited with code %d", binary, res.ExitCode)
	}
	return res, nil
}

// PartitionDisk creates a partition table and a single partition spanning the
// whole device using parted. label is "gpt" or "msdos".
func PartitionDisk(device, label, partType string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if err := validateDevice(device); err != nil {
		return nil, err
	}

	// Create partition table
	res, err := runDiskCommand("parted", []string{"-s", device, "mklabel", label}, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("parted mklabel failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("parted mklabel exited with code %d", res.ExitCode)
	}

	// Create a partition spanning the whole disk
	res, err = runDiskCommand("parted", []string{"-s", device, "mkpart", "primary", partType, "0%", "100%"}, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("parted mkpart failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("parted mkpart exited with code %d", res.ExitCode)
	}
	return res, nil
}

// CreateRAID creates a software RAID array using mdadm.
// level is "0", "1", "5", "6", "10". name is e.g. "/dev/md0".
func CreateRAID(name, level string, devices []string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if len(devices) == 0 {
		return nil, fmt.Errorf("at least one device is required")
	}
	for _, d := range devices {
		if err := validateDevice(d); err != nil {
			return nil, fmt.Errorf("invalid device %q: %w", d, err)
		}
	}

	args := []string{"--create", name, "--level=" + level, fmt.Sprintf("--raid-devices=%d", len(devices))}
	args = append(args, devices...)

	res, err := runDiskCommand("mdadm", args, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("mdadm failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("mdadm exited with code %d", res.ExitCode)
	}
	return res, nil
}

// CreateVolumeGroup creates an LVM volume group using vgcreate.
func CreateVolumeGroup(vgName string, pvs []string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if len(pvs) == 0 {
		return nil, fmt.Errorf("at least one physical volume is required")
	}
	for _, d := range pvs {
		if err := validateDevice(d); err != nil {
			return nil, fmt.Errorf("invalid PV %q: %w", d, err)
		}
	}

	args := append([]string{vgName}, pvs...)
	res, err := runDiskCommand("vgcreate", args, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("vgcreate failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("vgcreate exited with code %d", res.ExitCode)
	}
	return res, nil
}

// CreateLogicalVolume creates an LVM logical volume using lvcreate.
func CreateLogicalVolume(vgName, lvName, size string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	args := []string{"-n", lvName, "-L", size, vgName}
	res, err := runDiskCommand("lvcreate", args, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("lvcreate failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("lvcreate exited with code %d", res.ExitCode)
	}
	return res, nil
}

// CreateZPool creates a ZFS pool using zpool. If raidz is true, the pool is
// created as a raidz array.
func CreateZPool(pool string, devices []string, raidz bool, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	if len(devices) == 0 {
		return nil, fmt.Errorf("at least one device is required")
	}
	for _, d := range devices {
		if err := validateDevice(d); err != nil {
			return nil, fmt.Errorf("invalid device %q: %w", d, err)
		}
	}

	args := []string{"create"}
	if raidz {
		args = append(args, "raidz")
	}
	args = append(args, pool)
	args = append(args, devices...)

	res, err := runDiskCommand("zpool", args, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("zpool create failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("zpool exited with code %d", res.ExitCode)
	}
	return res, nil
}

// CreateZDataset creates a ZFS dataset within a pool using zfs create.
func CreateZDataset(pool, dataset string, timeout time.Duration, onLine func(stream, line string)) (*systemadapter.CommandResult, error) {
	fullName := pool + "/" + dataset
	res, err := runDiskCommand("zfs", []string{"create", fullName}, timeout, onLine)
	if err != nil {
		return res, fmt.Errorf("zfs create failed: %w", err)
	}
	if res.ExitCode != 0 {
		return res, fmt.Errorf("zfs exited with code %d", res.ExitCode)
	}
	return res, nil
}
