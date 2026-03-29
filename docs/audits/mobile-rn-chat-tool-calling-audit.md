# React Native Mobile App Chat 工具调用审计报告

**审计日期**: 2025-03-23\
**审计范围**: `apps/mobile`（React Native / Expo 原生应用）\
**区分**: 与 `src/routes/(mobile)/`（移动 Web SPA）为两套独立实现\
**版本**: 深度审计 v2（全面覆盖数据流、合并逻辑、消息展示、干预、错误处理与边缘场景）

**修复状态** (2025-03-23):

| 优先级 | 问题                                                  | 状态                                                                                                |
| ------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| P0     | tool_calls 格式不匹配（streamToolLoopFallback）       | ✅ 已修复：api.ts 检测 ChatToolPayload \[] 直接使用                                                 |
| P1     | formatToolDisplayTitle 只取第一个参数                 | ✅ 已修复：改为 slice (0, 3)                                                                        |
| P1     | CompareGroupBlock 引用链接不渲染                      | ✅ 已修复：传入 markdownRules（见 mobile-citation-links-audit）                                     |
| P2     | mergeToolPayloads 与 mergeToolPayloadLists 重复       | ✅ 已修复：抽成 mergeToolPayloadsCore                                                               |
| P2     | 工具错误展示路径不清晰                                | ✅ 已修复：buildToolPayloadFromMessage 映射 pluginError，ToolCard 接收 error prop                   |
| P2     | tool_executions 流式错误无 pluginError                | ✅ 已修复：服务端 createToolExecutionEvent 传递 execution.error；RN toolExecutionsToPayloads 映射   |
| P2     | RN 缺失内置工具 displayNames                          | ✅ 已修复：lobe-agent-management、lobe-group-agent-builder、lobe-local-system 添加中英 displayNames |
| P3     | chatHelpers 无单测                                    | ✅ 已修复：apps/mobile/src/store/chatHelpers.test.ts                                                |
| P3     | messageDisplay 无单测                                 | ✅ 已修复：apps/mobile/src/store/messageDisplay.test.ts                                             |
| P3     | api.ts transformToolCalls、mergeToolCallChunks 无单测 | ✅ 已修复：抽离至 toolCallUtils.ts，toolCallUtils.test.ts                                           |
| P3     | ToolCard 可访问性缺失                                 | ✅ 已修复：主卡片、折叠参数、复制按钮添加 accessibilityLabel                                        |
| P3     | 启用干预时需传入 onApprove/onReject                   | ✅ 已修复：MOBILE_TOOL_INTERVENTION_ENABLED=true，continue API + onApprove/onReject                 |

---

## 1. 架构概览

### 1.1 React Native vs 移动 Web

| 项目     | React Native App (`apps/mobile`)                    | 移动 Web SPA (`src/routes/(mobile)/`)                |
| -------- | --------------------------------------------------- | ---------------------------------------------------- |
| 入口     | `apps/mobile/App.tsx`                               | `src/spa/entry.mobile.tsx`                           |
| 路由     | React Navigation                                    | React Router                                         |
| Chat UI  | `MessageBubble.tsx`, `ToolCallsBlock`, `ToolCard`   | 复用 Web `ConversationArea`                          |
| API      | `/webapi/chat/${provider}` (MobileChatService)      | tRPC `sendMessageInServer` + 客户端 execAgentRuntime |
| 工具批准 | `MOBILE_TOOL_INTERVENTION_ENABLED = true`（已启用） | 支持                                                 |

### 1.2 工具数据流

```
SSE 流 (webapi/chat)
  → tool_calls 事件 → mergeToolCallChunks → transformToolCalls → onTools
  → tool_executions 事件 → onToolExecutions → toolExecutionsToPayloads
  → mergeToolPayloads 合并到 message.tools
  → buildDisplayMessages (collapseStandaloneToolMessages, collapseAssistantToolChains)
  → MessageBubble → ToolCallsBlock / AssistantChainBlock → ToolCard
```

---

## 2. 工具参数渲染逻辑

### 2.1 buildToolDisplayProps 与 argumentsText

**位置**: `apps/mobile/src/components/ui/MessageBubble.tsx` 约 1777–1801 行

```ts
const argumentsText = [
  params.length ? `(${params.join(', ')})` : '',
  tool.arguments ? formatToolArguments(tool.arguments) : '',
]
  .filter(Boolean)
  .join('\n');
```

- **params**: 来自 `formatToolDisplayTitle` → `Object.entries(args).slice(0, 3)`，**前 3 个参数**会出现在 `(key: value)` 摘要中（已修复）
- **formatToolArguments**: 完整 JSON 美化显示；解析失败时退回原始字符串

### 2.2 formatToolDisplayTitle 参数摘要（已修复）

**位置**: `MessageBubble.tsx` 约 1756–1772 行

```ts
const params = Object.entries(args)
  .slice(0, 3) // 展示前 3 个参数
  .map(([key, value]) => `${key}: ${formatToolArgumentValue(value)}`);
```

**现状**: 多参数工具（如 `searchSourceSet` 的 `query`、`spaceId`）在摘要中展示前 3 个参数，其余依赖 `formatToolArguments` 的完整 JSON。

### 2.3 ToolCard 中的 argumentsText 展示

**位置**: `MessageBubble.tsx` 约 2617–2699 行

