# Skills 工具调用渲染审计：Mobile vs Web

本文档审计 Mobile 端加载 Skills 后工具调用不显示的问题，并与 Web 版本对比。

## 一、现象

- **用户反馈**：加载了 Skills，但看不到工具调用的渲染
- **截图表现**：Thought（推理）区块正常展示，但无工具调用区块、无工具执行结果
- **控制台**：曾出现 `View config getter callback for component 'code' must be a function`（SyntaxHighlighter 相关，已修复）

## 二、Mobile 工具渲染逻辑

### 2.1 渲染条件

| 组件 | 触发条件 | 数据来源 |
|------|----------|----------|
| `ToolCallsBlock` | `hasTools && message.tools` | `message.tools`（assistant 消息内嵌） |
| `ToolResultBlock` | `message.role === 'tool'` | 单独的 tool 消息 |

```ts
// MessageBubble.tsx
const hasTools = !isUser && (message.tools?.length ?? 0) > 0;
// ...
{hasTools && message.tools && <ToolCallsBlock tools={message.tools} />}
// ...
) : isToolMessage ? (
  <ToolResultBlock message={message} />
```

### 2.2 数据流

1. **WebAPI** 在流式响应**开头**发送 `event: tool_executions`，携带工具执行结果
2. **Mobile api.ts** 的 `createSSEParser` 解析 SSE，`case 'tool_executions'` 调用 `callbacks.onToolExecutions(accToolExecutions)`
3. **chat.ts** 的 `onToolExecutions` 将 `ToolExecutionItem[]` 转为 `ChatToolPayload[]`，更新 assistant 消息的 `tools` 字段

```ts
// chat.ts
onToolExecutions: (executions) => {
  const toolPayloads = toolExecutionsToPayloads(executions);
  set((s) => ({
    messagesBySession: {
      ...s.messagesBySession,
      [sessionId]: (s.messagesBySession[sessionId] || []).map((m) =>
        m.id === assistantMsgId ? { ...m, tools: toolPayloads } : m,
      ),
    },
  }));
},
```

### 2.3 消息结构

- Mobile 使用**扁平消息列表**：`messagesBySession[sessionId]` 为 `ChatMessage[]`
- 工具信息**内嵌在 assistant 消息**的 `tools` 数组中
- **没有**单独的 `role: 'tool'` 消息作为列表项（与 Web 的 assistantGroup + children 不同）

## 三、Web 工具渲染逻辑

### 3.1 渲染结构

- Web 使用 **AssistantGroup** + **children (blocks)**
- 每个 block 为 `AssistantContentBlock`，可包含 `content`、`reasoning`、`tools` 等
- `ContentBlock` 在 `hasTools` 时渲染 `<Tools />`，内部为 `AssistantGroup/Tool` 的 Accordion 式展示

### 3.2 数据流

- Web 通过 **TRPC** 调用 agent runtime，使用 `StreamingHandler` 的 `onToolCallsUpdate`
- 工具调用在流式过程中通过 `stream_chunk` 的 `tools_calling` 或 `stream_end` 的 `toolCalls` 更新
- Agent runtime 支持 **builtin tools**、**MCP plugins**、**LobeHub Skills** 等，由 ToolsEngine 统一注入

### 3.3 关键差异

| 维度 | Web | Mobile |
|------|-----|--------|
| 聊天入口 | TRPC → Agent Runtime | WebAPI `/webapi/chat/[provider]` |
| 工具注入 | ToolsEngine（builtin + plugin + skill） | `resolvePluginTools`（仅 PluginModel） |
| 工具执行 | Agent runtime 内建 tool loop | WebAPI 内 tool loop（仅当 `mcpTools?.tools.length`） |
| tool_executions | 无此事件（流式 tool_calls） | 有，在流开头预发送 |

## 四、根因分析

### 4.1 WebAPI 工具解析范围

WebAPI 的 `resolvePluginTools` **仅从 PluginModel（userInstalledPlugins 表）解析**：

```ts
// route.ts
const pluginModel = new PluginModel(serverDB, userId);
const installedPlugins = await pluginModel.query();
// ...
const plugin = installedPlugins.find((p) => p.identifier === pluginId);
```

- **Builtin 工具**（如 `lobe-skills`）不在 `userInstalledPlugins` 表中
- 它们存在于前端的 builtin tool 注册表，Web 通过 ToolsEngine 注入
- Mobile 发送 `plugins: ['lobe-skills']` 时，WebAPI 在 `installedPlugins` 中找不到 `lobe-skills`
- 因此 `mcpTools.tools` 为空，**tool loop 不执行**，`tool_executions` **从不发送**

### 4.2 条件链

```
agent.plugins 含 lobe-skills
  → resolvePluginTools(['lobe-skills'])
  → installedPlugins 无 lobe-skills
  → mcpTools.tools = []
  → if (mcpTools?.tools.length) 为 false
  → tool loop 跳过
  → toolLoopSucceeded = false
  → 不发送 tool_executions
  → Mobile 收不到 tools 更新
  → ToolCallsBlock 不渲染
```

### 4.3 与 Web 的差异

- Web 的 agent runtime 在服务端/客户端会注入 builtin tools，不依赖 PluginModel
- Mobile WebAPI 是简化路径，只支持 **MCP 插件**，不支持 **builtin skills**

## 五、结论与建议

### 5.1 结论

| 项目 | 状态 |
|------|------|
| Mobile ToolCallsBlock / ToolResultBlock 实现 | ✅ 正常 |
| onToolExecutions 数据流 | ✅ 正常 |
| WebAPI 发送 tool_executions | ⚠️ 仅当 tool loop 成功（MCP 插件） |
| WebAPI 支持 builtin skills (lobe-skills) | ❌ 不支持 |

**根本原因**：WebAPI 未注入 builtin 工具定义，导致使用 Skills（如 lobe-skills）时 tool loop 不运行，`tool_executions` 不发送，Mobile 无法渲染工具调用。

### 5.2 修复建议

1. **扩展 WebAPI 工具解析**：当 `pluginIds` 包含 builtin 标识（如 `lobe-skills`）时，从 builtin tool 注册表获取工具定义并注入，使 tool loop 能执行。
2. **或**：在服务端提供与 Web 一致的 agent tools 解析逻辑（复用 ToolsEngine 或等价实现），统一支持 builtin / plugin / skill。

### 5.3 相关文件

| 角色 | 文件 |
|------|------|
| Mobile 渲染 | `apps/mobile/src/components/ui/MessageBubble.tsx` |
| Mobile 数据流 | `apps/mobile/src/store/chat.ts`、`apps/mobile/src/lib/api.ts` |
| WebAPI 工具解析 | `src/app/(backend)/webapi/chat/[provider]/route.ts` |
| Web 工具渲染 | `src/features/Conversation/Messages/AssistantGroup/` |
| Builtin 定义 | `packages/builtin-tool-skills/` |
