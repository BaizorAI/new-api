#!/usr/bin/env bash
# new-api deployment script with optional Hermes sidecar support.
set -e

INI_FILE="version.ini"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
HERMES_SIDECAR_ENABLED="${HERMES_SIDECAR_ENABLED:-false}"
HERMES_BUILD_CONTEXT="${HERMES_BUILD_CONTEXT:-}"

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
  echo "version.ini must define image_name_hermes and hermes_versions when Hermes sidecar is enabled."
  exit 1
fi

echo "Pulling latest code from branch: ${DEPLOY_BRANCH}"
git checkout "$DEPLOY_BRANCH" 2>/dev/null || true
git pull origin "$DEPLOY_BRANCH" || { echo "git pull origin ${DEPLOY_BRANCH} failed"; exit 1; }

MAJOR="$(echo "$CURRENT_VERSION" | awk -F. '{print $1}')"
MINOR="$(echo "$CURRENT_VERSION" | awk -F. '{print $2}')"
PATCH="$(echo "$CURRENT_VERSION" | awk -F. '{print $3}')"
NEW_PATCH=$((PATCH + 1))

if [ "$NEW_PATCH" -ge 102 ]; then
  NEW_PATCH=0
  MINOR=$((MINOR + 1))
  if [ "$MINOR" -ge 102 ]; then
    MINOR=0
    MAJOR=$((MAJOR + 1))
  fi
fi

NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
echo "New platform version: ${NEW_VERSION}"
sed -i.bak "s/^version=[0-9]*\.[0-9]*\.[0-9]*/version=${NEW_VERSION}/" "$INI_FILE" && rm -f "$INI_FILE.bak"
echo "$NEW_VERSION" > VERSION

echo "Building platform image: ${IMAGE_NAME}:${NEW_VERSION}"
docker build --pull --no-cache -t "${IMAGE_NAME}:${NEW_VERSION}" . || { echo "platform image build failed"; exit 1; }
docker push "${IMAGE_NAME}:${NEW_VERSION}"

if [ "$HERMES_SIDECAR_ENABLED" = "true" ]; then
  HERMES_IMAGE="${IMAGE_NAME_HERMES}:${CURRENT_HERMES_VERSION}"
  if [ -n "$HERMES_BUILD_CONTEXT" ]; then
    echo "Building Hermes image: ${HERMES_IMAGE}"
    docker build --pull --no-cache -t "$HERMES_IMAGE" "$HERMES_BUILD_CONTEXT" || { echo "Hermes image build failed"; exit 1; }
    docker push "$HERMES_IMAGE"
  else
    echo "Hermes sidecar uses configured image: ${HERMES_IMAGE}"
    echo "Set HERMES_BUILD_CONTEXT to build and push Hermes from source during deployment."
  fi

  echo "Syncing Hermes sidecar compose overlay..."
  scp docker-compose.hermes.yml baizor:/lucky/NewApi/docker-compose.hermes.yml
fi

echo "Deploying version ${NEW_VERSION} to baizor..."
ssh baizor << REMOTEEOF
set -e
cd /lucky/NewApi

COMPOSE_ARGS="-f docker-compose.yml"
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  COMPOSE_ARGS="\$COMPOSE_ARGS -f docker-compose.hermes.yml"

  if [ -z "\${HERMES_API_SERVER_KEY:-}" ] && ! grep -q '^HERMES_API_SERVER_KEY=' .env 2>/dev/null; then
    echo "HERMES_API_SERVER_KEY must be set in /lucky/NewApi/.env or remote environment before enabling Hermes sidecar."
    exit 1
  fi

  touch .env
  if grep -q '^HERMES_IMAGE=' .env; then
    sed -i 's|^HERMES_IMAGE=.*|HERMES_IMAGE=${HERMES_IMAGE}|' .env
  else
    printf '\\nHERMES_IMAGE=%s\\n' '${HERMES_IMAGE}' >> .env
  fi
fi

echo "Updating docker-compose.yml platform image to ${NEW_VERSION}..."
sed -i 's|image: ccr\.ccs\.tencentyun\.com/lucky/baizor-newapi:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml
sed -i 's|image: calciumion/new-api:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml

echo "Pulling deployment images..."
docker compose \$COMPOSE_ARGS pull new-api
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS pull hermes
fi

echo "Restarting services..."
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS up -d new-api hermes
else
  docker compose up -d new-api
fi

echo "Pruning old images..."
docker image prune -f

echo "Service status:"
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS ps new-api hermes
else
  docker compose ps new-api newapi-redis newapi-postgres
fi
REMOTEEOF

echo "Deployment complete. Version: ${NEW_VERSION}"
