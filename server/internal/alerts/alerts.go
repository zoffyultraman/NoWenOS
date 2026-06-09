package alerts

import (
	"errors"
	"fmt"
	"sync"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/sysinfo"
)

type AlertRule struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Metric    string `json:"metric"`    // cpu, memory, disk
	Operator  string `json:"operator"`  // gt, lt
	Threshold float64 `json:"threshold"`
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"createdAt"`
}

type AlertEvent struct {
	ID        int64  `json:"id"`
	RuleID    int64  `json:"ruleId"`
	RuleName  string `json:"ruleName"`
	Metric    string `json:"metric"`
	Value     float64 `json:"value"`
	Threshold float64 `json:"threshold"`
	Message   string `json:"message"`
	Level     string `json:"level"` // warning, critical
	Seen      bool   `json:"seen"`
	CreatedAt string `json:"createdAt"`
}

type CreateRuleRequest struct {
	Name      string  `json:"name"`
	Metric    string  `json:"metric"`
	Operator  string  `json:"operator"`
	Threshold float64 `json:"threshold"`
}

var (
	checkMu    sync.Mutex
	checkTimer *time.Timer
)

func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS alert_rules (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		metric TEXT NOT NULL,
		operator TEXT NOT NULL DEFAULT 'gt',
		threshold REAL NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS alert_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		rule_id INTEGER NOT NULL,
		rule_name TEXT NOT NULL,
		metric TEXT NOT NULL,
		value REAL NOT NULL,
		threshold REAL NOT NULL,
		message TEXT NOT NULL,
		level TEXT NOT NULL DEFAULT 'warning',
		seen INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE
	)`)
}

func GetRules() []AlertRule {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, name, metric, operator, threshold, enabled, created_at FROM alert_rules ORDER BY id")
	if err != nil {
		return []AlertRule{}
	}
	defer rows.Close()

	rules := make([]AlertRule, 0)
	for rows.Next() {
		var r AlertRule
		var enabled int
		if err := rows.Scan(&r.ID, &r.Name, &r.Metric, &r.Operator, &r.Threshold, &enabled, &r.CreatedAt); err != nil {
			continue
		}
		r.Enabled = enabled == 1
		rules = append(rules, r)
	}
	return rules
}

func CreateRule(req CreateRuleRequest) (*AlertRule, error) {
	if req.Name == "" {
		return nil, errors.New("rule name is required")
	}
	if req.Metric != "cpu" && req.Metric != "memory" && req.Metric != "disk" {
		return nil, errors.New("metric must be cpu, memory, or disk")
	}
	if req.Operator != "gt" && req.Operator != "lt" {
		return nil, errors.New("operator must be gt or lt")
	}
	if req.Threshold <= 0 || req.Threshold > 100 {
		return nil, errors.New("threshold must be between 0 and 100")
	}

	db := database.GetDB()
	result, err := db.Exec(
		"INSERT INTO alert_rules (name, metric, operator, threshold, enabled) VALUES (?, ?, ?, ?, 1)",
		req.Name, req.Metric, req.Operator, req.Threshold,
	)
	if err != nil {
		return nil, err
	}

	id, _ := result.LastInsertId()
	var r AlertRule
	var enabled int
	db.QueryRow("SELECT id, name, metric, operator, threshold, enabled, created_at FROM alert_rules WHERE id = ?", id).
		Scan(&r.ID, &r.Name, &r.Metric, &r.Operator, &r.Threshold, &enabled, &r.CreatedAt)
	r.Enabled = enabled == 1
	return &r, nil
}

func DeleteRule(id int64) error {
	db := database.GetDB()
	result, err := db.Exec("DELETE FROM alert_rules WHERE id = ?", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("rule not found")
	}
	// Also delete related events
	db.Exec("DELETE FROM alert_events WHERE rule_id = ?", id)
	return nil
}

func ToggleRule(id int64, enabled bool) error {
	db := database.GetDB()
	_, err := db.Exec("UPDATE alert_rules SET enabled = ? WHERE id = ?", boolToInt(enabled), id)
	return err
}

func GetEvents(limit int) []AlertEvent {
	if limit <= 0 {
		limit = 50
	}
	db := database.GetDB()
	rows, err := db.Query("SELECT id, rule_id, rule_name, metric, value, threshold, message, level, seen, created_at FROM alert_events ORDER BY id DESC LIMIT ?", limit)
	if err != nil {
		return []AlertEvent{}
	}
	defer rows.Close()

	events := make([]AlertEvent, 0)
	for rows.Next() {
		var e AlertEvent
		var seen int
		if err := rows.Scan(&e.ID, &e.RuleID, &e.RuleName, &e.Metric, &e.Value, &e.Threshold, &e.Message, &e.Level, &seen, &e.CreatedAt); err != nil {
			continue
		}
		e.Seen = seen == 1
		events = append(events, e)
	}
	return events
}

func GetUnseenCount() int {
	db := database.GetDB()
	var count int
	db.QueryRow("SELECT COUNT(*) FROM alert_events WHERE seen = 0").Scan(&count)
	return count
}

func MarkAllSeen() error {
	db := database.GetDB()
	_, err := db.Exec("UPDATE alert_events SET seen = 1 WHERE seen = 0")
	return err
}

func ClearEvents() error {
	db := database.GetDB()
	_, err := db.Exec("DELETE FROM alert_events")
	return err
}

// CheckRules evaluates all enabled rules against current system stats
func CheckRules() {
	checkMu.Lock()
	defer checkMu.Unlock()

	stats, err := sysinfo.GetStats()
	if err != nil {
		return
	}

	rules := GetRules()
	db := database.GetDB()

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}

		var value float64
		switch rule.Metric {
		case "cpu":
			value = stats.CPU.Usage
		case "memory":
			value = stats.Memory.Usage
		case "disk":
			value = stats.Disk.Usage
		default:
			continue
		}

		triggered := false
		switch rule.Operator {
		case "gt":
			triggered = value > rule.Threshold
		case "lt":
			triggered = value < rule.Threshold
		}

		if triggered {
			// Check if we already have a recent alert for this rule (avoid spam)
			var recentCount int
			db.QueryRow(
				"SELECT COUNT(*) FROM alert_events WHERE rule_id = ? AND created_at > datetime('now', '-5 minutes')",
				rule.ID,
			).Scan(&recentCount)

			if recentCount == 0 {
				level := "warning"
				if rule.Operator == "gt" && value > rule.Threshold*1.2 {
					level = "critical"
				}

				message := fmt.Sprintf("%s: %s is %.1f%% (threshold: %.1f%%)", rule.Name, rule.Metric, value, rule.Threshold)
				db.Exec(
					"INSERT INTO alert_events (rule_id, rule_name, metric, value, threshold, message, level) VALUES (?, ?, ?, ?, ?, ?, ?)",
					rule.ID, rule.Name, rule.Metric, value, rule.Threshold, message, level,
				)
			}
		}
	}
}

// StartPeriodicCheck runs alert checks every 30 seconds
func StartPeriodicCheck() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			CheckRules()
		}
	}()
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
