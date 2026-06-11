package security

import (
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// ── Rate Limiter ──

type rateLimiter struct {
	mu       sync.Mutex
	tokens   float64
	maxTokens float64
	refillRate float64 // tokens per second
	lastRefill time.Time
}

func newRateLimiter(maxPerMin int) *rateLimiter {
	return &rateLimiter{
		tokens:    float64(maxPerMin),
		maxTokens: float64(maxPerMin),
		refillRate: float64(maxPerMin) / 60.0,
		lastRefill: time.Now(),
	}
}

func (rl *rateLimiter) allow() bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	elapsed := now.Sub(rl.lastRefill).Seconds()
	rl.tokens += elapsed * rl.refillRate
	if rl.tokens > rl.maxTokens {
		rl.tokens = rl.maxTokens
	}
	rl.lastRefill = now

	if rl.tokens >= 1 {
		rl.tokens--
		return true
	}
	return false
}

var (
	limiters   sync.Map // map[string]*rateLimiter
	defaultRPS = 60     // requests per minute
	authRPS    = 10     // login attempts per minute
)

func getLimiter(ip string, maxPerMin int) *rateLimiter {
	key := ip + ":" + string(rune(maxPerMin))
	if v, ok := limiters.Load(key); ok {
		return v.(*rateLimiter)
	}
	rl := newRateLimiter(maxPerMin)
	actual, _ := limiters.LoadOrStore(key, rl)
	return actual.(*rateLimiter)
}

// RateLimitMiddleware returns a gin middleware that limits requests per IP.
func RateLimitMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		ip := c.ClientIP()
		path := c.Request.URL.Path

		limit := defaultRPS
		// Stricter limit for auth endpoints
		if strings.HasPrefix(path, "/api/v1/auth/login") {
			limit = authRPS
		}

		rl := getLimiter(ip, limit)
		if !rl.allow() {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Rate limit exceeded"})
			c.Abort()
			return
		}
		c.Next()
	}
}

// ── CORS ──

// CORSMiddleware returns a gin middleware for CORS handling.
func CORSMiddleware() gin.HandlerFunc {
	origins := os.Getenv("NOWENOS_CORS_ORIGINS")
	if origins == "" {
		origins = "*" // default: allow all for self-hosted use
	}

	allowedOrigins := strings.Split(origins, ",")

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		allowed := false
		for _, o := range allowedOrigins {
			o = strings.TrimSpace(o)
			if o == "*" || o == origin {
				allowed = true
				break
			}
		}

		if allowed {
			if origins == "*" {
				c.Header("Access-Control-Allow-Origin", "*")
			} else {
				c.Header("Access-Control-Allow-Origin", origin)
				c.Header("Vary", "Origin")
			}
		}

		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
