package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/configmgr"
	"nowenos-server/internal/settings"
	"nowenos-server/internal/statsstore"
	"nowenos-server/internal/sysinfo"
	"nowenos-server/internal/systemadapter"
	"nowenos-server/internal/updater"
)

func registerSystemRoutes(api *gin.RouterGroup) {
	api.GET("/system/info", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"name": "NoWenOS", "version": "0.1.0"}})
	})

	api.GET("/system/stats", func(c *gin.Context) {
		stats, err := sysinfo.GetStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": stats})
	})

	api.GET("/system/stats/history", func(c *gin.Context) {
		minutesStr := c.DefaultQuery("minutes", "60")
		minutes, err := strconv.Atoi(minutesStr)
		if err != nil || minutes <= 0 {
			minutes = 60
		}
		records, err := statsstore.GetHistory(minutes)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if records == nil {
			records = []statsstore.StatsRecord{}
		}
		c.JSON(http.StatusOK, gin.H{"data": records})
	})

	api.GET("/system/network", func(c *gin.Context) {
		stats, err := sysinfo.GetNetworkStats()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": stats})
	})

	api.GET("/system/hardware", func(c *gin.Context) {
		info, err := sysinfo.GetHardwareInfo()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": info})
	})

	api.GET("/system/processes", func(c *gin.Context) {
		limitStr := c.DefaultQuery("limit", "50")
		limit, _ := strconv.Atoi(limitStr)

		procs, err := sysinfo.GetTopProcesses(limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": procs})
	})

	api.GET("/storage/disks", func(c *gin.Context) {
		disks, err := systemadapter.GetDisks()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": disks})
	})

	// Settings
	api.GET("/settings", func(c *gin.Context) {
		s := settings.Get()
		c.JSON(http.StatusOK, gin.H{"data": s})
	})

	api.PUT("/settings", func(c *gin.Context) {
		var req settings.Settings
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if err := settings.Update(&req); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": settings.Get()})
	})

	// Config Export/Import
	api.GET("/config/export", func(c *gin.Context) {
		data, err := configmgr.Export()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.Header("Content-Disposition", "attachment; filename=nowenos-config.json")
		c.JSON(http.StatusOK, data)
	})

	api.POST("/config/import", func(c *gin.Context) {
		var data configmgr.ExportData
		if err := c.ShouldBindJSON(&data); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid config data"})
			return
		}
		if data.Version == 0 {
			data.Version = 1
		}
		if err := configmgr.Import(&data); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "imported"}})
	})

	// Update Check
	api.GET("/system/version", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": updater.GetVersionInfo()})
	})

	api.GET("/system/update-check", func(c *gin.Context) {
		info := updater.CheckForUpdate()
		c.JSON(http.StatusOK, gin.H{"data": info})
	})
}
