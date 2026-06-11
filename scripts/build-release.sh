#!/usr/bin/env bash
# NoWenOS ¡ª Release build script
# Builds the frontend, embeds it in the Go binary, and creates a tarball.
#
# Usage:
#   bash scripts/build-release.sh
#   VERSION=1.2.3 bash scripts/build-release.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
RELEASE_DIR="${PROJECT_ROOT}/release"
VERSION="${VERSION:-0.1.0}"
ARCH="${ARCH:-amd64}"

echo "=== NoWenOS Release Build v${VERSION} ==="
echo ""

# ©¤©¤ clean ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"

# ©¤©¤ build frontend ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
echo "[1/3] Building frontend..."
cd "${PROJECT_ROOT}/web"
npm ci
npm run build
echo "  Frontend built successfully."

# ©¤©¤ build Go binary with embedded frontend ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
echo "[2/3] Building Go binary (linux/${ARCH})..."
cd "${PROJECT_ROOT}/server"
export CGO_ENABLED=0
export GOOS=linux
export GOARCH="${ARCH}"
go build -trimpath -ldflags="-s -w" -o "${RELEASE_DIR}/nowenos-api" ./cmd/nowenos-api
echo "  Binary built: ${RELEASE_DIR}/nowenos-api"

# ©¤©¤ create tarball ©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤©¤
echo "[3/3] Creating release tarball..."
TARBALL="${PROJECT_ROOT}/nowenos-${VERSION}-linux-${ARCH}.tar.gz"

# Assemble a staging directory so the tarball has a clean layout
STAGING=$(mktemp -d)
mkdir -p "${STAGING}/bin"
cp "${RELEASE_DIR}/nowenos-api" "${STAGING}/bin/"
cp "${PROJECT_ROOT}/deploy/install.sh" "${STAGING}/"
cp "${PROJECT_ROOT}/deploy/systemd/nowenos-api.service" "${STAGING}/"

tar -czf "${TARBALL}" -C "${STAGING}" .
rm -rf "${STAGING}"

echo ""
echo "=== Build complete ==="
echo "  Tarball:  ${TARBALL}"
echo ""
echo "  Deploy:"
echo "    scp ${TARBALL} user@server:~/"
echo "    ssh user@server 'tar xzf nowenos-${VERSION}-linux-${ARCH}.tar.gz && sudo bash install.sh'"
echo ""
