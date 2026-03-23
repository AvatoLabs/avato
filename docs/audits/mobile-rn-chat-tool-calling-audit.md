# React Native Mobile App Chat 工具调用审计报告

**审计日期**: 2025-03-23\
**审计范围**: `apps/mobile`（React Native / Expo 原生应用）\
**区分**: 与 `src/routes/(mobile)/`（移动 Web SPA）为两套独立实现\
**版本**: 深度审计 v2（全面覆盖数据流、合并逻辑、消息展示、干预、错误处理与边缘场景）

**修复状态** (2025-03-23):

| 优先级 | 问题                                            | 状态                                                                              |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| P0     | tool_calls 格式不匹配（streamToolLoopFallback） | ✅ 已修复：api.ts 检测 ChatToolPayload \[] 直接使用                               |
| P1     | formatToolDisplayTitle 只取第一个参数           | ✅ 已修复：改为 slice (0, 3)                                                      |
| P1     | CompareGroupBlock 引用链接不渲染                | ✅ 已修复：传入 markdownRules（见 mobile-citation-links-audit）                   |
| P2     | mergeToolPayloads 与 mergeToolPayloadLists 重复 | ✅ 已修复：抽成 mergeToolPayloadsCore                                             |
| P2     | 工具错误展示路径不清晰                          | ✅ 已修复：buildToolPayloadFromMessage 映射 pluginError，ToolCard 接收 error prop |
| P3     | chatHelpers 无单测                              | ✅ 已修复：apps/mobile/src/store/chatHelpers.test.ts                              |
| P3     | 启用干预时需传入 onApprove/onReject             | ⏸️ 预留（MOBILE_TOOL_INTERVENTION_ENABLED=false 时无影响）                        |

---

## 1. 架构概览

### 1.1 React Native vs 移动 Web

| 项目     | React Native App (`apps/mobile`)                   | 移动 Web SPA (`src/routes/(mobile)/`)                |
| -------- | -------------------------------------------------- | ---------------------------------------------------- |
| 入口     | `apps/mobile/App.tsx`                              | `src/spa/entry.mobile.tsx`                           |
| 路由     | React Navigation                                   | React Router                                         |
| Chat UI  | `MessageBubble.tsx`, `ToolCallsBlock`, `ToolCard`  | 复用 Web `ConversationArea`                          |
| API      | `/webapi/chat/${provider}` (MobileChatService)     | tRPC `sendMessageInServer` + 客户端 execAgentRuntime |
| 工具批准 | `MOBILE_TOOL_INTERVENTION_ENABLED = false`（禁用） | 支持                                                 |

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

**现状**: 多参数工具（如 `searchKnowledgeBase` 的 `query`、`spaceId`）在摘要中展示前 3 个参数，其余依赖 `formatToolArguments` 的完整 JSON。

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

- **内置工具**：RN 缺 AgentBuilder、AgentManagement、GroupAgentBuilder、LocalSystem
- **批准**：RN 禁用，Web 支持完整干预流程
- **流式参数**：Web 无 StreamingRenderer 时 `return null`；RN 仍展示 argumentsText

---

## 5. 问题汇总与建议

### 5.1 参数细节未渲染

| 编号 | 问题                               | 位置                                                | 建议                                      |
| ---- | ---------------------------------- | --------------------------------------------------- | ----------------------------------------- |
| P1   | params 仅展示第一个参数            | `formatToolDisplayTitle`                            | 增加 `slice(0, 3)` 或提供「显示全部」入口 |
| P2   | `tool.arguments` 缺失时仅剩 `'{}'` | `transformToolCalls`、`buildToolPayloadFromMessage` | 校验服务端是否始终返回 `arguments`        |
| P3   | 折叠时 `numberOfLines={2}` 截断    | ToolCard                                            | 保留折叠时的摘要，或支持点击展开参数      |

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

### 6.1 tool_calls 事件格式不匹配（P0）

**问题**：`streamToolLoopFallback` 发送的 `tool_calls` 使用 `ChatToolPayload[]`，而 RN 期望 `MobileToolCallChunk[]`。

| 来源                                                   | 格式                    | 字段                                                 |
| ------------------------------------------------------ | ----------------------- | ---------------------------------------------------- |
| 服务端 `writeEvent('tool_calls', normalizedToolCalls)` | `ChatToolPayload[]`     | `apiName`, `arguments`, `identifier`, `id`（顶层级） |
| RN `mergeToolCallChunks` / `transformToolCalls`        | `MobileToolCallChunk[]` | `function.name`, `function.arguments`, `id`          |

**位置**：

