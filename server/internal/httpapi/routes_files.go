package httpapi

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/filemanager"
	"nowenos-server/internal/recyclebin"
)

func registerFileRoutes(api *gin.RouterGroup) {
	api.GET("/files/browse", func(c *gin.Context) {
		dirPath := c.Query("path")
		if dirPath == "" {
			dirPath = "."
		}

		result, err := filemanager.Browse(dirPath)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": result})
	})

	api.GET("/files/download", func(c *gin.Context) {
		filePath := c.Query("path")
		if filePath == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
			return
		}

		file, err := filemanager.OpenFile(filePath)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		defer file.Close()

		info, err := filemanager.GetFileInfo(filePath)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.Header("Content-Disposition", "attachment; filename="+info.Name)
		c.Header("Content-Type", "application/octet-stream")
		c.Header("Content-Length", strconv.FormatInt(info.Size, 10))
		c.File(filePath)
	})

	api.POST("/files/upload", requireWrite(), func(c *gin.Context) {
		dirPath := c.Query("path")
		if dirPath == "" {
			dirPath = "."
		}

		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No file provided"})
			return
		}
		defer file.Close()

		entry, err := filemanager.Upload(dirPath, header.Filename, file)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": entry})
	})

	api.DELETE("/files/delete", requireWrite(), func(c *gin.Context) {
		targetPath := c.Query("path")
		if targetPath == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Path required"})
			return
		}

		if err := filemanager.Delete(targetPath); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.POST("/files/mkdir", requireWrite(), func(c *gin.Context) {
		var req struct {
			ParentPath string `json:"parentPath"`
			DirName    string `json:"dirName"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		entry, err := filemanager.CreateDir(req.ParentPath, req.DirName)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": entry})
	})

	// Recycle Bin
	api.GET("/recycle-bin", func(c *gin.Context) {
		items := recyclebin.GetItems()
		c.JSON(http.StatusOK, gin.H{"data": items})
	})

	api.POST("/recycle-bin/trash", func(c *gin.Context) {
		var req struct {
			Path string `json:"path"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		username, _ := c.Get("username")
		item, err := recyclebin.MoveToTrash(req.Path, fmt.Sprintf("%v", username))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": item})
	})

	api.POST("/recycle-bin/:id/restore", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := recyclebin.Restore(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "restored"}})
	})

	api.DELETE("/recycle-bin/:id", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := recyclebin.PermanentDelete(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deleted"}})
	})

	api.POST("/recycle-bin/empty", func(c *gin.Context) {
		if err := recyclebin.EmptyTrash(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "emptied"}})
	})

	// File Rename / Move
	api.POST("/files/rename", requireWrite(), func(c *gin.Context) {
		var req struct {
			Path    string `json:"path"`
			NewName string `json:"newName"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		entry, err := filemanager.Rename(req.Path, req.NewName)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": entry})
	})

	api.POST("/files/move", requireWrite(), func(c *gin.Context) {
		var req struct {
			SourcePath string `json:"sourcePath"`
			DestDir    string `json:"destDir"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		entry, err := filemanager.Move(req.SourcePath, req.DestDir)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": entry})
	})

	// File Search / Compress / Extract
	api.POST("/files/search", requireWrite(), func(c *gin.Context) {
		var req struct {
			Path  string `json:"path"`
			Query string `json:"query"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if req.Path == "" {
			req.Path = "."
		}
		results, err := filemanager.SearchFiles(req.Path, req.Query)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": results})
	})

	api.POST("/files/compress", requireWrite(), func(c *gin.Context) {
		var req struct {
			Paths    []string `json:"paths"`
			DestPath string   `json:"destPath"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := filemanager.CompressFiles(req.Paths, req.DestPath); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.POST("/files/extract", requireWrite(), func(c *gin.Context) {
		var req struct {
			ArchivePath string `json:"archivePath"`
			DestDir     string `json:"destDir"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if req.DestDir == "" {
			req.DestDir = "."
		}
		if err := filemanager.ExtractFile(req.ArchivePath, req.DestDir); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})
}
