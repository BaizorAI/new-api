# Hermes Sidecar 多用户接入与部署说明

本文说明如何将 Hermes 作为 sidecar 容器接入白泽 AI 平台，让多个用户通过平台统一身份、团队、密钥、模型权限、额度、日志和审计能力使用 Hermes，而不是直接访问 Hermes 服务。

## 目标场景

推荐调用链：

```text
用户 / 业务系统
  -> 白泽 AI 平台 API Key / 团队 Key
  -> 白泽 AI 平台模型权限、额度、日志、审计、路由
  -> Hermes sidecar OpenAI-compatible API
  -> Hermes 内部任务执行
  -> 白泽 AI 平台统一模型服务或组织已授权模型
```

核心要求：

- 用户不直接持有 Hermes 服务密钥，也不直接访问 Hermes 容器。
- Hermes 需要调用大模型时，应优先配置为调用白泽 AI 平台统一 OpenAI-compatible 端点，由平台继续承担模型选择、额度扣减、日志记录和审计追踪。
- Web 版 HermesAgent 的技能、工具、消息平台操作都应走 new-api 代理，浏览器不得获得 `HERMES_API_SERVER_KEY`。

## 部署结构

`docker-compose.hermes.yml` 是可选 Docker Compose overlay。显式叠加该文件时才会启动 Hermes sidecar：

```bash
HERMES_API_SERVER_KEY=change-me \
docker compose -f docker-compose.yml -f docker-compose.hermes.yml up -d
```

Hermes sidecar 默认只通过 Docker 内部网络暴露：

```text
http://hermes:8642/v1
```

不要把 Hermes 端口直接映射到公网。对外访问应统一走白泽 AI 平台，由平台处理用户认证、团队隔离、模型权限、额度和日志。

## 镜像版本

`version.ini` 维护 Hermes 镜像名与版本：

```ini
image_name_hermes=ccr.ccs.tencentyun.com/lucky/baizor-hermes
hermes_versions=1.0.6
```

当前推荐镜像：

```text
ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.6
```

如需从源码构建并推送：

```bash
docker build --pull --no-cache -f hermes-agent/gateway/platforms/Dockerfile.baizor-overlay -t ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.6 hermes-agent
docker push ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.6
```

## 必要环境变量

远端 `/lucky/NewApi/.env` 至少需要：

```dotenv
HERMES_IMAGE=ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.6
HERMES_API_SERVER_URL=http://baizor-hermes:8642
HERMES_API_SERVER_KEY=replace-with-a-long-random-secret
HERMES_API_SERVER_PORT=8642
HERMES_WEIXIN_QR_ENABLED=true
```

说明：

- `HERMES_API_SERVER_KEY` 是 new-api 与 Hermes sidecar 之间的服务端密钥，只能保存在服务端环境变量或渠道密钥中。
- `HERMES_WEIXIN_QR_ENABLED=false` 时，Hermes 会返回微信扫码能力已禁用，前端不暴露可用连接流程。
- 镜像必须包含 Hermes weixin 适配器依赖，否则接口会返回 `disabled`。
- 可选限流变量：`HERMES_WEIXIN_ACTION_RATE_LIMIT_ENABLE`、`HERMES_WEIXIN_ACTION_RATE_LIMIT`、`HERMES_WEIXIN_ACTION_RATE_LIMIT_DURATION` 控制创建二维码和断开连接；`HERMES_WEIXIN_STATUS_RATE_LIMIT_ENABLE`、`HERMES_WEIXIN_STATUS_RATE_LIMIT`、`HERMES_WEIXIN_STATUS_RATE_LIMIT_DURATION` 控制状态查询和二维码轮询。

## 平台渠道配置

在白泽 AI 平台控制台新增 OpenAI 兼容渠道：

| 配置项 | 推荐值 |
| --- | --- |
| 渠道类型 | OpenAI 兼容渠道 |
| 渠道名称 | Hermes Sidecar |
| Base URL | `http://baizor-hermes:8642/v1` 或 overlay 中的 `http://hermes:8642/v1` |
| 密钥 | `/lucky/NewApi/.env` 中的 `HERMES_API_SERVER_KEY` |
| 模型 | `hermes-agent` 或组织内部约定的 Hermes 模型别名 |
| 分组 | 建议使用独立分组，例如 `hermes`、`agent` 或业务团队专用分组 |