- 服务端：`src/server/services/mobileChat/index.ts` 约 894 行
- RN：`apps/mobile/src/lib/api.ts` 约 533–643 行

**影响**：当 RN 收到 `ChatToolPayload[]` 时，`transformToolCalls` 会取 `toolCall.function?.arguments` 为 `undefined`，最终使用 `'{}'`；`function?.name` 为 `undefined`，退化为 `tool_1` 等占位名。参数与工具名在 `tool_calls` 阶段均错误。

**缓解**：`tool_executions` 随后到达，`mergeToolPayloads` 会用 `toolExecutionsToPayloads` 的结果覆盖，最终展示正确。但 `tool_calls` 到 `tool_executions` 之间会短暂显示错误（参数空、名称占位）。

**修复建议**：在 `tool_calls` 分支判断 `chunk.data` 是否为 `ChatToolPayload[]`（存在 `apiName` / `arguments` 顶层级），若是则直接作为 `ChatToolPayload[]` 传给 `onTools`，跳过 `mergeToolCallChunks` 与 `transformToolCalls`。

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

### 6.4 Web vs RN 内置工具矩阵

| identifier               | apiName 示例                                               | Web Render | RN Render | RN Streaming                             |
| ------------------------ | ---------------------------------------------------------- | ---------- | --------- | ---------------------------------------- |
| lobe-agent-builder       | -                                                          | ✅         | ❌ 未注册 | ❌                                       |
| lobe-agent-management    | -                                                          | ✅         | ❌ 未注册 | ❌                                       |
| lobe-cloud-sandbox       | executeCode                                                | ✅         | ✅        | ✅                                       |
| lobe-group-agent-builder | -                                                          | ✅         | ❌ 未注册 | ❌                                       |
| lobe-group-management    | broadcast, speak                                           | ✅         | ✅        | ❌                                       |
| lobe-gtd                 | createPlan, execTask, execTasks, ...                       | ✅         | ✅        | createPlan, execTask, execTasks          |
| lobe-knowledge-base      | searchKnowledgeBase                                        | ✅         | ✅        | ✅                                       |
| lobe-local-system        | -                                                          | ✅         | ❌ 未注册 | ❌                                       |
| lobe-user-memory         | addExperienceMemory, addPreferenceMemory, searchUserMemory | ✅         | ✅        | addExperienceMemory, addPreferenceMemory |
| lobe-notebook            | createDocument                                             | ✅         | ✅        | ✅                                       |
| lobe-skill-store         | searchSkill                                                | ✅         | ✅        | ✅                                       |
| lobe-skills              | searchSkill                                                | ✅         | ✅        | ✅                                       |
| lobe-web-browsing        | search                                                     | ✅         | ✅        | ✅                                       |
| lobe-calculator          | evaluate, execute, ...                                     | -          | ✅        | ❌（计算器通常无流式）                   |

**RN 缺失**：AgentBuilder、AgentManagement、GroupAgentBuilder、LocalSystem。这些在 RN 上会退回到 `ToolCard` + `argumentsText`，若 `arguments` 缺失则参数不展示。

### 6.5 消息持久化

**结论**：工具参数会被正确持久化。

- **数据库**：`packages/database/src/models/message.ts` 中 `message.create` 将 `plugin: chatToolPayload` 存入，`plugin.arguments` 随 payload 一起持久化
- **collapseStandaloneToolMessages**：从 `role: 'tool'` 消息的 `message.plugin` 构建 `buildToolPayloadFromMessage`，并合并到父 assistant 的 `tools[]`
- **buildToolPayloadFromMessage**：`arguments: message.plugin?.arguments || '{}'`，当 `plugin` 缺失或 `arguments` 为空时退化为 `'{}'`；依赖入库时写入完整 `plugin`

---

## 7. 文件索引

| 路径                                                  | 职责                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `apps/mobile/src/components/ui/MessageBubble.tsx`     | ToolCallsBlock、ToolCard、buildToolDisplayProps、formatToolArguments                    |
| `apps/mobile/src/features/BuiltinTools/index.ts`      | BUILTIN_RENDERS、getMobileBuiltinRender                                                 |
| `apps/mobile/src/features/BuiltinTools/streamings.ts` | BUILTIN_STREAMINGS、getMobileBuiltinStreaming                                           |
| `apps/mobile/src/store/messageDisplay.ts`             | mergeToolPayloadLists、buildToolPayloadFromMessage、collapseStandaloneToolMessages      |
| `apps/mobile/src/store/chatHelpers.ts`                | toolExecutionsToPayloads、mergeToolPayloads、mergeResolvedToolPayloads                  |
| `apps/mobile/src/lib/api.ts`                          | transformToolCalls、mergeToolCallChunks、SSE tool_calls/tool_executions                 |
| `apps/mobile/src/types/index.ts`                      | ChatToolPayload、ToolExecutionItem                                                      |
| `src/server/services/mobileChat/index.ts`             | MobileChatService、createToolExecutionEvent、normalizeToolCalls、streamToolLoopFallback |

