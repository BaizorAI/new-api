#!/usr/bin/env bash
# new-api deployment script with optional Hermes sidecar support.
set -e

INI_FILE="version.ini"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
REMOTE_HOST="${REMOTE_HOST:-baizor}"
REMOTE_DIR="${REMOTE_DIR:-/lucky/NewApi}"
HERMES_SIDECAR_ENABLED="${HERMES_SIDECAR_ENABLED:-true}"
HERMES_COMPOSE_OVERLAY_ENABLED="${HERMES_COMPOSE_OVERLAY_ENABLED:-true}"
SKIP_HERMES_BUILD="${SKIP_HERMES_BUILD:-false}"
HERMES_SERVICE_NAME="${HERMES_SERVICE_NAME:-}"
HERMES_BUILD_CONTEXT="${HERMES_BUILD_CONTEXT:-hermes-agent}"
HERMES_DOCKERFILE="${HERMES_DOCKERFILE:-deploy/Dockerfile.hermes-full-overlay}"
HERMES_API_SERVER_PORT="${HERMES_API_SERVER_PORT:-8642}"
HERMES_API_SERVER_PUBLISH_PORT="${HERMES_API_SERVER_PUBLISH_PORT:-$HERMES_API_SERVER_PORT}"
HERMES_API_SERVER_BIND="${HERMES_API_SERVER_BIND:-127.0.0.1}"
HERMES_API_SERVER_URL="${HERMES_API_SERVER_URL:-}"
HERMES_UID="${HERMES_UID:-10000}"
HERMES_GID="${HERMES_GID:-10000}"
HERMES_WEIXIN_QR_ENABLED="${HERMES_WEIXIN_QR_ENABLED:-true}"
HERMES_EXECUTE_CODE_AUTO_APPROVE="${HERMES_EXECUTE_CODE_AUTO_APPROVE:-true}"
HERMES_NO_PROXY="${HERMES_NO_PROXY:-localhost,127.0.0.1,new-api,hermes,baizor-hermes,postgres,redis,newapi-postgres,newapi-redis,kimi-agent}"
HERMES_NETWORK="${HERMES_NETWORK:-}"

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

if [ -z "$HERMES_SERVICE_NAME" ]; then
  HERMES_SERVICE_NAME="baizor-hermes"
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
  if [ "$SKIP_HERMES_BUILD" = "true" ]; then
    echo "Skipping Hermes image build; using configured image: ${HERMES_IMAGE}"
  elif [ -n "$HERMES_BUILD_CONTEXT" ]; then
    echo "Building Hermes image: ${HERMES_IMAGE}"
    HERMES_DOCKERFILE_ARGS=()
    if [ -n "$HERMES_DOCKERFILE" ]; then
      HERMES_DOCKERFILE_ARGS=(-f "$HERMES_DOCKERFILE")
    fi
    docker build --pull --no-cache "${HERMES_DOCKERFILE_ARGS[@]}" -t "$HERMES_IMAGE" "$HERMES_BUILD_CONTEXT" || { echo "Hermes image build failed"; exit 1; }
    docker push "$HERMES_IMAGE"
  else
    echo "Hermes sidecar uses configured image: ${HERMES_IMAGE}"
    echo "Set HERMES_BUILD_CONTEXT to build and push Hermes from source during deployment."
  fi

  if [ "$HERMES_COMPOSE_OVERLAY_ENABLED" = "true" ]; then
    echo "Syncing Hermes sidecar compose overlay..."
    scp docker-compose.hermes.yml "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.hermes.yml"
  fi

  if [ -z "$HERMES_API_SERVER_URL" ]; then
    HERMES_API_SERVER_URL="http://${HERMES_SERVICE_NAME}:${HERMES_API_SERVER_PORT}"
  fi
fi

echo "Deploying version ${NEW_VERSION} to ${REMOTE_HOST}:${REMOTE_DIR}..."
ssh "$REMOTE_HOST" << REMOTEEOF
set -e
cd "${REMOTE_DIR}"

COMPOSE_ARGS="--env-file .env -f docker-compose.yml"

set_env_var() {
  key="\$1"
  value="\$2"
  touch .env
  if grep -q "^\${key}=" .env; then
    sed -i "s|^\${key}=.*|\${key}=\${value}|" .env
  else
    printf '%s=%s\n' "\$key" "\$value" >> .env
  fi
}

ensure_new_api_env_line() {
  line="\$1"
  key="\$2"
  if sed -n '/^  new-api:/,/^  [^ ].*:/p' docker-compose.yml | grep -Eq "^[[:space:]]*-[[:space:]]*\${key}="; then
    return
  fi

  tmp_file="\$(mktemp)"
  awk -v line="      - \${line}" '
    BEGIN { in_new_api = 0; inserted = 0 }
    /^  new-api:/ { in_new_api = 1 }
    in_new_api && /^  [^ ].*:/ && \$0 !~ /^  new-api:/ { in_new_api = 0 }
    { print }
    in_new_api && !inserted && /^[[:space:]]*-[[:space:]]*no_proxy=/ {
      print line
      inserted = 1
    }
    in_new_api && !inserted && /^[[:space:]]*environment:[[:space:]]*$/ {
      print line
      inserted = 1
    }
  ' docker-compose.yml > "\$tmp_file"
  mv "\$tmp_file" docker-compose.yml
}

