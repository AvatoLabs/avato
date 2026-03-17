# Chat 与 Web 端同步审计

本文档全面审计移动端 App 与 Web 端在会话、消息、话题等聊天数据上的同步机制，分析「只有一部分同步」的原因。

**审计范围**：

- **数据层**：sessions、messages、topics、threads（群聊分支）
- **Web**：`src/store/session`、`src/store/chat`、SWR 策略
- **App**：`apps/mobile/src/store/session.ts`、`chat.ts`、`topic.ts`，以及各 Screen 的 fetch 时机

---

## 一、架构概览

### 1.1 数据源（共享）

| 数据类型 | API                              | 存储                     |
| -------- | -------------------------------- | ------------------------ |
| Sessions | `session.getGroupedSessions`     | PostgreSQL `sessions` 表 |
| Messages | `message.getMessages`            | PostgreSQL `messages` 表 |
| Topics   | `topic.getTopics` / `topic.list` | PostgreSQL `topics` 表   |
| Threads  | `thread.*`（群聊分支）           | PostgreSQL `threads` 表  |

Web 与 App 均通过 tRPC 调用同一后端，写入同一数据库。**无 WebSocket 或服务端推送**，同步完全依赖客户端拉取（pull）。

### 1.2 同步模式对比

| 维度           | Web                                   | App                                              |
| -------------- | ------------------------------------- | ------------------------------------------------ |
| **数据获取**   | SWR（`useClientDataSWR`）             | 手动 `fetchXxx` + `useEffect` / `useFocusEffect` |
| **Focus 刷新** | `revalidateOnFocus: true`，5 分钟节流 | 仅部分 Screen 有 `useFocusEffect`                |
| **重连刷新**   | `revalidateOnReconnect: true`         | 无                                               |
| **实时推送**   | 无                                    | 无                                               |

---

## 二、Sessions（会话列表）同步

### 2.1 Web

- **Hook**：`useFetchSessions(enabled, isLogin)`
- **SWR key**：`[FETCH_SESSIONS_KEY, isLogin]`
- **刷新**：`revalidateOnFocus: true`、`revalidateOnReconnect: true`
- **时机**：Tab 获得焦点、网络重连、手动 `refreshSessions`

### 2.2 App

- **入口**：`ChatListScreen` 的 `useFocusEffect`
- **时机**：仅当 **ChatListScreen 获得焦点** 时调用 `fetchSessions`
- **缺失**：在 `ChatDetailScreen`、`StoreScreen` 等页面时，会话列表不会刷新

### 2.3 差距

| 场景                                | Web                  | App                                 |
| ----------------------------------- | -------------------- | ----------------------------------- |
| 在 Web 新建会话后切回 App           | Tab focus → 自动刷新 | 需回到 ChatListScreen 才刷新        |
| 在 App 新建会话后切回 Web           | Tab focus → 自动刷新 | -                                   |
| 在 ChatDetailScreen 时 Web 新建会话 | -                    | 列表不更新，直到回到 ChatListScreen |

---

## 三、Messages（消息）同步

### 3.1 Web

- **Hook**：`useFetchMessages(context, skipFetch)`（Conversation + ChatStore 两处）
- **SWR**：`useClientDataSWRWithSync`，`revalidateOnFocus`、`revalidateOnReconnect` 继承
- **时机**：切换 topic、Tab focus、网络重连

### 3.2 App

- **入口**：`ChatDetailScreen` 的 `useEffect`
- **依赖**：`[sessionId, fetchMessages, fetchTopics, activeTopic, generating]`
- **时机**：挂载、`activeTopic` 变化、`generating` 从 true 变为 false
- **缺失**：**无 `useFocusEffect`**，从其他 App 或 Tab 切回 ChatDetailScreen 时不会重新拉取消息

### 3.3 差距

