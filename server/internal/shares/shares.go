package shares

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

type Share struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Path      string `json:"path"`
	Protocol  string `json:"protocol"`
	Enabled   bool   `json:"enabled"`
	ReadOnly  bool   `json:"readOnly"`
	Guest     bool   `json:"guest"`
	Comment   string `json:"comment"`
	CreatedAt string `json:"createdAt"`
}

type CreateShareRequest struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Protocol string `json:"protocol"`
	ReadOnly bool   `json:"readOnly"`
	Guest    bool   `json:"guest"`
	Comment  string `json:"comment"`
}

func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS shares (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		path TEXT NOT NULL,
		protocol TEXT NOT NULL DEFAULT 'smb',
		enabled INTEGER NOT NULL DEFAULT 1,
		read_only INTEGER NOT NULL DEFAULT 0,
		guest INTEGER NOT NULL DEFAULT 0,
		comment TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
}

func GetShares() []Share {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, name, path, protocol, enabled, read_only, guest, comment, created_at FROM shares ORDER BY id")
	if err != nil {
		return []Share{}
	}
	defer rows.Close()

	shares := make([]Share, 0)
	for rows.Next() {
		var s Share
		var enabled, readOnly, guest int
		if err := rows.Scan(&s.ID, &s.Name, &s.Path, &s.Protocol, &enabled, &readOnly, &guest, &s.Comment, &s.CreatedAt); err != nil {
			continue
		}
		s.Enabled = enabled == 1
		s.ReadOnly = readOnly == 1
		s.Guest = guest == 1
		shares = append(shares, s)
	}
	return shares
}

func GetShare(id int64) (*Share, error) {
	db := database.GetDB()
	var s Share
	var enabled, readOnly, guest int
	err := db.QueryRow("SELECT id, name, path, protocol, enabled, read_only, guest, comment, created_at FROM shares WHERE id = ?", id).
		Scan(&s.ID, &s.Name, &s.Path, &s.Protocol, &enabled, &readOnly, &guest, &s.Comment, &s.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, errors.New("share not found")
	}
	if err != nil {
		return nil, err
	}
	s.Enabled = enabled == 1
	s.ReadOnly = readOnly == 1
	s.Guest = guest == 1
	return &s, nil
}

func CreateShare(req CreateShareRequest) (*Share, error) {
	if req.Name == "" {
		return nil, errors.New("share name is required")
	}
	if req.Path == "" {
		return nil, errors.New("share path is required")
	}
	if req.Protocol == "" {
		req.Protocol = "smb"
	}
	if err := ValidateSharePath(req.Path); err != nil {
		return nil, err
	}

	db := database.GetDB()
	result, err := db.Exec(
		"INSERT INTO shares (name, path, protocol, enabled, read_only, guest, comment) VALUES (?, ?, ?, 1, ?, ?, ?)",
		req.Name, req.Path, req.Protocol, boolToInt(req.ReadOnly), boolToInt(req.Guest), req.Comment,
	)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()

	if !isWindows() {
		applyShareConfig(req.Protocol)
	}

	return GetShare(id)
}

func UpdateShare(id int64, req CreateShareRequest) (*Share, error) {
	existing, err := GetShare(id)
	if err != nil {
		return nil, err
	}
	oldProtocol := existing.Protocol
	if req.Name != "" {
		existing.Name = req.Name
	}
	if req.Path != "" {
		existing.Path = req.Path
	}
	if req.Protocol != "" {
		existing.Protocol = req.Protocol
	}
	existing.ReadOnly = req.ReadOnly
	existing.Guest = req.Guest
	if req.Comment != "" {
		existing.Comment = req.Comment
	}

	db := database.GetDB()
	_, err = db.Exec(
		"UPDATE shares SET name=?, path=?, protocol=?, read_only=?, guest=?, comment=? WHERE id=?",
		existing.Name, existing.Path, existing.Protocol, boolToInt(existing.ReadOnly), boolToInt(existing.Guest), existing.Comment, id,
	)
	if err != nil {
		return nil, err
	}

	if !isWindows() {
		applyShareConfig(existing.Protocol)
		if oldProtocol != existing.Protocol {
			applyShareConfig(oldProtocol)
		}
	}
	return GetShare(id)
}

