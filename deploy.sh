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
HERMES_SERVICE_NAME="${HERMES_SERVICE_NAME:-baizor-hermes}"

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
ssh "$REMOTE_HOST" << REMOTEEOF
set -e
cd "${REMOTE_DIR}"

COMPOSE_ARGS="--env-file .env -f docker-compose.yml"

if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  COMPOSE_ARGS="\$COMPOSE_ARGS -f docker-compose.hermes.yml"
fi

# Update image tag in docker-compose.yml
sed -i "s|image: ${IMAGE_NAME}:[^[:space:]]*|image: ${IMAGE_NAME}:${NEW_VERSION}|" docker-compose.yml

# Pull new images
docker compose \$COMPOSE_ARGS pull new-api
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS pull "${HERMES_SERVICE_NAME}"
fi

# Migrate legacy per-user/team skills into unified skills/ directory (one-shot).
if [ -d hermes-data ] && [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  echo "Migrating legacy skills to unified skills/ directory..."
  for user_dir in hermes-data/baizor-users/*/; do
    skills_dir="\$user_dir/skills"
    [ -d "\$skills_dir" ] || continue
    user_id="\$(basename "\$user_dir")"
    find "\$skills_dir" -name 'SKILL.md' | while read -r skill_md; do
      skill_dir="\$(dirname "\$skill_md")"
      rel="\$(echo "\$skill_dir" | sed "s|^hermes-data/baizor-users/[^/]*/skills/||")"
      target="hermes-data/skills/\$rel"
      if [ ! -e "\$target" ]; then
        mkdir -p "\$(dirname "\$target")"
        cp -a "\$skill_dir" "\$target"
        # Add ownership metadata if not already present
        if ! grep -q 'owner_id:' "\$target/SKILL.md" 2>/dev/null; then
          sed -i "/hermes:/a\\    owner_id: \"\${user_id}\"\\n    scope: \"user\"" "\$target/SKILL.md"
        fi
        echo "    Migrated personal skill: \$rel (user \${user_id})"
      fi
    done
  done
  for team_dir in hermes-data/teams/*/; do
    skills_dir="\$team_dir/skills"
    [ -d "\$skills_dir" ] || continue
    team_id="\$(basename "\$team_dir")"
    [ "\$team_id" = "0" ] && continue
    find "\$skills_dir" -name 'SKILL.md' | while read -r skill_md; do
      skill_dir="\$(dirname "\$skill_md")"
      rel="\$(echo "\$skill_dir" | sed "s|^hermes-data/teams/[^/]*/skills/||")"
      target="hermes-data/skills/\$rel"
      if [ ! -e "\$target" ]; then
        mkdir -p "\$(dirname "\$target")"
        cp -a "\$skill_dir" "\$target"
        if ! grep -q 'owner_id:' "\$target/SKILL.md" 2>/dev/null; then
          sed -i "/hermes:/a\\    owner_id: \"\${team_id}\"\\n    scope: \"team\"" "\$target/SKILL.md"
        fi
        echo "    Migrated team skill: \$rel (team \${team_id})"
      fi
    done
  done
  echo "  Legacy skill migration complete."
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
