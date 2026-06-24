package httpapi

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/audit"
	"nowenos-server/internal/auth"
	"nowenos-server/internal/security"
	"nowenos-server/static"
)

func New() *gin.Engine {
	r := gin.Default()

	r.Use(security.CORSMiddleware())
	r.Use(security.RateLimitMiddleware())

	// Health check (unauthenticated)
	r.GET("/api/v1/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Public auth routes (login, 2FA login verification)
	registerAuthRoutes(r)

	// Protected routes
	api := r.Group("/api/v1")
	api.Use(authMiddleware())
	api.Use(audit.AuditMiddleware())
	{
		registerSystemRoutes(api)
		registerDockerRoutes(api)
		registerFileRoutes(api)
		registerShareRoutes(api)
		registerUserRoutes(api)
		registerAuthProtectedRoutes(api)
		registerInfraRoutes(api)
	}

	static.ServeStatic(r)

	return r
}

func requireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleStr, _ := role.(string)
		for _, r := range roles {
			if r == roleStr {
				c.Next()
				return
			}
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

func requireWrite() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		roleStr, _ := role.(string)
		if roleStr == "viewer" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Viewers cannot perform write operations"})
			c.Abort()
			return
		}
		c.Next()
	}
}

func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format"})
			c.Abort()
			return
		}

		token := parts[1]
		username, err := auth.ValidateTokenAndExtractUser(token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		c.Set("username", username)
		c.Set("role", auth.GetUserRole(username))
		c.Next()
	}
}
