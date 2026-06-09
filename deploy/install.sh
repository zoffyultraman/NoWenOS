#!/usr/bin/env bash
# NoWenOS - One-click install script for Debian/Ubuntu
# Usage: sudo bash install.sh

set -euo pipefail

INSTALL_DIR="/opt/nowenos"
DATA_DIR="/var/lib/nowenos"
CONFIG_DIR="/etc/nowenos"
LOG_DIR="/var/log/nowenos"
SERVICE_USER="nowenos"
PORT="${PORT:-8080}"

echo "=== NoWenOS Installer ==="

# Check root
if [[ $EUID -ne 0 ]]; then
    echo "Error: This script must be run as root (sudo bash install.sh)"
    exit 1
fi

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    echo "Error: Cannot detect OS. Requires Debian or Ubuntu."
    exit 1
fi

echo "Detected: $PRETTY_NAME"

# Install dependencies
echo "[1/6] Installing dependencies..."
apt-get update -qq
apt-get install -y -qq ca-certificates curl wget sqlite3

# Install Go if not present
if ! command -v go &> /dev/null; then
    echo "  Installing Go..."
    GO_VERSION="1.22.5"
    wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -O /tmp/go.tar.gz
    tar -C /usr/local -xzf /tmp/go.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
    export PATH=$PATH:/usr/local/go/bin
    rm /tmp/go.tar.gz
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "  Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi

# Create user
echo "[2/6] Creating service user..."
if ! id "$SERVICE_USER" &>/dev/null; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
    echo "  User '$SERVICE_USER' created"
else
    echo "  User '$SERVICE_USER' already exists"
fi

# Create directories
echo "[3/6] Creating directories..."
mkdir -p "$INSTALL_DIR" "$DATA_DIR" "$CONFIG_DIR" "$LOG_DIR"
chown "$SERVICE_USER:$SERVICE_USER" "$DATA_DIR" "$LOG_DIR"

# Copy files
echo "[4/6] Installing files..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/bin/nowenos-api" ]; then
    # Pre-built mode
    cp "$SCRIPT_DIR/bin/nowenos-api" "$INSTALL_DIR/"
    cp -r "$SCRIPT_DIR/web" "$INSTALL_DIR/"
else
    # Build from source mode
    PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
    cd "$PROJECT_ROOT/server"
    CGO_ENABLED=1 go build -o "$INSTALL_DIR/nowenos-api" ./cmd/nowenos-api
    cd "$PROJECT_ROOT/web"
    npm ci --production=false 2>/dev/null || npm install
    npm run build
    cp -r dist "$INSTALL_DIR/web"
fi

chmod +x "$INSTALL_DIR/nowenos-api"

# Write default config
cat > "$CONFIG_DIR/nowenos.env" << 'ENVEOF'
# NoWenOS Configuration
PORT=8080
GIN_MODE=release
DB_PATH=/var/lib/nowenos/nowenos.db
ENVEOF

# Install systemd service
echo "[5/6] Installing systemd service..."
cat > /etc/systemd/system/nowenos.service << SVCEOF
[Unit]
Description=NoWenOS NAS Management Panel
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$CONFIG_DIR/nowenos.env
ExecStart=$INSTALL_DIR/nowenos-api
Restart=always
RestartSec=5
StandardOutput=append:$LOG_DIR/nowenos.log
StandardError=append:$LOG_DIR/nowenos.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=$DATA_DIR $LOG_DIR
ProtectHome=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable nowenos
systemctl start nowenos

echo "[6/6] Starting NoWenOS..."
sleep 2

if systemctl is-active --quiet nowenos; then
    echo ""
    echo "=== Installation complete ==="
    echo ""
    echo "  NoWenOS is running on port $PORT"
    echo "  Open: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo ""
    echo "  Default credentials:"
    echo "    Admin: admin / admin"
    echo "    User:  user / user"
    echo ""
    echo "  Service management:"
    echo "    systemctl status nowenos"
    echo "    systemctl restart nowenos"
    echo "    journalctl -u nowenos -f"
    echo ""
    echo "  Config: $CONFIG_DIR/nowenos.env"
    echo "  Data:   $DATA_DIR/"
    echo "  Logs:   $LOG_DIR/"
    echo ""
else
    echo "Error: Service failed to start. Check: journalctl -u nowenos -n 50"
    exit 1
fi
