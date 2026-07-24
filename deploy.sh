#!/usr/bin/env bash
# new-api deployment script with Hermes sidecar support.
set -e

DEPLOY_START_TIME=$(date +%s)
echo "Deployment started at: $(date -d @${DEPLOY_START_TIME} "+%Y-%m-%d %H:%M:%S")"

INI_FILE="version.ini"
REMOTE_HOST="${REMOTE_HOST:-baizor}"
REMOTE_DIR="${REMOTE_DIR:-/lucky/NewApi}"
HERMES_SIDECAR_ENABLED="${HERMES_SIDECAR_ENABLED:-true}"
SKIP_HERMES_BUILD="${SKIP_HERMES_BUILD:-false}"
HERMES_BUILD_CONTEXT="${HERMES_BUILD_CONTEXT:-hermes-agent}"
HERMES_DOCKERFILE="${HERMES_DOCKERFILE:-deploy/Dockerfile.hermes-full-overlay}"
HERMES_SERVICE_NAME="${HERMES_SERVICE_NAME:-hermes}"

ini_value() {
  grep -i "^$1=" "$INI_FILE" | head -n 1 | awk -F= '{print $2}'
}

IMAGE_NAME="$(ini_value image_name)"
CURRENT_VERSION="$(ini_value version)"
IMAGE_NAME_HERMES="$(ini_value image_name_hermes)"
CURRENT_HERMES_VERSION="$(ini_value hermes_versions)"
if [ -z "$CURRENT_HERMES_VERSION" ]; then
  CURRENT_HERMES_VERSION="$(ini_value hermes_version)"
fi

if [ -z "$IMAGE_NAME" ] || [ -z "$CURRENT_VERSION" ]; then
  echo "version.ini must define image_name and version."
  exit 1
fi

if [ "$HERMES_SIDECAR_ENABLED" = "true" ] && { [ -z "$IMAGE_NAME_HERMES" ] || [ -z "$CURRENT_HERMES_VERSION" ]; }; then
  echo "version.ini must define image_name_hermes and hermes_versions."
  exit 1
fi

# ── Version bump ──────────────────────────────────────────────────────

MAJOR="$(echo "$CURRENT_VERSION" | awk -F. '{print $1}')"
MINOR="$(echo "$CURRENT_VERSION" | awk -F. '{print $2}')"
PATCH="$(echo "$CURRENT_VERSION" | awk -F. '{print $3}')"
NEW_PATCH=$((PATCH + 1))

if [ "$NEW_PATCH" -ge 102 ]; then
  NEW_PATCH=0
  MINOR=$((MINOR + 1))
  if [ "$MINOR" -ge 102 ]; then MINOR=0; MAJOR=$((MAJOR + 1)); fi
fi

NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
echo "New platform version: ${NEW_VERSION}"
sed -i.bak "s/^version=[0-9]*\.[0-9]*\.[0-9]*/version=${NEW_VERSION}/" "$INI_FILE" && rm -f "$INI_FILE.bak"
echo "$NEW_VERSION" > VERSION

# ── Platform image ────────────────────────────────────────────────────

FULL_IMAGE="${IMAGE_NAME}:${NEW_VERSION}"
echo "Building platform image: ${FULL_IMAGE}"
docker build --pull --no-cache -t "$FULL_IMAGE" . || { echo "platform image build failed"; exit 1; }
docker push "$FULL_IMAGE"

# ── Hermes image ──────────────────────────────────────────────────────

HERMES_FULL_IMAGE="${IMAGE_NAME_HERMES}:${CURRENT_HERMES_VERSION}"

if [ "$HERMES_SIDECAR_ENABLED" = "true" ] && [ "$SKIP_HERMES_BUILD" != "true" ] && [ -n "$HERMES_BUILD_CONTEXT" ]; then
  echo "Building Hermes image: ${HERMES_FULL_IMAGE}"

  _df_src="${HERMES_DOCKERFILE}"
  _df_base="$(basename "$_df_src")"
  cp "$_df_src" "$HERMES_BUILD_CONTEXT/$_df_base" 2>/dev/null || true

  tar -cf - -C "$HERMES_BUILD_CONTEXT" \
    --exclude='.pytest_cache' --exclude='__pycache__' --exclude='.mypy_cache' \
    --exclude='.git' --exclude='*.pyc' . | \
    docker build --pull --no-cache -f "$_df_base" -t "$HERMES_FULL_IMAGE" - \
    || { rm -f "$HERMES_BUILD_CONTEXT/$_df_base"; echo "Hermes image build failed"; exit 1; }

  rm -f "$HERMES_BUILD_CONTEXT/$_df_base"
  docker push "$HERMES_FULL_IMAGE"
fi

# ── Remote deploy ─────────────────────────────────────────────────────

echo "Deploying version ${NEW_VERSION} to ${REMOTE_HOST}:${REMOTE_DIR} ..."

# Copy migration script and run it BEFORE restarting containers.
if [ "$HERMES_SIDECAR_ENABLED" = "true" ]; then
  # Copy migration script and run it BEFORE restarting containers.
  scp scripts/migrate-skills.sh "${REMOTE_HOST}:${REMOTE_DIR}/migrate-skills.sh" 2>/dev/null || true
  # Migration must run inside the hermes container to access the data volume.
  ssh "$REMOTE_HOST" \
    "cd ${REMOTE_DIR} && docker cp migrate-skills.sh ${HERMES_SERVICE_NAME}:/migrate-skills.sh && docker exec -u root ${HERMES_SERVICE_NAME} sh /migrate-skills.sh /opt/data" \
    || true
fi

ssh "$REMOTE_HOST" << REMOTEEOF
set -e
cd "${REMOTE_DIR}"

COMPOSE_ARGS="--env-file .env -f docker-compose.yml"

if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  COMPOSE_ARGS="\$COMPOSE_ARGS -f docker-compose.hermes.yml"
fi

# Update image tag in docker-compose.yml
sed -i "s|image: ${IMAGE_NAME}:[^[:space:]]*|image: ${IMAGE_NAME}:${NEW_VERSION}|" docker-compose.yml

# Update HERMES_IMAGE in .env
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  if grep -q '^HERMES_IMAGE=' .env 2>/dev/null; then
    sed -i "s|^HERMES_IMAGE=.*|HERMES_IMAGE=${IMAGE_NAME_HERMES}:${CURRENT_HERMES_VERSION}|" .env
  fi
fi

# Pull new images
docker compose \$COMPOSE_ARGS pull new-api
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS pull "${HERMES_SERVICE_NAME}"
fi

# Restart
echo "Restarting services..."
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS up -d new-api "${HERMES_SERVICE_NAME}"
else
  docker compose up -d new-api
fi

docker image prune -f

echo "Service status:"
docker compose \$COMPOSE_ARGS ps
REMOTEEOF

DEPLOY_END_TIME=$(date +%s)
DEPLOY_ELAPSED=$((DEPLOY_END_TIME - DEPLOY_START_TIME))
echo ""
echo "Deployment complete.  Version: ${NEW_VERSION}"
echo "Started:   $(date -d @${DEPLOY_START_TIME} "+%Y-%m-%d %H:%M:%S")"
echo "Finished:  $(date -d @${DEPLOY_END_TIME} "+%Y-%m-%d %H:%M:%S")"
echo "Elapsed:   $((DEPLOY_ELAPSED / 60))m $((DEPLOY_ELAPSED % 60))s"
