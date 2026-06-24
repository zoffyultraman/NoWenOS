package httpapi

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/auth"
	"nowenos-server/internal/twofa"
)

func registerAuthRoutes(r *gin.Engine) {
	// Login
	r.POST("/api/v1/auth/login", func(c *gin.Context) {
		var req auth.LoginRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// Validate credentials first
		if err := auth.ValidateCredentials(req.Username, req.Password); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Check if 2FA is enabled
		if twofa.HasTwoFA(req.Username) {
			c.JSON(http.StatusOK, gin.H{"data": gin.H{
				"requires2FA": true,
				"username":    req.Username,
			}})
			return
		}

		resp, err := auth.Login(req)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": resp})
	})

	// 2FA login verification
	r.POST("/api/v1/auth/login/2fa", func(c *gin.Context) {
		var req struct {
			Username string `json:"username"`
			Password string `json:"password"`
			Code     string `json:"code"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		// Validate credentials again
		if err := auth.ValidateCredentials(req.Username, req.Password); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Verify 2FA code
		if !twofa.LoginVerify(req.Username, req.Code) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid 2FA code"})
			return
		}

		resp, err := auth.Login(auth.LoginRequest{Username: req.Username, Password: req.Password})
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"data": resp})
	})
}

func registerAuthProtectedRoutes(api *gin.RouterGroup) {
	// 2FA management
	api.POST("/2fa/enable", func(c *gin.Context) {
		username, _ := c.Get("username")
		resp, err := twofa.Enable(fmt.Sprintf("%v", username))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": resp})
	})

	api.POST("/2fa/verify", func(c *gin.Context) {
		username, _ := c.Get("username")
		var req twofa.VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := twofa.Verify(fmt.Sprintf("%v", username), req.Code); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "enabled"}})
	})

	api.POST("/2fa/disable", func(c *gin.Context) {
		username, _ := c.Get("username")
		var req twofa.VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		if err := twofa.Disable(fmt.Sprintf("%v", username), req.Code); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "disabled"}})
	})

	api.GET("/2fa/status", func(c *gin.Context) {
		username, _ := c.Get("username")
		resp := twofa.GetStatus(fmt.Sprintf("%v", username))
		c.JSON(http.StatusOK, gin.H{"data": resp})
	})

	api.POST("/2fa/backup-verify", func(c *gin.Context) {
		username, _ := c.Get("username")
		var req twofa.VerifyRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}
		valid, err := twofa.BackupVerify(fmt.Sprintf("%v", username), req.Code)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if !valid {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup code"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"status": "verified"}})
	})

	api.GET("/2fa/setup", func(c *gin.Context) {
		username, _ := c.Get("username")
		resp, err := twofa.GetSetupInfo(fmt.Sprintf("%v", username))
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"data": resp})
	})
}
