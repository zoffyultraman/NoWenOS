package systemadapter

import (
	"bufio"
	"fmt"
	"os"
	"regexp"
	"strings"
	"time"
)

// RAIDArray represents a single software RAID array.
type RAIDArray struct {
	Name        string   `json:"name"`
	Level       string   `json:"level"`
	State       string   `json:"state"`
	Size        string   `json:"size"`
	Active      int      `json:"active"`
	Working     int      `json:"working"`
	Failed      int      `json:"failed"`
	Spare       int      `json:"spare"`
	RebuildPct  string   `json:"rebuildPct,omitempty"`
	Devices     []string `json:"devices"`
	UUID        string   `json:"uuid,omitempty"`
	Personality string   `json:"personality,omitempty"`
}

// GetRAIDStatus reads /proc/mdstat and runs mdadm --detail for each array.
// Returns an empty slice on systems without RAID (no error).
func GetRAIDStatus() ([]RAIDArray, error) {
	// First, read /proc/mdstat to discover arrays
	data, err := os.ReadFile("/proc/mdstat")
	if err != nil {
		// No /proc/mdstat means no RAID; return empty, not an error
		return []RAIDArray{}, nil
	}

	arrays := parseMdstat(string(data))

	// For each array found, get detailed info via mdadm
	for i := range arrays {
		detail, err := getMdadmDetail(arrays[i].Name)
		if err != nil {
			continue // skip arrays we can't query
		}
		arrays[i] = detail
	}

	return arrays, nil
}

// parseMdstat parses /proc/mdstat content to find RAID arrays.
func parseMdstat(content string) []RAIDArray {
	var arrays []RAIDArray
	scanner := bufio.NewScanner(strings.NewReader(content))

	mdLineRe := regexp.MustCompile(`^(md\d+)\s+:`)

	for scanner.Scan() {
		line := scanner.Text()
		matches := mdLineRe.FindStringSubmatch(line)
		if matches == nil {
			continue
		}

		array := RAIDArray{
			Name: matches[1],
		}

		// Parse the first line for level and state
		parts := strings.Fields(line)
		for i, p := range parts {
			if p == "active" || p == "inactive" {
				array.State = p
			}
			if strings.HasPrefix(p, "raid") {
				array.Level = p
			}
			// Devices are listed after the level info, e.g. [sda1][sdb1]
			if strings.HasPrefix(p, "[") && strings.HasSuffix(p, "]") {
				dev := strings.Trim(p, "[]")
				if dev != "" {
					array.Devices = append(array.Devices, dev)
				}
			}
			_ = i
		}

		// Second line usually has size info: "1234560 blocks super 1.2 level 5, ..."
		if scanner.Scan() {
			detailLine := scanner.Text()
			detailParts := strings.Fields(detailLine)
			if len(detailParts) > 1 && detailParts[1] == "blocks" {
				array.Size = detailParts[0] + " blocks"
			}
		}

		arrays = append(arrays, array)
	}

	return arrays
}

// getMdadmDetail runs mdadm --detail /dev/<name> and parses the output.
func getMdadmDetail(name string) (RAIDArray, error) {
	result, err := Run("mdadm", []string{"--detail", fmt.Sprintf("/dev/%s", name)}, 10*time.Second)
	if err != nil {
		return RAIDArray{}, err
	}
	if result.ExitCode != 0 {
		return RAIDArray{}, fmt.Errorf("mdadm exited with code %d", result.ExitCode)
	}

	array := RAIDArray{Name: name}
	scanner := bufio.NewScanner(strings.NewReader(result.Stdout))

	for scanner.Scan() {
		line := scanner.Text()
		trimmed := strings.TrimSpace(line)

		switch {
		case strings.HasPrefix(trimmed, "Raid Level"):
			array.Level = strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1])
		case strings.HasPrefix(trimmed, "State"):
			array.State = strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1])
		case strings.HasPrefix(trimmed, "Array Size"):
			array.Size = strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1])
		case strings.HasPrefix(trimmed, "Active Devices"):
			fmt.Sscanf(strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1]), "%d", &array.Active)
		case strings.HasPrefix(trimmed, "Working Devices"):
			fmt.Sscanf(strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1]), "%d", &array.Working)
		case strings.HasPrefix(trimmed, "Failed Devices"):
			fmt.Sscanf(strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1]), "%d", &array.Failed)
		case strings.HasPrefix(trimmed, "Spare Devices"):
			fmt.Sscanf(strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1]), "%d", &array.Spare)
		case strings.HasPrefix(trimmed, "UUID"):
			array.UUID = strings.TrimSpace(strings.SplitN(trimmed, ":", 2)[1])
		case strings.HasPrefix(trimmed, "Raid Level"):
			// handled above
		case strings.Contains(trimmed, "rebuild"):
			re := regexp.MustCompile(`(\d+\.?\d*)%`)
			if m := re.FindStringSubmatch(trimmed); m != nil {
				array.RebuildPct = m[1] + "%"
			}
		}

		// Parse device lines like: "   0     8       1        0      active sync   /dev/sda1"
		devRe := regexp.MustCompile(`^\s+\d+\s+\d+\s+\d+\s+\d+\s+\S+.*(/dev/\S+)\s*$`)
		if m := devRe.FindStringSubmatch(line); m != nil {
			array.Devices = append(array.Devices, m[1])
		}
	}

	// Normalize level
	array.Level = normalizeRAIDLevel(array.Level)

	return array, nil
}

func normalizeRAIDLevel(level string) string {
	switch strings.ToLower(level) {
	case "raid0", "0":
		return "RAID 0"
	case "raid1", "1":
		return "RAID 1"
	case "raid5", "5":
		return "RAID 5"
	case "raid6", "6":
		return "RAID 6"
	case "raid10", "10":
		return "RAID 10"
	default:
		return level
	}
}
