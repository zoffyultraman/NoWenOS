package cronmanager

import (
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/systemadapter"
)

const (
	maxOutputSize   = 1024 * 1024 // 1MB
	executionTimeout = 5 * time.Minute
	maxConcurrent    = 5
)

// ScheduledTask represents a cron-like scheduled task.
type ScheduledTask struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Command    string `json:"command"`
	Schedule   string `json:"schedule"` // 5-field cron expression: min hour day month weekday
	Enabled    bool   `json:"enabled"`
	LastRun    string `json:"lastRun"`
	NextRun    string `json:"nextRun"`
	LastStatus string `json:"lastStatus"` // success, failed, running, never
	Output     string `json:"output"`
	CreatedAt  string `json:"createdAt"`
	UpdatedAt  string `json:"updatedAt"`
}

// CreateTaskRequest is the input for creating or updating a scheduled task.
type CreateTaskRequest struct {
	Name     string `json:"name"`
	Command  string `json:"command"`
	Schedule string `json:"schedule"`
}

var (
	schedulerMu   sync.Mutex
	schedulerStop chan struct{}
)

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// InitTable creates the scheduled_tasks table.
func InitTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		command TEXT NOT NULL,
		schedule TEXT NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 1,
		last_run TEXT DEFAULT '',
		next_run TEXT DEFAULT '',
		last_status TEXT DEFAULT 'never',
		output TEXT DEFAULT '',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
}

// GetTasks returns all scheduled tasks.
func GetTasks() []ScheduledTask {
	db := database.GetDB()
	rows, err := db.Query(`SELECT id, name, command, schedule, enabled, last_run, next_run, last_status, output, created_at, updated_at FROM scheduled_tasks ORDER BY id DESC`)
	if err != nil {
		return []ScheduledTask{}
	}
	defer rows.Close()

	var tasks []ScheduledTask
	for rows.Next() {
		var t ScheduledTask
		var enabled int
		if err := rows.Scan(&t.ID, &t.Name, &t.Command, &t.Schedule, &enabled, &t.LastRun, &t.NextRun, &t.LastStatus, &t.Output, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		t.Enabled = enabled == 1
		tasks = append(tasks, t)
	}
	if tasks == nil {
		return []ScheduledTask{}
	}
	return tasks
}

// GetTask returns a single task by ID.
func GetTask(id int64) (*ScheduledTask, error) {
	db := database.GetDB()
	var t ScheduledTask
	var enabled int
	err := db.QueryRow(`SELECT id, name, command, schedule, enabled, last_run, next_run, last_status, output, created_at, updated_at FROM scheduled_tasks WHERE id = ?`, id).
		Scan(&t.ID, &t.Name, &t.Command, &t.Schedule, &enabled, &t.LastRun, &t.NextRun, &t.LastStatus, &t.Output, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, errors.New("task not found")
	}
	t.Enabled = enabled == 1
	return &t, nil
}

// CreateTask inserts a new scheduled task.
func CreateTask(req CreateTaskRequest) (*ScheduledTask, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("name is required")
	}
	if strings.TrimSpace(req.Command) == "" {
		return nil, errors.New("command is required")
	}
	if strings.TrimSpace(req.Schedule) == "" {
		return nil, errors.New("schedule is required")
	}
	if !isValidCron(req.Schedule) {
		return nil, errors.New("invalid cron expression: expected 5 fields (minute hour day month weekday)")
	}

	db := database.GetDB()
	nextRun := computeNextRun(req.Schedule, time.Now())

	result, err := db.Exec(`INSERT INTO scheduled_tasks (name, command, schedule, enabled, next_run, last_status) VALUES (?, ?, ?, 1, ?, 'never')`,
		req.Name, req.Command, req.Schedule, nextRun.Format(time.RFC3339))
	if err != nil {
		return nil, err
	}
	id, _ := result.LastInsertId()
	return GetTask(id)
}