| 状态 | 条件                           | 展示                            |
| ---- | ------------------------------ | ------------------------------- |
| 展开 | `showDetail && argumentsText`  | 完整 argumentsText（含复制）    |
| 折叠 | `!showDetail && argumentsText` | 最多 2 行 (`numberOfLines={2}`) |

**结论**: 完整参数在展开时可见；折叠时被截断。

---

## 3. 参数未渲染或缺失的可能场景

### 3.1 tool.arguments 为空或缺失

| 来源                        | 字段                                     | 可能问题                                  |
| --------------------------- | ---------------------------------------- | ----------------------------------------- |
| tool_calls 流               | `toolCall.function?.arguments \|\| '{}'` | 流式合并前的首包可能无 arguments          |
| tool_executions             | `exec.arguments`                         | 服务端可能不传 arguments                  |
| buildToolPayloadFromMessage | `message.plugin?.arguments \|\| '{}'`    | 持久化消息中 plugin 或 arguments 可能缺失 |

**位置**:

- `api.ts` 约 635 行: `arguments: toolCall.function?.arguments || '{}'`
- `messageDisplay.ts` 约 55 行: `arguments: message.plugin?.arguments || '{}'`

当上述字段缺失时，会使用 `'{}'`，导致 `argumentsText` 仅有 params，无完整 JSON。

### 3.2 流式 arguments 未完成

`mergeToolCallChunks` 会拼接 `arguments`，但在流式早期，`arguments` 可能是：

- 不完整 JSON（如 `{"query": "`）
- 空字符串

此时 `formatToolArguments` 会退回原始字符串，`safeParseJsonRecord` 返回 `{}`，params 为空，`argumentsText` 仅包含原始片段。若流式过程中完全不发送 `function.arguments` 的 chunk，合并后仍可能为空。

### 3.3 BuiltinRender 不展示原始 arguments

**示例**: `ExecuteCodeRender`（`ExecuteCode.tsx`）

- 从 `arguments` 解析 `code`、`language`
- 从 `pluginState` / `content` 解析 `output`、`stderr`
- **当** `!hasCode && !hasOutput && !hasStderr` 时 `return null`

**影响**: 此时 `customContent` 为 null，但 ToolCard 仍会渲染 `argumentsText` 区域。若 `tool.arguments` 本身为空，则完全无参数展示。

### 3.4 非内置工具的插件 / MCP

对无 `getMobileBuiltinRender` 的工具：

- 走 `ToolCard` 的 `content` + `argumentsText`
- 若 API 返回的 `tool` 结构不同（如 `args` 而非 `arguments`），当前逻辑不会映射到 `argumentsText`，参数将不显示。

---

## 4. 与 Web 的差异（简要）

见 **§18 Web vs RN 工具调用深度对比** 获取完整矩阵与差异分析。本节为摘要：

- **内置工具**：RN 缺 Render 的 AgentBuilder、AgentManagement、GroupAgentBuilder、LocalSystem 现已补全 displayNames，退回到 ToolCard 时展示友好名称
- **批准**：~~RN 禁用~~ RN 已启用（MOBILE_TOOL_INTERVENTION_ENABLED=true），Web 支持完整干预流程
- **流式参数**：Web 无 StreamingRenderer 时 `return null`；RN 仍展示 argumentsText

---

## 5. 问题汇总与建议

### 5.1 参数细节未渲染

| 编号   | 问题                               | 位置                                                | 建议                                 |
| ------ | ---------------------------------- | --------------------------------------------------- | ------------------------------------ |
| ~~P1~~ | ~~params 仅展示第一个参数~~        | `formatToolDisplayTitle`                            | ✅ 已修复：`slice(0, 3)`             |
| P2     | `tool.arguments` 缺失时仅剩 `'{}'` | `transformToolCalls`、`buildToolPayloadFromMessage` | 校验服务端是否始终返回 `arguments`   |
| P3     | 折叠时 `numberOfLines={2}` 截断    | ToolCard                                            | 保留折叠时的摘要，或支持点击展开参数 |

### 5.2 数据来源一致性

| 编号 | 问题                                   | 说明                                                         |
| ---- | -------------------------------------- | ------------------------------------------------------------ |
| M1   | tool_executions 与 tool_calls 合并策略 | 确认 `mergeToolPayloads` 中 arguments 的覆盖 / 保留规则      |
| M2   | 持久化消息的 plugin.arguments          | 检查 `messageApi.create` 等是否完整持久化 `plugin.arguments` |

### 5.3 建议排查

1. **抓包 / 日志**: 确认 `/webapi/chat` 的 SSE 中 `tool_calls` 与 `tool_executions` 是否始终包含 `arguments`
2. **端到端**: 对多参数工具（如知识库搜索、自定义 MCP）验证 RN 端参数展示是否完整
3. **BuiltinRender**: 对返回 `null` 的渲染（如 ExecuteCode 无输出），确认 `argumentsText` 是否按预期展示

---

## 6. 深度审计：SSE 格式、合并逻辑与内置工具矩阵

### 6.1 tool_calls 事件格式不匹配（P0）✅ 已修复

**原问题（已修复）**：`streamToolLoopFallback` 发送的 `tool_calls` 使用 `ChatToolPayload[]`，RN 曾期望 `MobileToolCallChunk[]`。

