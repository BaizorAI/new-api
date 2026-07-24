#!/usr/bin/env bash
# Deploy MagicalBrush skills into the hermes container's /opt/data volume.
#
# Usage:
#   sh scripts/deploy-magicalbrush-skills.sh
#
# What it does:
#   1. tar the local optional-skills/creative/magicalbrush/ directory
#   2. scp the tarball to baizor:/tmp/
#   3. docker cp + docker exec tar into /opt/data/skills/creative/
#      (volume-mounted, persists across container rebuilds)
#   4. Clean up temp files
set -e

REMOTE_HOST="${REMOTE_HOST:-baizor}"
CONTAINER="${HERMES_SERVICE_NAME:-hermes}"
SKILL_SRC="hermes-agent/optional-skills/creative/magicalbrush"
REMOTE_TMP="/tmp/magicalbrush-skills.tar.gz"
DEST_DIR="/opt/data/skills/creative"

if [ ! -d "$SKILL_SRC" ]; then
  echo "ERROR: $SKILL_SRC not found. Run from repo root."
  exit 1
fi

echo "=== Deploying MagicalBrush skills ==="
echo "Source:    $SKILL_SRC"
echo "Target:    $CONTAINER:$DEST_DIR/magicalbrush (volume-mounted)"
echo ""

# 1. Pack
LOCAL_TAR=$(mktemp --suffix=.tar.gz 2>/dev/null || mktemp -t magicalbrush).tar.gz
tar -czf "$LOCAL_TAR" -C "$(dirname "$SKILL_SRC")" "$(basename "$SKILL_SRC")"
echo "[1/3] Packed $(du -h "$LOCAL_TAR" | cut -f1)"

# 2. SCP to remote /tmp/
scp "$LOCAL_TAR" "${REMOTE_HOST}:${REMOTE_TMP}"
echo "[2/3] Uploaded to ${REMOTE_HOST}:${REMOTE_TMP}"
rm -f "$LOCAL_TAR"

# 3. docker cp into container volume path (persists across rebuilds)
ssh "$REMOTE_HOST" << REMOTE
set -e

docker exec -u root $CONTAINER mkdir -p $DEST_DIR
docker exec -u root $CONTAINER rm -rf $DEST_DIR/magicalbrush
docker cp $REMOTE_TMP $CONTAINER:/tmp/magicalbrush-skills.tar.gz
docker exec -u root $CONTAINER tar -xzf /tmp/magicalbrush-skills.tar.gz -C $DEST_DIR
docker exec -u root $CONTAINER rm -f /tmp/magicalbrush-skills.tar.gz
rm -f $REMOTE_TMP

echo "[3/3] Installed into $CONTAINER:$DEST_DIR/magicalbrush"
echo ""
echo "Deployed files:"
docker exec $CONTAINER find $DEST_DIR/magicalbrush -type f | sort
REMOTE

echo ""
echo "=== Done. Skills in /opt/data volume — survives deploy.sh rebuilds ==="
