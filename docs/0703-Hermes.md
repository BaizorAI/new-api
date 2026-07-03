# 0703 — Hermes 网关产品需求文档 (PRD)

> 文档编号：0703-Hermes  
> 创建时间：2026-07-03  
> 适用版本：v0.1 (草案)  
> 状态：草稿

---

## 1. 产品概述

Hermes 是一个面向多平台的 AI 对话网关，以 Python gateway + Node connector 的双语栈，为每一台机器提供 **平台无关的会话管理、路由、鉴权、计费、审计与监控**，让 AI 应用在任何平台（Discord、Telegram、Signal、WhatsApp、Feishu、Slack、Matrix、本地等）都拥有 **统一的会话生命周期**、**按人隔离的上下文**、**用量归属与成本**、**费用与退款**、**告警与通知**。

网关对外提供三条路由：

- **`/relay`** — 面向模型调用与流式返回，透传上下文与 payload
- **`/dashboard`** — 面向管理员，模型路由、计费配置、用量审计、退款、发票、告警、通知、速率限制、缓存与分布
- **`/app`** — 面向 AI 应用的 Web IDE 与模型路由 `/app/api`

所有接口支持多语言（zh / en / fr / ru / ja / vi）。

本 PRD 记录 Hermes v0.1 已实现的功能、待办特性与 0703 当日的聚焦工作。

---

## 2. 目标与成功标准

| 目标 | 成功标准 |
|---|---|
| 平台无关的会话管理 | 会话由 `session_key` 决定，重启自动恢复、崩溃软恢复、挂起/排水/超时标记、空闲与每日重置、过期会话清理 |
| 按人隔离的上下文 | DM 永远私有；群聊/频道默认按人隔离，线程默认共享（可配置），多租户共享机器人，作者优先路由与账户绑定 DM 路径 |
| 用量归属与成本 | 计费 token 数可精确到 0.001；费用可组合多种费用；用量归属租户/组织/项目 |
| 费用与退款 | 按次/按量、套餐、用量归属、部分/整单退款、发票 |
| 告警与通知 | 告警规则、告警渠道、告警通知、告警确认、告警升级、告警历史 |

---

## 3. 范围

### 3.1 包含

- 会话管理：`SessionSource` 来源描述、`SessionEntry` 活跃会话记录、`SessionStore` 存储与操作、会话 key 生成规则、多用户隔离策略、重置策略、重启恢复流、消息队列流、会话上下文注入、后台过期监视器、agent 缓存
- `/relay` 路由：模型路由、上下文（temperature / top_p / max_tokens / response_format / functions / tools / parallel_tool_calls / messages / presence_penalty / frequency_penalty / logit_bias）、stream、file、缓存与分布
- 鉴权：网关密钥、JWT、WebAuthn、OAuth、IP 白名单、API Key
- `/dashboard` 管理：模型路由、计费配置、用量审计、退款、发票、告警、通知、速率限制、流式与文件上传、多租户与配额、缓存与分布
- `/app` Web IDE 与模型路由 `/app/api`
- 多语言与国际化

### 3.2 不包含

- 模型训练 / 微调 / 评估
- 大模型知识注入
- 私有化部署的完整运维体系
- 第三方支付网关集成

---

## 4. 用户与角色

| 角色 | 典型需求 |
|---|---|
| 开发者 | 一键路由、计费透明、用量可审计 |
| 运维 / 管理员 | 路由配置、监控告警、审计 |
| AI 应用 | `/relay` 流式与文件上传 |
| 财务 / 审计 | 用量归属、退款、发票 |

---

## 5. 功能需求

### 5.1 会话管理

- **SessionSource** — 消息来源描述：`platform`、`chat_id`、`chat_name`、`chat_type`、`user_id`、`user_name`、`thread_id`、`chat_topic`、`user_id_alt`、`chat_id_alt`、`is_bot`、`guild_id`、`parent_chat_id`、`message_id`、`role_authorized`
- **SessionEntry** — 活跃会话记录：`session_key`、`session_id`、`created_at`、`updated_at`、`origin`、`display_name`、`platform`、`chat_type`、`input_tokens`、`output_tokens`、`cache_read_tokens`、`cache_write_tokens`、`total_tokens`、`estimated_cost_usd`、`cost_status`、`last_prompt_tokens`、布尔状态机（`was_auto_reset`、`auto_reset_reason`、`reset_had_activity`、`is_fresh_reset`、`expiry_finalized`、`suspended`、`resume_pending`、`resume_reason`、`last_resume_marked_at`）
- **SessionStore** — 存储与操作：`get_or_create_session`、`update_session`、`reset_session`、`switch_session`、`suspend_session`、`mark_resume_pending`、`clear_resume_pending`、`suspend_recently_active`、`prune_old_entries`、`list_sessions`、`lookup_by_session_id`、`has_any_sessions`、`append_to_transcript`、`rewrite_transcript`、`load_transcript`、`rewind_session`
- **会话 key 生成规则** — `agent:main:{platform}:{chat_type}[:{chat_id}][:{thread_id}][:{participant_id}]`，DM 永远私有，群聊/频道默认按人隔离，线程默认共享
- **多用户隔离策略** — DM 永远私有；群聊/频道默认按人隔离（`group_sessions_per_user`），线程默认共享（`thread_sessions_per_user`）
- **重置策略** — `none` / `idle` / `daily` / `both`，可配置每平台/每会话类型
- **重启恢复流** — 非干净关闭标记、`.clean_shutdown`、`suspend_recently_active`、`_suspend_stuck_loop_sessions`、排水超时标记、自动恢复、干净关闭标记
- **消息队列流** — 中断跟进与 `/queue` FIFO，单槽 + 溢出缓冲，深度与清理
- **会话上下文注入** — `SessionContext` 构建与 PII 红action
- **后台过期监视器** — 过期会话最终化、空闲缓存 agent 清扫、过期条目修剪
- **Agent 缓存** — LRU、最大 128、空闲 TTL 1h、清理流

