# 标题生成与 Home 流程全面审计

> 审计日期：2026-03-18  
> 范围：App 端标题生成、Home chatbox 创建会话流程、语义清晰度

**相关文档**：

- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md) — 同步审计（6.1 节：标题生成与智能重命名 Web vs App 架构对比）
- [chatlist-smart-rename-audit.zh-CN.md](./chatlist-smart-rename-audit.zh-CN.md) — ChatList 智能重命名专项审计

---

## 一、Home chatbox 是否创建新 Agent？

### 结论：**否，不创建 Agent**

从 Home 的 HeroComposer 进入对话时：

1. **`handleHeroSubmit`**（ChatListScreen）调用 `createSession({ tagId, model, provider, plugins })`
2. **`sessionApi.create`** 使用 `sessionOnly: true`（api.ts:709）
3. **服务端** `session.createSession` 在 `sessionOnly: true` 时：
   - 仅创建 `sessions` 表记录，config 存在 `session.config`
   - **不创建** `agents` 表记录
   - **不写入** `agents_to_sessions` 关联表

因此，Home chatbox 创建的是 **session-only 会话**（虚拟 Agent），不会在侧边栏「助手」列表中显示，也不会产生新的 Agent 实体。

---

## 二、标题生成流程审计

### 2.1 触发时机

| 场景 | 触发位置 | 条件 |
|------|----------|------|
| 单 Agent 流式完成 | chat.ts ~2161 | `persistedAssistant?.messages?.length` 且 `isDefaultSessionTitle(session.title)` |
| 单 Agent 流式完成 | chat.ts ~2190 | `shouldCreateTopicAfterResponse` 时先 createTopic，再 `triggerTopicTitleGeneration` |
| 群聊 settle 后 | chat.ts 多处 | `didSettle` 且 `isDefaultSessionTitle(sess.title)` 时调用 `sessionApi.generateTitle`；`triggerTopicTitleGeneration` 单独调用 |

### 2.2 Session 标题生成

**服务端** `session.generateSessionTitle`：

1. `messageModel.queryBySessionId(sessionId)` 拉取消息
2. `pickLatestSessionTitleContext(messages)` 取最后一对 user+assistant
3. `systemAgent.generateTopicTitle(titleContext)` 调用 LLM 生成标题
4. 更新 `session.config.title` 或 `session.title`（群聊）

**Session-only 兼容性**：

- `queryBySessionId` 使用 `matchSession(sessionId)` → `eq(messages.sessionId, sessionId)`
- Session-only 会话的消息通过 `message.createMessage` 写入时带 `sessionId`、`agentId` 为 undefined
- 消息表允许 `agentId` 为 null，因此 **queryBySessionId 能正确找到 session-only 的消息**

### 2.3 Topic 标题生成

**服务端** `topic.generateTopicTitle`：

1. `messageModel.query({ topicId })` 按 topicId 拉取消息
2. 取 user + assistant 消息，调用 `systemAgent.generateTopicTitle`

**App 端 Topic 创建时机**：

- `shouldCreateTopicAfterResponse = !isGroupSession && !resolvedTopicId`
- 首条消息无 topic 时，流式完成后先 `createTopic(sessionId, '', { messageIds })`，再 `triggerTopicTitleGeneration`

### 2.4 潜在问题与已修复

| 问题 | 分析 | 状态 |
|------|------|------|
| 时序竞争 / 同步覆盖 | `generateTitle` 成功后立即 `fetchSessions` 可能用旧数据覆盖刚更新的标题 | ✅ 已修复：移除成功路径的 fetchSessions，仅保留 updateSessionTitle |
| 返回 null 无反馈 | API 返回 null（无 titleContext、LLM 空）时无 Toast | ✅ 已修复：newTitle 为 null 时显示 toastTitleGenerationFailed + toastTitleGenerationFailedHint（引导检查消息与模型配置） |
| 默认标题未命中 | `isDefaultSessionTitle` 依赖 `DEFAULT_SESSION_TITLES` + 动态 `t.chatListNewConversation` 等，若服务端返回的 title 不在集合内会跳过生成 | 核对服务端 `DEFAULT_SESSION_TITLES` 与 App 是否一致 |
| Topic 创建失败 | `createTopic` 失败时 `resolvedTopicId` 仍为 undefined，`triggerTopicTitleGeneration(sessionId, undefined)` 直接 return | ✅ 已修复：createTopic 失败时 Toast 提示 `toastTopicCreateFailed` |
| LLM 返回空 | `systemAgent.generateTopicTitle` 失败或返回空时返回 null，App 端无重试 | 已有 Toast 提示 `toastTitleGenerationFailed` |
| ChatList 手动智能重命名 | Web 侧边栏 Topic 有「Smart Rename」，App ChatList 无对应入口 | ✅ 已实现：ChatList 长按 ActionSheet 增加「智能重命名」，调用 `sessionApi.generateTitle`，成功则 `updateSessionTitle`，失败则 Toast |

