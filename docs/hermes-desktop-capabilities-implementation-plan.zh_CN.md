# Hermes Desktop 风格能力中心实施计划（中文版）

本文对应 `docs/hermes-desktop-capabilities-prd.zh_CN.md`，用于指导 Web 版 HermesAgent 的技能、工具与微信扫码消息平台接入实施。实施原则是先交付技能/工具能力中心，形成稳定、可验收、低外部依赖的第一版；微信扫码作为第二版独立推进，避免外部协议和运行态依赖拖慢核心体验上线。

## 总体目标

在 HermesAgent 页面中新增能力中心，让用户可以：

- 查看并创建自己的 Hermes 技能。
- 查看当前 HermesAgent 可用工具集、工具明细、启用状态和配置状态。
- 通过微信扫码把个人微信接入 HermesAgent，并在多用户 sidecar 场景下保持身份隔离。

## 交付策略

### 第一版：技能/工具优先交付

第一版只承诺交付技能和工具，不绑定微信扫码上线：

- 后端完成 skills/toolsets 代理接口。
- 前端完成能力中心框架。
- 前端完成“我的技能”列表、技能创建、技能详情和搜索。
- 前端完成工具集列表、工具展开、启用状态和配置状态展示。
- 完成技能/工具的多用户隔离、错误状态、i18n 和基础测试。

第一版上线后，用户应能在 Web 版 HermesAgent 中完成“创建技能 -> 看到自己的技能 -> 查看可用工具”的完整闭环。

### 第二版：消息平台接入

第二版再处理微信扫码：

- Hermes sidecar 补微信扫码 API。
- new-api 补微信平台代理。
- 前端补消息平台页、二维码轮询和连接状态。
- 补微信相关部署文档和端到端验收。

微信扫码不应阻塞第一版发布；如果微信接口未完成，能力中心可以先隐藏“消息平台”标签或显示“即将支持”。

## 阶段 0：边界确认与技术基线

### 目标

确认当前 new-api、Web 前端和 Hermes sidecar 已具备哪些接口，避免重复造轮子。

### 任务

1. 确认远端和本地 `version.ini` 使用的 Hermes 镜像版本不低于 `1.0.3`。
2. 确认 `new-api` 容器能读取 `HERMES_API_SERVER_URL` 与 `HERMES_API_SERVER_KEY`。
3. 确认 Hermes sidecar 已支持：
   - `GET /v1/skills`
   - `POST /v1/skills`
   - `GET /v1/toolsets`
4. 确认 Hermes `weixin` 适配器的扫码、状态查询和会话存储能力在源码中的真实入口。
5. 梳理 Web 版 HermesAgent 当前状态：
   - 聊天页面入口。
   - `/skill` 创建入口。
   - 会话列表和会话操作。
   - i18n 文案结构。

### 交付物

- 一份接口现状清单。
- 一份缺口清单，特别标出微信扫码还缺哪些 API。

### 验收

- 使用本地或远端 curl 能访问 Hermes skills/toolsets 接口。
- 缺少 Hermes 环境变量时，new-api 返回明确错误，而不是前端白屏或 500。

## 阶段 1：平台代理能力补齐

### 目标

让浏览器只访问 new-api，由 new-api 代为访问 Hermes sidecar。浏览器不直接接触 Hermes API Server 密钥。

### 任务

1. 扩展现有 Hermes Playground 后端代理接口：
   - `GET /pg/hermes/skills`
   - `POST /pg/hermes/skills`
   - `GET /pg/hermes/toolsets`
2. 抽出一层 Hermes 代理请求逻辑，统一处理：
   - Hermes base URL。
   - Hermes API key。
   - 请求超时。
   - 错误透传和错误归一化。
   - `X-Hermes-User-Id`。
   - `X-Hermes-Session-Id`。
   - `X-Hermes-Source`。
3. 技能列表返回值需要满足前端消费：
   - `name`
   - `description`
   - `category`
   - `path`
   - `source`
   - `owner_scope`
   - `is_user_created`
