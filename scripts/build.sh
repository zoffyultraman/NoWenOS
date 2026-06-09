#!/usr/bin/env bash
# NoWenOS - Production build script
# Builds frontend and backend, packages for deployment

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/dist"
VERSION="${VERSION:-0.1.0}"

echo "=== NoWenOS Build v${VERSION} ==="

# Clean
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/bin" "$BUILD_DIR/web" "$BUILD_DIR/data"

# Build frontend
echo "[1/3] Building frontend..."
cd "$PROJECT_ROOT/web"
npm ci --production=false 2>/dev/null || npm install
npm run build
cp -r dist/* "$BUILD_DIR/web/"
echo "  Frontend built -> $BUILD_DIR/web/"

# Build backend (Linux)
echo "[2/3] Building backend..."
cd "$PROJECT_ROOT/server"
export CGO_ENABLED=1
export GOOS=linux
export GOARCH=amd64
go build -o "$BUILD_DIR/bin/nowenos-api" ./cmd/nowenos-api
echo "  Backend built -> $BUILD_DIR/bin/nowenos-api"

# Copy config files
echo "[3/3] Packaging..."
cp "$PROJECT_ROOT/deploy/nowenos.service" "$BUILD_DIR/" 2>/dev/null || true
cp "$PROJECT_ROOT/deploy/install.sh" "$BUILD_DIR/" 2>/dev/null || true

# Create tarball
cd "$PROJECT_ROOT"
tar -czf "nowenos-${VERSION}-linux-amd64.tar.gz" -C "$BUILD_DIR" .

echo ""
echo "=== Build complete ==="
echo "Archive: nowenos-${VERSION}-linux-amd64.tar.gz"
echo "Deploy:  scp nowenos-${VERSION}-linux-amd64.tar.gz user@server:~/"
echo "         ssh user@server 'tar xzf nowenos-${VERSION}-linux-amd64.tar.gz && sudo bash install.sh'"
