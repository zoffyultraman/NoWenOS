package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/alerts"
	"nowenos-server/internal/appcenter"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/backup"
	"nowenos-server/internal/logviewer"
	"nowenos-server/internal/proxy"
)

func registerInfraRoutes(api *gin.RouterGroup) {
	// Logs
	api.GET("/logs", func(c *gin.Context) {
		source := c.Query("source")
		limitStr := c.DefaultQuery("limit", "100")
		limit, _ := strconv.Atoi(limitStr)

		result, err := logviewer.GetLogs(source, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": result})
	})

	api.GET("/logs/sources", func(c *gin.Context) {
		sources := logviewer.GetAvailableLogs()
		c.JSON(http.StatusOK, gin.H{"data": sources})
	})

	api.GET("/logs/download", func(c *gin.Context) {
		c.Header("Content-Disposition", "attachment; filename=nowenos.log")
		logPath := "/var/log/nowenos/nowenos.log"
		data, err := os.ReadFile(logPath)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Log file not found"})
			return
		}
		c.Data(http.StatusOK, "text/plain", data)
	})

	// Audit
	api.GET("/audit/logs", func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "100")
		limit, _ := strconv.Atoi(limitStr)
		action := c.Query("action")
		username := c.Query("username")
		logs := audit.GetLogs(limit, action, username)
		c.JSON(http.StatusOK, gin.H{"data": logs})
	})

	api.GET("/audit/stats", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": audit.GetStats()})
	})

	// Security audit logs (device-path focused, for forensic review)
	api.GET("/audit/security", func(c *gin.Context) {
		devicePath := c.Query("device")
		limitStr := c.DefaultQuery("limit", "100")
		limit, _ := strconv.Atoi(limitStr)
		logs := audit.GetSecurityLogs(devicePath, limit)
		c.JSON(http.StatusOK, gin.H{"data": logs})
	})

	// Backup & Restore
	api.GET("/backups", func(c *gin.Context) {
		backups, err := backup.ListBackups()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": backups})
	})

	api.POST("/backups", func(c *gin.Context) {
		if err := backup.InitBackupDir(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		path, err := backup.CreateBackup()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"path": path}})
	})

	api.DELETE("/backups/:name", func(c *gin.Context) {
		name := c.Param("name")
		if err := backup.DeleteBackup(name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deleted"}})
	})

	api.POST("/backups/:name/restore", requireRole("admin"), func(c *gin.Context) {
		name := c.Param("name")
		filePath := backup.BackupDir + "/" + name
		if err := backup.RestoreBackup(filePath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "restored"}})
	})

	// Alerts - Rules
	api.GET("/alerts/rules", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": alerts.GetRules()})
	})

	api.POST("/alerts/rules", func(c *gin.Context) {
		var req alerts.CreateRuleRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		rule, err := alerts.CreateRule(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": rule})
	})

	api.PUT("/alerts/rules/:id/toggle", func(c *gin.Context) {
		var id int64
		fmt.Sscanf(c.Param("id"), "%d", &id)
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := alerts.ToggleRule(id, req.Enabled); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.DELETE("/alerts/rules/:id", func(c *gin.Context) {
		var id int64
		fmt.Sscanf(c.Param("id"), "%d", &id)
		if err := alerts.DeleteRule(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	// Alerts - Events
	api.GET("/alerts/events", func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "50")
		limit, _ := strconv.Atoi(limitStr)
		events := alerts.GetEvents(limit)
		unseen := alerts.GetUnseenCount()
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"events": events, "unseen": unseen}})
	})

	api.POST("/alerts/events/seen", func(c *gin.Context) {
		alerts.MarkAllSeen()
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.DELETE("/alerts/events", func(c *gin.Context) {
		alerts.ClearEvents()
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	// Alerts - Notification Channels
	api.GET("/alerts/channels", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": alerts.GetChannels()})
	})

	api.POST("/alerts/channels", func(c *gin.Context) {
		var req alerts.CreateChannelRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		ch, err := alerts.CreateChannel(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": ch})
	})

	api.DELETE("/alerts/channels/:id", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := alerts.DeleteChannel(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deleted"}})
	})

	api.PUT("/alerts/channels/:id/toggle", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := alerts.ToggleChannel(id, req.Enabled); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "toggled"}})
	})

	api.POST("/alerts/channels/:id/test", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := alerts.TestChannel(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "sent"}})
	})

	// Alerts - Rule-Channel Linking
	api.POST("/alerts/rules/:id/channels", func(c *gin.Context) {
		ruleID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		var req struct {
			ChannelIDs []int64 `json:"channelIds"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := alerts.LinkChannels(ruleID, req.ChannelIDs); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "linked"}})
	})

	api.GET("/alerts/rules/:id/channels", func(c *gin.Context) {
		ruleID, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		channelIDs := alerts.GetRuleChannels(ruleID)
		c.JSON(http.StatusOK, gin.H{"data": channelIDs})
	})

	// Reverse Proxy
	api.GET("/proxy/rules", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": proxy.ListRules()})
	})

	api.POST("/proxy/rules", func(c *gin.Context) {
		var req struct {
			Domain   string `json:"domain"`
			Target   string `json:"target"`
			Protocol string `json:"protocol"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		rule, err := proxy.CreateRule(req.Domain, req.Target, req.Protocol)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": rule})
	})

	api.PUT("/proxy/rules/:id", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		var req struct {
			Domain   string `json:"domain"`
			Target   string `json:"target"`
			Protocol string `json:"protocol"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		rule, err := proxy.UpdateRule(id, req.Domain, req.Target, req.Protocol)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": rule})
	})

	api.DELETE("/proxy/rules/:id", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := proxy.DeleteRule(id); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deleted"}})
	})

	api.PUT("/proxy/rules/:id/toggle", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := proxy.ToggleRule(id, req.Enabled); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "toggled"}})
	})

	api.GET("/proxy/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": proxy.GetStatus()})
	})

	api.GET("/proxy/config", func(c *gin.Context) {
		cfg, err := proxy.GetCaddyConfig()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"caddyfile": cfg}})
	})

	api.POST("/proxy/reload", func(c *gin.Context) {
		if err := proxy.ReloadCaddy(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "reloaded"}})
	})

	// App Center
	api.GET("/apps/templates", func(c *gin.Context) {
		templates := appcenter.GetBuiltinTemplates()
		installed := appcenter.GetInstalledApps()
		installedIDs := make(map[string]bool)
		for _, app := range installed {
			installedIDs[app["id"].(string)] = true
		}
		for i := range templates {
			templates[i].Installed = installedIDs[templates[i].ID]
		}
		c.JSON(http.StatusOK, gin.H{"data": templates})
	})

	api.GET("/apps/installed", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": appcenter.GetInstalledApps()})
	})

	api.POST("/apps/install", func(c *gin.Context) {
		var req struct {
			TemplateID string            `json:"templateId"`
			Env        map[string]string `json:"env"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := appcenter.InstallApp(req.TemplateID, req.Env); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "installed"}})
	})

	api.DELETE("/apps/:id", func(c *gin.Context) {
		if err := appcenter.UninstallApp(c.Param("id")); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "uninstalled"}})
	})
}