4. 如果 Hermes 原始返回缺少来源字段，优先在 Hermes API Server 中补齐；如短期无法补齐，在 new-api 代理层根据 path/用户目录做兼容判断。
5. 工具集返回值需要保持只读：
   - 工具集名称。
   - 显示名。
   - 描述。
   - 是否启用。
   - 是否配置完成。
   - 工具列表。

### 交付物

- new-api 后端 Hermes 能力代理接口。
- 针对技能和工具的后端单元/路由测试。

### 验收

- 登录用户调用 `GET /pg/hermes/skills` 能看到当前用户可见技能。
- 登录用户调用 `POST /pg/hermes/skills` 能创建合法 skill。
- 登录用户调用 `GET /pg/hermes/toolsets` 能看到工具集列表。
- 未配置 Hermes key 时返回 503 和可读错误。
- Hermes 返回 400 时前端能看到具体校验原因。

## 阶段 2：技能中心前端

### 目标

在 HermesAgent 页面中提供“我的技能”可视化管理入口。

### 任务

1. 在 HermesAgent 页面新增能力中心 UI 容器，建议使用右侧抽屉或顶部标签，不影响聊天主区域。
2. 新增“技能”标签页，包含：
   - 我的技能列表。
   - 内置技能列表或系统技能区域。
   - 搜索框。
   - 分类过滤。
   - 创建技能按钮。
3. 复用现有创建技能弹窗，但创建成功后刷新技能列表。
4. 技能列表项显示：
   - 名称。
   - 描述。
   - 分类。
   - 来源。
   - 路径或引用标识。
5. 技能详情支持：
   - 查看描述。
   - 复制技能名称。
   - 复制引用提示。
6. 添加空状态、加载状态、错误状态和 Hermes 未启用状态。
7. 新增所有 UI 文案的 i18n key，并补齐中文、英文基础翻译。

### 交付物

- HermesAgent 技能中心 UI。
- 前端 API 封装。
- i18n 文案。

### 验收

- 用户创建 skill 后，列表自动出现该 skill。
- 切换浏览器账号后，不显示上一个用户创建的 skill。
- Hermes 不可用时，聊天页面仍可打开，能力中心显示不可用状态。

## 阶段 3：工具中心前端

### 目标

让用户清楚知道 HermesAgent 当前有哪些工具能力，哪些已启用，哪些缺配置。

### 任务

1. 新增“工具”标签页。
2. 调用 `GET /pg/hermes/toolsets`。
3. 按工具集展示：
   - 工具集名称。
   - 描述。
   - 启用状态。
   - 配置状态。
   - 工具数量。
4. 支持展开工具集查看具体工具名。
5. 支持按“已启用”“未启用”“已配置”“未配置”过滤。
6. 对未配置工具集显示明确状态，但首期不提供配置表单。
7. 避免把工具展示做成权限承诺。文案应说明“当前 Hermes API Server 平台可见工具集”，而不是保证每次模型都会调用。

### 交付物

- HermesAgent 工具中心 UI。
- 工具集查询和展示逻辑。

### 验收

- 已启用和未启用工具集能正确区分。
- 空工具列表显示合理空状态。
- 工具接口失败不影响聊天主流程。

## 阶段 4：第一版集成验收与发布

### 目标

把技能和工具作为第一版独立发布，不等待微信扫码。

### 任务

1. 联调 `GET /pg/hermes/skills`、`POST /pg/hermes/skills`、`GET /pg/hermes/toolsets`。
2. 验证技能创建后列表自动刷新。
3. 验证用户 A 和用户 B 的技能隔离。
4. 验证工具集启用状态、配置状态和展开列表。
5. 验证 Hermes 不可用时能力中心显示错误状态，聊天主流程不受影响。
6. 补齐第一版部署说明：
   - Hermes 镜像版本要求。
   - `HERMES_API_SERVER_URL`。
   - `HERMES_API_SERVER_KEY`。
   - 常见 405/503/400 错误处理。

