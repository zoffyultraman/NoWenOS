package systemadapter

import (
	"bufio"
	"encoding/json"
	"regexp"
	"strings"
	"time"
)

// ZFSInfo contains ZFS pool and dataset information.
type ZFSInfo struct {
	Pools    []ZFSPool    `json:"pools"`
	Datasets []ZFSDataset `json:"datasets"`
}

// ZFSPool represents a ZFS storage pool.
type ZFSPool struct {
	Name      string     `json:"name"`
	Size      string     `json:"size"`
	Allocated string     `json:"allocated"`
	Free      string     `json:"free"`
	Health    string     `json:"health"`
	ReadOnly  string     `json:"readOnly,omitempty"`
	Scan      string     `json:"scan,omitempty"`
	Devices   []ZFSVDev  `json:"devices"`
}

// ZFSVDev represents a virtual device in a ZFS pool.
type ZFSVDev struct {
	Name     string `json:"name"`
	State    string `json:"state"`
	Read     string `json:"read,omitempty"`
	Write    string `json:"write,omitempty"`
	Cksum    string `json:"cksum,omitempty"`
	Children []ZFSVDev `json:"children,omitempty"`
}

// ZFSDataset represents a ZFS dataset or volume.
type ZFSDataset struct {
	Name     string `json:"name"`
	Used     string `json:"used"`
	Avail    string `json:"avail"`
	Refer    string `json:"refer"`
	Mountpoint string `json:"mountpoint,omitempty"`
	Type     string `json:"type"`
}

// zpoolStatus is the JSON structure from zpool status -j.
// We'll parse the text output instead for broader compatibility.

// GetZFSInfo runs zpool status and zfs list to gather ZFS information.
// Returns empty ZFSInfo on systems without ZFS (no error).
func GetZFSInfo() (ZFSInfo, error) {
	info := ZFSInfo{
		Pools:    []ZFSPool{},
		Datasets: []ZFSDataset{},
	}

	if !IsBinaryAvailable("zpool") {
		return info, nil
	}

	// Get pool status
	if poolResult, err := Run("zpool", []string{"status"}, 15*time.Second); err == nil && poolResult.ExitCode == 0 {
		info.Pools = parseZpoolStatus(poolResult.Stdout)
	}

	// Get datasets via zfs list -j (JSON)
	if IsBinaryAvailable("zfs") {
		if dsResult, err := Run("zfs", []string{"list", "-j"}, 15*time.Second); err == nil && dsResult.ExitCode == 0 {
			if datasets := parseZFSListJSON(dsResult.Stdout); len(datasets) > 0 {
				info.Datasets = datasets
			}
		} else {
			// Fallback: parse text output
			if dsResult, err := Run("zfs", []string{"list"}, 15*time.Second); err == nil && dsResult.ExitCode == 0 {
				info.Datasets = parseZFSListText(dsResult.Stdout)
			}
		}
	}

	return info, nil
}