| 来源                                                   | 格式                    | 字段                                                 |
| ------------------------------------------------------ | ----------------------- | ---------------------------------------------------- |
| 服务端 `writeEvent('tool_calls', normalizedToolCalls)` | `ChatToolPayload[]`     | `apiName`, `arguments`, `identifier`, `id`（顶层级） |
| RN `mergeToolCallChunks` / `transformToolCalls`        | `MobileToolCallChunk[]` | `function.name`, `function.arguments`, `id`          |

**位置**：

- 服务端：`src/server/services/mobileChat/index.ts` 约 894 行
- RN：`apps/mobile/src/lib/api.ts` 约 533–643 行

**~~影响~~（已消除）**：~~当 RN 收到 `ChatToolPayload[]` 时，transformToolCalls 会取 function?.arguments 为 undefined...~~

**修复**：api.ts 检测 `ChatToolPayload[]`（`isChatToolPayloadArray`），若匹配则直接传给 `onTools`，跳过 `mergeToolCallChunks` 与 `transformToolCalls`。

### 6.2 mergeToolPayloads 覆盖逻辑（已确认）

**逻辑**：`next = { ...existing, ...tool }`，incoming 的字段会覆盖 existing。

**结论**：

- `tool_executions` 中的 `arguments` 会覆盖 `tool_calls` 的 `arguments`，最终数据正确
- `MobileToolExecutionEvent` 在 `createToolExecutionEvent` 中始终传入 `toolCall.arguments`，服务端不会漏传
- `mergeToolPayloads` 对 `intervention`、`pluginState`、`result_content` 有特殊保留逻辑，不会误覆盖

### 6.3 服务端 SSE 事件格式

**`tool_executions`**（`createToolExecutionEvent`）：

- `apiName`, `arguments`, `id`, `identifier`, `intervention`, `result`, `state?`
- 始终包含 `arguments`

**`tool_calls`**（仅 `streamToolLoopFallback`）：

- 发送 `normalizedToolCalls`（`ChatToolPayload[]`），非 `MobileToolCallChunk[]`

**主路径**（`runToolLoop` 成功）：

- 只发送 `tool_executions`，不发送 `tool_calls`，无格式冲突

### 6.4 Web vs RN 内置工具矩阵 ✅ 已对齐

| identifier               | apiName 示例                                                  | Web Render | RN Render | RN Streaming                             | RN Intervention                     |
| ------------------------ | ------------------------------------------------------------- | ---------- | --------- | ---------------------------------------- | ----------------------------------- |
| lobe-agent-builder       | getAvailableModels, installPlugin, updateConfig, updatePrompt | ✅         | ✅ 通用   | ✅ 通用                                  | installPlugin                       |
| lobe-agent-management    | createAgent, searchAgent, callAgent, ...                      | ✅         | ✅ 通用   | ✅ 通用                                  | -                                   |
| lobe-cloud-sandbox       | executeCode                                                   | ✅         | ✅        | ✅                                       | executeCode                         |
| lobe-group-agent-builder | createAgent, inviteAgent, updateConfig, ...                   | ✅         | ✅ 通用   | ✅ 通用                                  | -                                   |
| lobe-group-management    | broadcast, speak, executeAgentTask, executeAgentTasks         | ✅         | ✅        | ✅ broadcast, speak, executeAgentTask(s) | executeAgentTask, executeAgentTasks |
| lobe-gtd                 | createPlan, execTask, execTasks, ...                          | ✅         | ✅        | createPlan, execTask, execTasks          | createPlan, createTodos             |
| lobe-source-set          | searchSourceSet                                               | ✅         | ✅        | ✅                                       | -                                   |
| lobe-local-system        | listLocalFiles, runCommand, searchLocalFiles, ...             | ✅         | ✅ 通用   | ✅ 通用                                  | 全 API                              |
| lobe-user-memory         | addExperienceMemory, addPreferenceMemory, searchUserMemory    | ✅         | ✅        | addExperienceMemory, addPreferenceMemory | addExperienceMemory                 |
| lobe-notebook            | createDocument                                                | ✅         | ✅        | ✅                                       | createDocument                      |
| lobe-skill-store         | searchSkill                                                   | ✅         | ✅        | ✅                                       | -                                   |
| lobe-skills              | searchSkill                                                   | ✅         | ✅        | ✅                                       | -                                   |
| lobe-web-browsing        | search                                                        | ✅         | ✅        | ✅                                       | -                                   |
| lobe-calculator          | evaluate, execute, ...                                        | -          | ✅        | -（计算器通常无流式）                    | -                                   |

**RN 通用**：GenericFallbackRender（arguments + result）、GenericFallbackStreaming（执行中…）、GenericFallbackIntervention（参数展示 + 批准 / 拒绝）。

### 6.5 消息持久化

**结论**：工具参数会被正确持久化。

- **数据库**：`packages/database/src/models/message.ts` 中 `message.create` 将 `plugin: chatToolPayload` 存入，`plugin.arguments` 随 payload 一起持久化
- **collapseStandaloneToolMessages**：从 `role: 'tool'` 消息的 `message.plugin` 构建 `buildToolPayloadFromMessage`，并合并到父 assistant 的 `tools[]`
- **buildToolPayloadFromMessage**：`arguments: message.plugin?.arguments || '{}'`，当 `plugin` 缺失或 `arguments` 为空时退化为 `'{}'`；依赖入库时写入完整 `plugin`

---

## 7. 文件索引