func ToggleShare(id int64, enabled bool) error {
	share, err := GetShare(id)
	if err != nil {
		return err
	}
	db := database.GetDB()
	_, err = db.Exec("UPDATE shares SET enabled = ? WHERE id = ?", boolToInt(enabled), id)
	if err != nil {
		return err
	}
	if !isWindows() {
		applyShareConfig(share.Protocol)
	}
	return nil
}

func DeleteShare(id int64) error {
	share, err := GetShare(id)
	if err != nil {
		return err
	}
	db := database.GetDB()
	result, err := db.Exec("DELETE FROM shares WHERE id = ?", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("share not found")
	}
	if !isWindows() {
		applyShareConfig(share.Protocol)
	}
	return nil
}

// ── Config Dispatch ──

func applyShareConfig(protocol string) {
	switch protocol {
	case "smb":
		applySambaConfig()
	case "webdav":
		applyWebDAVConfig()
	case "nfs":
		applyNFSConfig()
	}
}

// ── Samba ──

func applySambaConfig() {
	db := database.GetDB()
	rows, err := db.Query("SELECT name, path, read_only, guest, comment FROM shares WHERE protocol='smb' AND enabled=1")
	if err != nil {
		return
	}
	defer rows.Close()

	var config strings.Builder
	config.WriteString("# Auto-generated by NoWenOS - DO NOT EDIT MANUALLY\n")
	config.WriteString(fmt.Sprintf("# Generated at: %s\n\n", time.Now().Format(time.RFC3339)))
	config.WriteString("[global]\n")
	config.WriteString("   workgroup = WORKGROUP\n")
	config.WriteString("   server string = NoWenOS\n")
	config.WriteString("   security = user\n")
	config.WriteString("   map to guest = Bad User\n")
	config.WriteString("   dns proxy = no\n\n")

	for rows.Next() {
		var name, path, comment string
		var readOnly, guest int
		if err := rows.Scan(&name, &path, &readOnly, &guest, &comment); err != nil {
			continue
		}
		config.WriteString(fmt.Sprintf("[%s]\n", name))
		config.WriteString(fmt.Sprintf("   path = %s\n", path))
		if comment != "" {
			config.WriteString(fmt.Sprintf("   comment = %s\n", comment))
		}
		if guest == 1 {
			config.WriteString("   guest ok = yes\n")
		}
		if readOnly == 1 {
			config.WriteString("   read only = yes\n")
		} else {
			config.WriteString("   read only = no\n")
			config.WriteString("   writable = yes\n")
		}
		config.WriteString("   create mask = 0664\n")
		config.WriteString("   directory mask = 0775\n\n")
	}

	tmpPath := "/tmp/smb.conf.nowenos"
	os.WriteFile(tmpPath, []byte(config.String()), 0644)
	backupPath := fmt.Sprintf("/etc/samba/smb.conf.backup.%s", time.Now().Format("20060102150405"))
	systemadapter.CopyFile("/etc/samba/smb.conf", backupPath)
	systemadapter.CopyFile(tmpPath, "/etc/samba/smb.conf")
	systemadapter.RestartSamba()
}

// ── WebDAV (Apache mod_dav_svn / standalone) ──

func applyWebDAVConfig() {
	db := database.GetDB()
	rows, err := db.Query("SELECT name, path, read_only, comment FROM shares WHERE protocol='webdav' AND enabled=1")
	if err != nil {
		return
	}
	defer rows.Close()

	var config strings.Builder
	config.WriteString("# Auto-generated by NoWenOS - DO NOT EDIT MANUALLY\n")
	config.WriteString(fmt.Sprintf("# Generated at: %s\n\n", time.Now().Format(time.RFC3339)))
	config.WriteString("DavLockDB /var/lib/apache2/DavLock\n\n")

	for rows.Next() {
		var name, path, comment string
		var readOnly int
		if err := rows.Scan(&name, &path, &readOnly, &comment); err != nil {
			continue
		}
		alias := "/webdav/" + name
		config.WriteString(fmt.Sprintf("Alias %s %s\n", alias, path))
		config.WriteString(fmt.Sprintf("<Directory %s>\n", path))
		config.WriteString("    Dav On\n")
		if comment != "" {
			config.WriteString(fmt.Sprintf("    # %s\n", comment))
		}
		if readOnly == 1 {
			config.WriteString("    DavDepthInfinity Off\n")
			config.WriteString("    <Limit GET PROPFIND OPTIONS>\n")
			config.WriteString("        Require all granted\n")
			config.WriteString("    </Limit>\n")
			config.WriteString("    <LimitExcept GET PROPFIND OPTIONS>\n")
			config.WriteString("        Require all denied\n")
			config.WriteString("    </LimitExcept>\n")
		} else {
			config.WriteString("    Require all granted\n")
		}
		config.WriteString("</Directory>\n\n")
	}

	confPath := "/etc/apache2/sites-available/nowenos-webdav.conf"
	os.WriteFile(confPath, []byte(config.String()), 0644)
	systemadapter.EnableApacheModule([]string{"dav", "dav_fs"})
	systemadapter.EnableApacheSite("nowenos-webdav")
	systemadapter.ReloadApache()
}

