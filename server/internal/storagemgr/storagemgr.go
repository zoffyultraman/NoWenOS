package storagemgr

import (
	"encoding/json"
	"fmt"

	"nowenos-server/internal/systemadapter"
	"nowenos-server/internal/taskqueue"
)

// DiskInfo is a convenience alias of systemadapter.DiskInfo exposed through
// the storagemgr package so that API consumers only need to import one package.
type DiskInfo = systemadapter.DiskInfo

// ─── Payload structs ────────────────────────────────────────────────────────

// WipePayload is the JSON payload stored in the tasks table for a wipe task.
type WipePayload struct {
	Device string `json:"device"`
	Method string `json:"method"` // "quick" or "full"
}

// FormatPayload is the JSON payload for a format task.
type FormatPayload struct {
	Device string `json:"device"`
	FSType string `json:"fs_type"` // ext4, xfs, btrfs
	Label  string `json:"label"`
}

// PartitionPayload is the JSON payload for a partition task.
type PartitionPayload struct {
	Device   string `json:"device"`
	Label    string `json:"label"`     // gpt, msdos
	PartType string `json:"part_type"` // e.g. "ext4", "xfs", or empty for default
}

// ─── Task-queue wrappers ────────────────────────────────────────────────────

// WipeDisk enqueues a disk-wipe task.  When quick is true only wipefs -a is
// run; when false a full zero-fill (dd) is appended.  Returns the task ID for
// polling via GET /api/v1/tasks/:id.
func WipeDisk(devicePath string, quick bool) (int64, error) {
	if devicePath == "" {
		return 0, fmt.Errorf("device path is required")
	}
	if err := CheckDeviceSafety(devicePath); err != nil {
		return 0, fmt.Errorf("safety check blocked wipe: %w", err)
	}
	method := "quick"
	if !quick {
		method = "full"
	}
	payload, _ := json.Marshal(WipePayload{
		Device: devicePath,
		Method: method,
	})
	return taskqueue.CreateTask("wipe", string(payload))
}

// FormatDisk enqueues a mkfs task.  fsType must be one of ext4, xfs, btrfs.
func FormatDisk(devicePath, fsType, label string) (int64, error) {
	if devicePath == "" {
		return 0, fmt.Errorf("device path is required")
	}
	if err := CheckDeviceSafety(devicePath); err != nil {
		return 0, fmt.Errorf("safety check blocked format: %w", err)
	}
	if fsType == "" {
		fsType = "ext4"
	}
	payload, _ := json.Marshal(FormatPayload{
		Device: devicePath,
		FSType: fsType,
		Label:  label,
	})
	return taskqueue.CreateTask("format", string(payload))
}

// PartitionDisk enqueues a parted task that creates a GPT label and a single
// partition spanning the whole disk.
func PartitionDisk(devicePath string, partType string) (int64, error) {
	if devicePath == "" {
		return 0, fmt.Errorf("device path is required")
	}
	if err := CheckDeviceSafety(devicePath); err != nil {
		return 0, fmt.Errorf("safety check blocked partition: %w", err)
	}
	payload, _ := json.Marshal(PartitionPayload{
		Device:   devicePath,
		Label:    "gpt",
		PartType: partType,
	})
	return taskqueue.CreateTask("partition", string(payload))
}

// ─── Read-only queries ──────────────────────────────────────────────────────

// ListDisks returns information about every block device visible to lsblk.
func ListDisks() ([]DiskInfo, error) {
	return systemadapter.GetDisks()
}

// GetDiskInfo returns information for a single device identified by its path
// (e.g. "/dev/sda").  Returns an error if the device is not found.
func GetDiskInfo(devicePath string) (*DiskInfo, error) {
	if devicePath == "" {
		return nil, fmt.Errorf("device path is required")
	}
	disks, err := systemadapter.GetDisks()
	if err != nil {
		return nil, err
	}
	for i := range disks {
		devName := "/dev/" + disks[i].Name
		if devName == devicePath || disks[i].Name == devicePath {
			return &disks[i], nil
		}
	}
	return nil, fmt.Errorf("device not found: %s", devicePath)
}