| 路径                                                                             | 职责                                                                                                                                        |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/MessageBubble.tsx`                                | ToolCallsBlock、ToolCard、buildToolDisplayProps、formatToolArguments                                                                        |
| `apps/mobile/src/features/BuiltinTools/index.ts`                                 | BUILTIN_RENDERS、getMobileBuiltinRender、GenericFallbackRender（agent-builder 等）                                                          |
| `apps/mobile/src/features/BuiltinTools/fallback/GenericFallback.tsx`             | 通用 Render，用于 agent-builder、agent-management、group-agent-builder、local-system                                                        |
| `apps/mobile/src/features/BuiltinTools/fallback/GenericFallbackStreaming.tsx`    | 通用 Streaming 占位（执行中…）                                                                                                              |
| `apps/mobile/src/features/BuiltinTools/fallback/GenericFallbackIntervention.tsx` | 通用 Intervention（参数展示 + 批准 / 拒绝）                                                                                                 |
| `apps/mobile/src/features/BuiltinTools/streamings.ts`                            | BUILTIN_STREAMINGS、getMobileBuiltinStreaming（含 agent-builder、agent-management、group-agent-builder、group-management、local-system 等） |
| `apps/mobile/src/features/BuiltinTools/interventions.ts`                         | BUILTIN_INTERVENTIONS、getMobileBuiltinIntervention（GTD、Notebook、Memory、CloudSandbox、GenericFallback 等）                              |
| `apps/mobile/src/lib/toolCallUtils.ts`                                           | isChatToolPayloadArray、mergeToolCallChunks、transformToolCalls（纯函数，可单测）                                                           |
| `apps/mobile/src/store/messageDisplay.ts`                                        | mergeToolPayloadLists、buildToolPayloadFromMessage、collapseStandaloneToolMessages                                                          |
| `apps/mobile/src/store/chatHelpers.ts`                                           | toolExecutionsToPayloads、mergeToolPayloads、mergeResolvedToolPayloads                                                                      |
| `apps/mobile/src/lib/api.ts`                                                     | transformToolCalls、mergeToolCallChunks、SSE tool_calls/tool_executions                                                                     |
| `apps/mobile/src/types/index.ts`                                                 | ChatToolPayload、ToolExecutionItem                                                                                                          |
| `src/server/services/mobileChat/index.ts`                                        | MobileChatService、createToolExecutionEvent、normalizeToolCalls、streamToolLoopFallback、partitionToolsByIntervention                       |
| `src/server/services/mobileChat/partitionToolsByIntervention.ts`                 | 按 userInterventionConfig + manifest 分区需批准的工具                                                                                       |
| `src/server/services/mobileChat/resumeStore.ts`                                  | 干预状态存储（TTL 30min）                                                                                                                   |
| `src/app/(backend)/webapi/chat/[provider]/continue/route.ts`                     | POST continue 端点（审批后继续执行）                                                                                                        |

---

## 8. 完整数据流管道（端到端）

### 8.1 实时流式路径（发送消息 → 渲染）

```
1. 用户发送 → chat.sendMessage (chat.ts)
2. 创建 assistant 占位消息 (assistantMsgId)
3. aiChatApi.streamChat() → /webapi/chat/${provider} (api.ts)
4. createSSEChunkParser 解析 SSE
   ├─ event: tool_calls → isChatToolPayloadArray? 直接 onTools(payload)
   │                    : mergeToolCallChunks → transformToolCalls → onTools(accTools)
   └─ event: tool_executions → callbacks.onToolExecutions(payload)
5. chat.ts onTools: mergeToolPayloads(m.tools, tools) → 更新 message.tools
   onToolExecutions: toolExecutionsToPayloads → mergeToolPayloads(m.tools, toolPayloads)
6. 流结束: mergeResolvedToolPayloads(result.tools, result.toolExecutions) → 最终 tools
7. messageApi.create({ tools: resolvedTools }) → 持久化
8. ChatDetailScreen: buildDisplayMessages(messages) → displayMessages
9. MessageBubble: message.tools → ToolCallsBlock → ToolCard (buildToolDisplayProps)
```

### 8.2 历史消息加载路径（拉取已持久化消息）

```
1. messageApi.list(sessionId, topicId) → normalizeMessage (含 tools, plugin)
2. messagesBySession 写入 store
3. buildDisplayMessages(messages):
   a. collapseStandaloneToolMessages: role=tool 消息 → buildToolPayloadFromMessage → 合并到父 assistant.tools
   b. collapseAssistantToolChains: 多轮 assistant 链 → mergeAssistantToolChain → 合并 tools
