# Hermes Sidecar 多用户接入方案

本文说明如何把 Hermes 作为 sidecar 容器接入白泽 AI 平台，让多个用户通过平台统一身份、团队、密钥、模型权限、额度、日志和审计能力使用 Hermes，而不是直接访问 Hermes 服务。

## 目标场景

Hermes 适合作为组织内部的智能代理运行时。推荐的调用链是：

```text
用户 / 业务系统
  -> 白泽 AI 平台 API Key / 团队 Key
  -> 白泽 AI 平台模型权限、额度、日志、审计、路由
  -> Hermes sidecar OpenAI-compatible API
  -> Hermes 内部任务执行
  -> 白泽 AI 平台统一模型服务或组织已授权模型
```

这个结构有两个重点：

- 用户不直接持有 Hermes 的服务密钥，也不直接访问 Hermes 容器。
- Hermes 需要模型能力时，应优先配置为调用白泽 AI 平台的统一模型端点，由平台继续承担模型选择、额度扣减、日志记录和审计追踪。

## 部署结构

项目新增了 `docker-compose.hermes.yml` 作为 Docker Compose overlay。它不会改变默认部署，只有显式叠加该文件时才会启动 Hermes sidecar。

```bash
HERMES_API_SERVER_KEY=change-me \
docker compose -f docker-compose.yml -f docker-compose.hermes.yml up -d
```

Hermes sidecar 默认只通过 Docker 内部网络暴露：

```text
http://hermes:8642/v1
```

不要把 Hermes 端口直接映射到公网。对外访问应统一走白泽 AI 平台，由平台处理用户认证、团队隔离、模型权限、额度和日志。

## Hermes 镜像准备

`docker-compose.hermes.yml` 默认使用：

```text
HERMES_IMAGE=ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.2
```

这个镜像应由 Hermes 官方仓库源码构建后推送到腾讯云镜像仓库。首次准备镜像时可以：

```bash
git clone https://github.com/NousResearch/hermes-agent.git
cd hermes-agent
docker build -t ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.2 .
docker push ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.2
```

生产环境建议把镜像推送到内部镜像仓库，并在项目根目录 `version.ini` 中维护 Hermes 镜像名与版本：

```ini
image_name_hermes=ccr.ccs.tencentyun.com/lucky/baizor-hermes
hermes_versions=1.0.2
```

启用 Hermes sidecar 的 `deploy.sh` 会把这两个字段组合成：

```text
ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.2
```

并写入远端 `/lucky/NewApi/.env` 的 `HERMES_IMAGE`。远端仍需要配置 Hermes API Server 密钥：

```dotenv
HERMES_API_SERVER_KEY=replace-with-a-long-random-secret
HERMES_API_SERVER_PORT=8642
```

## 平台渠道配置

在白泽 AI 平台控制台新增一个模型渠道：

| 配置项 | 推荐值 |
| --- | --- |
| 渠道类型 | OpenAI 兼容渠道 |
| 渠道名称 | Hermes Sidecar |
| Base URL | `http://hermes:8642/v1` |
| 密钥 | `/lucky/NewApi/.env` 中的 `HERMES_API_SERVER_KEY` |
| 模型 | 按 Hermes 暴露的模型名配置，例如 `hermes-agent` 或组织内部约定名称 |
| 分组 | 建议放入独立分组，例如 `hermes`、`agent` 或业务团队专用分组 |

用户侧只看到平台分配给他的模型名和团队 Key。平台管理员可以通过分组、模型权限、额度、团队密钥、IP 限制和日志来控制可见范围。

## Web 版 HermesAgent

平台前端提供独立入口 `/hermes-playground`，用于在浏览器中测试 Hermes agent。该入口复用平台 Playground 的模型选择、分组选择、流式响应、消息编辑和重试能力，但使用独立的本地存储作用域，避免和普通 Playground 的会话、参数、消息记录混在一起。

隔离策略分为两层：

- 浏览器层：按登录用户生成独立的 `hermes_user_<userId>` 存储作用域，不同用户在同一浏览器登录时不会复用彼此的 HermesAgent 配置和消息。
- 平台层：HermesAgent 请求会由后端写入 `X-Hermes-User-Id`、`X-Hermes-Session-Id` 和 `X-Hermes-Source` 上游请求头，用户 ID 由服务端登录态生成，前端不能伪造。

