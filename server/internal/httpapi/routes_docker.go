package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/systemadapter"
)

func registerDockerRoutes(api *gin.RouterGroup) {
	// Docker Containers
	api.GET("/docker/containers", func(c *gin.Context) {
		containers, err := systemadapter.GetContainers()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": containers})
	})

	api.POST("/docker/containers/:id/control", func(c *gin.Context) {
		id := c.Param("id")
		var req struct {
			Action string `json:"action"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if err := systemadapter.ControlContainer(id, req.Action); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok", "action": req.Action}})
	})

	api.GET("/docker/containers/:id/logs", func(c *gin.Context) {
		id := c.Param("id")
		tailStr := c.DefaultQuery("tail", "100")
		tail, _ := strconv.Atoi(tailStr)

		logs, err := systemadapter.GetContainerLogs(id, tail)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"logs": logs}})
	})

	// Docker Images
	api.GET("/docker/images", func(c *gin.Context) {
		images, err := systemadapter.GetImages()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": images})
	})

	api.POST("/docker/images/pull", func(c *gin.Context) {
		var req struct {
			Image string `json:"image"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if err := systemadapter.PullImage(req.Image); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok", "image": req.Image}})
	})

	api.DELETE("/docker/images/:id", func(c *gin.Context) {
		id := c.Param("id")

		if err := systemadapter.RemoveImage(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	// Docker Compose
	api.GET("/docker/compose", func(c *gin.Context) {
		projects, err := systemadapter.ListComposeProjects()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": projects})
	})

	api.GET("/docker/compose/:name", func(c *gin.Context) {
		name := c.Param("name")
		services, err := systemadapter.GetComposeProject(name)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": services})
	})

	api.POST("/docker/compose/:name/control", func(c *gin.Context) {
		name := c.Param("name")
		var req struct {
			Action   string `json:"action"`
			FilePath string `json:"filePath"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		var err error
		switch req.Action {
		case "up":
			err = systemadapter.ComposeUp(name, req.FilePath)
		case "down":
			err = systemadapter.ComposeDown(name, req.FilePath)
		case "restart":
			err = systemadapter.ComposeRestart(name, req.FilePath)
		default:
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid action. Use up, down, or restart"})
			return
		}

		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok", "action": req.Action}})
	})

	api.GET("/docker/compose/:name/logs", func(c *gin.Context) {
		name := c.Param("name")
		tailStr := c.DefaultQuery("tail", "100")
		tail, _ := strconv.Atoi(tailStr)

		logs, err := systemadapter.ComposeLogs(name, tail)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"logs": logs}})
	})

	// Docker Compose File Editor
	api.GET("/docker/compose/file", func(c *gin.Context) {
		path := c.Query("path")
		content, err := systemadapter.ReadComposeFile(path)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"path": path, "content": content}})
	})

	api.PUT("/docker/compose/file", func(c *gin.Context) {
		var req struct {
			Path    string `json:"path"`
			Content string `json:"content"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := systemadapter.WriteComposeFile(req.Path, req.Content); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok", "path": req.Path}})
	})

	api.POST("/docker/compose/file/validate", func(c *gin.Context) {
		var req struct {
			Path string `json:"path"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		output, err := systemadapter.ValidateComposeFile(req.Path)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error(), "output": output})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "valid", "output": output}})
	})

	api.POST("/docker/compose/file/deploy", func(c *gin.Context) {
		var req struct {
			Path string `json:"path"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := systemadapter.DeployComposeFile(req.Path); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deployed"}})
	})
}