// UpdateTask updates an existing scheduled task.
func UpdateTask(id int64, req CreateTaskRequest) (*ScheduledTask, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, errors.New("name is required")
	}
	if strings.TrimSpace(req.Command) == "" {
		return nil, errors.New("command is required")
	}
	if strings.TrimSpace(req.Schedule) == "" {
		return nil, errors.New("schedule is required")
	}
	if !isValidCron(req.Schedule) {
		return nil, errors.New("invalid cron expression: expected 5 fields (minute hour day month weekday)")
	}

	_, err := GetTask(id)
	if err != nil {
		return nil, err
	}

	nextRun := computeNextRun(req.Schedule, time.Now())

	db := database.GetDB()
	_, err = db.Exec(`UPDATE scheduled_tasks SET name = ?, command = ?, schedule = ?, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		req.Name, req.Command, req.Schedule, nextRun.Format(time.RFC3339), id)
	if err != nil {
		return nil, err
	}
	return GetTask(id)
}

// DeleteTask removes a task by ID.
func DeleteTask(id int64) error {
	db := database.GetDB()
	result, err := db.Exec(`DELETE FROM scheduled_tasks WHERE id = ?`, id)
	if err != nil {
		return err
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return errors.New("task not found")
	}
	return nil
}

// ToggleTask enables or disables a task.
func ToggleTask(id int64, enabled bool) error {
	db := database.GetDB()

	var schedule string
	err := db.QueryRow(`SELECT schedule FROM scheduled_tasks WHERE id = ?`, id).Scan(&schedule)
	if err != nil {
		return errors.New("task not found")
	}

	var nextRun string
	if enabled {
		nextRun = computeNextRun(schedule, time.Now()).Format(time.RFC3339)
	}

	_, err = db.Exec(`UPDATE scheduled_tasks SET enabled = ?, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		boolToInt(enabled), nextRun, id)
	return err
}

// RunTask executes a task's command immediately and records the result.
func RunTask(id int64) (*ScheduledTask, error) {
	task, err := GetTask(id)
	if err != nil {
		return nil, err
	}

	db := database.GetDB()
	now := time.Now().Format(time.RFC3339)
	db.Exec(`UPDATE scheduled_tasks SET last_status = 'running', last_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, now, id)

	output, exitErr := executeCommand(task.Command)
	status := "success"
	if exitErr != nil {
		status = "failed"
		if output == "" {
			output = exitErr.Error()
		}
	}

	nextRun := computeNextRun(task.Schedule, time.Now()).Format(time.RFC3339)
	db.Exec(`UPDATE scheduled_tasks SET last_status = ?, output = ?, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, status, output, nextRun, id)

	return GetTask(id)
}

// StartScheduler launches a background goroutine that checks and runs due tasks every minute.
func StartScheduler() {
	schedulerMu.Lock()
	defer schedulerMu.Unlock()

	if schedulerStop != nil {
		return
	}
	schedulerStop = make(chan struct{})

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		log.Println("[cronmanager] scheduler started")
		for {
			select {
			case <-schedulerStop:
				log.Println("[cronmanager] scheduler stopped")
				return
			case now := <-ticker.C:
				runDueTasks(now)
			}
		}
	}()
}

func runDueTasks(now time.Time) {
	db := database.GetDB()
	rows, err := db.Query(`SELECT id, command, schedule, next_run FROM scheduled_tasks WHERE enabled = 1`)
	if err != nil {
		return
	}
	defer rows.Close()

	type taskInfo struct {
		id       int64
		command  string
		schedule string
	}
	var dueTasks []taskInfo

	for rows.Next() {
		var t taskInfo
		var nextRunStr string
		if err := rows.Scan(&t.id, &t.command, &t.schedule, &nextRunStr); err != nil {
			continue
		}

		if nextRunStr == "" {
			dueTasks = append(dueTasks, t)
			continue
		}

		nextRun, err := time.Parse(time.RFC3339, nextRunStr)
		if err != nil {
			continue
		}

		if now.After(nextRun) || now.Equal(nextRun) {
			dueTasks = append(dueTasks, t)
		}
	}

	sem := make(chan struct{}, maxConcurrent)
	for _, t := range dueTasks {
		sem <- struct{}{}
		go func(ti taskInfo) {
			defer func() { <-sem }()
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[cronmanager] panic in task %d: %v", ti.id, r)
				}
			}()
			runSingleTask(ti.id, ti.command, ti.schedule)
		}(t)
	}
}

