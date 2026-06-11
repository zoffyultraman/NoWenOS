# NoWenOS v0.3 Web OS Lite MVP 实现计划

> **Worker instructions:** Required sub-skill: superpowers:subagent-driven-development or superpowers:executing-plans.
>
> **Goal:** Implement the Web OS Lite MVP — user/group/ACL model, audit logging, Samba/WebDAV share enablement improvements, Docker management enhancements, and a `.deb` packaging skeleton.
>
> **Architecture:** Extend auth with group-based ACL. Add audit log table and middleware. Enhance share management with proper service control. Add Docker compose file editor. Add `.deb` packaging scripts.
>
> **Tech stack:** React 19 + TypeScript + Tailwind + shadcn/ui + Zustand + TanStack Query | Go + Gin + SQLite | systemd + Samba + WebDAV

---

## Phase A: Auth & ACL (Tasks 1-3)

### Task 1: Fix auth middleware + add group model

**Files:**
- Modify: `server/internal/auth/auth.go`
- Modify: `server/internal/httpapi/router.go`
- Create: `server/internal/auth/groups.go`

**Changes:**

1. Fix `authMiddleware()` to extract username from token and set in context:
```go
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
		role := auth.GetUserRole(username)
		c.Set("role", role)
		c.Next()
	}
}
```

2. In `auth.go`, change `ValidateToken` to `ValidateTokenAndExtractUser` that parses the HMAC token and returns the username. Add `GetUserRole` function. Store tokens as `username|timestamp|hmac` format.

3. Create `server/internal/auth/groups.go`:
```go
package auth

import "nowenos-server/internal/database"

type Group struct {
	ID      int64  `json:"id"`
	Name    string `json:"name"`
	Comment string `json:"comment"`
}

type UserGroup struct {
	Username string `json:"username"`
	GroupID  int64  `json:"groupId"`
}

func InitGroupsTable() {
	db := database.GetDB()
	db.Exec(`CREATE TABLE IF NOT EXISTS groups (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		comment TEXT DEFAULT ''
	)`)
	db.Exec(`CREATE TABLE IF NOT EXISTS user_groups (
		username TEXT NOT NULL,
		group_id INTEGER NOT NULL,
		PRIMARY KEY (username, group_id),
		FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
	)`)
}

func GetGroups() []Group { ... }
func CreateGroup(name, comment string) (*Group, error) { ... }
func DeleteGroup(id int64) error { ... }
func AddUserToGroup(username string, groupID int64) error { ... }
func RemoveUserFromGroup(username string, groupID int64) error { ... }
func GetUserGroups(username string) []Group { ... }
func GetGroupMembers(groupID int64) []string { ... }
```

4. Add group CRUD routes to router.go:
   - `GET /api/v1/groups`
   - `POST /api/v1/groups`
   - `DELETE /api/v1/groups/:id`
   - `POST /api/v1/groups/:id/members` (add user)
   - `DELETE /api/v1/groups/:id/members/:username` (remove user)
   - `GET /api/v1/users/:username/groups`

[ ] Step 1: Create groups.go
[ ] Step 2: Fix auth middleware and token validation
[ ] Step 3: Add group routes to router.go
[ ] Step 4: Verify Go compiles
[ ] Step 5: Commit

---

### Task 2: Share ACL — bind shares to groups

**Files:**
- Modify: `server/internal/shares/shares.go`

**Changes:**

1. Add `allowed_groups TEXT DEFAULT ''` column to shares table (comma-separated group names, empty = public).
2. Add `ACLGroups` field to `Share` struct.
3. Update `CreateShare`, `UpdateShare` to accept and store `allowedGroups`.
4. Add `GetSharesForUser(username)` that checks user's groups against share ACL.
5. Update Samba config generation to use `valid users = @group1 @group2` when ACL is set.

[ ] Step 1: Add ACL column and update share CRUD
[ ] Step 2: Add GetSharesForUser function
[ ] Step 3: Update Samba config template with group-based access
[ ] Step 4: Verify Go compiles
[ ] Step 5: Commit

---

### Task 3: Frontend — User/Group management enhancements

**Files:**
- Modify: `web/src/pages/users/index.tsx`
- Modify: `web/src/features/users/api.ts`
- Create: `web/src/features/groups/api.ts`

**Changes:**

1. Create groups API client with CRUD + member management functions.
2. Enhance UsersPage with group assignment UI (checkboxes or multi-select per user).
3. Add a "Groups" tab or section showing group list and members.
4. Add group selector to Share creation/edit form.