// parseZpoolStatus parses the text output of `zpool status`.
func parseZpoolStatus(output string) []ZFSPool {
	var pools []ZFSPool
	scanner := bufio.NewScanner(strings.NewReader(output))

	var current *ZFSPool
	inConfig := false

	poolRe := regexp.MustCompile(`^\s*pool:\s+(.+)$`)
	stateRe := regexp.MustCompile(`^\s*state:\s+(.+)$`)
	readonlyRe := regexp.MustCompile(`^\s*readonly:\s+(.+)$`)
	scanRe := regexp.MustCompile(`^\s*scan:\s+(.+)$`)
	// Lines like:  	NAME        STATE     READ  WRITE  CKSUM
	// and:          mirror-0    ONLINE       0     0     0
	devRe := regexp.MustCompile(`^\s+(\S+)\s+(ONLINE|DEGRADED|FAULTED|UNAVAIL|REMOVED)\s+(\S+)\s+(\S+)\s+(\S+)`)

	for scanner.Scan() {
		line := scanner.Text()

		if m := poolRe.FindStringSubmatch(line); m != nil {
			if current != nil {
				pools = append(pools, *current)
			}
			current = &ZFSPool{
				Name:    m[1],
				Devices: []ZFSVDev{},
			}
			inConfig = false
			continue
		}

		if current == nil {
			continue
		}

		if m := stateRe.FindStringSubmatch(line); m != nil {
			current.Health = m[1]
			continue
		}

		if m := readonlyRe.FindStringSubmatch(line); m != nil {
			current.ReadOnly = m[1]
			continue
		}

		if m := scanRe.FindStringSubmatch(line); m != nil {
			current.Scan = m[1]
			continue
		}

		if strings.Contains(line, "config:") {
			inConfig = true
			continue
		}

		if inConfig {
			// End of config section when we hit a blank line or "errors:"
			if strings.TrimSpace(line) == "" || strings.HasPrefix(strings.TrimSpace(line), "errors:") {
				inConfig = false
				continue
			}

			if m := devRe.FindStringSubmatch(line); m != nil {
				dev := ZFSVDev{
					Name:  m[1],
					State: m[2],
					Read:  m[3],
					Write: m[4],
					Cksum: m[5],
				}
				// Distinguish pool-level vs child devices by indentation
				indent := len(line) - len(strings.TrimLeft(line, " \t"))
				if indent == 0 {
					current.Devices = append(current.Devices, dev)
				} else if len(current.Devices) > 0 {
					last := len(current.Devices) - 1
					current.Devices[last].Children = append(current.Devices[last].Children, dev)
				}
			}

			// Pool capacity line like: "  pool_name  1.5T  500G  1.0T"
			// We parse size info from the first device line (the pool itself)
			capRe := regexp.MustCompile(`^\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)`)
			if m := capRe.FindStringSubmatch(line); m != nil && m[1] == current.Name {
				current.Size = m[2]
				current.Allocated = m[3]
				current.Free = m[4]
			}
		}
	}

	if current != nil {
		pools = append(pools, *current)
	}

	return pools
}

// parseZFSListJSON parses the JSON output of `zfs list -j`.
func parseZFSListJSON(output string) []ZFSDataset {
	// zfs list -j outputs a JSON object with a "datasets" key
	var raw map[string]json.RawMessage
	if err := json.Unmarshal([]byte(output), &raw); err != nil {
		return nil
	}

	dsRaw, ok := raw["datasets"]
	if !ok {
		return nil
	}

	// The JSON structure varies by zfs version; try generic parse
	var dsList []map[string]interface{}
	if err := json.Unmarshal(dsRaw, &dsList); err != nil {
		return nil
	}

	var datasets []ZFSDataset
	for _, ds := range dsList {
		dataset := ZFSDataset{}

		if name, ok := ds["name"].(string); ok {
			dataset.Name = name
		}
		if used, ok := ds["used"].(map[string]interface{}); ok {
			if bytes, ok := used["value"].(float64); ok {
				dataset.Used = formatBytes(int64(bytes))
			} else if s, ok := used["string"].(string); ok {
				dataset.Used = s
			}
		}
		if avail, ok := ds["available"].(map[string]interface{}); ok {
			if bytes, ok := avail["value"].(float64); ok {
				dataset.Avail = formatBytes(int64(bytes))
			} else if s, ok := avail["string"].(string); ok {
				dataset.Avail = s
			}
		}
		if refer, ok := ds["referenced"].(map[string]interface{}); ok {
			if bytes, ok := refer["value"].(float64); ok {
				dataset.Refer = formatBytes(int64(bytes))
			} else if s, ok := refer["string"].(string); ok {
				dataset.Refer = s
			}
		}
		if mp, ok := ds["mountpoint"].(string); ok {
			dataset.Mountpoint = mp
		}
		if dsType, ok := ds["type"].(string); ok {
			dataset.Type = dsType
		}

		datasets = append(datasets, dataset)
	}

	return datasets
}

// parseZFSListText parses the text output of `zfs list` as a fallback.
func parseZFSListText(output string) []ZFSDataset {
	var datasets []ZFSDataset
	scanner := bufio.NewScanner(strings.NewReader(output))

	// Skip header line
	if !scanner.Scan() {
		return datasets
	}

	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}

		dataset := ZFSDataset{
			Name:  fields[0],
			Used:  fields[1],
			Avail: fields[3],
		}
		if len(fields) > 5 {
			dataset.Mountpoint = fields[5]
		}

		// Determine type from name
		if strings.Contains(dataset.Name, "/") {
			dataset.Type = "filesystem"
		} else {
			dataset.Type = "pool"
		}

		datasets = append(datasets, dataset)
	}

	return datasets
}