HermesAgent 默认只展示名称中包含 `hermes` 的模型。上线前需要在平台模型渠道中配置类似 `hermes-agent` 的模型别名，并授权给目标用户或团队；如果没有可用 Hermes 模型，页面会禁止发送请求并提示未找到可用模型。

如果 Hermes 容器内部要做更细的工作区、缓存、任务状态隔离，应以 `X-Hermes-User-Id` 与 `X-Hermes-Session-Id` 作为隔离键。平台侧已经保证这些头只在 HermesAgent 场景写入，并且用户标识来自服务端。

## Hermes 使用平台模型

Hermes 内部如果需要调用大模型，应配置为使用白泽 AI 平台统一 OpenAI-compatible 端点：

```text
Base URL: http://new-api:3000/v1
API Key:  为 Hermes 创建的服务账号或团队 Key
Model:    平台上已授权的具体模型，例如 gpt-5.5、qwen、deepseek 或组织自有模型别名
```

注意不要让 Hermes 调用自身暴露给平台的 `hermes-agent` 模型名，否则会形成递归调用：

```text
平台 hermes-agent -> Hermes -> 平台 hermes-agent -> Hermes -> ...
```

推荐做法是为 Hermes 单独创建一个服务账号或团队，并只授予它执行任务所需的底层模型范围。

## 多用户治理方式

多用户使用 Hermes 时，治理边界应落在平台层：

- 用户身份：用户登录平台后使用个人 Key 或团队 Key。
- 团队隔离：不同团队使用不同团队 Key、模型权限、额度和日志视图。
- 模型权限：平台只向用户开放授权后的 Hermes 模型别名。
- 额度扣减：用户调用 Hermes 的请求由平台记录；Hermes 再调用底层模型时可归集到 Hermes 服务账号或团队。
- 审计追踪：平台保留用户请求、模型名、渠道、消耗、响应状态和错误信息。
- 安全边界：Hermes API key 只放在服务器 `.env` 或平台渠道密钥中，不下发给普通用户。

## 通过 deploy.sh 部署

默认 `deploy.sh` 仍只部署 `new-api`。需要同时部署 Hermes sidecar 时，先确认本地 `version.ini` 已配置：

```ini
image_name_hermes=ccr.ccs.tencentyun.com/lucky/baizor-hermes
hermes_versions=1.0.2
```

再在服务器 `/lucky/NewApi/.env` 准备：

```dotenv
HERMES_API_SERVER_KEY=replace-with-a-long-random-secret
HERMES_API_SERVER_PORT=8642
```

然后本地执行：

```bash
HERMES_SIDECAR_ENABLED=true ./deploy.sh
```

脚本会同步 `docker-compose.hermes.yml` 到 `/lucky/NewApi/`，并使用：

```bash
docker compose -f docker-compose.yml -f docker-compose.hermes.yml up -d new-api hermes
```

如果需要部署时同步构建 Hermes 镜像，可以指定 Hermes 源码目录：

```bash
HERMES_SIDECAR_ENABLED=true HERMES_BUILD_CONTEXT=/path/to/hermes-agent ./deploy.sh
```

不指定 `HERMES_BUILD_CONTEXT` 时，脚本只使用 `version.ini` 中的 `image_name_hermes:hermes_versions` 并在服务器上拉取该镜像。

如果未启用 `HERMES_SIDECAR_ENABLED=true`，部署行为与原来保持一致。

## 验收清单

- `docker compose -f docker-compose.yml -f docker-compose.hermes.yml config --quiet` 可以通过。
- `docker compose -f docker-compose.yml -f docker-compose.hermes.yml ps new-api hermes` 显示两个服务运行。
- 平台渠道测试能够访问 `http://hermes:8642/v1`。
- 普通用户无法直接访问 Hermes 容器端口，只能通过平台模型调用。
- 使用日志中可以区分用户调用 Hermes 的记录和 Hermes 服务账号调用底层模型的记录。
- 团队额度、模型权限、IP 限制和审计日志符合组织策略。
