package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/auth"
)

func registerUserRoutes(api *gin.RouterGroup) {
	// Users
	api.GET("/users", func(c *gin.Context) {
		users := auth.GetUsers()
		c.JSON(http.StatusOK, gin.H{"data": users})
	})

	api.POST("/users", func(c *gin.Context) {
		var req auth.CreateUserRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		user, err := auth.CreateUser(req)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": user})
	})

	api.DELETE("/users/:username", func(c *gin.Context) {
		username := c.Param("username")

		if err := auth.DeleteUser(username); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	api.PUT("/users/:username/password", func(c *gin.Context) {
		username := c.Param("username")
		var req auth.ChangePasswordRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		if err := auth.ChangePassword(username, req); err != nil {
			if err == auth.ErrInvalidCredentials {
				c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "ok"}})
	})

	// Groups
	api.GET("/groups", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"data": auth.GetGroups()})
	})

	api.POST("/groups", func(c *gin.Context) {
		var req struct {
			Name    string `json:"name"`
			Comment string `json:"comment"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		group, err := auth.CreateGroup(req.Name, req.Comment)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": group})
	})

	api.DELETE("/groups/:id", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		if err := auth.DeleteGroup(id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "deleted"}})
	})

	api.POST("/groups/:id/members", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		var req struct {
			Username string `json:"username"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := auth.AddUserToGroup(req.Username, id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "added"}})
	})

	api.DELETE("/groups/:id/members/:username", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		username := c.Param("username")
		if err := auth.RemoveUserFromGroup(username, id); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "removed"}})
	})

	api.GET("/users/:username/groups", func(c *gin.Context) {
		username := c.Param("username")
		c.JSON(http.StatusOK, gin.H{"data": auth.GetUserGroups(username)})
	})

	api.GET("/groups/:id/members", func(c *gin.Context) {
		id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
		c.JSON(http.StatusOK, gin.H{"data": auth.GetGroupMembers(id)})
	})
}
