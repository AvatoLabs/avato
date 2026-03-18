# App 细节增强审计（现状与路线图）

> 审计日期：2026-03-18\
> 范围：`apps/mobile` 功能完整性、体验、稳定性、性能、无障碍、与 Web 对齐

本文档是移动端综合审计总表，目标是把 “已落地能力” 和 “仍影响体验的关键问题” 拆开，避免状态判断失真。

**相关专项审计**：

- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md)
- [chatlist-smart-rename-audit.zh-CN.md](./chatlist-smart-rename-audit.zh-CN.md)
- [topic-chat-conversation-semantic-audit.zh-CN.md](./topic-chat-conversation-semantic-audit.zh-CN.md)
- [explore-store-category-audit.zh-CN.md](./explore-store-category-audit.zh-CN.md)
- [group-chat-app-web-gap-audit.zh-CN.md](./group-chat-app-web-gap-audit.zh-CN.md)
- [app-performance-vs-web-audit.zh-CN.md](./app-performance-vs-web-audit.zh-CN.md)
- [resource-preview-app-web-gap-audit.zh-CN.md](./resource-preview-app-web-gap-audit.zh-CN.md)

---

## 一、TL;DR

当前 App 核心链路已可用，但仍有 5 个会直接影响稳定体感的点：

1. Store Explore 分类切换仍存在并发竞态和 “失败伪装为空结果” 问题。
2. ChatList 智能重命名链路已接入，但成功率仍受服务端 `SystemAgent` 配置与运行环境一致性影响。
3. 群聊流式仍是轮询架构，和 Web 的 SSE 存在实时性与请求开销差距。
4. `execute_tasks` 相关 API 已接入，但任务委托编排流程尚未形成闭环。
5. 深层链接（如 `/chat/:sessionId`、通知跳转）尚未落地。

---

## 二、现状矩阵（按体验优先级）

| 维度             | 现状                                             | 状态 | 说明                           |
| ---------------- | ------------------------------------------------ | ---- | ------------------------------ |
| 会话与对话语义   | ChatList 已支持「会话视图 + 最近话题视图」双视图 | ✅   | 语义层面较此前明显改善         |
| 会话 / 话题同步  | Focus、重连、前台唤醒同步已接入                  | ✅   | 主要刷新链路可用               |
| 标题生成         | Topic/Session 标题生成链路已接入                 | ✅   | 失败场景仍依赖服务端配置正确性 |
| Store 基础能力   | Explore/Installed、MCP/Skill、安装卸载可用       | ✅   | 功能可用不等于稳定性已达标     |
| Store 分类稳定性 | fallback 与 key 归一化已做                       | ⚠️   | 竞态与错误语义仍是主因         |
| 群聊核心能力     | @ 提及、DM、GroupTasks、重生成功能已实现         | ✅   | 常规群聊可用                   |
| 群聊任务委托     | `createClientGroupAgentTaskThread` 仅 API 层     | ⚠️   | 编排流程与 UI 反馈未闭环       |
| 群聊流式架构     | App 轮询，Web SSE                                | ⚠️   | 架构差异导致体验差距           |
| 无障碍基础       | 主流程已覆盖 label/role/modal 语义               | ✅   | 建议持续抽样回归               |
| 导航与入口       | Discover 已从 Profile 接入                       | ✅   | 入口完整                       |
| 深层链接         | 尚无统一 linking 配置                            | ⏳   | 跳转链路待建设                 |

---

## 三、关键风险与根因

### 3.1 Store 分类 “时有时无”

现状不是 “没有 fallback”，而是：

1. `fetchMarket` 没有请求序列保护，快速切分类时可能被过时响应覆盖。
2. 服务端 `getMcpList/getSkillList` 失败时返回空结构，前端难以区分 “真实空数据” 和 “请求失败”。
3. category key 仍有多源契约（fallback、分类接口、列表接口、manifest），存在语义漂移风险。

详见：[explore-store-category-audit.zh-CN.md](./explore-store-category-audit.zh-CN.md)

### 3.2 ChatList 智能重命名稳定性

链路层面已接入：`handleSmartRename -> session.generateSessionTitle`。\
但当服务端模型配置不可用、上游失败或返回空标题时，前端只能提示失败，不会生成新标题。

详见：[chatlist-smart-rename-audit.zh-CN.md](./chatlist-smart-rename-audit.zh-CN.md)

### 3.3 群聊与 Web 架构差异

1. Web 为 SSE 推送，App 仍以轮询为主。
2. `execute_tasks` 仅有接口接入，尚未形成 “识别任务 -> 创建线程 -> 执行 -> 回写状态” 的产品闭环。
3. Thread / 分支能力仍未完整呈现。