// ── NFS ──

func applyNFSConfig() {
	db := database.GetDB()
	rows, err := db.Query("SELECT name, path, read_only, guest FROM shares WHERE protocol='nfs' AND enabled=1")
	if err != nil {
		return
	}
	defer rows.Close()

	var config strings.Builder
	config.WriteString("# Auto-generated by NoWenOS - DO NOT EDIT MANUALLY\n")
	config.WriteString(fmt.Sprintf("# Generated at: %s\n\n", time.Now().Format(time.RFC3339)))

	for rows.Next() {
		var name, path string
		var readOnly, guest int
		if err := rows.Scan(&name, &path, &readOnly, &guest); err != nil {
			continue
		}
		exportOpts := "sync,no_subtree_check"
		if readOnly == 1 {
			exportOpts += ",ro"
		} else {
			exportOpts += ",rw"
		}
		if guest == 1 {
			exportOpts += ",all_squash,anonuid=65534,anongid=65534"
		} else {
			exportOpts += ",root_squash"
		}
		config.WriteString(fmt.Sprintf("%s  *(%s)\n", path, exportOpts))
	}

	exportsPath := "/etc/exports.nowenos"
	os.WriteFile(exportsPath, []byte(config.String()), 0644)
	backupPath := fmt.Sprintf("/etc/exports.backup.%s", time.Now().Format("20060102150405"))
	systemadapter.CopyFile("/etc/exports", backupPath)
	systemadapter.CopyFile(exportsPath, "/etc/exports")
	systemadapter.ExportFS()
	systemadapter.ReloadNFS()
}

// ── Service Status ──

func GetSambaStatus() map[string]interface{} {
	result := map[string]interface{}{
		"installed": false,
		"running":   false,
	}
	if isWindows() {
		result["installed"] = true
		result["running"] = true
		return result
	}
	if systemadapter.IsBinaryAvailable("smbd") {
		result["installed"] = true
	}
	if active, err := systemadapter.IsServiceActive("smbd"); err == nil && active {
		result["running"] = true
	}
	return result
}

func GetWebDAVStatus() map[string]interface{} {
	result := map[string]interface{}{
		"installed": false,
		"running":   false,
	}
	if isWindows() {
		result["installed"] = true
		result["running"] = true
		return result
	}
	if systemadapter.IsBinaryAvailable("apache2") {
		result["installed"] = true
	}
	if active, err := systemadapter.IsServiceActive("apache2"); err == nil && active {
		result["running"] = true
	}
	return result
}

func GetNFSStatus() map[string]interface{} {
	result := map[string]interface{}{
		"installed": false,
		"running":   false,
	}
	if isWindows() {
		result["installed"] = true
		result["running"] = true
		return result
	}
	if systemadapter.IsBinaryAvailable("exportfs") {
		result["installed"] = true
	}
	if active, err := systemadapter.IsServiceActive("nfs-kernel-server"); err == nil && active {
		result["running"] = true
	}
	return result
}

// ── Helpers ──

func ValidateSharePath(path string) error {
	if path == "" {
		return errors.New("path is required")
	}
	absPath, err := filepath.Abs(path)
	if err != nil {
		return fmt.Errorf("invalid path: %v", err)
	}
	blockedPaths := []string{"/", "/boot", "/dev", "/etc", "/proc", "/root", "/sys", "/usr"}
	for _, blocked := range blockedPaths {
		if absPath == blocked {
			return fmt.Errorf("cannot share system path: %s", absPath)
		}
	}
	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func isWindows() bool {
	return systemadapter.IsBinaryAvailable("cmd.exe")
}
