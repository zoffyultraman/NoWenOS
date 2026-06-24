# Frontend-Backend API Contract

## General

- All API requests use prefix `/api/v1`.
- Responses use JSON with a top-level `data` envelope for success and `error` for failures.
- Protected endpoints require `Authorization: Bearer <token>` header.
- Middleware: CORS, rate limiting, JWT auth, and audit logging are applied automatically.

## Conventions

| Field | Description |
|-------|-------------|
| Auth | Requires Bearer token unless marked "Public" |
| Write | `requireWrite()` -- viewer role is forbidden |
| Admin | `requireRole("admin")` -- only admin role allowed |

---

## 1. Health

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/health` | Health check | Public |

**Response:** `{ "status": "ok" }`

---

## 2. Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/login` | Login (returns token or requires 2FA) | Public |
| POST | `/api/v1/auth/login/2fa` | Login with 2FA code | Public |

### POST /auth/login

**Request:**
```json
{ "username": "string", "password": "string" }
```

**Response (no 2FA):**
```json
{ "data": { "token": "string", "user": { ... } } }
```

**Response (2FA required):**
```json
{ "data": { "requires2FA": true, "username": "string" } }
```

### POST /auth/login/2fa

**Request:**
```json
{ "username": "string", "password": "string", "code": "string" }
```

**Response:** Same as successful login.

---

## 3. Two-Factor Authentication (2FA)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/2fa/status` | Get 2FA status for current user | Yes |
| GET | `/api/v1/2fa/setup` | Get 2FA setup info (QR, secret) | Yes |
| POST | `/api/v1/2fa/enable` | Generate 2FA secret | Yes |
| POST | `/api/v1/2fa/verify` | Verify and enable 2FA | Yes |
| POST | `/api/v1/2fa/disable` | Disable 2FA | Yes |
| POST | `/api/v1/2fa/backup-verify` | Verify with backup code | Yes |

### POST /2fa/enable

**Response:** `{ "data": { "secret": "string", "qrCode": "string" } }`

### POST /2fa/verify, /2fa/disable, /2fa/backup-verify

**Request:** `{ "code": "string" }`

---

## 4. System

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/system/info` | System name and version | Yes |
| GET | `/api/v1/system/stats` | Current system stats (CPU, RAM, etc.) | Yes |
| GET | `/api/v1/system/stats/history?minutes=60` | Historical stats | Yes |
| GET | `/api/v1/system/network` | Network interface stats | Yes |
| GET | `/api/v1/system/hardware` | Hardware details | Yes |
| GET | `/api/v1/system/processes?limit=50` | Top processes | Yes |
| GET | `/api/v1/system/version` | Current version info | Yes |
| GET | `/api/v1/system/update-check` | Check for updates | Yes |
| GET | `/api/v1/storage/disks` | Disk information | Yes |

### GET /system/info

**Response:** `{ "data": { "name": "NoWenOS", "version": "0.1.0" } }`

---

## 5. Settings & Config

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/settings` | Get system settings | Yes |
| PUT | `/api/v1/settings` | Update system settings | Yes |
| GET | `/api/v1/config/export` | Export configuration (JSON download) | Yes |
| POST | `/api/v1/config/import` | Import configuration | Yes |

### PUT /settings

**Request:**
```json
{
  "hostname": "string",
  "httpPort": 8080,
  "logLevel": "info",
  "autoUpdate": false,
  "maxUpload": 1024
}
```

### POST /config/import

**Request:** Full config JSON object (same format as export).

---

## 6. File Management

| Method | Path | Description | Auth | Write |
|--------|------|-------------|------|-------|
| GET | `/api/v1/files/browse?path=.` | Browse directory | Yes | |
| GET | `/api/v1/files/download?path=...` | Download file | Yes | |
| POST | `/api/v1/files/upload?path=.` | Upload file (multipart) | Yes | Yes |
| DELETE | `/api/v1/files/delete?path=...` | Delete file/folder | Yes | Yes |
| POST | `/api/v1/files/mkdir` | Create directory | Yes | Yes |
| POST | `/api/v1/files/rename` | Rename file/folder | Yes | Yes |
| POST | `/api/v1/files/move` | Move file/folder | Yes | Yes |
| POST | `/api/v1/files/search` | Search files | Yes | Yes |
| POST | `/api/v1/files/compress` | Compress files to archive | Yes | Yes |
| POST | `/api/v1/files/extract` | Extract archive | Yes | Yes |

### POST /files/mkdir