func runSingleTask(id int64, command, schedule string) {
	db := database.GetDB()
	now := time.Now().Format(time.RFC3339)
	db.Exec(`UPDATE scheduled_tasks SET last_status = 'running', last_run = ? WHERE id = ?`, now, id)

	output, err := executeCommand(command)
	status := "success"
	if err != nil {
		status = "failed"
		if output == "" {
			output = err.Error()
		}
	}

	nextRun := computeNextRun(schedule, time.Now()).Format(time.RFC3339)
	db.Exec(`UPDATE scheduled_tasks SET last_status = ?, output = ?, next_run = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, status, output, nextRun, id)
	log.Printf("[cronmanager] task %d executed: status=%s", id, status)
}

func executeCommand(command string) (string, error) {
	result, err := systemadapter.RunShell(command, executionTimeout)

	output := result.Stdout
	if result.Stderr != "" {
		if output != "" {
			output += "\n"
		}
		output += result.Stderr
	}
	// Truncate output to maxOutputSize
	if len(output) > maxOutputSize {
		output = output[:maxOutputSize] + "\n... (truncated)"
	}

	if err != nil {
		return output, err
	}
	if result.ExitCode != 0 {
		return output, fmt.Errorf("command exited with code %d", result.ExitCode)
	}
	return output, nil
}

// --- Cron expression parsing (5-field: min hour dom month dow) ---

func isValidCron(expr string) bool {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return false
	}
	ranges := [][]int{
		{0, 59}, // minute
		{0, 23}, // hour
		{1, 31}, // day of month
		{1, 12}, // month
		{0, 7},  // weekday (0 and 7 = Sunday)
	}
	for i, field := range fields {
		if field == "*" {
			continue
		}
		if strings.ContainsAny(field, ",/-") {
			// Validate numeric parts of compound expressions
			for _, part := range strings.Split(field, ",") {
				part = strings.TrimSpace(part)
				if strings.Contains(part, "/") {
					subParts := strings.SplitN(part, "/", 2)
					if subParts[0] != "*" {
						if n, err := strconv.Atoi(subParts[0]); err != nil || n < ranges[i][0] || n > ranges[i][1] {
							return false
						}
					}
					if n, err := strconv.Atoi(subParts[1]); err != nil || n <= 0 {
						return false
					}
				} else if strings.Contains(part, "-") {
					subParts := strings.SplitN(part, "-", 2)
					n1, err1 := strconv.Atoi(subParts[0])
					n2, err2 := strconv.Atoi(subParts[1])
					if err1 != nil || err2 != nil || n1 < ranges[i][0] || n2 > ranges[i][1] || n1 > n2 {
						return false
					}
				}
			}
			continue
		}
		n, err := strconv.Atoi(field)
		if err != nil || n < ranges[i][0] || n > ranges[i][1] {
			return false
		}
	}
	return true
}

func matchesField(field string, value int) bool {
	if field == "*" {
		return true
	}

	// Handle comma-separated values
	if strings.Contains(field, ",") {
		for _, part := range strings.Split(field, ",") {
			if matchesField(strings.TrimSpace(part), value) {
				return true
			}
		}
		return false
	}

	// Handle step values like */5
	if strings.Contains(field, "/") {
		parts := strings.SplitN(field, "/", 2)
		base := parts[0]
		step, err := strconv.Atoi(parts[1])
		if err != nil || step <= 0 {
			return false
		}
		if base == "*" {
			return value%step == 0
		}
		start, err := strconv.Atoi(base)
		if err != nil {
			return false
		}
		return value >= start && (value-start)%step == 0
	}

	// Handle range values like 1-5
	if strings.Contains(field, "-") {
		parts := strings.SplitN(field, "-", 2)
		start, err1 := strconv.Atoi(parts[0])
		end, err2 := strconv.Atoi(parts[1])
		if err1 != nil || err2 != nil {
			return false
		}
		return value >= start && value <= end
	}

	// Exact value
	n, err := strconv.Atoi(field)
	return err == nil && n == value
}

// computeNextRun finds the next time after 'from' that matches the cron expression.
func computeNextRun(expr string, from time.Time) time.Time {
	fields := strings.Fields(expr)
	if len(fields) != 5 {
		return from.Add(1 * time.Minute)
	}

	// Start from the next minute
	t := from.Truncate(time.Minute).Add(1 * time.Minute)

	// Avoid infinite loops by capping at 2 years of search
	maxIter := 366 * 24 * 60
	for i := 0; i < maxIter; i++ {
		if matchesField(fields[0], t.Minute()) &&
			matchesField(fields[1], t.Hour()) &&
			matchesField(fields[2], t.Day()) &&
			matchesField(fields[3], int(t.Month())) &&
			matchesField(fields[4], int(t.Weekday())) {
			return t
		}
		t = t.Add(1 * time.Minute)
	}

	// Fallback: 1 minute from now
	return from.Add(1 * time.Minute)
}