### 5.2 路由

- 模型名称标准化、别名、分类、标签、描述、提供商、价格、是否支持 stream
- 权重路由（基于使用次数）与失败自动降级
- 请求头注入、响应头注入
- 速率限制：请求数、token 数、流式事件、自定义维度
- 上下文：最大/最小 token、温度、top_p、max_tokens、response_format、functions / tools、parallel_tool_calls、system / user / assistant / tool messages、presence_penalty / frequency_penalty / logit_bias
- 缓存与分布：键、TTL、权重、失效、刷新、统计

### 5.3 鉴权

- 网关密钥、JWT、WebAuthn、OAuth（GitHub / Discord / OIDC）、IP 白名单、API Key
- 网关密钥：只读、自动续期、有效期、描述
- JWT：签发、过期、算法、主题、受众
- WebAuthn：注册、认证、可信平台标识符、允许_credentials、挑战、用户验证选项、超时
- OAuth：授权端点、令牌端点、客户端 ID、客户端密钥、授权 URI、范围、发现端点、用户信息端点、令牌端点 URI、令牌类型、响应类型、PKCE、状态、默认 scopes
- IP 白名单：CIDR、描述、白名单
- API Key：创建、更新、删除、描述、有效期、IP 白名单

### 5.4 审计

- 请求审计：请求体、响应体、错误、请求 ID、模型、路由、调用者、费用、token、耗时、IP、状态码、时间
- 日志审计：用户、操作、时间、IP、资源、结果、错误

### 5.5 多租户

- 租户、组织、项目：创建、更新、删除、描述、有效期、状态、计费、配额
- 配额：请求数、token、费用、速率、流式事件、文件上传

### 5.6 通知

- 告警：告警规则、告警渠道、告警通知、告警确认、告警升级、告警历史
- 通知：通知模板、通知渠道、通知历史

### 5.7 缓存与分布

- 缓存键、TTL、权重、失效、刷新、统计
- 分布：路由权重、失败降级、分布统计

---

## 6. 非功能需求

| 维度 | 指标 |
|---|---|
| 性能 | 响应 P99 < 100ms；支持 10k QPS |
| 可用 | SLA 99.9%；自动降级 |
| 安全 | 请求签名、TLS 1.3、密钥不落地 |
| 兼容 | 支持 HTTP/1.1/2/3，流式、file、JSON Schema |

---

## 7. 架构概览

```
client -> /relay -> model -> upstream
         |-> /dashboard -> model/route -> setting/ratio -> setting/model
         |-> /dashboard -> setting/operation -> setting/system -> setting/performance
         |-> /dashboard -> usage -> refund -> invoice -> audit
         |-> /dashboard -> alert -> notify
         |-> /dashboard -> cache -> distribution
         |-> /app -> /app/api
```

### 7.1 数据模型（核心）

- Model：id、name、alias、category、tags、description、provider、price、supports_stream
- Route：id、model_id、weight、failover_to、headers、cache
- Ratio：id、model_id、user_id、value
- ModelSetting：id、model_id、ratio_id、operation、system、performance
- OperationSetting：id、model_id、operation、value
- SystemSetting：id、system、value
- PerformanceSetting：id、performance、value
- User：id、username、email、password、avatar、role、status、created_at、updated_at
- Usage：id、model_id、user_id、org_id、project_id、token_in、token_out、cost、ip、status、created_at
- Refund：id、usage_id、amount、reason、status、created_at、updated_at
- Invoice：id、user_id、invoice_number、amount、currency、status、created_at、updated_at
- Audit：id、user_id、action、resource、ip、result、error、created_at
- AlertRule：id、name、expression、severity、channels
- NotifyChannel：id、type、config
- CacheKey：id、key、ttl、weight、fail_count、created_at、updated_at
- Distribution：id、model_id、weight、failover_to、created_at、updated_at

---

## 8. 接口契约（摘要）

### 8.1 /relay 路由