**Request:** `{ "parentPath": "string", "dirName": "string" }`

### POST /files/rename

**Request:** `{ "path": "string", "newName": "string" }`

### POST /files/move

**Request:** `{ "sourcePath": "string", "destDir": "string" }`

### POST /files/search

**Request:** `{ "path": "string", "query": "string" }`

### POST /files/compress

**Request:** `{ "paths": ["string"], "destPath": "string" }`

### POST /files/extract

**Request:** `{ "archivePath": "string", "destDir": "string" }`

---

## 7. Recycle Bin

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/recycle-bin` | List recycled items | Yes |
| POST | `/api/v1/recycle-bin/trash` | Move file to trash | Yes |
| POST | `/api/v1/recycle-bin/:id/restore` | Restore from trash | Yes |
| DELETE | `/api/v1/recycle-bin/:id` | Permanently delete | Yes |
| POST | `/api/v1/recycle-bin/empty` | Empty entire trash | Yes |

### POST /recycle-bin/trash

**Request:** `{ "path": "string" }`

---

## 8. Docker -- Containers

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/docker/containers` | List containers | Yes |
| POST | `/api/v1/docker/containers/:id/control` | Start/stop/restart container | Yes |
| GET | `/api/v1/docker/containers/:id/logs?tail=100` | Container logs | Yes |

### POST /docker/containers/:id/control

**Request:** `{ "action": "start" | "stop" | "restart" }`

---

## 9. Docker -- Images

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/docker/images` | List images | Yes |
| POST | `/api/v1/docker/images/pull` | Pull image | Yes |
| DELETE | `/api/v1/docker/images/:id` | Remove image | Yes |

### POST /docker/images/pull

**Request:** `{ "image": "string" }`

---

## 10. Docker -- Compose

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/docker/compose` | List compose projects | Yes |
| GET | `/api/v1/docker/compose/:name` | Get project services | Yes |
| POST | `/api/v1/docker/compose/:name/control` | Up/down/restart project | Yes |
| GET | `/api/v1/docker/compose/:name/logs?tail=100` | Project logs | Yes |
| GET | `/api/v1/docker/compose/file?path=...` | Read compose file | Yes |
| PUT | `/api/v1/docker/compose/file` | Write compose file | Yes |
| POST | `/api/v1/docker/compose/file/validate` | Validate compose file | Yes |
| POST | `/api/v1/docker/compose/file/deploy` | Deploy compose file | Yes |

### POST /docker/compose/:name/control

**Request:** `{ "action": "up" | "down" | "restart", "filePath": "string" }`

### PUT /docker/compose/file

**Request:** `{ "path": "string", "content": "string" }`

### POST /docker/compose/file/validate

**Request:** `{ "path": "string" }`

### POST /docker/compose/file/deploy

**Request:** `{ "path": "string" }`

---

## 11. Shares

| Method | Path | Description | Auth | Write |
|--------|------|-------------|------|-------|
| GET | `/api/v1/shares` | List shares | Yes | |
| GET | `/api/v1/shares/status` | Samba status | Yes | |
| GET | `/api/v1/shares/status/webdav` | WebDAV status | Yes | |
| GET | `/api/v1/shares/status/nfs` | NFS status | Yes | |
| POST | `/api/v1/shares` | Create share | Yes | Yes |
| PUT | `/api/v1/shares/:id` | Update share | Yes | |
| PUT | `/api/v1/shares/:id/toggle` | Enable/disable share | Yes | |
| DELETE | `/api/v1/shares/:id` | Delete share | Yes | |

### POST /shares

**Request:**
```json
{
  "name": "string",
  "path": "string",
  "protocol": "smb" | "webdav" | "nfs",
  "readOnly": false,
  "guest": false
}
```

---

## 12. Users

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/users` | List users | Yes |
| POST | `/api/v1/users` | Create user | Yes |
| DELETE | `/api/v1/users/:username` | Delete user | Yes |
| PUT | `/api/v1/users/:username/password` | Change password | Yes |
| GET | `/api/v1/users/:username/groups` | Get user's groups | Yes |

### POST /users

**Request:** `{ "username": "string", "password": "string", "role": "admin" | "user" | "viewer" }`

### PUT /users/:username/password

**Request:** `{ "currentPassword": "string", "newPassword": "string" }`

---

## 13. Groups

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/groups` | List groups | Yes |
| POST | `/api/v1/groups` | Create group | Yes |
| DELETE | `/api/v1/groups/:id` | Delete group | Yes |
| GET | `/api/v1/groups/:id/members` | List group members | Yes |
| POST | `/api/v1/groups/:id/members` | Add user to group | Yes |
| DELETE | `/api/v1/groups/:id/members/:username` | Remove user from group | Yes |