4. MessageBubble 渲染 ToolCallsBlock / AssistantChainBlock
```

### 8.3 Assistant Chain 中的 tools 合并

**mergeAssistantToolChain**（`messageDisplay.ts` 134–169 行）：

```ts
const mergedTools = messages.reduce(
  (tools, message) => mergeToolPayloadLists(tools, message.tools),
  undefined,
);
```

- 链中每个 assistant 的 `tools` 按顺序通过 `mergeToolPayloadLists` 合并
- `getToolLinkIds` 用 `tool.id`、`tool.result_msg_id` 判定父子关系，决定哪些 assistant 属于同一链

---

## 9. mergeToolPayloads vs mergeToolPayloadLists（已重构）

| 属性        | mergeToolPayloads                                            | mergeToolPayloadLists                                   |
| ----------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| **位置**    | `chatHelpers.ts`                                             | `messageDisplay.ts`                                     |
| **底层**    | 两者均调用 `mergeToolPayloadsCore`（chatHelpers.ts）         |                                                         |
| **用途**    | 流式回调中合并 tools /tool_executions                        | 消息展示流水线（collapse 阶段）                         |
| **options** | `autoApproveOnResult: true`                                  | `autoApproveOnResult: false`                            |
| **调用方**  | chat.ts onTools、onToolExecutions；mergeResolvedToolPayloads | collapseStandaloneToolMessages、mergeAssistantToolChain |

**已修复**：抽成共用 `mergeToolPayloadsCore`，减少重复实现。

---

## 10. 消息展示流水线（buildDisplayMessages）

```
raw messages
  → collapseStandaloneToolMessages
      - role=assistant: 直接推入，记录 assistantIndexById
      - role=tool 且有 parentId: buildToolPayloadFromMessage(message) → mergeToolPayloadLists(parent.tools, [toolPayload])
      - 其他: 直接推入
  → collapseAssistantToolChains
      - 非 assistant: 直接推入
      - assistant 且 tools 为空: 直接推入
      - assistant 且有 tool link ids: 向后扫描 parentId 在链中的 assistant，组成 chain
      - mergeAssistantToolChain(chain) → 合并 content、tools、metadata 等
  → (群聊) buildDisplayMessagesWithGroupTasks
  → displayMessages
