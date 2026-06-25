package systemadapter

import (
	"encoding/json"
	"fmt"
	"time"
)

// Mountpoint represents a single filesystem mount from findmnt.
type Mountpoint struct {
	Source  string `json:"source"`
	Target  string `json:"target"`
	Fstype  string `json:"fstype"`
	Options string `json:"options"`
	Size    string `json:"size,omitempty"`
	Used    string `json:"used,omitempty"`
	UsedPct int    `json:"usedPct,omitempty"`
}

// GetMountpoints runs findmnt -Jo and parses the filesystem list.
func GetMountpoints() ([]Mountpoint, error) {
	result, err := Run("findmnt", []string{"-Jo"}, 10*time.Second)
	if err != nil {
		return nil, fmt.Errorf("findmnt failed: %w", err)
	}

	var resp struct {
		Filesystems []struct {
			Source  string `json:"source"`
			Target  string `json:"target"`
			Fstype  string `json:"fstype"`
			Options string `json:"options"`
		} `json:"filesystems"`
	}

	if err := json.Unmarshal([]byte(result.Stdout), &resp); err != nil {
		return nil, fmt.Errorf("failed to parse findmnt output: %w", err)
	}

	usage := getDiskUsage()

	mounts := make([]Mountpoint, 0, len(resp.Filesystems))
	for _, fs := range resp.Filesystems {
		m := Mountpoint{
			Source:  fs.Source,
			Target:  fs.Target,
			Fstype:  fs.Fstype,
			Options: fs.Options,
		}
		if u, ok := usage[fs.Target]; ok {
			m.Used = formatBytes(u.UsedBytes)
			m.UsedPct = u.UsedPct
			m.Size = formatBytes(u.UsedBytes + u.AvailBytes)
		}
		mounts = append(mounts, m)
	}

	return mounts, nil
}
