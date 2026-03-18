# ChatList 智能重命名审计（现状版）

> 审计日期：2026-03-18\
> 范围：App ChatList「智能重命名」（Session 级）与 Web Topic 重命名差异、调用链、失败路径与排障策略

**相关文档**：

- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md)
- [title-generation-and-home-flow-audit.zh-CN.md](./title-generation-and-home-flow-audit.zh-CN.md)
- [topic-chat-conversation-semantic-audit.zh-CN.md](./topic-chat-conversation-semantic-audit.zh-CN.md)

---

## 一、TL;DR

当前本地代码层面，历史两类主根因已修复：

1. `queryBySessionId` 已支持 sessionId + agentId 双条件匹配（修复 Agent 会话消息查空）。
2. `SystemAgentService.getTaskModelConfig` 已改为 `DEFAULT -> env SYSTEM_AGENT -> user settings`（与 Web 对齐）。

但 “返回 `newTitle: null`” 仍可能出现，主要来自运行时条件：

- 会话没有有效 user+assistant 消息对。
- 会话标题被判定为非默认标题（直接返回已有标题，不重新生成）。
- 模型运行失败或返回空标题。
- 线上部署版本未包含上述修复（最常见运维侧问题）。

---

## 二、Web vs App 功能定位（不是同一层级）

| 维度     | Web                                 | App ChatList                   |
| -------- | ----------------------------------- | ------------------------------ |
| 操作对象 | Topic                               | Session                        |
| 入口     | Topic 列表项操作                    | ChatList 长按会话              |
| API      | `chatService.fetchPresetTaskResult` | `session.generateSessionTitle` |
| 生成方式 | 客户端流式                          | 服务端一次性 mutation          |

结论：两端不是 “同一功能不同实现”，而是 “不同层级的重命名能力”。Web 更偏 Topic；App ChatList 更偏 Session。

---

## 三、App 调用链（现状）

### 3.1 前端链路

```
ChatListScreen.handleSmartRename(session)
  -> sessionApi.generateTitle(session.id)
  -> trpc mutation: session.generateSessionTitle
```

### 3.2 服务端链路

```
session.generateSessionTitle
  -> find session/group
  -> 若标题非默认：直接返回原标题
  -> query messages（session/group）
  -> pickLatestSessionTitleContext（需要 user+assistant 成对）
  -> SystemAgentService.generateTopicTitle
  -> update session/group title
  -> return title | null
```

### 3.3 返回 `null` 的路径

1. session/group 不存在。
2. `titleContext` 为空（找不到有效 user+assistant 消息对）。
3. LLM 执行失败或返回空。

---

## 四、已修复项（代码已落地）

### 4.1 Agent 会话消息查询缺口

- 现状：`MessageModel.queryBySessionId` 对 agent 会话通过 `buildSessionCondition` 同时匹配 `sessionId` 与关联 `agentId`。
- 结果：避免 “消息实际存在但 queryBySessionId 查空”。

### 4.2 SystemAgent 配置来源不一致

- 现状：`SystemAgentService.getTaskModelConfig` 已使用 `DEFAULT -> env SYSTEM_AGENT -> user settings`。
- 结果：当用户 DB 未显式配置时，可使用 env 的 topic 模型（如 moonshot/kimi），不再默认掉回 openai。

---

## 五、仍需关注的风险

### 5.1 默认标题判定集合存在边界差异

服务端 `session.ts` 的默认标题集合与 App 侧集合并非完全一致（例如 App 有 `New Session`/`新会话`）。
这会导致部分标题被服务端视为 “非默认”，从而直接返回原值而非重新生成。

### 5.2 成功与失败可见性仍可增强

- 失败时已有 Toast + hint。
- 成功时目前主要是静默关闭弹层，缺少可观测性（日志 / 埋点）与可理解反馈。

### 5.3 线上部署版本漂移

即使代码已修复，若线上镜像未更新到对应 commit，现象会保持不变。

---

## 六、线上排障 Runbook

### 6.1 第一步：确认运行版本是否包含修复

必须确认运行时代码中同时存在：

1. `queryBySessionId` 使用 `buildSessionCondition`。
2. `getTaskModelConfig` 使用 `getServerGlobalConfig()` 且 merge 顺序为 `DEFAULT -> env -> user`。

如果缺任一项，先以 “部署未生效” 处理。

### 6.2 第二步：确认模型配置可执行

1. 服务器环境是否设置 `SYSTEM_AGENT`（topic provider/model）。
2. 对应 provider 的 API key 是否可用。
3. 用户 `system_agent` 配置是否显式覆盖到不可用 provider。

### 6.3 第三步：确认数据前提

1. 目标 session/group 是否存在。
2. 是否至少存在一组可提取文本的 user + assistant 消息。
3. 是否已是非默认标题（此时接口会直接返回原标题）。

### 6.4 第四步：观察日志

建议至少记录：

- `sessionId`
- `effectiveTitle`
- `isDefaultTitle`
- `messageCount`
- `provider/model`
- `errorType`
- `generatedTitle`

---

## 七、建议优化（P0/P1）

### P0

1. 统一服务端与 App 的默认 Session 标题集合，减少误判。
2. 智能重命名补齐结构化日志（包含 provider/model/errorType）。
3. 前端在 `newTitle === null` 时附带简短原因提示（如 “无有效消息上下文”）。

### P1

1. ChatList 成功后可选 success feedback（弱提示，不打断）。
2. 在 TopicList/ChatDetail 继续保留 Topic 级智能重命名，明确与 Session 级的边界。

---

## 八、结论

当前代码层面，智能重命名主逻辑已可用，过去两项核心代码缺陷已修复。\
若线上仍出现 `newTitle: null`，优先按 “**部署版本未生效 / 运行时配置不可用 / 消息上下文不足**” 三类排查，不应再默认归因到旧代码缺陷。

---

## 九、关键文件

- `apps/mobile/src/screens/ChatListScreen.tsx`
- `apps/mobile/src/lib/api.ts`
- `src/server/routers/lambda/session.ts`
- `src/server/services/systemAgent/index.ts`
- `packages/database/src/models/message.ts`