### 交付物

- 可上线的技能/工具能力中心。
- 第一版验收清单。
- 第一版部署说明。

### 验收

- 用户能创建技能并立即看到自己的技能。
- 用户能查看工具集和工具明细。
- 多用户之间技能不可见。
- 普通 Playground 和 HermesAgent 聊天主流程不受影响。

## 阶段 5：Hermes sidecar 微信扫码 API

### 目标

在 Hermes API Server 中补齐 Web 可调用的微信扫码管理接口，并确保多用户隔离。

### 建议接口

```text
GET  /v1/platforms/weixin/status
POST /v1/platforms/weixin/qr
GET  /v1/platforms/weixin/qr/{request_id}
POST /v1/platforms/weixin/disconnect
```

### 返回状态建议

```text
disabled       未启用或依赖缺失
not_connected  未连接
qr_ready       二维码已生成
scanned        已扫码，等待手机确认
connected      已连接
expired        二维码过期
failed         连接失败
disconnected   已断开
```

### 任务

1. 阅读 Hermes `weixin` 适配器现有 QR 登录函数和状态查询函数。
2. 在 API Server 中添加微信平台管理接口。
3. 所有接口复用 API Server 鉴权。
4. 所有接口读取服务端注入的 `X-Hermes-User-Id`，按用户生成隔离目录或隔离 profile。
5. 二维码请求只返回二维码图片内容、二维码 URL 或可渲染的 base64，不返回内部 session token。
6. 状态查询接口只返回状态枚举、过期时间、脱敏账号信息和可读错误。
7. 断开连接清理当前用户微信会话状态，不影响其他用户。
8. 如果 weixin 依赖缺失，返回 `disabled`，并给出可读原因。

### 交付物

- Hermes API Server 微信扫码接口。
- Hermes sidecar 测试。
- 新 Hermes 镜像版本。

### 验收

- 用户 A 生成二维码不影响用户 B。
- 二维码过期后状态变为 `expired`。
- 扫码成功后状态变为 `connected`，返回脱敏账号信息。
- 断开连接后状态变为 `not_connected` 或 `disconnected`。

## 阶段 6：平台代理微信接口

### 目标

让 Web 前端通过 new-api 安全访问微信扫码能力。

### 建议接口

```text
GET  /pg/hermes/platforms/weixin/status
POST /pg/hermes/platforms/weixin/qr
GET  /pg/hermes/platforms/weixin/qr/:request_id
POST /pg/hermes/platforms/weixin/disconnect
```

### 任务

1. 在 new-api 中增加微信平台代理路由。
2. 复用阶段 1 的 Hermes 代理公共逻辑。
3. 增加状态轮询频率限制，避免前端频繁请求打爆 Hermes sidecar。
4. 增加错误映射：
   - Hermes 未启用。
   - 微信依赖缺失。
   - 二维码过期。
   - 扫码失败。
   - 连接已失效。
5. 记录关键审计事件：
   - 发起二维码。
   - 连接成功。
   - 断开连接。
   - 连接失败。

### 交付物

- new-api 微信扫码代理接口。
- 后端测试。

### 验收

- 前端不需要 Hermes API key。
- 代理接口能正确传递平台用户身份。
- 高频轮询被限制或合并，不影响服务稳定性。

## 阶段 7：微信扫码前端

### 目标

在能力中心中提供微信扫码接入体验。

### 任务

1. 新增“消息平台”标签页。
2. 首期只显示微信平台。
3. 页面状态包括：
   - 未连接。
   - 正在生成二维码。
   - 二维码待扫码。
   - 已扫码待确认。
   - 已连接。
   - 已过期。
   - 失败。
   - 已禁用。
4. 支持操作：
   - 连接微信。
   - 刷新二维码。
   - 断开连接。