Hermes 内部调用底层模型时，不要再调用平台暴露给用户的 `hermes-agent` 模型名，否则会形成递归调用。推荐为 Hermes 单独创建服务账号或团队 Key，只授权它访问执行任务所需的底层模型。

## Web 版 HermesAgent

平台前端提供 `/hermes-playground` 入口。该入口复用平台 Playground 的模型选择、分组选择、流式响应、消息编辑和重试能力，并使用独立本地存储作用域，避免与普通 Playground 会话混用。

隔离策略：

- 浏览器层：按登录用户生成独立的 `hermes_user_<userId>` 存储作用域。
- 平台层：后端为 HermesAgent 请求写入 `X-Hermes-User-Id`、`X-Hermes-Session-Id`、`X-Hermes-Source`。
- Hermes 层：sidecar 使用 `X-Hermes-User-Id` 将技能、微信账号凭据、会话状态等数据落到 `/opt/data/baizor-users/<userId>/` 下。

## 消息平台：微信扫码

首期消息平台支持微信扫码连接。浏览器调用 new-api：

```text
GET  /pg/hermes/platforms/weixin/status
POST /pg/hermes/platforms/weixin/qr
GET  /pg/hermes/platforms/weixin/qr/:request_id
POST /pg/hermes/platforms/weixin/disconnect
```

new-api 再代理到 Hermes sidecar：

```text
GET  /v1/platforms/weixin/status
POST /v1/platforms/weixin/qr
GET  /v1/platforms/weixin/qr/{request_id}
POST /v1/platforms/weixin/disconnect
```

安全边界：

- 前端只拿到二维码、连接状态、脱敏账号标识和提示信息。
- Hermes API Server key、微信 bot token、iLink user id、base URL 等敏感信息不会返回给浏览器。
- 二维码创建、扫码确认成功、断开连接、异常会写入用户安全审计日志；二维码状态轮询只在首次确认连接时记一次审计，避免日志刷屏。
- 二维码请求按用户隔离，用户 A 不能查询或确认用户 B 的 `request_id`。

## 通过 deploy.sh 部署

默认 `deploy.sh` 只部署 `new-api`。需要同时部署 Hermes sidecar 时：

```bash
HERMES_SIDECAR_ENABLED=true ./deploy.sh
```

如需部署时同步构建 Hermes 镜像：

```bash
HERMES_SIDECAR_ENABLED=true \
HERMES_BUILD_CONTEXT=hermes-agent \
HERMES_DOCKERFILE=hermes-agent/gateway/platforms/Dockerfile.baizor-overlay \
./deploy.sh
```

脚本会：

- 从 `version.ini` 读取 `image_name_hermes` 与 `hermes_versions`，组合成 `HERMES_IMAGE`。
- 将 `HERMES_IMAGE`、`HERMES_API_SERVER_URL`、`HERMES_API_SERVER_PORT`、`HERMES_WEIXIN_QR_ENABLED` 等写入远端 `.env`。
- 重启 `new-api` 与 Hermes sidecar 服务。

如果使用 overlay 服务名 `hermes`：

```bash
HERMES_SIDECAR_ENABLED=true HERMES_COMPOSE_OVERLAY_ENABLED=true ./deploy.sh
```

## 验收清单

- `docker compose --env-file .env -f docker-compose.yml config --quiet` 通过。
- `docker compose --env-file .env -f docker-compose.yml ps new-api baizor-hermes` 显示服务运行。
- new-api 容器内可访问 `http://baizor-hermes:8642/v1/models`。
- 登录用户访问 HermesAgent 后，可在左侧 HermesAgent 根节点下打开“消息平台”，并看到“微信”连接卡片。
- 点击连接微信后能显示二维码，扫码状态能从等待扫码、已扫码、已连接或过期之间正确切换。
- 审计日志能看到微信二维码创建、断开连接或错误记录。
