#!/usr/bin/env bash
# NoWenOS ¡ª Install / Uninstall script
# Usage:
#   sudo bash install.sh [--port PORT] [--uninstall]

set -euo pipefail

# ©¤©¤ defaults ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
INSTALL_DIR="/opt/nowenos"
DATA_DIR="/var/lib/nowenos"
CONFIG_DIR="/etc/nowenos"
LOG_DIR="/var/log/nowenos"
SERVICE_NAME="nowenos-api"
SERVICE_USER="nowenos"
PORT="8080"
MODE="install"

# ©¤©¤ cleanup on error ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
cleanup() {
    local exit_code=$?
    if [[ $exit_code -ne 0 ]]; then
        echo ""
        echo "Error: Installation failed (exit code $exit_code)."
        echo "Check the output above for details."
    fi
}
trap cleanup EXIT

# ©¤©¤ helpers ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
die()  { echo "Error: $*" >&2; exit 1; }
info() { echo "[*] $*"; }

usage() {
    cat <<EOF
Usage: sudo bash install.sh [OPTIONS]

Options:
  --port PORT       Set the listen port (default: 8080)
  --uninstall       Remove NoWenOS from the system
  -h, --help        Show this help message
EOF
    exit 0
}

# ©¤©¤ parse arguments ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
while [[ $# -gt 0 ]]; do
    case "$1" in
        --port)
            [[ -z "${2:-}" ]] && die "--port requires a value"
            PORT="$2"; shift 2 ;;
        --uninstall)
            MODE="uninstall"; shift ;;
        -h|--help)
            usage ;;
        *)
            die "Unknown option: $1" ;;
    esac
done

# ©¤©¤ root check ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
[[ $EUID -eq 0 ]] || die "This script must be run as root (sudo bash install.sh)"

# ©¤©¤ systemd check ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
check_systemd() {
    if ! command -v systemctl &>/dev/null; then
        die "systemd is required but not found on this system."
    fi
    if [[ ! -d /run/systemd/system ]]; then
        die "systemd is not the init system. This script requires systemd."
    fi
}

# ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
# UNINSTALL
# ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
do_uninstall() {
    check_systemd

    echo "=== NoWenOS Uninstaller ==="
    echo ""
    echo "  This will:"
    echo "    - Stop and disable the ${SERVICE_NAME} service"
    echo "    - Remove ${INSTALL_DIR}"
    echo "    - Remove ${LOG_DIR}"
    echo "    - Remove ${CONFIG_DIR}"
    echo "    - Remove the '${SERVICE_USER}' system user"
    echo ""
    echo "  Data in ${DATA_DIR} will be PRESERVED."
    echo ""

    read -rp "Continue? [y/N] " confirm
    [[ "$confirm" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }

    info "Stopping service..."
    systemctl stop "${SERVICE_NAME}" 2>/dev/null || true
    systemctl disable "${SERVICE_NAME}" 2>/dev/null || true
    rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
    systemctl daemon-reload

    info "Removing application files..."
    rm -rf "${INSTALL_DIR}"

    info "Removing log directory..."
    rm -rf "${LOG_DIR}"

    info "Removing config directory..."
    rm -rf "${CONFIG_DIR}"

    info "Removing service user..."
    if id "${SERVICE_USER}" &>/dev/null; then
        userdel "${SERVICE_USER}" 2>/dev/null || true
    fi

    echo ""
    echo "=== Uninstall complete ==="
    echo "  Data directory ${DATA_DIR} was preserved."
    echo "  Remove it manually if desired: sudo rm -rf ${DATA_DIR}"
    echo ""
}

# ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
# INSTALL
# ¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T¨T
do_install() {
    check_systemd

    echo "=== NoWenOS Installer ==="
    echo ""

    # ©¤©¤ detect OS ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    if [[ -f /etc/os-release ]]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        echo "Detected: ${PRETTY_NAME}"
    else
        die "Cannot detect OS. Requires Debian or Ubuntu."
    fi

    # ©¤©¤ install runtime dependencies ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    info "[1/5] Installing dependencies..."
    apt-get update -qq
    apt-get install -y -qq ca-certificates sqlite3

    # ©¤©¤ locate / copy binary ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    info "[2/5] Installing binary..."
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

    mkdir -p "${INSTALL_DIR}"

    if [[ -f "${SCRIPT_DIR}/bin/nowenos-api" ]]; then
        cp "${SCRIPT_DIR}/bin/nowenos-api" "${INSTALL_DIR}/nowenos-api"
    elif [[ -f "${SCRIPT_DIR}/nowenos-api" ]]; then
        cp "${SCRIPT_DIR}/nowenos-api" "${INSTALL_DIR}/nowenos-api"
    else
        die "nowenos-api binary not found next to this script or in bin/. " \
            "Place the release tarball contents next to install.sh and retry."
    fi

    chmod +x "${INSTALL_DIR}/nowenos-api"

    # ©¤©¤ create user ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    info "[3/5] Creating service user..."
    if ! id "${SERVICE_USER}" &>/dev/null; then
        useradd --system --no-create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
        echo "  User '${SERVICE_USER}' created."
    else
        echo "  User '${SERVICE_USER}' already exists."
    fi

    # ©¤©¤ create directories ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    mkdir -p "${INSTALL_DIR}" "${DATA_DIR}" "${CONFIG_DIR}" "${LOG_DIR}"
    chown "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}" "${LOG_DIR}"
    chmod 750 "${DATA_DIR}" "${LOG_DIR}"

    # ©¤©¤ write default config ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    if [[ ! -f "${CONFIG_DIR}/nowenos.env" ]]; then
        cat > "${CONFIG_DIR}/nowenos.env" <<ENVEOF
# NoWenOS Configuration
PORT=${PORT}
GIN_MODE=release
DB_PATH=${DATA_DIR}/nowenos.db
ENVEOF
        echo "  Default config written to ${CONFIG_DIR}/nowenos.env"
    else
        echo "  Existing config preserved at ${CONFIG_DIR}/nowenos.env"
    fi

    # ©¤©¤ install systemd service ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    info "[4/5] Installing systemd service..."
    cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<SVCEOF
[Unit]
Description=NoWenOS API Server
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
ExecStart=${INSTALL_DIR}/nowenos-api
Restart=on-failure
RestartSec=5
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${DATA_DIR}
EnvironmentFile=${CONFIG_DIR}/nowenos.env

# Security hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
ReadWritePaths=${DATA_DIR} ${LOG_DIR}

# Resource limits
MemoryMax=512M

StandardOutput=append:${LOG_DIR}/nowenos.log
StandardError=append:${LOG_DIR}/nowenos.log

[Install]
WantedBy=multi-user.target
SVCEOF

    systemctl daemon-reload
    systemctl enable "${SERVICE_NAME}"
    systemctl restart "${SERVICE_NAME}"

    # ©¤©¤ verify ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
    info "[5/5] Verifying..."
    sleep 2

    if systemctl is-active --quiet "${SERVICE_NAME}"; then
        local_ip
        echo ""
        echo "=== Installation complete ==="
        echo ""
        echo "  Service:  ${SERVICE_NAME}"
        echo "  Port:     ${PORT}"
        echo "  Binary:   ${INSTALL_DIR}/nowenos-api"
        echo "  Config:   ${CONFIG_DIR}/nowenos.env"
        echo "  Data:     ${DATA_DIR}/"
        echo "  Logs:     ${LOG_DIR}/nowenos.log"
        echo ""
        echo "  Service management:"
        echo "    systemctl status ${SERVICE_NAME}"
        echo "    systemctl restart ${SERVICE_NAME}"
        echo "    journalctl -u ${SERVICE_NAME} -f"
        echo ""
    else
        die "Service failed to start. Check: journalctl -u ${SERVICE_NAME} -n 50"
    fi
}

local_ip() {
    local ip
    ip=$(hostname -I 2>/dev/null | awk '{print $1}')
    [[ -n "${ip}" ]] && echo "  URL:      http://${ip}:${PORT}"
}

# ©¤©¤ main ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
case "${MODE}" in
    install)   do_install   ;;
    uninstall) do_uninstall ;;
esac
