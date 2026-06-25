package systemadapter

import (
	"encoding/json"
	"fmt"
	"regexp"
	"time"
)

// validDeviceName matches Linux block device names like sda, nvme0n1, vda, etc.
var validDeviceName = regexp.MustCompile(`^[a-z]+[0-9]*$`)

// SmartInfo holds parsed SMART health data from smartctl.
type SmartInfo struct {
	Device       string `json:"device"`
	ModelName    string `json:"modelName"`
	SerialNumber string `json:"serialNumber"`
	Firmware     string `json:"firmware"`
	SmartStatus  struct {
		Passed bool `json:"passed"`
	} `json:"smart_status"`
	PowerOnHours int64  `json:"powerOnHours"`
	Temperature  int    `json:"temperature"`
	Reallocated  int64  `json:"reallocatedSectors"`
	PendingSects int64  `json:"pendingSectors"`
	Uncorrectable int64 `json:"uncorrectableErrors"`
	RawJSON      string `json:"rawJson,omitempty"`
}

// GetSmartInfo runs smartctl -a --json /dev/<device> and parses the output.
// Device name is validated against a strict pattern to prevent injection.
func GetSmartInfo(device string) (*SmartInfo, error) {
	if !validDeviceName.MatchString(device) {
		return nil, fmt.Errorf("invalid device name: %q", device)
	}

	result, err := Run("smartctl", []string{"-a", "--json", "/dev/" + device}, 30*time.Second)
	if err != nil {
		return nil, fmt.Errorf("smartctl failed: %w", err)
	}

	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(result.Stdout), &raw); err != nil {
		return nil, fmt.Errorf("failed to parse smartctl output: %w", err)
	}

	info := &SmartInfo{
		Device:  device,
		RawJSON: result.Stdout,
	}

	if v, ok := raw["model_name"].(string); ok {
		info.ModelName = v
	}
	if v, ok := raw["serial_number"].(string); ok {
		info.SerialNumber = v
	}
	if v, ok := raw["firmware_version"].(string); ok {
		info.Firmware = v
	}

	if ss, ok := raw["smart_status"].(map[string]interface{}); ok {
		if passed, ok := ss["passed"].(bool); ok {
			info.SmartStatus.Passed = passed
		}
	}

	if v, ok := raw["power_on_time"].(map[string]interface{}); ok {
		if hours, ok := v["hours"].(float64); ok {
			info.PowerOnHours = int64(hours)
		}
	}

	if v, ok := raw["temperature"].(map[string]interface{}); ok {
		if temp, ok := v["current"].(float64); ok {
			info.Temperature = int(temp)
		}
	}

	if attrs, ok := raw["ata_smart_attributes"].(map[string]interface{}); ok {
		if table, ok := attrs["table"].([]interface{}); ok {
			for _, attr := range table {
				a, ok := attr.(map[string]interface{})
				if !ok {
					continue
				}
				name, _ := a["name"].(string)
				rawVal, _ := a["raw"].(map[string]interface{})
				val, _ := rawVal["value"].(float64)
				switch name {
				case "Reallocated_Sector_Ct":
					info.Reallocated = int64(val)
				case "Current_Pending_Sector":
					info.PendingSects = int64(val)
				case "Offline_Uncorrectable":
					info.Uncorrectable = int64(val)
				}
			}
		}
	}

	return info, nil
}
