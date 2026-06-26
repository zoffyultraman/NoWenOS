package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/auth"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/taskqueue"
)

func registerTaskRoutes(api *gin.RouterGroup) {
	// List tasks, optionally filtered by status
	api.GET("/tasks", func(c *gin.Context) {
		status := c.Query("status")
		limitStr := c.DefaultQuery("limit", "50")
		limit, _ := strconv.Atoi(limitStr)

		tasks, err := taskqueue.ListTasks(status, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if tasks == nil {
			tasks = []taskqueue.Task{}
		}
		c.JSON(http.StatusOK, gin.H{"data": tasks})
	})

	// Get a single task by ID
	api.GET("/tasks/:id", func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
			return
		}

		task, err := taskqueue.GetTask(id)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": task})
	})

	// Get task logs (supports incremental fetching via ?since=<id>)
	api.GET("/tasks/:id/logs", func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
			return
		}

		var sinceID int64
		if sinceStr := c.Query("since"); sinceStr != "" {
			sinceID, err = strconv.ParseInt(sinceStr, 10, 64)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid since parameter"})
				return
			}
		}

		logs, err := taskqueue.GetTaskLogs(id, sinceID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if logs == nil {
			logs = []taskqueue.TaskLog{}
		}
		c.JSON(http.StatusOK, gin.H{"data": logs})
	})

	// Cancel a task
	api.POST("/tasks/:id/cancel", requireWrite(), func(c *gin.Context) {
		id, err := strconv.ParseInt(c.Param("id"), 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid task id"})
			return
		}

		if err := taskqueue.CancelTask(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "cancel_requested"}})
	})

	// Create a storage task (wipe, format, partition, raid, lvm, zfs)
	// Requires password challenge via X-Confirm-Password header.
	validTaskTypes := map[string]bool{
		"wipe": true, "format": true, "partition": true,
		"raid": true, "lvm": true, "zfs": true,
	}

	api.POST("/storage/tasks/:type", requireWrite(), passwordChallengeMiddleware(), func(c *gin.Context) {
		taskType := c.Param("type")
		if !validTaskTypes[taskType] {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid task type: %s", taskType)})
			return
		}

		var body map[string]interface{}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
			return
		}

		payload := "{}"
		if body != nil {
			bodyBytes, _ := json.Marshal(body)
			payload = string(bodyBytes)
		}

		taskID, err := taskqueue.CreateTask(taskType, payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"task_id": taskID, "status": "pending"}})
	})
}

// passwordChallengeMiddleware validates the X-Confirm-Password header.
// This is a lightweight version of audit.RequirePasswordChallenge that
// can be used inline in task_routes without importing the full audit package.
func passwordChallengeMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		password := c.GetHeader("X-Confirm-Password")
		if password == "" {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Password confirmation required for this destructive operation",
				"code":  "CONFIRM_PASSWORD_REQUIRED",
			})
			c.Abort()
			return
		}

		usernameRaw, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		username := fmt.Sprintf("%v", usernameRaw)

		if err := auth.ValidateCredentials(username, password); err != nil {
			ip := c.ClientIP()
			audit.LogSecurity(username, "password_challenge_failed", "", ip,
				"storage task creation blocked: invalid password", "blocked")
			c.JSON(http.StatusForbidden, gin.H{
				"error": "Invalid password confirmation",
				"code":  "CONFIRM_PASSWORD_INVALID",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
