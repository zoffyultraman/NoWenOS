package configmgr

import (
	"nowenos-server/internal/database"
)

type ExportData struct {
	Version  int               `json:"version"`
	Users    []UserExport      `json:"users"`
	Shares   []ShareExport     `json:"shares"`
	Settings map[string]string `json:"settings"`
	Groups   []GroupExport     `json:"groups"`
	Alerts   []AlertRuleExport `json:"alertRules"`
}

type UserExport struct {
	Username string `json:"username"`
	Role     string `json:"role"`
}

type ShareExport struct {
	Name     string `json:"name"`
	Path     string `json:"path"`
	Protocol string `json:"protocol"`
	ReadOnly bool   `json:"readOnly"`
	Guest    bool   `json:"guest"`
	Comment  string `json:"comment"`
}

type GroupExport struct {
	Name    string   `json:"name"`
	Comment string   `json:"comment"`
	Members []string `json:"members"`
}

type AlertRuleExport struct {
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Operator  string  `json:"operator"`
	Threshold float64 `json:"threshold"`
	Enabled   bool    `json:"enabled"`
}

func Export() (*ExportData, error) {
	db := database.GetDB()
	data := &ExportData{Version: 1}

	// Users
	rows, err := db.Query("SELECT username, role FROM users ORDER BY id")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var u UserExport
			if rows.Scan(&u.Username, &u.Role) == nil {
				data.Users = append(data.Users, u)
			}
		}
	}

	// Shares
	rows2, err := db.Query("SELECT name, path, protocol, read_only, guest, comment FROM shares ORDER BY id")
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var s ShareExport
			var ro, guest int
			if rows2.Scan(&s.Name, &s.Path, &s.Protocol, &ro, &guest, &s.Comment) == nil {
				s.ReadOnly = ro == 1
				s.Guest = guest == 1
				data.Shares = append(data.Shares, s)
			}
		}
	}

	// Settings
	rows3, err := db.Query("SELECT key, value FROM settings")
	if err == nil {
		defer rows3.Close()
		data.Settings = make(map[string]string)
		for rows3.Next() {
			var k, v string
			if rows3.Scan(&k, &v) == nil {
				data.Settings[k] = v
			}
		}
	}

	// Groups
	rows4, err := db.Query("SELECT id, name, comment FROM groups ORDER BY id")
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var g GroupExport
			var gid int64
			if rows4.Scan(&gid, &g.Name, &g.Comment) == nil {
				// Get members
				memberRows, err := db.Query("SELECT username FROM user_groups WHERE group_id = ?", gid)
				if err == nil {
					for memberRows.Next() {
						var m string
						if memberRows.Scan(&m) == nil {
							g.Members = append(g.Members, m)
						}
					}
					memberRows.Close()
				}
				data.Groups = append(data.Groups, g)
			}
		}
	}

	// Alert rules
	rows5, err := db.Query("SELECT name, metric, operator, threshold, enabled FROM alert_rules ORDER BY id")
	if err == nil {
		defer rows5.Close()
		for rows5.Next() {
			var a AlertRuleExport
			var enabled int
			if rows5.Scan(&a.Name, &a.Metric, &a.Operator, &a.Threshold, &enabled) == nil {
				a.Enabled = enabled == 1
				data.Alerts = append(data.Alerts, a)
			}
		}
	}

	return data, nil
}

func Import(data *ExportData) error {
	db := database.GetDB()

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Import users (skip if exists)
	for _, u := range data.Users {
		tx.Exec("INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)", u.Username, u.Username, u.Role)
	}

	// Import groups
	for _, g := range data.Groups {
		result, err := tx.Exec("INSERT OR IGNORE INTO groups (name, comment) VALUES (?, ?)", g.Name, g.Comment)
		if err == nil {
			gid, _ := result.LastInsertId()
			if gid > 0 {
				for _, m := range g.Members {
					tx.Exec("INSERT OR IGNORE INTO user_groups (username, group_id) VALUES (?, ?)", m, gid)
				}
			}
		}
	}

	// Import shares
	for _, s := range data.Shares {
		ro := 0
		if s.ReadOnly {
			ro = 1
		}
		guest := 0
		if s.Guest {
			guest = 1
		}
		tx.Exec("INSERT OR IGNORE INTO shares (name, path, protocol, enabled, read_only, guest, comment) VALUES (?, ?, ?, 1, ?, ?, ?)",
			s.Name, s.Path, s.Protocol, ro, guest, s.Comment)
	}

	// Import settings
	for k, v := range data.Settings {
		tx.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", k, v)
	}

	// Import alert rules
	for _, a := range data.Alerts {
		enabled := 0
		if a.Enabled {
			enabled = 1
		}
		tx.Exec("INSERT INTO alert_rules (name, metric, operator, threshold, enabled) VALUES (?, ?, ?, ?, ?)",
			a.Name, a.Metric, a.Operator, a.Threshold, enabled)
	}

	return tx.Commit()
}