ensure_env_secret() {
  key="\$1"
  current="\$(grep "^\${key}=" .env 2>/dev/null | head -n 1 | cut -d= -f2-)"
  if [ -n "\$current" ] && [ "\$current" != "random_string" ]; then
    return
  fi
  value="\$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  set_env_var "\$key" "\$value"
}

ensure_new_api_env_line 'SESSION_SECRET=\${SESSION_SECRET:-}' 'SESSION_SECRET'
ensure_env_secret SESSION_SECRET

if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  if [ "${HERMES_COMPOSE_OVERLAY_ENABLED}" = "true" ]; then
    COMPOSE_ARGS="\$COMPOSE_ARGS -f docker-compose.hermes.yml"
  fi

  if grep -q './hermes_data:/opt/data' docker-compose.yml 2>/dev/null; then
    sed -i 's|./hermes_data:/opt/data|./hermes-data:/opt/data|' docker-compose.yml
  fi

  ensure_new_api_env_line 'HERMES_API_SERVER_URL=\${HERMES_API_SERVER_URL:-http://baizor-hermes:8642}' 'HERMES_API_SERVER_URL'
  ensure_new_api_env_line 'HERMES_API_SERVER_KEY=\${HERMES_API_SERVER_KEY:-}' 'HERMES_API_SERVER_KEY'

  REMOTE_HERMES_NETWORK="${HERMES_NETWORK}"
  if [ -z "\$REMOTE_HERMES_NETWORK" ]; then
    REMOTE_HERMES_NETWORK="\$(awk '
      /^networks:[[:space:]]*$/ { in_networks = 1; next }
      in_networks && /^[^[:space:]]/ { in_networks = 0 }
      in_networks && /^[[:space:]]{2}[A-Za-z0-9_.-]+:/ {
        name = \$1
        sub(":$", "", name)
        print name
        exit
      }
    ' docker-compose.yml)"
  fi
  if [ -z "\$REMOTE_HERMES_NETWORK" ]; then
    REMOTE_HERMES_NETWORK="new-api-network"
  fi

  set_env_var HERMES_IMAGE "${HERMES_IMAGE}"
  set_env_var HERMES_NETWORK "\$REMOTE_HERMES_NETWORK"
  set_env_var HERMES_API_SERVER_PORT "${HERMES_API_SERVER_PORT}"
  set_env_var HERMES_API_SERVER_PUBLISH_PORT "${HERMES_API_SERVER_PUBLISH_PORT}"
  set_env_var HERMES_API_SERVER_BIND "${HERMES_API_SERVER_BIND}"
  set_env_var HERMES_API_SERVER_URL "${HERMES_API_SERVER_URL}"
  set_env_var HERMES_UID "${HERMES_UID}"
  set_env_var HERMES_GID "${HERMES_GID}"
  set_env_var HERMES_WEIXIN_QR_ENABLED "${HERMES_WEIXIN_QR_ENABLED}"
  set_env_var HERMES_EXECUTE_CODE_AUTO_APPROVE "${HERMES_EXECUTE_CODE_AUTO_APPROVE}"
  set_env_var NO_PROXY "${HERMES_NO_PROXY}"
  set_env_var no_proxy "${HERMES_NO_PROXY}"

  if [ -n "${HERMES_API_SERVER_KEY:-}" ]; then
    set_env_var HERMES_API_SERVER_KEY "${HERMES_API_SERVER_KEY}"
  fi

  if ! grep -q '^HERMES_API_SERVER_KEY=' .env 2>/dev/null; then
    echo "HERMES_API_SERVER_KEY must be set in ${REMOTE_DIR}/.env or local HERMES_API_SERVER_KEY before enabling Hermes sidecar."
    exit 1
  fi
fi

echo "Updating docker-compose.yml platform image to ${NEW_VERSION}..."
sed -i 's|image: ccr\.ccs\.tencentyun\.com/lucky/baizor-newapi:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml
sed -i 's|image: calciumion/new-api:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml

echo "Pulling deployment images..."
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ] && [ "${HERMES_COMPOSE_OVERLAY_ENABLED}" = "true" ]; then
  mkdir -p hermes-data
fi
docker compose \$COMPOSE_ARGS pull new-api
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS pull "${HERMES_SERVICE_NAME}"
fi

echo "Restarting services..."
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS up -d new-api "${HERMES_SERVICE_NAME}"
else
  docker compose up -d new-api
fi

echo "Pruning old images..."
docker image prune -f

echo "Service status:"
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS ps new-api "${HERMES_SERVICE_NAME}"
else
  docker compose ps new-api newapi-redis newapi-postgres
fi
REMOTEEOF

echo "Deployment complete. Version: ${NEW_VERSION}"