### POST /groups

**Request:** `{ "name": "string", "comment": "string" }`

### POST /groups/:id/members

**Request:** `{ "username": "string" }`

---

## 14. Logs

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/logs?source=...&limit=100` | Get logs | Yes |
| GET | `/api/v1/logs/sources` | List available log sources | Yes |
| GET | `/api/v1/logs/download` | Download log file | Yes |

---

## 15. Audit

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/audit/logs?limit=100&action=...&username=...` | Audit logs | Yes |
| GET | `/api/v1/audit/stats` | Audit statistics | Yes |

---

## 16. Backups

| Method | Path | Description | Auth | Admin |
|--------|------|-------------|------|-------|
| GET | `/api/v1/backups` | List backups | Yes | |
| POST | `/api/v1/backups` | Create backup | Yes | |
| DELETE | `/api/v1/backups/:name` | Delete backup | Yes | |
| POST | `/api/v1/backups/:name/restore` | Restore backup | Yes | Yes |

---

## 17. Alerts -- Rules

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/alerts/rules` | List alert rules | Yes |
| POST | `/api/v1/alerts/rules` | Create alert rule | Yes |
| PUT | `/api/v1/alerts/rules/:id/toggle` | Enable/disable rule | Yes |
| DELETE | `/api/v1/alerts/rules/:id` | Delete rule | Yes |
| POST | `/api/v1/alerts/rules/:id/channels` | Link channels to rule | Yes |
| GET | `/api/v1/alerts/rules/:id/channels` | Get linked channel IDs | Yes |

### POST /alerts/rules

**Request:**
```json
{
  "name": "string",
  "metric": "string",
  "condition": "string",
  "threshold": 0,
  "enabled": true
}
```

### POST /alerts/rules/:id/channels

**Request:** `{ "channelIds": [1, 2, 3] }`

---

## 18. Alerts -- Events

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/alerts/events?limit=50` | List alert events + unseen count | Yes |
| POST | `/api/v1/alerts/events/seen` | Mark all events as seen | Yes |
| DELETE | `/api/v1/alerts/events` | Clear all events | Yes |

---

## 19. Alerts -- Notification Channels

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/alerts/channels` | List notification channels | Yes |
| POST | `/api/v1/alerts/channels` | Create channel | Yes |
| DELETE | `/api/v1/alerts/channels/:id` | Delete channel | Yes |
| PUT | `/api/v1/alerts/channels/:id/toggle` | Enable/disable channel | Yes |
| POST | `/api/v1/alerts/channels/:id/test` | Send test notification | Yes |

### POST /alerts/channels

**Request:**
```json
{
  "name": "string",
  "type": "email" | "webhook" | "telegram",
  "config": { ... }
}
```

---

## 20. Reverse Proxy

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/proxy/rules` | List proxy rules | Yes |
| POST | `/api/v1/proxy/rules` | Create proxy rule | Yes |
| PUT | `/api/v1/proxy/rules/:id` | Update proxy rule | Yes |
| DELETE | `/api/v1/proxy/rules/:id` | Delete proxy rule | Yes |
| PUT | `/api/v1/proxy/rules/:id/toggle` | Enable/disable rule | Yes |
| GET | `/api/v1/proxy/status` | Caddy status | Yes |
| GET | `/api/v1/proxy/config` | Get Caddyfile config | Yes |
| POST | `/api/v1/proxy/reload` | Reload Caddy | Yes |

### POST /proxy/rules

**Request:**
```json
{
  "domain": "string",
  "target": "string",
  "protocol": "http" | "https"
}
```

---

## 21. App Center

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/apps/templates` | List available app templates (with installed flag) | Yes |
| GET | `/api/v1/apps/installed` | List installed apps | Yes |
| POST | `/api/v1/apps/install` | Install app from template | Yes |
| DELETE | `/api/v1/apps/:id` | Uninstall app | Yes |

### POST /apps/install

**Request:**
```json
{
  "templateId": "string",
  "env": { "KEY": "value" }
}
```

---

## System Safety

- Read endpoints may list disks, containers, users, and logs.
- Mutation endpoints must validate input carefully.
- Dangerous operations must not execute automatically without explicit approval and confirmation workflow.
- Backup restore requires admin role.
- File write operations are blocked for viewer role.