| 场景                                       | Web                  | App                         |
| ------------------------------------------ | -------------------- | --------------------------- |
| 在 Web 发送消息后切回 App ChatDetailScreen | Tab focus → 自动刷新 | **不刷新**（无 focus 触发） |
| 在 App 发送消息后切回 Web                  | Tab focus → 自动刷新 | -                           |
| 从 ChatListScreen 再进入 ChatDetailScreen  | -                    | 会刷新（组件重新挂载）      |
| 从后台唤醒 App，仍在 ChatDetailScreen      | -                    | **不刷新**                  |

**根因**：App 的 `ChatDetailScreen` 未在 `useFocusEffect` 中调用 `fetchMessages` / `fetchTopics`。

---

## 四、Topics（话题）同步

### 4.1 Web

- **Hook**：`useFetchTopics`（SWR）
- **刷新**：与 messages 类似，受 focus /reconnect 影响

### 4.2 App

- **入口**：与 `fetchMessages` 共用同一 `useEffect`
- **时机**：与 messages 相同，无 focus 触发

### 4.3 差距

与 Messages 相同，App 在 ChatDetailScreen 获得焦点时不会刷新 topics。

---

## 五、Threads（群聊分支）同步

### 5.1 Web

- **Hook**：`useFetchThreads(topicId, enabled)`
- **用途**：群聊 Topic 下的 Thread 列表

### 5.2 App

- **现状**：无 Thread 相关 UI 与 fetch（参见 `group-chat-app-web-gap-audit.zh-CN.md`）
- **结论**：Thread 在 App 端未实现，无同步可言

---

## 六、其他相关数据

| 数据类型                   | Web                   | App                                    | 同步情况 |
| -------------------------- | --------------------- | -------------------------------------- | -------- |
| Session 标题（含 AI 生成） | 写入 DB，SWR 刷新可见 | 写入 DB，需回到 ChatListScreen 才可见  | 部分     |
| Topic 标题（含 AI 生成）   | 写入 DB，SWR 刷新可见 | 写入 DB，无 focus 刷新                 | 部分     |
| 群组详情（groupDetail）    | -                     | `useFocusEffect` 中 `loadGroupDetail`  | 有       |
| 模型 / Provider 选择       | 存 session meta       | 存 session meta，需 fetchSessions 更新 | 部分     |

---

## 七、根因归纳

1. **无实时推送**：两端均为拉取模式，无 WebSocket/SSE 推送。
2. **App 缺少 focus 刷新**：`ChatDetailScreen` 未在 `useFocusEffect` 中刷新 messages/topics，导致从其他 App 或 Tab 切回时数据陈旧。
3. **Sessions 刷新范围窄**：仅 ChatListScreen focus 时刷新，其他 Screen 不触发。
4. **Web 的 SWR 策略**：`revalidateOnFocus`、`revalidateOnReconnect` 使 Web 在 focus/reconnect 时自动刷新，App 无等价机制。

---

## 八、已实施的改进

1. **ChatDetailScreen**：已添加 `useFocusEffect`，在屏幕获得焦点且 `!generating` 时调用 `fetchMessages`、`fetchTopics`，与 Web 的 focus 刷新对齐。
2. **StoreScreen**：已修复「已安装」Tab 的刷新循环，将 effect 拆分为 installed /explore 两路，避免 `fetchMarket` 依赖变化触发 `fetchInstalled` 的循环。
3. **Topic 自动创建与总结**：已对齐 Web 的无 - topic 发送路径。移动端现在会在首轮消息持久化完成后，再创建并切换到新 topic；若该会话已有历史消息，会把已持久化消息一并挂到新 topic，再触发标题总结。
4. **默认 topic 标题识别**：移动端已把 `Topics / 话题 / 話題` 视为默认标题，避免把占位标题误判成用户自定义标题而跳过总结。

## 九、群聊消息持久化（createMessage）参数差距

### 9.1 问题描述（历史）

App 端在群聊中发送消息时，曾仅传递 `sessionId`（群聊场景下为 `cg_xxx`），未传递 `groupId`。

