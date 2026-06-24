package httpapi

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/shares"
)

func registerShareRoutes(api *gin.RouterGroup) {
	api.GET("/shares", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": shares.GetShares()})
	})

	api.GET("/shares/status", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": shares.GetSambaStatus()})
	})

	api.GET("/shares/status/webdav", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": shares.GetWebDAVStatus()})
	})

	api.GET("/shares/status/nfs", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": shares.GetNFSStatus()})
	})

	api.POST("/shares", requireWrite(), func(c *gin.Context) {
		var req shares.CreateShareRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		share, err := shares.CreateShare(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": share})
	})

	api.PUT("/shares/:id", func(c *gin.Context) {
		idStr := c.Param("id")
		var id int64
		fmt.Sscanf(idStr, "%d", &id)
		var req shares.CreateShareRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		share, err := shares.UpdateShare(id, req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": share})
	})

	api.PUT("/shares/:id/toggle", func(c *gin.Context) {
		idStr := c.Param("id")
		var id int64
		fmt.Sscanf(idStr, "%d", &id)
		var req struct {
			Enabled bool `json:"enabled"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := shares.ToggleShare(id, req.Enabled); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.DELETE("/shares/:id", func(c *gin.Context) {
		idStr := c.Param("id")
		var id int64
		fmt.Sscanf(idStr, "%d", &id)
		if err := shares.DeleteShare(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})
}
