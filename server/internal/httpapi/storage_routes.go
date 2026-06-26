package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/storagemgr"
)

func registerStorageRoutes(api *gin.RouterGroup) {
	storage := api.Group("/storage")
	storage.Use(requireRole("admin"))
	{
		// ── Read-only endpoints ────────────────────────────────────────

		// List all block devices
		storage.GET("/disks", func(c *gin.Context) {
			disks, err := storagemgr.ListDisks()
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
				return
			}
			if disks == nil {
				disks = []storagemgr.DiskInfo{}
			}
			c.JSON(http.StatusOK, gin.H{"data": disks})
		})

		// Get a single device by name (e.g. "sda" or "/dev/sda")
		storage.GET("/disks/:device", func(c *gin.Context) {
			device := normaliseDevice(c.Param("device"))
			if device == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "device parameter is required"})
				return
			}
			info, err := storagemgr.GetDiskInfo(device)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
				return
			}
			c.JSON(http.StatusOK, gin.H{"data": info})
		})

		// ── Destructive endpoints (password challenge required) ────────

		destructive := storage.Group("")
		destructive.Use(audit.RequirePasswordChallenge())
		{
			// Wipe a disk
			destructive.POST("/disks/wipe", func(c *gin.Context) {
				var req struct {
					Device string `json:"device"`
					Quick  *bool  `json:"quick"` // pointer so we can detect omission
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
					return
				}
				device := normaliseDevice(req.Device)
				if device == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "device is required"})
					return
				}
				quick := true // default to quick wipe
				if req.Quick != nil {
					quick = *req.Quick
				}

				taskID, err := storagemgr.WipeDisk(device, quick)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusAccepted, gin.H{"task_id": taskID})
			})

			// Format a disk
			destructive.POST("/disks/format", func(c *gin.Context) {
				var req struct {
					Device string `json:"device"`
					FSType string `json:"fs_type"`
					Label  string `json:"label"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
					return
				}
				device := normaliseDevice(req.Device)
				if device == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "device is required"})
					return
				}

				taskID, err := storagemgr.FormatDisk(device, req.FSType, req.Label)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusAccepted, gin.H{"task_id": taskID})
			})

			// Partition a disk (GPT + single partition)
			destructive.POST("/disks/partition", func(c *gin.Context) {
				var req struct {
					Device   string `json:"device"`
					PartType string `json:"part_type"`
				}
				if err := c.ShouldBindJSON(&req); err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
					return
				}
				device := normaliseDevice(req.Device)
				if device == "" {
					c.JSON(http.StatusBadRequest, gin.H{"error": "device is required"})
					return
				}

				taskID, err := storagemgr.PartitionDisk(device, req.PartType)
				if err != nil {
					c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
					return
				}
				c.JSON(http.StatusAccepted, gin.H{"task_id": taskID})
			})
		}
	}
}

// normaliseDevice ensures the device path starts with "/dev/".
func normaliseDevice(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "/dev/") {
		raw = "/dev/" + raw
	}
	return raw
}