5. 二维码区域需要稳定尺寸，避免轮询状态导致页面跳动。
6. 已连接状态显示脱敏账号信息和连接时间。
7. 明确区分“微信扫码接入 HermesAgent”和平台账号“微信登录”。
8. 所有新增文案补齐 i18n。

### 交付物

- 微信扫码 UI。
- 前端 API 封装。
- 轮询逻辑和状态机。

### 验收

- 用户能从未连接走到二维码展示。
- 二维码过期后能重新生成。
- 连接成功后 UI 显示已连接。
- 点击断开后 UI 回到未连接。
- Hermes weixin 不可用时显示已禁用，不影响技能和工具页。

## 阶段 8：第二版部署与文档

### 目标

保证本地、远端和 partner 私有化部署可以稳定启用能力中心。

### 任务

1. 更新 Hermes 镜像版本到包含微信 API 的新版本。
2. 更新 `version.ini` 的 `hermes_versions`。
3. 更新 `deploy.sh` 说明和必要环境变量。
4. 更新 Hermes sidecar 文档，补充：
   - 能力中心依赖。
   - 技能/工具接口。
   - 微信扫码依赖。
   - 常见错误排查。
5. 明确微信扫码不等于平台微信登录/微信支付。
6. 给出部署后验证命令。

### 交付物

- 新 Hermes 镜像。
- 更新后的部署文档。
- 验证清单。

### 验收

- 新部署环境使用 `HERMES_SIDECAR_ENABLED=true ./deploy.sh` 后，技能、工具和微信状态接口可用。
- 未启用微信依赖时，页面显示禁用状态而不是报错。

## 阶段 9：端到端验收

### 验收路径

1. 管理员部署 new-api 与 Hermes sidecar。
2. 管理员配置 Hermes 模型渠道，并授权给测试用户。
3. 用户进入 HermesAgent。
4. 用户打开能力中心。
5. 用户创建一个 skill。
6. 用户在“我的技能”看到该 skill。
7. 用户打开工具页，看到工具集和工具明细。
8. 用户打开消息平台页，生成微信二维码。
9. 用户扫码连接微信。
10. 用户从微信发消息，HermesAgent 能响应。
11. 用户断开微信。
12. 另一个用户登录后，看不到前一个用户的 skill 和微信连接状态。

### 回归范围

- 普通 Playground 不受影响。
- HermesAgent 聊天不受能力中心错误影响。
- `/new`、`/save`、`/retry` 和 `/skill` 仍可用。
- 团队密钥、个人密钥、额度、模型权限和日志仍由平台治理。

## 风险与处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Hermes weixin 适配器依赖外部 iLink 服务 | 扫码和消息收发不稳定 | UI 显示禁用/失败状态，文档说明依赖边界 |
| 多用户共用 sidecar 导致状态串号 | 严重安全问题 | 所有接口强制使用服务端 `X-Hermes-User-Id` 隔离 |
| 技能来源字段不足 | “我的技能”显示不准确 | 优先补 Hermes API 返回字段，短期由平台代理兼容 |
| 前端轮询过频 | sidecar 压力升高 | 轮询间隔、超时、后端限频 |
| Hermes 镜像版本不一致 | 部署后接口 404/405 | `version.ini`、部署文档和部署后探针同时更新 |
| 微信扫码与微信登录混淆 | 用户误解 | 全部文案使用“微信扫码接入 HermesAgent” |

## 推荐实施顺序

1. 后端技能/工具代理。
2. 技能中心前端。
3. 工具中心前端。
4. 技能/工具第一版集成验收并发布。
5. Hermes 微信扫码 API。
6. new-api 微信代理。
7. 微信扫码前端。
8. 第二版镜像、部署脚本和文档。
9. 多用户端到端验收。

这个顺序把技能和工具作为明确的第一交付版本，先给用户一个稳定可用的 Hermes 能力中心；微信扫码这种依赖外部服务的高风险部分放在第二版独立验证和发布。
