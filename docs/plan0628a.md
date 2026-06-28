 现状判断
  当前体验不和谐的根因是：同一类“工作区管理动作”分散在三个地方：

  - 顶部 Header：左上角是 SidebarTrigger 折叠按钮。
  - 第二栏 Sidebar：已有 Workbench、Skill Store、Results Center、Message Platform 等入口。
  - HermesAgent 工作区右上角工具栏：Capabilities、Message platforms、Execution tasks、Results 等又重复用右侧 Sheet 打开。

  这导致用户心智混乱：有些功能像导航，有些像弹窗，有些同一个功能既在第二栏又在右上角按钮里。

  目标原则

  1. 左上角只做品牌入口，不做布局控制。
  2. 第二栏承担“工作区管理导航”。
  3. 右侧弹框只保留临时详情、编辑、确认，不再作为主要功能入口。
  4. HermesAgent 的会话、任务、结果、技能、消息平台都归同一套工作区管理模型。

  计划 1：左上角折叠按钮改为白泽 Logo
  当前位置在 web/default/src/components/layout/components/header.tsx:34，Header 无条件渲染 SidebarTrigger。

  改造方案：

  - 移除左上角 SidebarTrigger。
  - 在左上角放白泽主图标，点击跳转 /。
  - 现有 SystemBrand variant='inline' 已经有 logo + 系统名并跳 /，但它现在是在折叠按钮后面。需要调整为：
      - Header 左侧：仅主 Logo 图标。
      - Logo 后面是否显示系统名由 AppHeader 决定，避免重复。

  - 桌面端不再提供显眼折叠按钮。
  - 侧栏展开/折叠仍可暂时保留 SidebarRail 和 Ctrl/Cmd+B，但不再是主入口。
  - 移动端要补一个导航入口，否则去掉折叠按钮后移动端无法打开侧栏。建议移动端把产品导航入口放到右侧更多菜单或保留一个非“折叠”语义的导航按钮。

  结论：可行，但移动端必须单独处理。

  计划 2：工作区工具栏收敛到第二栏管理
  当前 HermesAgent 工具栏在 web/default/src/features/hermes-playground/components/hermes-agent-workspace.tsx:827 附近，绝对定位到右上角。这里同时放了团队选择、团队管理、消息平台、
  任务、会话、结果、技能等入口。

  改造方案：

  - 右上角工具栏只保留“当前工作上下文”的控件：
      - 团队/个人计费归属选择。
      - 极少量与当前输入直接相关的动作。

  - 移除这些管理入口按钮：
      - Message platforms
      - Execution tasks
      - Team sessions
      - Team results
      - Team skills
      - Capabilities

  - 这些入口全部移动到第二栏对应模块。

  建议第二栏结构：

  Workbench
  - HermesAgent
  - Sessions
  - Execution tasks
  - Results
  - Skills
  - Tools

  Message Platform
  - Overview
  - WeChat
  - Message history
  - Connection settings
  - Auto-reply settings

  这里的关键是：第二栏是管理入口，右侧 Sheet 是详情载体。

  计划 3：消息平台统一归“消息平台管理设置”
  当前 HermesMessagePlatforms 是一个右侧 Sheet，内部又有 WeChat / Message history / Connection settings 三个 tabs。代码在 web/default/src/features/hermes-playground/components/
  hermes-message-platforms.tsx:61。

  改造方案：

  - 第二栏 Message Platform 成为唯一主入口。
  - /hermes-playground?panel=messages&section=wechat 定位到 WeChat 管理。
  - /hermes-playground?panel=messages&section=history 定位到消息历史。
  - /hermes-playground?panel=messages&section=settings 定位到连接设置。
  - 右侧 Sheet 不再由顶部按钮打开，而是由第二栏点击或页面内详情动作打开。
  - “连接状态、监听状态、重连、断开、二维码刷新”都放在消息平台设置模块里，不散落在 HermesAgent 工具栏。

  结论：强烈建议做。这个改造会显著提升 locality，后续新增 Telegram、飞书、企业微信时也不会继续污染 HermesAgent 主工作区。

  计划 4：爱马仕Agent 任务列表放到第二栏
  当前任务列表是 HermesExecutionTasksSheet，代码在 web/default/src/features/hermes-playground/components/hermes-execution-tasks-sheet.tsx:47。它已经具备：

  - 按个人/团队拉任务。
  - 轮询运行中任务。
  - 打开任务。
  - 打开结果。
  - 失败任务重试。

  放到第二栏是可行的，但建议不是“完整表格搬过去”，而是：

  - 第二栏显示最近任务、状态、进度、失败标记。
  - 点击任务后：
      - 有会话则切到对应 session。
      - 有结果则打开结果详情。
      - 需要完整管理时打开任务详情 Sheet 或主内容区。

  - 提供 View all tasks 入口，进入完整任务列表视图或打开右侧详情。

  实现方式：

  - 新增一个 Sidebar 动态项类型，例如 type: 'hermes-execution-tasks'。
  - 类似现有 hermes-sessions 的模式，在 NavGroup 中渲染专门的 HermesExecutionTasksItem。
  - Query 只在当前路径是 /hermes-playground 或 /team-workspace?team_id=... 且侧栏展开时启用，避免全局无意义轮询。
  - team 模式必须从 URL team_id 读取上下文；没有 team_id 时隐藏团队任务或显示选择团队提示。

  结论：可行，建议先做“最近任务 + 状态 + View all”，不要一次把完整任务管理塞进 18rem 第二栏。

  推荐分阶段

  1. Header 改造：去掉左上折叠按钮，放白泽 Logo，补移动端导航入口。
  2. 侧栏交互修正：点击产品图标时桌面端主动展开第二栏，避免“有时不弹”。
  3. 消息平台收敛：把消息平台入口、状态、设置统一到第二栏 Message Platform。
  4. 任务列表侧栏化：新增 HermesExecutionTasksItem，先展示最近任务和状态。
  5. 清理 HermesAgent 顶部工具栏：只保留当前工作上下文控件，其余管理入口删除。
  6. 最后抽出一个 WorkspacePanelController 模块，统一 panel/section URL、右侧 Sheet 打开、第二栏 active 状态，避免继续靠散落的 useState + window event + sessionStorage 串联。