[ ] Step 1: Create groups API client
[ ] Step 2: Enhance users API client with group functions
[ ] Step 3: Update UsersPage with group management
[ ] Step 4: Update SharesPage with group ACL selector
[ ] Step 5: Verify TypeScript compiles
[ ] Step 6: Commit

---

## Phase B: Audit Logging (Tasks 4-5)

### Task 4: Backend — Audit log model + middleware

**Files:**
- Create: `server/internal/audit/audit.go`
- Modify: `server/internal/httpapi/router.go`

**Changes:**

1. Create audit package with SQLite table:
```go
// audit_log table: id, timestamp, username, action, resource, resource_id, details, ip, status
```

2. Create audit middleware that logs all mutating requests (POST/PUT/DELETE):
```go
func AuditMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        // Before: record start time
        c.Next()
        // After: log to audit_log table with username, method, path, status, duration
    }
}
```

3. Add explicit `AuditLog(username, action, resource, details string)` function for manual logging from service code.

4. Add audit log query routes:
   - `GET /api/v1/audit/logs?limit=100&action=...&username=...`
   - `GET /api/v1/audit/stats` (counts by action, by user)

5. Wire audit middleware into router (after auth middleware).

[ ] Step 1: Create audit.go with model and functions
[ ] Step 2: Add audit middleware
[ ] Step 3: Add audit query routes
[ ] Step 4: Verify Go compiles
[ ] Step 5: Commit

---

### Task 5: Frontend — Audit log viewer

**Files:**
- Create: `web/src/features/audit/api.ts`
- Modify: `web/src/pages/logs/index.tsx`

**Changes:**

1. Create audit API client.
2. Enhance LogsPage with a tab for "System Logs" (existing) and "Audit Logs" (new).
3. Audit log table shows: timestamp, username, action, resource, status, IP.
4. Add filters: by user, by action type, by date range.

[ ] Step 1: Create audit API client
[ ] Step 2: Enhance LogsPage with audit tab
[ ] Step 3: Verify TypeScript compiles
[ ] Step 4: Commit

---

## Phase C: Docker & Share Enhancements (Tasks 6-7)

### Task 6: Docker — Compose file editor + service control improvements

**Files:**
- Modify: `web/src/pages/docker/index.tsx`

**Changes:**

1. Add a "Compose Files" section that lists discovered compose files.
2. Add a simple text editor area (textarea or Monaco later) for compose file content.
3. Add service start/stop/restart buttons that call existing compose control API.
4. Show compose service status (running/stopped) with color indicators.

[ ] Step 1: Enhance DockerPage with compose section
[ ] Step 2: Add compose file viewer/editor
[ ] Step 3: Verify TypeScript compiles
[ ] Step 4: Commit

---

### Task 7: Shares — Service control UI

**Files:**
- Modify: `web/src/pages/shares/index.tsx`

**Changes:**

1. Show Samba/WebDAV/NFS service status (installed/running) from existing API.
2. Add start/stop/restart buttons for each service (call systemd via backend).
3. Add service status indicator (green dot = running, red = stopped, gray = not installed).

**Backend addition:**
- Add `POST /api/v1/shares/services/:name/control` endpoint that runs `systemctl start/stop/restart` for whitelisted services only (smbd, apache2, nfs-kernel-server).

[ ] Step 1: Add service control backend endpoint
[ ] Step 2: Enhance SharesPage with service status and controls
[ ] Step 3: Verify Go and TypeScript compile
[ ] Step 4: Commit

---

## Phase D: i18n + Packaging (Tasks 8-9)

### Task 8: i18n — Add all v0.3 translation keys

[ ] Add translation keys for: groups, audit, service control, compose editor
[ ] Verify TypeScript compiles
[ ] Commit

---

### Task 9: Debian packaging skeleton

**Files:**
- Create: `deploy/debian/control`
- Create: `deploy/debian/nowenos.service`
- Create: `deploy/scripts/install.sh`
- Create: `deploy/scripts/postinst.sh`

**Changes:**

1. Create systemd service file for nowenos-api.
2. Create install script that copies binaries, creates data directories, sets permissions.
3. Create postinst script for post-installation setup.
4. Create debian control file with dependencies.

[ ] Step 1: Create packaging files
[ ] Step 2: Verify scripts are syntactically correct
[ ] Step 3: Commit

---

## Self-Check

1. **Spec coverage:** Auth/ACL (OK), Groups (OK), Share ACL (OK), Audit logging (OK), Docker enhancements (OK), Share service control (OK), i18n (OK), Packaging skeleton (OK).
2. **Safety:** All privileged operations through whitelisted commands. No destructive disk ops. Service control limited to whitelisted units.
3. **Token security:** Fixed token validation to properly extract and verify username.