- POST `/relay` — 模型调用（body: model, messages, temperature, top_p, max_tokens, response_format, functions, tools, parallel_tool_calls, system, user, assistant, tool messages, presence_penalty, frequency_penalty, logit_bias, stream, stream_options, file）
- 响应：200 / 201（创建模型）或 400 / 401 / 403 / 404 / 409 / 422 / 429 / 500 / 502 / 503 / 504

### 8.2 /dashboard 管理

- GET /dashboard/model/route — 路由列表（分页、过滤、排序）
- POST /dashboard/model/route — 创建路由
- PATCH /dashboard/model/route/:id — 更新路由
- DELETE /dashboard/model/route/:id — 删除路由
- GET /dashboard/setting/ratio/:model_id — 路由比率（按用户）
- POST /dashboard/setting/ratio — 创建比率
- DELETE /dashboard/setting/ratio/:id — 删除比率
- GET /dashboard/setting/model — 模型设置（缓存、分布、上下文）
- POST /dashboard/setting/model — 创建设置
- PATCH /dashboard/setting/model/:id — 更新设置
- DELETE /dashboard/setting/model/:id — 删除设置
- GET /dashboard/setting/operation — 操作设置
- POST /dashboard/setting/operation — 创建操作设置
- PATCH /dashboard/setting/operation/:id — 更新操作设置
- DELETE /dashboard/setting/operation/:id — 删除操作设置
- GET /dashboard/setting/system — 系统设置
- POST /dashboard/setting/system — 创建系统设置
- PATCH /dashboard/setting/system/:id — 更新系统设置
- DELETE /dashboard/setting/system/:id — 删除系统设置
- GET /dashboard/setting/performance — 性能设置
- POST /dashboard/setting/performance — 创建性能设置
- PATCH /dashboard/setting/performance/:id — 更新性能设置
- DELETE /dashboard/setting/performance/:id — 删除性能设置
- GET /dashboard/usage — 用量列表（分页、过滤、排序）
- GET /dashboard/usage/:id — 用量详情
- DELETE /dashboard/usage/:id — 删除用量
- POST /dashboard/usage/:id/refund — 退款
- GET /dashboard/usage/refund/:id — 退款详情
- GET /dashboard/usage/invoice/:id — 发票详情
- GET /dashboard/usage/invoice — 发票列表
- GET /dashboard/audit — 审计列表
- GET /dashboard/alert — 告警列表
- GET /dashboard/alert/:id — 告警详情
- POST /dashboard/alert — 创建告警
- PATCH /dashboard/alert/:id — 更新告警
- DELETE /dashboard/alert/:id — 删除告警
- GET /dashboard/notify — 通知列表
- GET /dashboard/notify/:id — 通知详情
- POST /dashboard/notify — 创建通知
- GET /dashboard/cache — 缓存列表
- GET /dashboard/cache/:id — 缓存详情
- POST /dashboard/cache — 创建缓存
- PATCH /dashboard/cache/:id — 更新缓存
- DELETE /dashboard/cache/:id — 删除缓存
- GET /dashboard/distribution — 分布列表
- GET /dashboard/distribution/:id — 分布详情
- POST /dashboard/distribution — 创建分布
- PATCH /dashboard/distribution/:id — 更新分布
- DELETE /dashboard/distribution/:id — 删除分布

---

## 9. 待办特性

- [ ] 计费表达式引擎
- [ ] 更细粒度的用量计量（0.001）
- [ ] 更多 OAuth 提供商
- [ ] 更多模型路由
- [ ] 更多上下文
- [ ] 更多缓存与分布
- [ ] 更多通知渠道
- [ ] 更多告警规则
- [ ] 更多退款与发票
- [ ] 更多审计
- [ ] 更多多租户

---

## 10. 验收标准

- 会话 key 生成与多用户隔离策略正确；重启自动恢复、崩溃软恢复、挂起/排水/超时标记、空闲与每日重置、过期会话清理
- 路由配置可创建/更新/删除；权重路由生效；失败自动降级
- 计费 token 数可精确到 0.001；费用可组合多种费用
- 用量可归属租户/组织；审计可查询所有请求
- 监控与日志覆盖所有路由；错误率告警可触发
- 所有接口支持多语言（zh / en / fr / ru / ja / vi）

---

## 11. 附录

### 11.1 术语

- **会话 key**：确定对话车道的标识
- **session_id**：会话 incarnations
- **流式**：stream / SSE
- **file**：文件上传
- **上下文**：temperature / top_p / max_tokens / response_format / functions / tools / parallel_tool_calls / messages / presence_penalty / frequency_penalty / logit_bias
- **分布**：路由权重 / 失败降级 / 分布统计

### 11.2 变更历史

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-07-03 | v0.1 | 0703 PRD 初稿 |

### 11.3 参考资料

- [项目架构](/CLAUDE.md)
- [会话生命周期](/hermes-agent/docs/session-lifecycle.md)
- [中继器-连接器合同](/hermes-agent/docs/relay-connector-contract.md)
- [AGENTS.md](/AGENTS.md)

