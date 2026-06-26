package taskqueue

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"nowenos-server/internal/database"
	"nowenos-server/internal/diskcmd"
)

// Task status constants
const (
	StatusPending   = "pending"
	StatusRunning   = "running"
	StatusCompleted = "completed"
	StatusFailed    = "failed"
	StatusCancelled = "cancelled"
)

// Task represents a background task persisted in SQLite.
type Task struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"`
	Payload   string `json:"payload"`
	Status    string `json:"status"`
	Progress  int    `json:"progress"`
	Log       string `json:"log"` // Deprecated: kept for backward compat, prefer GetTaskLogs
	ErrorMsg  string `json:"error_msg"`
	Result    string `json:"result"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// TaskExecutor is a function that runs a task. It receives the task's payload
// and two callback functions: updateProgress and appendLog.
// appendLog receives (stream, line) where stream is "stdout", "stderr", or "system".
type TaskExecutor func(payload string, updateProgress func(int), appendLog func(stream, line string)) (result string, err error)

var (
	executors = make(map[string]TaskExecutor)
	mu        sync.RWMutex

	// cancelRequests tracks task IDs that have been requested to cancel.
	cancelRequests = make(map[int64]bool)
	cancelMu       sync.RWMutex
)

// RegisterExecutor registers a task executor for a given task type.
func RegisterExecutor(taskType string, executor TaskExecutor) {
	mu.Lock()
	defer mu.Unlock()
	executors[taskType] = executor
}

// CreateTask inserts a new task into the database and returns its ID.
func CreateTask(taskType, payload string) (int64, error) {
	mu.RLock()
	_, ok := executors[taskType]
	mu.RUnlock()
	if !ok {
		return 0, fmt.Errorf("unknown task type: %s", taskType)
	}

	if payload == "" {
		payload = "{}"
	}

	db := database.GetDB()
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := db.Exec(
		`INSERT INTO tasks (type, payload, status, progress, error_msg, result, created_at, updated_at)
		 VALUES (?, ?, ?, 0, '', '{}', ?, ?)`,
		taskType, payload, StatusPending, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to create task: %w", err)
	}
	id, _ := result.LastInsertId()
	return id, nil
}

// GetTask retrieves a single task by ID.
func GetTask(taskID int64) (*Task, error) {
	db := database.GetDB()
	row := db.QueryRow(
		`SELECT id, type, payload, status, progress, error_msg, result, created_at, updated_at
		 FROM tasks WHERE id = ?`, taskID,
	)
	t := &Task{}
	err := row.Scan(&t.ID, &t.Type, &t.Payload, &t.Status, &t.Progress, &t.ErrorMsg, &t.Result, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("task not found: %d", taskID)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get task: %w", err)
	}
	return t, nil
}

// CancelTask marks a task for cancellation. If the task is pending, it is
// immediately set to cancelled. If it is running, the cancellation flag is
// set so the executor can check for it.
func CancelTask(taskID int64) error {
	db := database.GetDB()
	row := db.QueryRow("SELECT status FROM tasks WHERE id = ?", taskID)
	var status string
	if err := row.Scan(&status); err == sql.ErrNoRows {
		return fmt.Errorf("task not found: %d", taskID)
	} else if err != nil {
		return fmt.Errorf("failed to get task: %w", err)
	}

	switch status {
	case StatusCompleted, StatusFailed, StatusCancelled:
		return fmt.Errorf("task %d already in terminal state: %s", taskID, status)
	case StatusPending:
		// Cancel immediately
		now := time.Now().UTC().Format(time.RFC3339)
		_, err := db.Exec(
			`UPDATE tasks SET status = ?, error_msg = 'cancelled by user', updated_at = ? WHERE id = ?`,
			StatusCancelled, now, taskID,
		)
		return err
	case StatusRunning:
		// Set cancellation flag; the runner goroutine will pick it up
		cancelMu.Lock()
		cancelRequests[taskID] = true
		cancelMu.Unlock()
		return nil
	default:
		return fmt.Errorf("unknown task status: %s", status)
	}
}

// IsCancelled checks if a task has been requested to cancel.
func IsCancelled(taskID int64) bool {
	cancelMu.RLock()
	defer cancelMu.RUnlock()
	return cancelRequests[taskID]
}

// ListTasks returns tasks filtered by status (empty string means all).
// limit defaults to 50 if <= 0.
func ListTasks(status string, limit int) ([]Task, error) {
	if limit <= 0 {
		limit = 50
	}
	db := database.GetDB()

	var rows *sql.Rows
	var err error
	if status != "" {
		rows, err = db.Query(
			`SELECT id, type, payload, status, progress, error_msg, result, created_at, updated_at
			 FROM tasks WHERE status = ? ORDER BY id DESC LIMIT ?`, status, limit,
		)
	} else {
		rows, err = db.Query(
			`SELECT id, type, payload, status, progress, error_msg, result, created_at, updated_at
			 FROM tasks ORDER BY id DESC LIMIT ?`, limit,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to list tasks: %w", err)
	}
	defer rows.Close()

	var tasks []Task
	for rows.Next() {
		var t Task
		if err := rows.Scan(&t.ID, &t.Type, &t.Payload, &t.Status, &t.Progress, &t.ErrorMsg, &t.Result, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan task: %w", err)
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

// RecoverZombieTasks finds all tasks left in "running" state (orphaned by a
// previous server crash / restart) and transitions them to "failed" so the
// frontend stops polling forever.
func RecoverZombieTasks() {
	db := database.GetDB()
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := db.Exec(
		`UPDATE tasks SET status = ?, error_msg = ?, updated_at = ?
		 WHERE status = ?`,
		StatusFailed, "Task interrupted by server restart", now, StatusRunning,
	)
	if err != nil {
		log.Printf("[taskqueue] zombie recovery failed: %v", err)
		return
	}
	affected, _ := result.RowsAffected()
	if affected > 0 {
		log.Printf("[taskqueue] recovered %d zombie task(s) (running -> failed)", affected)
	} else {
		log.Printf("[taskqueue] no zombie tasks found")
	}
}

// StartWorker launches the background goroutine that polls for pending tasks.
func StartWorker() {
	RecoverZombieTasks()
	go workerLoop()
}

func workerLoop() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		processNextTask()
	}
}

func processNextTask() {
	db := database.GetDB()

	// Atomically pick up the next pending task
	now := time.Now().UTC().Format(time.RFC3339)
	row := db.QueryRow(
		`UPDATE tasks SET status = ?, updated_at = ?
		 WHERE id = (SELECT id FROM tasks WHERE status = ? ORDER BY id ASC LIMIT 1)
		 RETURNING id, type, payload`,
		StatusRunning, now, StatusPending,
	)

	var taskID int64
	var taskType, payload string
	if err := row.Scan(&taskID, &taskType, &payload); err != nil {
		// No pending tasks
		return
	}

	mu.RLock()
	executor, ok := executors[taskType]
	mu.RUnlock()
	if !ok {
		setTaskFailed(taskID, fmt.Sprintf("no executor registered for type: %s", taskType))
		return
	}

	log.Printf("[taskqueue] running task #%d type=%s", taskID, taskType)

	// Create callback functions bound to this task ID
	updateProgress := func(pct int) {
		if IsCancelled(taskID) {
			return
		}
		if pct < 0 {
			pct = 0
		}
		if pct > 100 {
			pct = 100
		}
		db.Exec(`UPDATE tasks SET progress = ?, updated_at = ? WHERE id = ?`,
			pct, time.Now().UTC().Format(time.RFC3339), taskID)
	}

	appendLog := func(stream, line string) {
		if IsCancelled(taskID) {
			return
		}
		AppendLog(taskID, stream, line)
	}

	// Run the executor
	result, execErr := executor(payload, updateProgress, appendLog)

	// Check cancellation after execution
	if IsCancelled(taskID) {
		cancelMu.Lock()
		delete(cancelRequests, taskID)
		cancelMu.Unlock()
		db.Exec(`UPDATE tasks SET status = ?, error_msg = 'cancelled by user', updated_at = ? WHERE id = ?`,
			StatusCancelled, time.Now().UTC().Format(time.RFC3339), taskID)
		log.Printf("[taskqueue] task #%d was cancelled", taskID)
		return
	}

	if execErr != nil {
		setTaskFailed(taskID, execErr.Error())
		log.Printf("[taskqueue] task #%d failed: %v", taskID, execErr)
		return
	}

	// Success
	if result == "" {
		result = "{}"
	}
	db.Exec(
		`UPDATE tasks SET status = ?, progress = 100, result = ?, updated_at = ? WHERE id = ?`,
		StatusCompleted, result, time.Now().UTC().Format(time.RFC3339), taskID,
	)
	log.Printf("[taskqueue] task #%d completed", taskID)
}

func setTaskFailed(taskID int64, errMsg string) {
	db := database.GetDB()
	db.Exec(
		`UPDATE tasks SET status = ?, error_msg = ?, updated_at = ? WHERE id = ?`,
		StatusFailed, errMsg, time.Now().UTC().Format(time.RFC3339), taskID,
	)
}

// ── Built-in executors ──

func init() {
	RegisterExecutor("wipe", executeWipe)
	RegisterExecutor("format", executeFormat)
	RegisterExecutor("partition", executePartition)
	RegisterExecutor("raid", executeRAID)
	RegisterExecutor("lvm", executeLVM)
	RegisterExecutor("zfs", executeZFS)
}

// executeWipe wipes a disk using wipefs + dd (via diskcmd).
func executeWipe(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Device string `json:"device"`
		Method string `json:"method"` // "quick" or "full"
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}
	if p.Device == "" {
		return "", fmt.Errorf("device is required")
	}
	if p.Method == "" {
		p.Method = "quick"
	}

	appendLog("system", fmt.Sprintf("Starting wipe on %s (method=%s)", p.Device, p.Method))
	updateProgress(10)

	_, err := diskcmd.WipeDisk(p.Device, p.Method == "full", 60*time.Second,
		func(stream, line string) { appendLog(stream, line) })
	if err != nil {
		return "", err
	}

	updateProgress(100)
	appendLog("system", "Wipe completed")
	return fmt.Sprintf(`{"device":"%s","method":"%s","status":"done"}`, p.Device, p.Method), nil
}

// executeFormat creates a filesystem on a device (via diskcmd).
func executeFormat(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Device string `json:"device"`
		FSType string `json:"fs_type"` // ext4, xfs, btrfs, vfat
		Label  string `json:"label"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}
	if p.Device == "" {
		return "", fmt.Errorf("device is required")
	}
	if p.FSType == "" {
		p.FSType = "ext4"
	}

	appendLog("system", fmt.Sprintf("Formatting %s as %s (label=%s)", p.Device, p.FSType, p.Label))
	updateProgress(20)

	_, err := diskcmd.FormatDisk(p.Device, p.FSType, p.Label, 300*time.Second,
		func(stream, line string) { appendLog(stream, line) })
	if err != nil {
		return "", err
	}

	updateProgress(100)
	appendLog("system", "Format completed")
	return fmt.Sprintf(`{"device":"%s","fs_type":"%s","label":"%s"}`, p.Device, p.FSType, p.Label), nil
}

