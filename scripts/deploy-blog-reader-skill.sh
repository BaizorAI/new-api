#!/usr/bin/env bash
# Deploy blog-reader-v1 skill into the hermes container's /opt/data volume.
#
# Usage:
#   sh scripts/deploy-blog-reader-skill.sh
#
# What it does:
#   1. tar the local optional-skills/creative/blog-reader-v1/ directory
#   2. scp the tarball to baizor:/tmp/
#   3. docker cp + docker exec tar into /opt/data/skills/creative/
#      (volume-mounted, persists across container rebuilds)
#   4. Clean up temp files
set -e

REMOTE_HOST="${REMOTE_HOST:-baizor}"
CONTAINER="${HERMES_SERVICE_NAME:-hermes}"
SKILL_SRC="hermes-agent/optional-skills/creative/blog-reader-v1"
REMOTE_TMP="/tmp/blog-reader-v1-skills.tar.gz"
DEST_DIR="/opt/data/skills/creative"

if [ ! -d "$SKILL_SRC" ]; then
  echo "ERROR: $SKILL_SRC not found. Run from repo root."
  exit 1
fi

echo "=== Deploying blog-reader-v1 skill ==="
echo "Source:    $SKILL_SRC"
echo "Target:    $CONTAINER:$DEST_DIR/blog-reader-v1 (volume-mounted)"
echo ""

# 1. Pack
LOCAL_TAR=$(mktemp --suffix=.tar.gz 2>/dev/null || mktemp -t blog-reader-v1).tar.gz
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
docker exec -u root $CONTAINER rm -rf $DEST_DIR/blog-reader-v1
docker cp $REMOTE_TMP $CONTAINER:/tmp/blog-reader-v1-skills.tar.gz
docker exec -u root $CONTAINER tar -xzf /tmp/blog-reader-v1-skills.tar.gz -C $DEST_DIR
docker exec -u root $CONTAINER rm -f /tmp/blog-reader-v1-skills.tar.gz
rm -f $REMOTE_TMP

echo "[3/3] Installed into $CONTAINER:$DEST_DIR/blog-reader-v1"
echo ""
echo "Deployed files:"
docker exec $CONTAINER find $DEST_DIR/blog-reader-v1 -type f | sort
REMOTE

echo ""
echo "=== Done. Skill in /opt/data volume — survives deploy.sh rebuilds ==="
