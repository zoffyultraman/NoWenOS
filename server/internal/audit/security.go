package audit

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"nowenos-server/internal/auth"
	"nowenos-server/internal/database"
	"nowenos-server/internal/twofa"
)

// RequirePasswordChallenge returns a gin middleware that requires the caller
// to provide a valid password (or OTP) in the request header before executing
// a destructive operation. This acts as a "step-up authentication" gate for
// high-risk API endpoints (disk partitioning, filesystem creation, dd, etc.).
//
// The client must send one of:
//
//	X-Confirm-Password: <current password>
//	X-Confirm-OTP:      <6-digit TOTP code or backup code>
//
// On failure the middleware aborts with 403 and writes a structured audit log
// entry recording the user, IP, target device path, and failure reason.
func RequirePasswordChallenge() gin.HandlerFunc {
	return func(c *gin.Context) {
		usernameRaw, exists := c.Get("username")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
			c.Abort()
			return
		}
		username := fmt.Sprintf("%v", usernameRaw)
		ip := c.ClientIP()
		devicePath := extractDevicePath(c)

		password := c.GetHeader("X-Confirm-Password")
		otp := c.GetHeader("X-Confirm-OTP")

		if password == "" && otp == "" {
			LogSecurity(username, "password_challenge_missing", devicePath, ip,
				"destructive operation blocked: no confirmation password or OTP provided", "blocked")
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "Password confirmation required for this destructive operation",
				"code":    "CONFIRM_PASSWORD_REQUIRED",
				"details": "Send your current password via X-Confirm-Password header, or a TOTP code via X-Confirm-OTP",
			})
			c.Abort()
			return
		}

		// Try password-based confirmation first
		if password != "" {
			if err := auth.ValidateCredentials(username, password); err != nil {
				LogSecurity(username, "password_challenge_failed", devicePath, ip,
					fmt.Sprintf("destructive operation blocked: invalid password"), "blocked")
				c.JSON(http.StatusForbidden, gin.H{
					"error": "Invalid password confirmation",
					"code":  "CONFIRM_PASSWORD_INVALID",
				})
				c.Abort()
				return
			}
		} else if otp != "" {
			// Try OTP-based confirmation (TOTP code or backup code)
			if !twofa.LoginVerify(username, otp) {
				LogSecurity(username, "otp_challenge_failed", devicePath, ip,
					"destructive operation blocked: invalid OTP or backup code", "blocked")
				c.JSON(http.StatusForbidden, gin.H{
					"error": "Invalid OTP confirmation",
					"code":  "CONFIRM_OTP_INVALID",
				})
				c.Abort()
				return
			}
		}

		// Challenge passed -- log success and continue
		LogSecurity(username, "password_challenge_passed", devicePath, ip,
			"destructive operation authorized", "ok")
		c.Next()
	}
}

// LogSecurity writes a security-focused audit log entry. Compared to the
// generic Log() function, this always records the physical device_path and
// is intended for high-risk storage operations.
func LogSecurity(username, action, devicePath, ip, details, status string) {
	db := database.GetDB()
	db.Exec(
		"INSERT INTO audit_log (username, action, resource, resource_id, details, ip, status, device_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		username, action, "storage", devicePath, details, ip, status, devicePath,
	)
}

// LogDestructive is a convenience wrapper that logs a destructive storage
// operation with all relevant context. Call this AFTER the operation completes.
func LogDestructive(username, action, devicePath, ip, details, status string, durationMs int64) {
	db := database.GetDB()
	db.Exec(
		"INSERT INTO audit_log (username, action, resource, resource_id, details, ip, status, duration, device_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		username, action, "storage", devicePath, details, ip, status, durationMs, devicePath,
	)
}

// extractDevicePath attempts to pull a /dev/... device path from the request
// body or URL parameters. It checks common JSON field names used across the
// storage API endpoints.
func extractDevicePath(c *gin.Context) string {
	// 1. Check URL parameter :device
	if dev := c.Param("device"); dev != "" {
		return sanitizeDevicePath(dev)
	}

	// 2. Try to read from JSON body without consuming it
	var body map[string]interface{}
	if c.Request.Body != nil && c.Request.ContentLength > 0 && c.Request.ContentLength < 65536 {
		if err := c.ShouldBindJSON(&body); err == nil {
			for _, key := range []string{"device", "devicePath", "device_path", "disk", "target"} {
				if val, ok := body[key]; ok {
					if s, ok := val.(string); ok && s != "" {
						return sanitizeDevicePath(s)
					}
				}
			}
		}
	}

	return ""
}

// sanitizeDevicePath normalises a device reference to a /dev/ path.
// Accepts forms like "sdb", "/dev/sdb", "/dev/sdb1".
func sanitizeDevicePath(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if !strings.HasPrefix(raw, "/dev/") {
		raw = "/dev/" + raw
	}
	return raw
}

// InitSecurityAuditSchema ensures the audit_log table has the device_path
// column required by the security audit module. Called during startup.
func InitSecurityAuditSchema() {
	db := database.GetDB()
	// SQLite does not support IF NOT EXISTS for ALTER TABLE ADD COLUMN,
	// so we catch the duplicate-column error silently.
	_, _ = db.Exec("ALTER TABLE audit_log ADD COLUMN device_path TEXT DEFAULT ''")
}

// GetSecurityLogs returns audit entries filtered by device_path for forensic
// review. Only returns entries that have a non-empty device_path.
func GetSecurityLogs(devicePath string, limit int) []AuditEntry {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	db := database.GetDB()

	query := `SELECT id, timestamp, username, action, resource, resource_id, details, ip, status, duration
		FROM audit_log WHERE device_path != ''`
	args := []interface{}{}

	if devicePath != "" {
		query += " AND device_path = ?"
		args = append(args, devicePath)
	}

	query += " ORDER BY id DESC LIMIT ?"
	args = append(args, limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return []AuditEntry{}
	}
	defer rows.Close()

	entries := make([]AuditEntry, 0)
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.ID, &e.Timestamp, &e.Username, &e.Action, &e.Resource, &e.ResourceID, &e.Details, &e.IP, &e.Status, &e.Duration); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries
}

// IsDestructiveBinary returns true if the given binary is considered
// destructive and should trigger the password challenge flow.
// NOTE: These binaries are now routed exclusively through the diskcmd package
// and are no longer in the public systemadapter allowlist.
func IsDestructiveBinary(binary string) bool {
	destructive := map[string]bool{
		"fdisk":      true,
		"parted":     true,
		"sgdisk":     true,
		"mkfs.ext4":  true,
		"mkfs.btrfs": true,
		"mkfs.xfs":   true,
		"mkfs.vfat":  true,
		"wipefs":     true,
		"dd":         true,
		"mdadm":      true,
		"vgcreate":   true,
		"lvcreate":   true,
		"zpool":      true,
		"zfs":        true,
		"umount":     true,
	}
	return destructive[binary]
}