### 2.5 服务端默认标题集对齐

**服务端**（session.ts）：
```
'', 'New Chat', 'New Conversation', 'New conversation', 'New Group Chat', '新对话', '新對話', 'Untitled'
```

**App**（chat.ts）静态集已对齐，另增加动态 i18n：`t.chatListNewConversation`、`t.chatListCreateGroup`、`t.groupCreateDefaultTitle`。

Session 创建时使用 `title || 'New Conversation'`，双方均可识别，**已对齐**。

---

## 三、语义清晰度

### 3.1 命名与概念

| 概念 | 当前用法 | 说明 |
|------|----------|------|
| Session | 会话，可对应 Agent 或 session-only | 清晰 |
| Agent | 助手实体，有 agents 表记录 | 清晰 |
| Session-only | 无 Agent 的会话，config 在 session | 代码注释有，用户不可见 |
| Topic | 会话内的话题/主题 | 清晰 |
| createSession | 创建会话（可能是 session-only） | 清晰 |
| createAgent | 创建助手（AgentListScreen 等） | 清晰 |

### 3.2 可能混淆点

1. **「新对话」vs「新助手」**  
   - Home 输入框创建的是「新对话」（session-only）  
   - Discover 使用 Agent 创建的是「新助手」+ 关联会话  
   - 若 UI 未区分，用户可能误以为每次都在创建新助手

2. **`agentApi.getConfigBySession`**  
   - Session-only 时无 agent，此 API 可能返回空或 fallback 到 session config  
   - handleHeroSubmit 中 `agentConfig?.id` 区分了有无 agent，逻辑正确

3. **`type: 'agent'`**  
   - Session 的 `type` 为 `'agent'` 表示单 Agent 会话，与「是否有 Agent 实体」不同  
   - Session-only 的 session.type 也是 `'agent'`，易与「有 Agent」混淆，但属内部实现，对外语义可接受

### 3.3 建议与已实施

- ✅ 在 api.ts、session.ts 注释中明确：**Session-only = 无 Agent 实体的会话，仅用于「新对话」**
- 若产品需要，可在 UI 上区分「新对话」与「从助手创建」的入口，减少「是否创建了新 Agent」的困惑

---

## 四、ChatList 手动智能重命名（与 Web 对比）

| 项 | 说明 |
|----|------|
| 入口 | ChatList 长按会话 → ActionSheet → 智能重命名（Wand2 图标） |
| 实现 | `handleSmartRename` 调用 `sessionApi.generateTitle(sessionId)`，成功则 `updateSessionTitle`，失败或 null 则 Toast `toastTitleGenerationFailed` + `toastTitleGenerationFailedHint` |
| i18n | `actionSmartRename`：en "Smart Rename" / zh-CN zh-TW "智能重命名" |
| 状态 | ✅ 已实现 |
| **Web 差异** | Web 智能重命名为 **Topic 级**，用 `fetchPresetTaskResult`（客户端 LLM）；App 为 **Session 级**，用 `session.generateSessionTitle`（服务端 tRPC）。详见 chat-sync-app-web-audit 6.1 节。 |

---

## 五、总结

| 审计项 | 结论 |
|--------|------|
| Home chatbox 是否创建新 Agent | 否，使用 sessionOnly，不创建 Agent |
| Session 标题生成 | 流程正确，session-only 兼容 |
| Topic 标题生成 | 流程正确，依赖 createTopic 成功 |
| 默认标题集 | 需与服务端对齐 |
| 语义清晰度 | 整体清晰，Session-only 与 Agent 的区分建议在文档中显式说明 |
| ChatList 手动智能重命名 | ✅ 已实现，与 Web Topic 智能重命名对应 |