// executePartition creates or modifies partition tables (via diskcmd).
func executePartition(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Device   string `json:"device"`
		Label    string `json:"label"` // gpt, msdos
		PartType string `json:"part_type"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}
	if p.Device == "" {
		return "", fmt.Errorf("device is required")
	}
	if p.Label == "" {
		p.Label = "gpt"
	}

	appendLog("system", fmt.Sprintf("Creating %s partition table on %s", p.Label, p.Device))
	updateProgress(20)

	_, err := diskcmd.PartitionDisk(p.Device, p.Label, p.PartType, 60*time.Second,
		func(stream, line string) { appendLog(stream, line) })
	if err != nil {
		return "", err
	}

	updateProgress(100)
	appendLog("system", "Partitioning completed")
	return fmt.Sprintf(`{"device":"%s","label":"%s"}`, p.Device, p.Label), nil
}

// executeRAID creates a software RAID array (via diskcmd).
func executeRAID(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Level   string   `json:"level"`   // 0, 1, 5, 6, 10
		Name    string   `json:"name"`    // e.g. /dev/md0
		Devices []string `json:"devices"` // e.g. ["/dev/sdb", "/dev/sdc"]
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}
	if p.Name == "" || len(p.Devices) == 0 {
		return "", fmt.Errorf("name and devices are required")
	}

	appendLog("system", fmt.Sprintf("Creating RAID %s (%s) with %d devices", p.Name, p.Level, len(p.Devices)))
	updateProgress(20)

	_, err := diskcmd.CreateRAID(p.Name, p.Level, p.Devices, 300*time.Second,
		func(stream, line string) { appendLog(stream, line) })
	if err != nil {
		return "", err
	}

	updateProgress(100)
	appendLog("system", "RAID array created")
	return fmt.Sprintf(`{"name":"%s","level":"%s","devices":%s}`, p.Name, p.Level, mustJSON(p.Devices)), nil
}

// executeLVM creates LVM volume groups and logical volumes (via diskcmd).
func executeLVM(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Action string   `json:"action"` // "create_vg", "create_lv"
		VGName string   `json:"vg_name"`
		LVName string   `json:"lv_name"`
		Size   string   `json:"size"` // e.g. "10G"
		PVs    []string `json:"pvs"`  // physical volumes
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}

	switch p.Action {
	case "create_vg":
		if p.VGName == "" || len(p.PVs) == 0 {
			return "", fmt.Errorf("vg_name and pvs are required")
		}
		appendLog("system", fmt.Sprintf("Creating VG %s with %d PVs", p.VGName, len(p.PVs)))
		updateProgress(20)
		_, err := diskcmd.CreateVolumeGroup(p.VGName, p.PVs, 120*time.Second,
			func(stream, line string) { appendLog(stream, line) })
		if err != nil {
			return "", err
		}
		updateProgress(100)
		appendLog("system", "VG created")
		return fmt.Sprintf(`{"action":"create_vg","vg_name":"%s"}`, p.VGName), nil

	case "create_lv":
		if p.VGName == "" || p.LVName == "" || p.Size == "" {
			return "", fmt.Errorf("vg_name, lv_name, and size are required")
		}
		appendLog("system", fmt.Sprintf("Creating LV %s/%s (%s)", p.VGName, p.LVName, p.Size))
		updateProgress(20)
		_, err := diskcmd.CreateLogicalVolume(p.VGName, p.LVName, p.Size, 120*time.Second,
			func(stream, line string) { appendLog(stream, line) })
		if err != nil {
			return "", err
		}
		updateProgress(100)
		appendLog("system", "LV created")
		return fmt.Sprintf(`{"action":"create_lv","vg_name":"%s","lv_name":"%s","size":"%s"}`, p.VGName, p.LVName, p.Size), nil

	default:
		return "", fmt.Errorf("unknown LVM action: %s", p.Action)
	}
}

// executeZFS creates ZFS pools and datasets (via diskcmd).
func executeZFS(payload string, updateProgress func(int), appendLog func(stream, line string)) (string, error) {
	var p struct {
		Action  string   `json:"action"` // "create_pool", "create_dataset"
		Pool    string   `json:"pool"`
		Dataset string   `json:"dataset"`
		Devices []string `json:"devices"`
		Raidz   bool     `json:"raidz"`
	}
	if err := json.Unmarshal([]byte(payload), &p); err != nil {
		return "", fmt.Errorf("invalid payload: %w", err)
	}

	switch p.Action {
	case "create_pool":
		if p.Pool == "" || len(p.Devices) == 0 {
			return "", fmt.Errorf("pool and devices are required")
		}

		appendLog("system", fmt.Sprintf("Creating ZFS pool %s with %d devices", p.Pool, len(p.Devices)))
		updateProgress(20)

		_, err := diskcmd.CreateZPool(p.Pool, p.Devices, p.Raidz, 300*time.Second,
			func(stream, line string) { appendLog(stream, line) })
		if err != nil {
			return "", err
		}
		updateProgress(100)
		appendLog("system", "Pool created")
		return fmt.Sprintf(`{"action":"create_pool","pool":"%s"}`, p.Pool), nil

	case "create_dataset":
		if p.Pool == "" || p.Dataset == "" {
			return "", fmt.Errorf("pool and dataset are required")
		}
		appendLog("system", fmt.Sprintf("Creating ZFS dataset %s/%s", p.Pool, p.Dataset))
		updateProgress(20)

		_, err := diskcmd.CreateZDataset(p.Pool, p.Dataset, 120*time.Second,
			func(stream, line string) { appendLog(stream, line) })
		if err != nil {
			return "", err
		}
		updateProgress(100)
		appendLog("system", "Dataset created")
		return fmt.Sprintf(`{"action":"create_dataset","dataset":"%s/%s"}`, p.Pool, p.Dataset), nil

	default:
		return "", fmt.Errorf("unknown ZFS action: %s", p.Action)
	}
}

func mustJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}
