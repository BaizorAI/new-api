#!/usr/bin/env bash
# new-api 部署脚本（带版本号管理）
set -e

INI_FILE="version.ini"
HERMES_SIDECAR_ENABLED="${HERMES_SIDECAR_ENABLED:-false}"

# ========== 1. 确保本地代码是最新的 ==========
DEPLOY_BRANCH="main"
echo "🔄 拉取最新代码（分支: ${DEPLOY_BRANCH}）..."
git checkout "$DEPLOY_BRANCH" 2>/dev/null || true
git pull origin "$DEPLOY_BRANCH" || { echo "❌ git pull origin ${DEPLOY_BRANCH} 失败"; exit 1; }

# 读取镜像名 & 当前版本号
IMAGE_NAME=$(grep -i "^image_name=" "$INI_FILE" | awk -F= '{print $2}')
CURRENT_VERSION=$(grep -i "^version=" "$INI_FILE" | awk -F= '{print $2}')

# 提取主版本号、次版本号和补丁号
MAJOR=$(echo "$CURRENT_VERSION" | awk -F. '{print $1}')
MINOR=$(echo "$CURRENT_VERSION" | awk -F. '{print $2}')
PATCH=$(echo "$CURRENT_VERSION" | awk -F. '{print $3}')

# 递增补丁号
NEW_PATCH=$((PATCH + 1))

# 检查是否需要进位
if [ "$NEW_PATCH" -ge 102 ]; then
  NEW_PATCH=0
  MINOR=$((MINOR + 1))
  if [ "$MINOR" -ge 102 ]; then
    MINOR=0
    MAJOR=$((MAJOR + 1))
  fi
fi

# 生成新版本号
NEW_VERSION="${MAJOR}.${MINOR}.${NEW_PATCH}"
echo "📦 新版本号: $NEW_VERSION"
sed -i.bak 's/^version=[0-9]*\.[0-9]*\.[0-9]*/version='${NEW_VERSION}'/' "$INI_FILE" && rm -f "$INI_FILE.bak"

# 同步更新 VERSION 文件（供 Dockerfile 构建使用）
echo "$NEW_VERSION" > VERSION

# ========== 2. 构建 & 推送镜像 ==========
echo "🐳 正在构建镜像 [${IMAGE_NAME}:${NEW_VERSION}]"
docker build --pull --no-cache -t "${IMAGE_NAME}:${NEW_VERSION}" . || { echo "❌ 镜像构建失败"; exit 1; }
docker push "${IMAGE_NAME}:${NEW_VERSION}"

echo "✅ 构建并推送成功！"
echo "  - ${IMAGE_NAME}:${NEW_VERSION}"

# ========== 3. 远程部署 ==========
echo "🚀 正在远程部署 [${NEW_VERSION}]..."
if [ "$HERMES_SIDECAR_ENABLED" = "true" ]; then
  echo "Syncing Hermes sidecar compose overlay..."
  scp docker-compose.hermes.yml baizor:/lucky/NewApi/docker-compose.hermes.yml
fi

ssh baizor << REMOTEEEOF
set -e
cd /lucky/NewApi

COMPOSE_ARGS="-f docker-compose.yml"
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  COMPOSE_ARGS="\$COMPOSE_ARGS -f docker-compose.hermes.yml"
  if [ -z "\${HERMES_API_SERVER_KEY:-}" ] && ! grep -q '^HERMES_API_SERVER_KEY=' .env 2>/dev/null; then
    echo "HERMES_API_SERVER_KEY must be set in /lucky/NewApi/.env or remote environment before enabling Hermes sidecar."
    exit 1
  fi
fi

echo "🏷️ 更新 docker-compose.yml 镜像版本为 ${NEW_VERSION}..."
# 替换已有的 baizor-newapi 镜像版本
sed -i 's|image: ccr\.ccs\.tencentyun\.com/lucky/baizor-newapi:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml
# 替换默认的 calciumion/new-api 镜像行
sed -i 's|image: calciumion/new-api:[^[:space:]]*|image: ccr.ccs.tencentyun.com/lucky/baizor-newapi:${NEW_VERSION}|' docker-compose.yml

echo "🐳 拉取新版本镜像..."
docker compose \$COMPOSE_ARGS pull new-api

echo "🚀 重启 new-api 服务..."
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS up -d new-api hermes
else
  docker compose up -d new-api
fi

echo "🧹 清理旧镜像..."
docker image prune -f

echo "📋 new-api 服务状态:"
if [ "${HERMES_SIDECAR_ENABLED}" = "true" ]; then
  docker compose \$COMPOSE_ARGS ps new-api hermes
else
  docker compose ps new-api newapi-redis newapi-postgres
fi
REMOTEEEOF

echo "🎉 部署完成！版本: ${NEW_VERSION}"