详见：[group-chat-app-web-gap-audit.zh-CN.md](./group-chat-app-web-gap-audit.zh-CN.md)

### 3.4 导航链路仍缺深链

当前仅看到外链打开能力，尚无完整 deep link 配置，限制了通知跳转、外部唤起与跨端定位会话。

---

## 四、代码侧证据（关键锚点）

### 4.1 会话 / 话题语义与视图

- `apps/mobile/src/screens/ChatListScreen.tsx`：顶部注释明确 Session/Topic 双层语义与双视图。
- `apps/mobile/src/screens/ChatListScreen.tsx`：`recentTopics`、`VIEW_TOPIC`、最近话题列表渲染。

### 4.2 智能重命名

- `apps/mobile/src/screens/ChatListScreen.tsx`：`handleSmartRename` 已接入失败提示与引导文案。
- `apps/mobile/src/lib/api.ts`：`sessionApi.generateTitle` -> `session.generateSessionTitle`。
- `src/server/routers/lambda/session.ts`：`generateSessionTitle` 在多分支下可能返回 `null`。

### 4.3 Store 分类能力与问题并存

- `apps/mobile/src/screens/StoreScreen.tsx`：`fetchCategories` 先设 fallback，再请求分类 API。
- `apps/mobile/src/screens/StoreScreen.tsx`：分类合法性检查，不在 `categoryOptions` 时回退 `all`。
- `apps/mobile/src/screens/StoreScreen.tsx`：`fetchMarket` 仍无 abort/requestId 防护。
- `src/server/routers/lambda/market/index.ts` 与 `skill.ts`：列表接口失败返回空结构。

### 4.4 群聊能力与缺口

- `apps/mobile/src/components/ui/GroupMentionInput.tsx`：@ 提及输入已实现。
- `apps/mobile/src/store/chat.ts`：`parseTargetIdFromMentions`、compressedGroup 处理、轮询流程。
- `apps/mobile/src/lib/api.ts`：任务线程相关 API 已接入，但业务编排未形成闭环。

---

## 五、优先级路线图（直接可执行）

### P0（本周）

1. Store `fetchMarket` 增加请求序列保护（requestId 或 abort），禁止过时响应覆盖。
2. 统一 “失败 vs 空结果” 语义，让前端可展示失败态与重试，而非静默空列表。
3. 为智能重命名链路补齐可观测字段：`sessionId/model/provider/errorType/newTitle`。

### P1（下个迭代）

1. 打通 `execute_tasks` 最小闭环：检测任务、创建线程、回写状态、失败可见。
2. 群聊 SSE 做灰度验证（保留轮询降级），先验证稳定性再扩面。
3. 落地最小 deep link：`/chat/:sessionId`、`/chat/:sessionId/:topicId`。

### P2（后续）

1. 收敛 Session/Topic 相关文案，减少 “Chat = 会话还是对话” 的理解成本。
2. 统一 App/Web/Server 的 category 契约与共享常量，减少多源 key 漂移。
3. 建立移动端关键链路回归集：重命名、分类切换、群聊长会话、弱网恢复。

---

## 六、验收标准

1. 快速切换 Store 分类（A -> B -> A）不出现列表错位回跳。
2. 上游失败时出现 “加载失败可重试”，而非空列表误导。
3. 智能重命名失败日志可定位到 provider/model/errorType。
4. 群聊任务委托从触发到状态回写可在 UI 追踪。
5. 深链可直接打开目标会话并正确定位 topic（若提供）。

---

## 七、相关文件索引

### App

- `apps/mobile/src/screens/ChatListScreen.tsx`
- `apps/mobile/src/screens/ChatDetailScreen.tsx`
- `apps/mobile/src/screens/StoreScreen.tsx`
- `apps/mobile/src/screens/ProfileScreen.tsx`
- `apps/mobile/src/store/chat.ts`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/App.tsx`

### Server

- `src/server/routers/lambda/session.ts`
- `src/server/routers/lambda/market/index.ts`
- `src/server/routers/lambda/market/skill.ts`
- `src/server/services/discover/index.ts`
- `src/server/services/community/marketCache.ts`

---

## 八、审计结论（截至 2026-03-18）

App 已从 “功能缺失期” 进入 “稳定性打磨期”。\
下一阶段不应继续泛化 “新增功能”，而应聚焦 3 条主线：

1. **Store 分类稳定性**（竞态与错误语义）。
2. **群聊执行链闭环**（execute_tasks + 流式策略）。
3. **跨端可达性**（深链与可观测性）。

这三项完成后，移动端体验会从 “可用” 提升到 “可预测、可定位、可恢复”。