---

## 8. 完整数据流管道（端到端）

### 8.1 实时流式路径（发送消息 → 渲染）

```
1. 用户发送 → chat.sendMessage (chat.ts)
2. 创建 assistant 占位消息 (assistantMsgId)
3. aiChatApi.streamChat() → /webapi/chat/${provider} (api.ts)
4. createSSEChunkParser 解析 SSE
   ├─ event: tool_calls → mergeToolCallChunks(rawToolCalls, payload)
   │                    → transformToolCalls(rawToolCalls) → accTools
   │                    → callbacks.onTools(accTools)
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

## 11. 干预与批准流程（当前禁用）

### 11.1 MOBILE_TOOL_INTERVENTION_ENABLED = false

- **ToolCallsBlock** 不向 ToolCard 传入 `onApprove`、`onReject`，批准 / 拒绝按钮永不渲染
- **showIntervention**：`MOBILE_TOOL_INTERVENTION_ENABLED && isPending && BuiltinIntervention` → 恒为 false
- **BuiltinIntervention** 已注册（GTD、Notebook、Memory、CloudSandbox），但 never 渲染

### 11.2 干预相关 API 与 Store

- **chatToolApi.approveToolCall**、**rejectToolCall**：tRPC 调用，RN 端存在
- **chat.approveToolCall**：调用 chatToolApi，用于群聊等场景；单聊 `/webapi/chat` 不触发
- **chat.rejectToolCall** / **rejectToolMessage**：本地更新 `intervention.status = 'rejected'`，不调用服务端

### 11.3 启用干预时需补齐

1. ToolCallsBlock 在 `MOBILE_TOOL_INTERVENTION_ENABLED` 时传入 `onApprove`、`onReject`，并需 `toolMessageId` / `toolCallId` 以调用 API
2. `/webapi/chat` 当前工具自动执行，如需人工批准需改服务端或改用 tRPC chat 路径

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

## 14. RN 内置工具干预 / 流式矩阵（补充）

| identifier            | Intervention            | Streaming                                |
| --------------------- | ----------------------- | ---------------------------------------- |
| lobe-gtd              | createPlan, createTodos | createPlan, execTask, execTasks          |
| lobe-notebook         | createDocument          | createDocument                           |
| lobe-user-memory      | addExperienceMemory     | addExperienceMemory, addPreferenceMemory |
| lobe-cloud-sandbox    | executeCode             | executeCode                              |
| lobe-knowledge-base   | -                       | searchKnowledgeBase                      |
| lobe-web-browsing     | -                       | search                                   |
| lobe-skill-store      | -                       | searchSkill                              |
| lobe-skills           | -                       | searchSkill                              |
| lobe-group-management | -                       | -                                        |
| lobe-calculator       | -                       | -                                        |

**GroupManagement** 无 Streaming，执行中显示通用状态；**Calculator** 无 Streaming，通常快速完成。

---

## 15. i18n 与可访问性

### 15.1 工具相关 i18n 键

`chatToolsTitle`, `chatToolRunning`, `chatToolDone`, `chatToolFailed`, `chatToolArguments`, `chatToolCompleted`, `chatToolPending`, `chatToolRejected`, `chatToolResponse`, `chatToolAborted`, `chatToolApprove`, `chatToolReject`, `chatToolPendingDesc`, `chatToolRejectedDesc`, `chatToolAbortedDesc`，以及各内置工具的 placeholder、streaming 文案。

### 15.2 可访问性

- ToolCard 使用 TouchableOpacity，支持 `onPress` 展开 / 收起
- `numberOfLines={2}` 截断时无 `accessibilityLabel` 说明
- 复制按钮无明确 a11y 标签

---

## 16. 测试覆盖

- **chatHelpers**: `mergeToolPayloadsCore`、`mergeToolPayloads`、`toolExecutionsToPayloads`、`mergeResolvedToolPayloads` 已有单测（`chatHelpers.test.ts`）
- **messageDisplay**: `mergeToolPayloadLists`、`collapseStandaloneToolMessages`、`collapseAssistantToolChains` 无单测
- **api.ts**: `transformToolCalls`、`mergeToolCallChunks` 无单测
- **MessageBubble ToolCallsBlock/ToolCard**: 无组件测试

---

## 17. 优先级建议（按 P0 → P3）

| 优先级 | 问题                                                | 建议                                                                                        |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **P0** | tool_calls 格式不匹配（streamToolLoopFallback）     | 在 tool_calls 分支检测 ChatToolPayload \[]，若匹配则直接传 onTools，跳过 transformToolCalls |
| **P1** | formatToolDisplayTitle 只取第一个参数               | 改为 slice (0, 3) 或提供「全部参数」入口                                                    |
| **P1** | 折叠时 argumentsText 截断                           | 考虑摘要优化或点击展开                                                                      |
| **P2** | mergeToolPayloads 与 mergeToolPayloadLists 重复实现 | 抽成共用函数，减少分支                                                                      |
| **P2** | 工具错误展示路径不清晰                              | 明确 pluginError/result_content 流入 ToolCard 的路径，补全 error prop                       |
| **P3** | messageDisplay、chatHelpers、api 无单测             | 为关键合并与转换逻辑补充单测                                                                |
| **P3** | 启用干预时需传入 onApprove/onReject                 | 预留或实现干预分支，避免后续改动过大                                                        |

---

## 18. Web vs RN 工具调用深度对比

### 18.1 整体架构

| 维度             | Web                                                                                         | RN                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **API 入口**     | tRPC `sendMessageInServer` + 客户端 `execAgentRuntime`（fetch-sse、model-runtime protocol） | HTTP `POST /webapi/chat/${provider}`（MobileChatService）                                    |
| **工具执行位置** | 客户端 Agent Runtime（可暂停等待批准）                                                      | 服务端 MobileChatService（自动执行，无批准）                                                 |
| **Store**        | ChatStore（`dbMessagesMap`、`operations`）、ConversationStore、useChatStore                 | 本地 useChatStore（`messagesBySession`），无 operations                                      |
| **消息结构**     | `conversation-flow` 解析为 `assistantGroup`，含 `children[]`、每个 child 有 `tools`         | 扁平 `message.tools`，`collapseStandaloneToolMessages`、`collapseAssistantToolChains` 做合并 |
| **工具结果来源** | 每条 tool 对应独立 `role: tool` 消息，由 FlatListBuilder 合并为 `toolsWithResults`          | 服务端 `tool_executions` 事件一次性返回，或从持久化 `message.plugin` 构建                    |

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

| 层级         | Web                                                                  | RN                                                 |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------- |
| **列表**     | VirtualizedList → MessageItem                                        | FlashList → MessageBubble                          |
| **消息聚合** | assistantGroup（conversation-flow）                                  | 无；单条 assistant 或 collapse 后的链              |
| **工具容器** | `Tools`（Flexbox gap=8）                                             | `ToolCallsBlock`（可折叠区块）                     |
| **单工具**   | `Tool`（Accordion + Detail）                                         | `ToolCard`（TouchableOpacity 展开 / 收起）         |
| **详情渲染** | Detail → Intervention / ToolRender / LoadingPlaceholder              | ToolCard → BuiltinRender / content / argumentsText |
| **参数编辑** | Intervention（KeyValueEditor、BuiltinIntervention、ApprovalActions） | MOBILE_TOOL_INTERVENTION_ENABLED=false，无编辑     |

### 18.4 工具名称与参数解析

| 环节           | Web                                                                                                      | RN                                                                                                    |     |                             |
| -------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --- | --------------------------- |
| **transform**  | `internal_transformToolCalls`：ToolNameResolver + 全量 manifest（plugin、builtin、klavis、lobehubSkill） | `transformToolCalls`：从 `function.name` 解析 `identifier/apiName`（`/` 或 `____` 分隔），无 manifest |     |                             |
| **arguments**  | 来自 MessageToolCall，JSON 字符串                                                                        | \`toolCall.function?.arguments                                                                        |     | '{}'`，或 `exec.arguments\` |
| **格式不匹配** | 无；Web 协议统一                                                                                         | streamToolLoopFallback 发 ChatToolPayload \[]，RN 期望 function.name/arguments → P0 问题              |     |                             |

### 18.5 批准与干预

| 能力                  | Web                                                                               | RN                                                       |
| --------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **pending 状态**      | `intervention?.status === 'pending'` → 展示 Intervention                          | MOBILE_TOOL_INTERVENTION_ENABLED=false，never 展示       |
| **ApprovalActions**   | 批准、拒绝、拒绝并继续、allow-list 记忆                                           | chatToolApi 存在但不触发                                 |
| **Intervention 组件** | Fallback（JSON 编辑）、BuiltinIntervention（GTD、Notebook、Memory、CloudSandbox） | BUILTIN_INTERVENTIONS 已注册但 showIntervention 恒 false |
| **参数编辑**          | `updatePluginArguments`、`waitForPendingArgsUpdate`                               | 无                                                       |
| **继续生成**          | `rejectAndContinueToolCall`                                                       | 无                                                       |

### 18.6 参数与结果渲染

| 场景                | Web                                                         | RN                                                               |
| ------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------- |
| **流式中无 result** | 有 StreamingRenderer → 展示；无则 `return null`，参数不展示 | 有 BuiltinStreaming → 展示；无则 ToolCard 仍展示 `argumentsText` |
| **params 摘要**     | ArgumentRender / ToolRender 内部实现                        | `formatToolDisplayTitle` 仅 `slice(0, 1)` 第一个参数             |
| **完整 JSON**       | KeyValueEditor、ArgumentRender                              | `formatToolArguments` 美化 JSON，折叠时 `numberOfLines={2}`      |
| **BuiltinRender**   | `getBuiltinRender`（packages/builtin-tools）                | `getMobileBuiltinRender`（apps/mobile BuiltinTools）             |
| **无 Render 时**    | ArgumentRender（KeyValue 表格）                             | content + argumentsText 纯文本                                   |

### 18.7 错误处理

| 来源                   | Web                                                                  | RN                                                                           |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **tool 消息 error**    | `toolMsg.error`、`toolMsg.pluginError` → `result.error` → ToolRender | buildToolPayloadFromMessage 映射 pluginError；ToolResultBlock 传 pluginError |
| **assistant 嵌 tools** | FlatListBuilder 合并 toolMsg，有 error 时写入 result                 | ToolCallsBlock 传 error={tool.pluginError}（已修复）                         |
| **展示**               | ToolRender 可接收 result.error                                       | ToolCard error prop 两路径均传入                                             |

### 18.8 消息持久化

| 环节               | Web                                             | RN                                                 |
| ------------------ | ----------------------------------------------- | -------------------------------------------------- |
| **assistant 消息** | tools 在 message 顶层级，与 content 一同持久化  | messageApi.create({ tools: resolvedTools })        |
| **tool 消息**      | 每条 tool 一条 role:tool 消息，plugin=payload   | collapse 时从 plugin 构建；独立 tool 消息有 plugin |
| **合并策略**       | conversation-flow 从 db 消息构建 assistantGroup | collapseStandaloneToolMessages 合并 tool→assistant |

### 18.9 内置工具对比（细化）

| identifier               | Web | RN Render | RN Streaming                    | RN Intervention         |
| ------------------------ | --- | --------- | ------------------------------- | ----------------------- |
| lobe-agent-builder       | ✅  | ❌        | ❌                              | ❌                      |
| lobe-agent-management    | ✅  | ❌        | ❌                              | ❌                      |
| lobe-cloud-sandbox       | ✅  | ✅        | ✅                              | ✅ executeCode          |
| lobe-group-agent-builder | ✅  | ❌        | ❌                              | ❌                      |
| lobe-group-management    | ✅  | ✅        | ❌                              | ❌                      |
| lobe-gtd                 | ✅  | ✅        | createPlan, execTask, execTasks | createPlan, createTodos |
| lobe-knowledge-base      | ✅  | ✅        | searchKnowledgeBase             | ❌                      |
| lobe-local-system        | ✅  | ❌        | ❌                              | ❌                      |
| lobe-user-memory         | ✅  | ✅        | addExperience, addPreference    | addExperienceMemory     |
| lobe-notebook            | ✅  | ✅        | createDocument                  | createDocument          |
| lobe-skill-store         | ✅  | ✅        | searchSkill                     | ❌                      |
| lobe-skills              | ✅  | ✅        | searchSkill                     | ❌                      |
| lobe-web-browsing        | ✅  | ✅        | search                          | ❌                      |
| lobe-calculator          | -   | ✅        | ❌                              | ❌                      |

### 18.10 对齐建议汇总

1. **P0 格式**：RN 检测 ChatToolPayload \[]，直接使用，跳过 transformToolCalls
2. **参数摘要**：RN 改为 slice (0, 3) 或与 Web ArgumentRender 行为对齐
3. **流式无 Render**：决策 RN 是否与 Web 一致（无 Streaming 时暂不展示参数）或保持现状
4. **错误展示**：ToolCallsBlock 补充 error 流入路径（如 pluginError → tool）
5. **干预启用**：若开启 RN 批准，需接 `/webapi/chat` 的人为批准或切换 tRPC 路径