### 9.2 后端期望

- `messages` 表：`sessionId` 引用 `sessions.id`（格式 `ssn_xxx`），`groupId` 引用 `chat_groups.id`（格式 `cg_xxx`）。
- 群聊消息应使用 `groupId: cg_xxx`、`sessionId: null`；单 agent 会话使用 `sessionId: ssn_xxx`。

### 9.3 当前行为（已修复 ✅）

| 层级      | 实现                                                                                          | 状态    |
| --------- | --------------------------------------------------------------------------------------------- | ------- |
| App Store | `buildMessageContainerParams(sessionId, 'group')` → `{ groupId: sessionId, sessionId: null }` | ✅      |
| App API   | `normalizeCreateMessageParams`：当 `sessionId.startsWith('cg_')` 时转为 `groupId`             | ✅ 兜底 |
| 后端      | `message.createMessage` 输入：`sessionId?.startsWith('cg_') && !groupId` 时自动转换           | ✅ 兜底 |

- `chat.ts` 中 `sendMessage`、`regenerateMessage` 均通过 `buildMessageContainerParams` 正确传参。
- `messageApi.create` 在调用前经 `normalizeCreateMessageParams` 处理。
- 三层保障确保群聊消息正确持久化。

---

## 十、消息结构解析差距

### 10.1 Web 端

- 使用 `conversation-flow` 的 `parse()` 处理 MessageGroup、compressedGroup、assistantGroup 等复杂结构。
- 支持消息分组、压缩展示、多 agent 回复等。

### 10.2 App 端

- 仅对原始消息做 `normalizeMessage`，未使用 `parse()`。
- 无法正确处理 MessageGroup、压缩组、Supervisor/Group 结构。
- `MessageBubble` 不区分成员，无 AgentGroupAvatar。

### 10.3 影响

- 群聊多成员回复在 App 上展示不完整或结构错误。
- 压缩后的消息组可能无法正确展开或展示。

---

## 十一、待实施建议

1. ~~**Session 列表**~~：已实施。ChatDetailScreen、StoreScreen 的 useFocusEffect 中调用 fetchSessions。
2. ~~**重连刷新**~~：已实施。App.tsx 中 NetInfo 监听在 `wasOffline && !offline` 时调用 syncMobileBootstrapState。
3. **长期方案**：评估 WebSocket/SSE 推送，实现跨端近实时同步。
4. ~~**群聊 createMessage**~~：已修复（见第九节）。
5. ~~**群聊 settle 判定**~~：已修复。详见 `group-chat-app-web-gap-audit.zh-CN.md` 4.5 节。
6. **消息结构**：评估在 App 端引入 `conversation-flow` 的 `parse()` 或等价逻辑，以支持 MessageGroup、压缩组等结构。

---

## 十二、审计状态汇总（截至 2026-03）

| 项目                        | 状态      | 说明                                                                       |
| --------------------------- | --------- | -------------------------------------------------------------------------- |
| ChatDetailScreen focus 刷新 | ✅ 已实施 | useFocusEffect 调用 fetchSessions、fetchMessages、fetchTopics              |
| 群聊 createMessage 参数     | ✅ 已修复 | buildMessageContainerParams + API 归一化 + 后端兜底                        |
| 群聊 settle 判定            | ✅ 已修复 | 结构化判定 + 信任 operationStatus.isCompleted                              |
| Skill/MCP 分类              | ✅ 已修复 | storeCategories.ts 固定兜底、builtin 归一化                                |
| Session 列表刷新范围        | ✅ 已实施 | ChatListScreen、ChatDetailScreen、StoreScreen focus 时均调用 fetchSessions |
| 网络重连刷新                | ✅ 已实施 | NetInfo 监听 `wasOffline && !offline` 时调用 syncMobileBootstrapState      |
| 消息结构 parse ()           | ⏳ 待评估 | App 未使用 conversation-flow parse                                         |