```

**getToolLinkIds**：`tools.flatMap(t => [t.id, t.result_msg_id].filter(Boolean))`，用于判断 assistant 之间的「工具链」父子关系。

---

## 11. 干预与批准流程（已实现）

### 11.1 MOBILE_TOOL_INTERVENTION_ENABLED = true

- **ToolCallsBlock** 向 ToolCard 传入 `onApprove`、`onReject`，需 `sessionId`、`topicId`、`assistantMessageId`
- **showIntervention**：`MOBILE_TOOL_INTERVENTION_ENABLED && isPending && BuiltinIntervention`
- **BuiltinIntervention** 已注册（GTD、Notebook、Memory、CloudSandbox），pending 时渲染批准 / 拒绝按钮

### 11.2 干预相关 API 与 Store

- **chat.continueToolIntervention**：调用 `POST /webapi/chat/:provider/continue`，传入 `approvedToolCall`、`sessionId`、`topicId`，流式更新 tools
- **chat.rejectToolCall**：本地更新 `intervention.status = 'rejected'`
- **chat.approveToolCall**：tRPC，群聊等场景；单聊使用 `continueToolIntervention`

### 11.3 后端实现

1. **MobileChatService**：`partitionToolsByIntervention` 根据 `userInterventionConfig` + manifest 分区工具
2. 需人工批准的 tools 不执行，emit `tool_calls`（含 `intervention: { status: 'pending' }`）、`intervention_required`
3. 状态存入 `resumeStore`（in-memory，TTL 30min）
4. `POST /webapi/chat/:provider/continue`：执行 approved tool，若有剩余 pending 则再次 emit intervention_required，否则继续 LLM 循环

---

## 12. 错误处理

### 12.1 工具执行错误展示

| 组件                | error 来源                                             | 展示                                       |
| ------------------- | ------------------------------------------------------ | ------------------------------------------ |
| **ToolResultBlock** | `message.pluginError`                                  | 传给 ToolCard `error` prop，展开时红色文案 |
| **ToolCallsBlock**  | `tool.pluginError`（来自 buildToolPayloadFromMessage） | 传给 ToolCard `error` prop，展开时红色文案 |

**ToolResultBlock** 用于未合并的 `role: tool` 消息（如孤儿消息），接收完整 message，可拿到 `pluginError`。**ToolCallsBlock** 用于 assistant 的 `tools[]`，collapse 时 `buildToolPayloadFromMessage` 将 `message.pluginError` 映射到 `tool.pluginError`。

### 12.2 pluginError 与 normalizeMessage（已修复）

- `normalizeMessage` 将 `pluginError`、`plugin_error` 映射到消息
- **buildToolPayloadFromMessage** 已映射 `pluginError` 到 payload，ToolCallsBlock 将 `tool.pluginError` 作为 `error` 传给 ToolCard
- **collapseStandaloneToolMessages** 中，tool 消息的 `content` 可能为错误文本，作为 `result_content` 传入

### 12.3 流式解析失败

- **safeParseJsonRecord**：`JSON.parse` 失败返回 `{}`，params 为空
- **formatToolArguments**：解析失败则退回原始字符串展示
- **mergeToolCallChunks**：不完整 JSON 会字符串拼接，可能产生非法 JSON

---

## 13. 边缘场景与健壮性

| 场景                                                | 行为                                                   | 潜在问题                    |
| --------------------------------------------------- | ------------------------------------------------------ | --------------------------- |
| tools 空数组                                        | ToolCallsBlock 不渲染                                  | -                           |
| tool.id 重复                                        | merge 以 key 覆盖，后者胜出                            | 多轮同 id 可能丢数据        |
| tool.arguments 非 JSON                              | safeParseJsonRecord → {}；formatToolArguments 退回原串 | 展示可能不理想              |
| 流式中途断开                                        | accTools 为最后一帧状态                                | 可能缺 tool_executions 覆盖 |
| 多轮 tool loop（多组 tool_calls + tool_executions） | 每次 onTools/onToolExecutions 均 merge                 | 若 id 冲突需确认顺序        |
| BuiltinRender 返回 null                             | ToolCard 仍展示 argumentsText、content                 | 若 arguments 空则仅 status  |
| content 超 500 字                                   | truncatedContent + 展开 / 收起                         | -                           |

---

## 14. RN 内置工具干预 / 流式矩阵 ✅ 已对齐 Web

| identifier               | Intervention                                                       | Streaming                                             |
| ------------------------ | ------------------------------------------------------------------ | ----------------------------------------------------- |
| lobe-gtd                 | createPlan, createTodos                                            | createPlan, execTask, execTasks                       |
| lobe-notebook            | createDocument                                                     | createDocument                                        |
| lobe-user-memory         | addExperienceMemory                                                | addExperienceMemory, addPreferenceMemory              |
| lobe-cloud-sandbox       | executeCode                                                        | executeCode                                           |
| lobe-source-set          | -                                                                  | searchSourceSet                                       |
| lobe-web-browsing        | -                                                                  | search                                                |
| lobe-skill-store         | -                                                                  | searchSkill                                           |
| lobe-skills              | -                                                                  | searchSkill                                           |
| lobe-group-management    | executeAgentTask, executeAgentTasks（GenericFallbackIntervention） | broadcast, speak, executeAgentTask, executeAgentTasks |
| lobe-agent-builder       | installPlugin（GenericFallbackIntervention）                       | 通用（GenericFallbackStreaming）                      |
| lobe-agent-management    | -                                                                  | 通用                                                  |
| lobe-group-agent-builder | -                                                                  | 通用                                                  |
| lobe-local-system        | 全 API（GenericFallbackIntervention）                              | 通用                                                  |
| lobe-calculator          | -                                                                  | -                                                     |

**Calculator** 无 Streaming，通常快速完成。

---

## 15. i18n 与可访问性

### 15.1 工具相关 i18n 键

`chatToolsTitle`, `chatToolRunning`, `chatToolDone`, `chatToolFailed`, `chatToolArguments`, `chatToolCompleted`, `chatToolPending`, `chatToolRejected`, `chatToolResponse`, `chatToolAborted`, `chatToolApprove`, `chatToolReject`, `chatToolPendingDesc`, `chatToolRejectedDesc`, `chatToolAbortedDesc`，以及各内置工具的 placeholder、streaming 文案。

### 15.2 可访问性（✅ 已修复）

- ToolCard 使用 TouchableOpacity，支持 `onPress` 展开 / 收起
- ToolCard 主卡片：`accessibilityLabel` 含标题与「点击展开 / 收起」提示
- 折叠时 `numberOfLines={2}` 截断的 argumentsText：`accessibilityLabel` 为「参数，点击展开」
- 复制按钮：`accessibilityLabel={t.msgActionCopy}`（复用消息操作栏「复制」）

---

## 16. 测试覆盖

- **chatHelpers**: `mergeToolPayloadsCore`、`mergeToolPayloads`、`toolExecutionsToPayloads`、`mergeResolvedToolPayloads` 已有单测（`chatHelpers.test.ts`）
- **messageDisplay**: `buildDisplayMessages`、`getAssistantChainActionMessageId` 已有单测（`messageDisplay.test.ts`）
- **toolCallUtils**: `isChatToolPayloadArray`、`mergeToolCallChunks`、`transformToolCalls` 已有单测（`toolCallUtils.test.ts`，由 api.ts 抽离）
- **MessageBubble ToolCallsBlock/ToolCard**: 无组件测试

---

## 17. 优先级建议（按 P0 → P3）

| 优先级     | 问题                                                    | 建议                                                           |
| ---------- | ------------------------------------------------------- | -------------------------------------------------------------- |
| ~~**P0**~~ | ~~tool_calls 格式不匹配（streamToolLoopFallback）~~     | ✅ 已修复：api.ts 检测 ChatToolPayload \[]                     |
| ~~**P1**~~ | ~~formatToolDisplayTitle 只取第一个参数~~               | ✅ 已修复：slice (0, 3)                                        |
| **P1**     | 折叠时 argumentsText 截断                               | 考虑摘要优化或点击展开                                         |
| ~~**P2**~~ | ~~mergeToolPayloads 与 mergeToolPayloadLists 重复实现~~ | ✅ 已修复：mergeToolPayloadsCore                               |
| ~~**P2**~~ | ~~工具错误展示路径不清晰~~                              | ✅ 已修复：buildToolPayloadFromMessage 映射 pluginError        |
| ~~**P3**~~ | ~~messageDisplay、chatHelpers、api 无单测~~             | ✅ 已修复：单测已补充                                          |
| ~~**P3**~~ | ~~启用干预时需传入 onApprove/onReject~~                 | ✅ 已修复：MOBILE_TOOL_INTERVENTION_ENABLED=true，continue API |

---

## 18. Web vs RN 工具调用深度对比

### 18.1 整体架构

| 维度             | Web                                                                                         | RN                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| **API 入口**     | tRPC `sendMessageInServer` + 客户端 `execAgentRuntime`（fetch-sse、model-runtime protocol） | HTTP `POST /webapi/chat/${provider}`（MobileChatService）                                               |
| **工具执行位置** | 客户端 Agent Runtime（可暂停等待批准）                                                      | 服务端 MobileChatService（~~自动执行，无批准~~ ✅ 支持干预，需批准时暂停并 emit intervention_required） |
| **Store**        | ChatStore（`dbMessagesMap`、`operations`）、ConversationStore、useChatStore                 | 本地 useChatStore（`messagesBySession`），无 operations                                                 |
| **消息结构**     | `conversation-flow` 解析为 `assistantGroup`，含 `children[]`、每个 child 有 `tools`         | 扁平 `message.tools`，`collapseStandaloneToolMessages`、`collapseAssistantToolChains` 做合并            |
| **工具结果来源** | 每条 tool 对应独立 `role: tool` 消息，由 FlatListBuilder 合并为 `toolsWithResults`          | 服务端 `tool_executions` 事件一次性返回，或从持久化 `message.plugin` 构建                               |

### 18.2 数据流对比

**Web 工具数据流**：

```
LLM stream → tool_calls (MessageToolCall[])
  → internal_transformToolCalls (ToolNameResolver + manifestMap)
  → ChatToolPayload[] 写入 optimistic message
  → step_start phase=human_approval（可选）→ 等待批准
  → 批准后 execAgentRuntime 执行 → 创建 role:tool 消息
  → refreshMessages → parse (conversation-flow)
  → FlatListBuilder 合并 assistant + tool 消息 → assistantGroup.children[].tools (ChatToolPayloadWithResult[])
  → ContentBlock → Tools → Tool (Detail)
