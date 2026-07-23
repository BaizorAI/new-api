#!/bin/bash
set -euo pipefail

# ============================================================================
# dev-deploy.sh — Build and deploy to local Docker containers
#
# Reads the base version from the VERSION file, appends a timestamp suffix
# for unique cache busting, then builds frontend + backend with the same
# version string and deploys to the running new-api container.
#
# Prerequisites:
#   - Docker
#   - Go 1.22+
#   - Running new-api container (docker compose up -d)
#
# The version is consistent across both builds, ensuring assets always match.
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# ── Version: VERSION file + timestamp suffix ──────────────────────────────
BASE_VERSION="$(cat VERSION 2>/dev/null || echo 'dev')"
TIMESTAMP="$(date +%Y%m%d%H%M%S)"
DEV_VERSION="${BASE_VERSION}-${TIMESTAMP}"

echo "========================================="
echo "  dev-deploy: ${DEV_VERSION}"
echo "========================================="

# ── Step 1: Build frontend (Docker, macOS too old for local bun) ───────────
echo ""
echo "[1/3] Building frontend..."

docker run --rm \
  -v "${SCRIPT_DIR}/web:/workspace" \
  -w /workspace/default \
  -e VITE_REACT_APP_VERSION="${DEV_VERSION}" \
  oven/bun:1.2 \
  sh -c "bun install && bun run build"

echo "  Frontend build done."

# ── Step 2: Build Go backend ───────────────────────────────────────────────
echo ""
echo "[2/3] Building Go backend..."

CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
  -ldflags "-s -w -X 'github.com/BaizorAI/new-api/common.Version=${DEV_VERSION}'" \
  -o new-api \
  main.go

echo "  Go build done."

# ── Step 3: Deploy to container ────────────────────────────────────────────
echo ""
echo "[3/3] Deploying to container..."

docker cp new-api new-api:/new-api

docker compose -f docker-compose.yml -f docker-compose.local.yml -f docker-compose.hermes.yml restart new-api

# ── Verify ──────────────────────────────────────────────────────────────────
echo ""
echo "Waiting for container to be ready..."
sleep 10

HEALTH="$(docker inspect --format '{{.State.Health.Status}}' new-api 2>/dev/null || echo 'unknown')"
RESP="$(curl -s http://localhost:3000/version.json 2>/dev/null || echo '{}')"
SERVER_VERSION="$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','???'))" 2>/dev/null || echo '???')"

echo ""
echo "========================================="
echo "  Deploy complete"
echo "  Container health: ${HEALTH}"
echo "  Server version:   ${SERVER_VERSION}"
echo "========================================="

if [ "${SERVER_VERSION}" != "${DEV_VERSION}" ]; then
  echo "  WARNING: server version (${SERVER_VERSION}) != build version (${DEV_VERSION})"
  echo "  The container may still be starting. Check: docker logs new-api --tail 10"
fi
