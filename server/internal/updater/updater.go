package updater

import (
	"encoding/json"
	"net/http"
	"time"
)

const CurrentVersion = "0.5.0"
const UpdateCheckURL = "https://api.github.com/repos/cropflre/NoWenOS/releases/latest"

type VersionInfo struct {
	Current     string `json:"current"`
	Latest      string `json:"latest"`
	UpdateAvail bool   `json:"updateAvailable"`
	ReleaseURL  string `json:"releaseUrl,omitempty"`
	CheckedAt   string `json:"checkedAt"`
}

type githubRelease struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}

func GetVersionInfo() *VersionInfo {
	return &VersionInfo{
		Current:   CurrentVersion,
		CheckedAt: time.Now().Format(time.RFC3339),
	}
}

func CheckForUpdate() *VersionInfo {
	info := &VersionInfo{
		Current:   CurrentVersion,
		CheckedAt: time.Now().Format(time.RFC3339),
	}

	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequest("GET", UpdateCheckURL, nil)
	if err != nil {
		info.Latest = CurrentVersion
		return info
	}
	req.Header.Set("User-Agent", "NoWenOS/"+CurrentVersion)

	resp, err := client.Do(req)
	if err != nil {
		info.Latest = CurrentVersion
		return info
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		info.Latest = CurrentVersion
		return info
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		info.Latest = CurrentVersion
		return info
	}

	info.Latest = release.TagName
	info.ReleaseURL = release.HTMLURL
	info.UpdateAvail = release.TagName != CurrentVersion

	return info
}