```

**RN 工具数据流**：

```
SSE tool_calls (或 tool_executions)
  → mergeToolCallChunks + transformToolCalls（或 toolExecutionsToPayloads）
  → onTools / onToolExecutions → mergeToolPayloads → message.tools
  → messageApi.create({ tools }) 持久化
  → buildDisplayMessages (collapseStandaloneToolMessages, collapseAssistantToolChains)
  → MessageBubble → ToolCallsBlock → ToolCard
```

### 18.3 组件层级对比

| 层级         | Web                                                                  | RN                                                                             |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **列表**     | VirtualizedList → MessageItem                                        | FlashList → MessageBubble                                                      |
| **消息聚合** | assistantGroup（conversation-flow）                                  | 无；单条 assistant 或 collapse 后的链                                          |
| **工具容器** | `Tools`（Flexbox gap=8）                                             | `ToolCallsBlock`（可折叠区块）                                                 |
| **单工具**   | `Tool`（Accordion + Detail）                                         | `ToolCard`（TouchableOpacity 展开 / 收起）                                     |
| **详情渲染** | Detail → Intervention / ToolRender / LoadingPlaceholder              | ToolCard → BuiltinRender / content / argumentsText                             |
| **参数编辑** | Intervention（KeyValueEditor、BuiltinIntervention、ApprovalActions） | ✅ MOBILE_TOOL_INTERVENTION_ENABLED=true，GenericFallbackIntervention 展示参数 |

### 18.4 工具名称与参数解析

| 环节               | Web                                                                                                      | RN                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **transform**      | `internal_transformToolCalls`：ToolNameResolver + 全量 manifest（plugin、builtin、klavis、lobehubSkill） | `transformToolCalls` 或 `isChatToolPayloadArray` 直接使用 ChatToolPayload \[]（✅ P0 已修复） |
| **arguments**      | 来自 MessageToolCall，JSON 字符串                                                                        | `toolCall.function?.arguments` 或 `exec.arguments` 或 ChatToolPayload.arguments               |
| ~~**格式不匹配**~~ | ~~streamToolLoopFallback 发 ChatToolPayload \[]，RN 期望 function.name/arguments~~                       | ✅ 已修复：api.ts 检测并直接使用 ChatToolPayload \[]                                          |

### 18.5 批准与干预 ✅ 已实现

| 能力                  | Web                                                                               | RN                                                                    |
| --------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **pending 状态**      | `intervention?.status === 'pending'` → 展示 Intervention                          | ~~MOBILE_TOOL_INTERVENTION_ENABLED=false~~ ✅ true，展示 Intervention |
| **ApprovalActions**   | 批准、拒绝、拒绝并继续、allow-list 记忆                                           | ✅ chat.continueToolIntervention、chat.rejectToolCall                 |
| **Intervention 组件** | Fallback（JSON 编辑）、BuiltinIntervention（GTD、Notebook、Memory、CloudSandbox） | ✅ GenericFallbackIntervention + GTD/Notebook/Memory/CloudSandbox 等  |
| **参数编辑**          | `updatePluginArguments`、`waitForPendingArgsUpdate`                               | GenericFallbackIntervention 展示参数（编辑待接入 onArgsChange）       |
| **继续生成**          | `rejectAndContinueToolCall`                                                       | ✅ POST /webapi/chat/:provider/continue                               |

### 18.6 参数与结果渲染

| 场景                | Web                                                         | RN                                                               |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **流式中无 result** | 有 StreamingRenderer → 展示；无则 `return null`，参数不展示 | 有 BuiltinStreaming → 展示；无则 ToolCard 仍展示 `argumentsText` |
| **params 摘要**     | ArgumentRender / ToolRender 内部实现                        | `formatToolDisplayTitle` 已改为 `slice(0, 3)`                    |
| **完整 JSON**       | KeyValueEditor、ArgumentRender                              | `formatToolArguments` 美化 JSON，折叠时 `numberOfLines={2}`      |
| **BuiltinRender**   | `getBuiltinRender`（packages/builtin-tools）                | `getMobileBuiltinRender`（apps/mobile BuiltinTools）             |
| **无 Render 时**    | ArgumentRender（KeyValue 表格）                             | content + argumentsText 纯文本                                   |

### 18.7 错误处理

| 来源                   | Web                                                                  | RN                                                                           |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **tool 消息 error**    | `toolMsg.error`、`toolMsg.pluginError` → `result.error` → ToolRender | buildToolPayloadFromMessage 映射 pluginError；ToolResultBlock 传 pluginError |
| **assistant 嵌 tools** | FlatListBuilder 合并 toolMsg，有 error 时写入 result                 | ✅ ToolCallsBlock 传 error={tool.pluginError}                                |
| **展示**               | ToolRender 可接收 result.error                                       | ToolCard error prop 两路径均传入                                             |

### 18.8 消息持久化

| 环节               | Web                                             | RN                                                 |
| ------------------ | ----------------------------------------------- | -------------------------------------------------- |
| **assistant 消息** | tools 在 message 顶层级，与 content 一同持久化  | messageApi.create({ tools: resolvedTools })        |
| **tool 消息**      | 每条 tool 一条 role:tool 消息，plugin=payload   | collapse 时从 plugin 构建；独立 tool 消息有 plugin |
| **合并策略**       | conversation-flow 从 db 消息构建 assistantGroup | collapseStandaloneToolMessages 合并 tool→assistant |

### 18.9 内置工具对比（细化）

**RN Intervention 列「❌」含义**：

- **与 Web 一致无专用 Builtin**：`knowledge-base`、`skill-store`、`skills`、`web-browsing`、`calculator` 等在 `packages/builtin-tools` 的 `BuiltinToolInterventions` 中**无注册**；RN 同样无专用组件。若需人工批准，Web 走通用 Fallback（JSON），非 per-tool 表单。
- **有意简化（工程取舍）**：`installPlugin`、`executeAgentTask(s)`、`local-system` 各 API 在 RN 使用 **GenericFallbackIntervention**（参数 JSON + 批准 / 拒绝），未移植 Web 的 antd /agentGroup 等富表单；**流程**与 Web 对齐，**UI** 非像素级对齐。
- **待补小缺口**：Web GTD 有 `clearTodos` 的 Intervention，RN 若 manifest 对该 API 开人工批准，可补注册 **ClearTodos** 与 Web 对齐。

| identifier               | Web | RN Render | RN Streaming                                          | RN Intervention                                                      |
| ------------------------ | --- | --------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| lobe-agent-builder       | ✅  | ✅ 通用   | ✅ 通用 (GenericFallbackStreaming)                    | ✅ installPlugin (GenericFallbackIntervention)                       |
| lobe-agent-management    | ✅  | ✅ 通用   | ✅ 通用 (GenericFallbackStreaming)                    | ❌ (Web 无 intervention)                                             |
| lobe-cloud-sandbox       | ✅  | ✅        | ✅ executeCode                                        | ✅ executeCode                                                       |
| lobe-group-agent-builder | ✅  | ✅ 通用   | ✅ 通用 (GenericFallbackStreaming)                    | ❌ (Web 无 intervention)                                             |
| lobe-group-management    | ✅  | ✅        | broadcast, speak, executeAgentTask, executeAgentTasks | ✅ executeAgentTask, executeAgentTasks (GenericFallbackIntervention) |
| lobe-gtd                 | ✅  | ✅        | createPlan, execTask, execTasks                       | createPlan, createTodos                                              |
| lobe-source-set          | ✅  | ✅        | searchSourceSet                                       | ❌                                                                   |
| lobe-local-system        | ✅  | ✅ 通用   | ✅ 通用 (GenericFallbackStreaming)                    | ✅ 全 API (GenericFallbackIntervention)                              |
| lobe-user-memory         | ✅  | ✅        | addExperience, addPreference                          | addExperienceMemory                                                  |
| lobe-notebook            | ✅  | ✅        | createDocument                                        | createDocument                                                       |
| lobe-skill-store         | ✅  | ✅        | searchSkill                                           | ❌                                                                   |
| lobe-skills              | ✅  | ✅        | searchSkill                                           | ❌                                                                   |
| lobe-web-browsing        | ✅  | ✅        | search                                                | ❌                                                                   |
| lobe-calculator          | -   | ✅        | ❌                                                    | ❌                                                                   |

**RN 通用**：

- **Render**：AgentBuilder、AgentManagement、GroupAgentBuilder、LocalSystem 使用 GenericFallbackRender 展示 arguments + result。
- **Streaming**：agent-builder、agent-management、group-agent-builder、local-system、group-management（executeAgentTask/executeAgentTasks）使用 GenericFallbackStreaming 占位（执行中显示「执行中…」）。
- **Intervention**：agent-builder（installPlugin）、group-management（executeAgentTask/executeAgentTasks）、local-system（全部需批准的 API）使用 GenericFallbackIntervention 展示参数并支持批准 / 拒绝。

### 18.10 对齐建议汇总

1. ~~**P0 格式**：RN 检测 ChatToolPayload \[]~~ ✅ 已修复
2. ~~**参数摘要**：RN 改为 slice (0, 3)~~ ✅ 已修复
3. **流式无 Render**：决策 RN 是否与 Web 一致（无 Streaming 时暂不展示参数）或保持现状
4. ~~**错误展示**：ToolCallsBlock 补充 error 流入路径~~ ✅ 已修复（pluginError → tool）
5. ~~**干预启用**：若开启 RN 批准，需接 `/webapi/chat` 的人为批准~~ ✅ 已实现（continue API）
