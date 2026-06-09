package sysinfo

import (
	"bufio"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strings"
)

type HardwareInfo struct {
	Hostname    string        `json:"hostname"`
	OS          string        `json:"os"`
	Arch        string        `json:"arch"`
	Kernel      string        `json:"kernel"`
	CPUModel    string        `json:"cpuModel"`
	CPUCores    int           `json:"cpuCores"`
	TotalMemory string        `json:"totalMemory"`
	BoardVendor string        `json:"boardVendor"`
	BoardName   string        `json:"boardName"`
	BIOSVendor  string        `json:"biosVendor"`
	BIOSVersion string        `json:"biosVersion"`
	GoVersion   string        `json:"goVersion"`
	Temperature []ThermalZone `json:"temperature"`
}

type ThermalZone struct {
	Type string `json:"type"`
	Temp string `json:"temp"`
}

func GetHardwareInfo() (*HardwareInfo, error) {
	info := &HardwareInfo{
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		GoVersion: runtime.Version(),
		CPUCores:  runtime.NumCPU(),
	}

	if h, err := os.Hostname(); err == nil {
		info.Hostname = h
	}

	if data, err := os.ReadFile("/proc/version"); err == nil {
		info.Kernel = strings.TrimSpace(string(data))
		if idx := strings.Index(info.Kernel, "("); idx > 0 {
			info.Kernel = strings.TrimSpace(info.Kernel[:idx])
		}
	}

	if file, err := os.Open("/proc/cpuinfo"); err == nil {
		defer file.Close()
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			line := scanner.Text()
			if strings.HasPrefix(line, "model name") {
				parts := strings.SplitN(line, ":", 2)
				if len(parts) == 2 {
					info.CPUModel = strings.TrimSpace(parts[1])
				}
				break
			}
		}
	}

	if file, err := os.Open("/proc/meminfo"); err == nil {
		defer file.Close()
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			fields := strings.Fields(scanner.Text())
			if len(fields) >= 2 && fields[0] == "MemTotal:" {
				info.TotalMemory = formatKB(parseUint(fields[1]))
				break
			}
		}
	}

	info.BoardVendor = readFileTrimmed("/sys/class/dmi/id/board_vendor")
	info.BoardName = readFileTrimmed("/sys/class/dmi/id/board_name")
	info.BIOSVendor = readFileTrimmed("/sys/class/dmi/id/bios_vendor")
	info.BIOSVersion = readFileTrimmed("/sys/class/dmi/id/bios_version")
	info.Temperature = readThermalZones()

	if info.Kernel == "" {
		if out, err := exec.Command("uname", "-r").Output(); err == nil {
			info.Kernel = strings.TrimSpace(string(out))
		}
	}
	if info.CPUModel == "" {
		info.CPUModel = runtime.GOARCH + " processor"
	}

	return info, nil
}

func readFileTrimmed(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

func readThermalZones() []ThermalZone {
	zones := make([]ThermalZone, 0)
	entries, err := os.ReadDir("/sys/class/thermal")
	if err != nil {
		return zones
	}
	for _, entry := range entries {
		name := entry.Name()
		if !strings.HasPrefix(name, "thermal_zone") {
			continue
		}
		base := "/sys/class/thermal/" + name
		zoneType := readFileTrimmed(base + "/type")
		tempStr := readFileTrimmed(base + "/temp")
		if tempStr == "" {
			continue
		}
		t := parseUint(tempStr)
		var tempC string
		if t > 1000 {
			tempC = fmt.Sprintf("%d C", t/1000)
		} else {
			tempC = fmt.Sprintf("%d C", t)
		}
		if zoneType == "" {
			zoneType = name
		}
		zones = append(zones, ThermalZone{Type: zoneType, Temp: tempC})
	}
	return zones
}

func parseUint(s string) uint64 {
	var n uint64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			n = n*10 + uint64(c-'0')
		}
	}
	return n
}
