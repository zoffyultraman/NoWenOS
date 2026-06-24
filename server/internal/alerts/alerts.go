package alerts

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"strings"
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

// NotificationChannel represents a notification delivery target.
type NotificationChannel struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Type      string `json:"type"` // email, webhook, telegram
	Config    string `json:"config"` // JSON config string
	Enabled   bool   `json:"enabled"`
	CreatedAt string `json:"createdAt"`
}

// CreateChannelRequest is the input for creating a notification channel.
type CreateChannelRequest struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Config string `json:"config"`
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
	db.Exec(`CREATE TABLE IF NOT EXISTS notification_channels (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		type TEXT NOT NULL,
		config TEXT DEFAULT '{}',
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
	db.Exec(`CREATE TABLE IF NOT EXISTS rule_channels (
		rule_id INTEGER NOT NULL,
		channel_id INTEGER NOT NULL,
		PRIMARY KEY (rule_id, channel_id),
		FOREIGN KEY (rule_id) REFERENCES alert_rules(id) ON DELETE CASCADE,
		FOREIGN KEY (channel_id) REFERENCES notification_channels(id) ON DELETE CASCADE
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
				result, err := db.Exec(
					"INSERT INTO alert_events (rule_id, rule_name, metric, value, threshold, message, level) VALUES (?, ?, ?, ?, ?, ?, ?)",
					rule.ID, rule.Name, rule.Metric, value, rule.Threshold, message, level,
				)
				if err != nil {
					continue
				}

				eventID, _ := result.LastInsertId()
				event := AlertEvent{
					ID:        eventID,
					RuleID:    rule.ID,
					RuleName:  rule.Name,
					Metric:    rule.Metric,
					Value:     value,
					Threshold: rule.Threshold,
					Message:   message,
					Level:     level,
					CreatedAt: time.Now().Format(time.RFC3339),
				}

				// Send notifications to linked channels
				channels := getChannelsForRule(rule.ID)
				for _, ch := range channels {
					if err := SendNotification(ch, event); err != nil {
						log.Printf("[alerts] failed to send notification via channel %s: %v", ch.Name, err)
					}
				}
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

// GetChannels returns all notification channels.
func GetChannels() []NotificationChannel {
	db := database.GetDB()
	rows, err := db.Query("SELECT id, name, type, config, enabled, created_at FROM notification_channels ORDER BY id")
	if err != nil {
		return []NotificationChannel{}
	}
	defer rows.Close()
	channels := make([]NotificationChannel, 0)
	for rows.Next() {
		var ch NotificationChannel
		var enabled int
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Config, &enabled, &ch.CreatedAt); err != nil {
			continue
		}
		ch.Enabled = enabled == 1
		channels = append(channels, ch)
	}
	return channels
}

// CreateChannel inserts a new notification channel.
func CreateChannel(req CreateChannelRequest) (*NotificationChannel, error) {
	if req.Name == "" || req.Type == "" {
		return nil, errors.New("name and type are required")
	}
	validTypes := map[string]bool{"email": true, "webhook": true, "telegram": true}
	if !validTypes[req.Type] {
		return nil, errors.New("type must be email, webhook, or telegram")
	}
	if req.Config == "" {
		req.Config = "{}"
	}
	db := database.GetDB()
	result, err := db.Exec(
		"INSERT INTO notification_channels (name, type, config) VALUES (?, ?, ?)",
		req.Name, req.Type, req.Config,
	)
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	var ch NotificationChannel
	var enabled int
	db.QueryRow("SELECT id, name, type, config, enabled, created_at FROM notification_channels WHERE id = ?", id).
		Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Config, &enabled, &ch.CreatedAt)
	ch.Enabled = enabled == 1
	return &ch, nil
}

// DeleteChannel removes a notification channel.
func DeleteChannel(id int64) error {
	db := database.GetDB()
	result, err := db.Exec("DELETE FROM notification_channels WHERE id = ?", id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("channel not found")
	}
	return nil
}

// ToggleChannel enables or disables a notification channel.
func ToggleChannel(id int64, enabled bool) error {
	db := database.GetDB()
	_, err := db.Exec("UPDATE notification_channels SET enabled = ? WHERE id = ?", boolToInt(enabled), id)
	return err
}


func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// SendNotification dispatches an alert event to a notification channel.
func SendNotification(channel NotificationChannel, event AlertEvent) error {
	if !channel.Enabled {
		return nil
	}

	switch channel.Type {
	case "webhook":
		return sendWebhook(channel, event)
	case "email":
		return sendEmail(channel, event)
	case "telegram":
		return sendTelegram(channel, event)
	default:
		return fmt.Errorf("unsupported channel type: %s", channel.Type)
	}
}

