# NoWenOS Deployment Guide

## Quick Install (Recommended)

```bash
# 1. Copy the release archive to your server
scp nowenos-0.1.0-linux-amd64.tar.gz user@server:~/

# 2. Extract
ssh user@server
tar xzf nowenos-0.1.0-linux-amd64.tar.gz

# 3. Install (requires root)
sudo bash install.sh
```

## Manual Install from Source

```bash
# Prerequisites: Go 1.22+, Node.js 20+, CGO enabled
git clone <repo-url> /opt/nowenos
cd /opt/nowenos

# Build backend
cd server && CGO_ENABLED=1 go build -o ../deploy/bin/nowenos-api ./cmd/nowenos-api

# Build frontend
cd ../web && npm install && npm run build
cp -r dist ../deploy/web

# Run install script
cd ../deploy && sudo bash install.sh
```

## Service Management

```bash
systemctl status nowenos      # Check status
systemctl restart nowenos     # Restart
systemctl stop nowenos        # Stop
journalctl -u nowenos -f      # Follow logs
```

## Configuration

Edit `/etc/nowenos/nowenos.env`:

```bash
PORT=8080
GIN_MODE=release
DB_PATH=/var/lib/nowenos/nowenos.db
```

## Directory Layout

| Path | Purpose |
|------|---------|
| `/opt/nowenos/` | Application binary + web assets |
| `/var/lib/nowenos/` | SQLite database, persistent data |
| `/etc/nowenos/` | Configuration files |
| `/var/log/nowenos/` | Application logs |

## Default Credentials

| Username | Password | Role |
|----------|----------|------|
| admin | admin | admin |
| user | user | user |

**Change default passwords immediately after first login.**
