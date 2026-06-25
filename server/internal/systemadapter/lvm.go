package systemadapter

import (
	"encoding/json"
	"time"
)

// LVMInfo contains the full LVM hierarchy.
type LVMInfo struct {
	PhysicalVolumes []PVInfo `json:"physicalVolumes"`
	VolumeGroups    []VGInfo `json:"volumeGroups"`
	LogicalVolumes  []LVInfo `json:"logicalVolumes"`
}

// PVInfo represents an LVM physical volume.
type PVInfo struct {
	Name   string `json:"name"`
	VGName string `json:"vgName"`
	Size   string `json:"size"`
	Free   string `json:"free"`
	UUID   string `json:"uuid,omitempty"`
}

// VGInfo represents an LVM volume group.
type VGInfo struct {
	Name   string `json:"name"`
	PVCount int    `json:"pvCount"`
	LVCount int    `json:"lvCount"`
	Size   string `json:"size"`
	Free   string `json:"free"`
	UUID   string `json:"uuid,omitempty"`
}

// LVInfo represents an LVM logical volume.
type LVInfo struct {
	Name   string `json:"name"`
	VGName string `json:"vgName"`
	Size   string `json:"size"`
	Path   string `json:"path,omitempty"`
	UUID   string `json:"uuid,omitempty"`
}

// pvsOutput is the JSON structure from pvs --reportformat json.
type pvsOutput struct {
	Report []struct {
		PV []struct {
			PVName string `json:"pv_name"`
			VGName string `json:"vg_name"`
			PVSize string `json:"pv_size"`
			PVFree string `json:"pv_free"`
			PVUUID string `json:"pv_uuid"`
		} `json:"pv"`
	} `json:"report"`
}

// vgsOutput is the JSON structure from vgs --reportformat json.
type vgsOutput struct {
	Report []struct {
		VG []struct {
			VGName   string `json:"vg_name"`
			PVCount  string `json:"pv_count"`
			LVCount  string `json:"lv_count"`
			VGSize   string `json:"vg_size"`
			VGFree   string `json:"vg_free"`
			VGUUID   string `json:"vg_uuid"`
		} `json:"vg"`
	} `json:"report"`
}

// lvsOutput is the JSON structure from lvs --reportformat json.
type lvsOutput struct {
	Report []struct {
		LV []struct {
			LVName string `json:"lv_name"`
			VGName string `json:"vg_name"`
			LVSize string `json:"lv_size"`
			LVPath string `json:"lv_path"`
			LVUUID string `json:"lv_uuid"`
		} `json:"lv"`
	} `json:"report"`
}

// GetLVMInfo runs pvs, vgs, lvs with JSON output to gather LVM info.
// Returns an empty LVMInfo on systems without LVM (no error).
func GetLVMInfo() (LVMInfo, error) {
	info := LVMInfo{
		PhysicalVolumes: []PVInfo{},
		VolumeGroups:    []VGInfo{},
		LogicalVolumes:  []LVInfo{},
	}

	// Check if LVM commands are available
	if !IsBinaryAvailable("pvs") {
		return info, nil
	}

	// Get PVs
	if pvResult, err := Run("pvs", []string{"--reportformat", "json", "--units", "b", "--nosuffix"}, 10*time.Second); err == nil && pvResult.ExitCode == 0 {
		var output pvsOutput
		if json.Unmarshal([]byte(pvResult.Stdout), &output) == nil {
			for _, report := range output.Report {
				for _, pv := range report.PV {
					info.PhysicalVolumes = append(info.PhysicalVolumes, PVInfo{
						Name:   pv.PVName,
						VGName: pv.VGName,
						Size:   pv.PVSize,
						Free:   pv.PVFree,
						UUID:   pv.PVUUID,
					})
				}
			}
		}
	}

	// Get VGs
	if vgResult, err := Run("vgs", []string{"--reportformat", "json", "--units", "b", "--nosuffix"}, 10*time.Second); err == nil && vgResult.ExitCode == 0 {
		var output vgsOutput
		if json.Unmarshal([]byte(vgResult.Stdout), &output) == nil {
			for _, report := range output.Report {
				for _, vg := range report.VG {
					var pvCount, lvCount int
					json.Unmarshal([]byte(vg.PVCount), &pvCount)
					json.Unmarshal([]byte(vg.LVCount), &lvCount)
					info.VolumeGroups = append(info.VolumeGroups, VGInfo{
						Name:    vg.VGName,
						PVCount: pvCount,
						LVCount: lvCount,
						Size:    vg.VGSize,
						Free:    vg.VGFree,
						UUID:    vg.VGUUID,
					})
				}
			}
		}
	}

	// Get LVs
	if lvResult, err := Run("lvs", []string{"--reportformat", "json", "--units", "b", "--nosuffix"}, 10*time.Second); err == nil && lvResult.ExitCode == 0 {
		var output lvsOutput
		if json.Unmarshal([]byte(lvResult.Stdout), &output) == nil {
			for _, report := range output.Report {
				for _, lv := range report.LV {
					info.LogicalVolumes = append(info.LogicalVolumes, LVInfo{
						Name:   lv.LVName,
						VGName: lv.VGName,
						Size:   lv.LVSize,
						Path:   lv.LVPath,
						UUID:   lv.LVUUID,
					})
				}
			}
		}
	}

	return info, nil
}