func sendWebhook(channel NotificationChannel, event AlertEvent) error {
	var cfg struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal([]byte(channel.Config), &cfg); err != nil {
		return fmt.Errorf("invalid webhook config: %w", err)
	}
	if cfg.URL == "" {
		return errors.New("webhook URL is empty")
	}

	payload := map[string]interface{}{
		"level":     event.Level,
		"metric":    event.Metric,
		"value":     event.Value,
		"threshold": event.Threshold,
		"message":   event.Message,
		"timestamp": event.CreatedAt,
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(cfg.URL, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("webhook request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status %d", resp.StatusCode)
	}
	return nil
}

func sendEmail(channel NotificationChannel, event AlertEvent) error {
	var cfg struct {
		Host     string `json:"host"`
		Port     int    `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
		From     string `json:"from"`
		To       string `json:"to"`
	}
	if err := json.Unmarshal([]byte(channel.Config), &cfg); err != nil {
		return fmt.Errorf("invalid email config: %w", err)
	}
	if cfg.Host == "" || cfg.To == "" {
		return errors.New("email host and to address are required")
	}
	if cfg.Port == 0 {
		cfg.Port = 587
	}

	subject := fmt.Sprintf("[NoWenOS Alert] %s - %s", event.Level, event.RuleName)
	body := fmt.Sprintf("Subject: %s\r\nFrom: %s\r\nTo: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		subject, cfg.From, cfg.To, event.Message)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)
	var auth smtp.Auth
	if cfg.User != "" && cfg.Password != "" {
		auth = smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Host)
	}

	recipients := strings.Split(cfg.To, ",")
	for i := range recipients {
		recipients[i] = strings.TrimSpace(recipients[i])
	}

	if err := smtp.SendMail(addr, auth, cfg.From, recipients, []byte(body)); err != nil {
		return fmt.Errorf("smtp send failed: %w", err)
	}
	return nil
}

func sendTelegram(channel NotificationChannel, event AlertEvent) error {
	var cfg struct {
		Token  string `json:"token"`
		ChatID string `json:"chatId"`
	}
	if err := json.Unmarshal([]byte(channel.Config), &cfg); err != nil {
		return fmt.Errorf("invalid telegram config: %w", err)
	}
	if cfg.Token == "" || cfg.ChatID == "" {
		return errors.New("telegram token and chat_id are required")
	}

	text := fmt.Sprintf("*[NoWenOS Alert]* %s\n\n%s\n\nValue: %.1f%% | Threshold: %.1f%%",
		event.Level, event.Message, event.Value, event.Threshold)

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", cfg.Token)
	payload := map[string]string{
		"chat_id":    cfg.ChatID,
		"text":       text,
		"parse_mode": "Markdown",
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(body))
	if err != nil {
		return fmt.Errorf("telegram request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("telegram returned status %d", resp.StatusCode)
	}
	return nil
}

// LinkChannels sets the channels linked to a rule (replaces existing links).
func LinkChannels(ruleID int64, channelIDs []int64) error {
	db := database.GetDB()
	// Verify rule exists
	var count int
	db.QueryRow("SELECT COUNT(*) FROM alert_rules WHERE id = ?", ruleID).Scan(&count)
	if count == 0 {
		return errors.New("rule not found")
	}
	// Remove existing links
	db.Exec("DELETE FROM rule_channels WHERE rule_id = ?", ruleID)
	// Insert new links
	for _, chID := range channelIDs {
		db.Exec("INSERT OR IGNORE INTO rule_channels (rule_id, channel_id) VALUES (?, ?)", ruleID, chID)
	}
	return nil
}

// GetRuleChannels returns the channel IDs linked to a rule.
func GetRuleChannels(ruleID int64) []int64 {
	db := database.GetDB()
	rows, err := db.Query("SELECT channel_id FROM rule_channels WHERE rule_id = ?", ruleID)
	if err != nil {
		return []int64{}
	}
	defer rows.Close()
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids
}

// getChannelsForRule returns the full channel objects linked to a rule.
func getChannelsForRule(ruleID int64) []NotificationChannel {
	db := database.GetDB()
	rows, err := db.Query(`
		SELECT nc.id, nc.name, nc.type, nc.config, nc.enabled, nc.created_at
		FROM notification_channels nc
		INNER JOIN rule_channels rc ON rc.channel_id = nc.id
		WHERE rc.rule_id = ? AND nc.enabled = 1`, ruleID)
	if err != nil {
		return []NotificationChannel{}
	}
	defer rows.Close()
	channels := make([]NotificationChannel, 0)
	for rows.Next() {
		var ch NotificationChannel
		var enabled int
		if err := rows.Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Config, &enabled, &ch.CreatedAt); err != nil {
			continue
		}
		ch.Enabled = enabled == 1
		channels = append(channels, ch)
	}
	return channels
}

// TestChannel sends a test notification to the specified channel.
func TestChannel(channelID int64) error {
	db := database.GetDB()
	var ch NotificationChannel
	var enabled int
	err := db.QueryRow("SELECT id, name, type, config, enabled, created_at FROM notification_channels WHERE id = ?", channelID).
		Scan(&ch.ID, &ch.Name, &ch.Type, &ch.Config, &enabled, &ch.CreatedAt)
	if err != nil {
		return errors.New("channel not found")
	}
	ch.Enabled = enabled == 1

	testEvent := AlertEvent{
		RuleName:  "Test Alert",
		Metric:    "cpu",
		Value:     95.0,
		Threshold: 80.0,
		Message:   "This is a test notification from NoWenOS",
		Level:     "warning",
		CreatedAt: time.Now().Format(time.RFC3339),
	}
	return SendNotification(ch, testEvent)
}
