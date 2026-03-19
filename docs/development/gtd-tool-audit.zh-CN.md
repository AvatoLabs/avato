# GTD 工具完整审计报告

## 一、GTD 工具实现概览

### 1.1 核心包结构

| 路径 | 职责 |
|------|------|
| `packages/builtin-tool-gtd/` | GTD 工具核心：Plan/Todo/Task 三层模型、Executor、Manifest |
| `packages/builtin-tools/` | 注册 GTD 的 Render、Intervention、Streaming 组件 |

### 1.2 GTD API 能力

- **Plan**：`createPlan`、`updatePlan`
- **Todo**：`createTodos`、`updateTodos`、`clearTodos`、`completeTodos`、`removeTodos`
- **Task**：`execTask`、`execTasks`

### 1.3 数据存储

- Todo 通过 `syncTodosToPlan(ctx.topicId, todoState)` 同步到 **Plan 文档**（`agent/plan` 类型）
- 无独立任务数据库表，任务数据存在于对话关联的 Plan 文档元数据中

---

## 二、Web 端任务列表与配合

### 2.1 是否有独立任务列表页面？

**无**。GTD 不提供独立「任务列表」路由或页面。

### 2.2 任务展示位置

| 位置 | 组件 | 数据来源 | 说明 |
|------|------|----------|------|
| **Document Portal** | `src/features/Portal/Document/TodoList.tsx` | `document.metadata?.todos` | 当 `document.fileType === 'agent/plan'` 且 `metadata.todos` 有数据时，在 Document 视图底部展示可折叠 Todo 列表 |
| **对话内** | `src/features/Conversation/Messages/AssistantGroup/Tool/` | 工具调用消息 | 通过 `getBuiltinRender`、`getBuiltinIntervention` 渲染 GTD 的 TodoList、CreatePlan、ExecTask 等组件 |

### 2.3 Theatre 相关

**代码库中未发现与 GTD 相关的 Theatre 实现。** Theatre 为其他功能（如 UI 动画/编排）所用，与 GTD 任务管理无直接关联。

---

## 三、Web 端工具调用与批准流程

### 3.1 工具渲染

- **Render**：`getBuiltinRender(identifier, apiName)` → 如 `TodoListRender`、`CreatePlan`、`ExecTask` 等
- **Intervention**：`getBuiltinIntervention(identifier, apiName)` → 如 `AddTodoIntervention`、`ClearTodosIntervention` 等
- **Streaming**：`getBuiltinStreaming(identifier, apiName)` → 实时执行反馈

### 3.2 批准/拒绝流程

- **Intervention 组件**：`src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/index.tsx`
- **ApprovalActions**：`approveToolCall`、`rejectToolCall`、`rejectAndContinueToolCall` 来自 `useConversationStore`
- **Store 链路**：`ConversationStore.toolSlice` → `useChatStore.approveToolCalling` → 本地 Agent Runtime 继续执行

### 3.3 关键依赖

- 批准流程依赖 **本地 Agent Runtime**（`internal_execAgentRuntime`）
- 云端/后端 API 流（webapi/chat）**不**支持 human intervention，工具在服务端自动执行

---

## 四、App 端 Chat 对 GTD 工具调用的支持

### 4.1 当前实现

| 能力 | 状态 | 说明 |
|------|------|------|
| 工具调用展示 | ✅ 有 | `ToolCallsBlock` + `ToolCard` 展示 `message.tools` |
| `intervention.status` 展示 | ✅ 有 | `hasPending`、`status` 用于 pending/rejected/aborted 样式 |
| 批准/拒绝按钮 UI | ⚠️ 半成品 | `ToolCard` 有 `onApprove`/`onReject`，但 **ToolCallsBlock 从未传入** |
| 批准/拒绝逻辑 | ❌ 无 | 无 `approveToolCall`/`rejectToolCall`，无对应 API |
| GTD 专用 Render | ❌ 无 | 无 `getBuiltinRender` 调用，仅通用 ToolCard |
| GTD 专用 Intervention | ❌ 无 | 无 `getBuiltinIntervention`，无 CreatePlan/AddTodo 等表单 |

### 4.2 关键代码位置

```
apps/mobile/src/components/ui/MessageBubble.tsx
├── ToolCard (2341–2560): 有 onApprove/onReject props，pending 时展示按钮
├── ToolCallsBlock (2562–2657): 渲染 ToolCard，但未传 onApprove/onReject
└── ToolResultBlock (2661–2688): 工具结果消息，同样未传批准回调
```

### 4.3 数据流

- **`message.tools`**：来自 `normalizeMessage`，后端/SSE 的 `tools` 或 `tool_calls` 转换
- **`tool.intervention`**：`transformToolCalls`、`toolExecutionsToPayloads` **均未** 写入 `intervention`
- 若后端返回 `intervention`，需在 `normalizeMessage` 或 `transformToolCalls` 中透传

### 4.4 后端支持情况

- **webapi/chat**：工具在服务端 **同步自动执行**，无 human approval 流程
- **AgentRuntimeService.handleHumanIntervention**：`approveToolCall`、`rejectToolCall` 为 **TODO**，未实现
- 结论：**云端/移动端流当前不支持工具批准**

---

## 五、差异总结

| 维度 | Web | App |
|------|-----|-----|
| 任务列表 | Document Portal 内 TodoList（Plan 文档） | 无 |
| 工具 Render | GTD 专用（TodoList、CreatePlan、ExecTask 等） | 通用 ToolCard |
| Intervention UI | CreatePlan、AddTodo 等表单 + ApprovalActions | 无 |
| 批准/拒绝 | 完整支持（本地 Runtime） | 按钮存在但未接逻辑，后端无支持 |
| 数据来源 | 本地 ChatStore + ConversationStore | 后端 API + 本地 chat store |

---

## 六、改进建议

### 6.1 高优先级：补齐 App 批准流程（若后端支持）

1. **后端**：实现 `AgentRuntimeService.handleHumanIntervention` 中的 approve/reject，并暴露对应 API（如 `aiChat.approveToolCall`、`aiChat.rejectToolCall`）
2. **Mobile API**：在 `apps/mobile/src/lib/api.ts` 中新增 `approveToolCall`、`rejectToolCall` 调用
3. **Mobile Store**：在 `apps/mobile/src/store/chat.ts` 中实现 `approveToolCall`、`rejectToolCall`，调用上述 API
4. **MessageBubble**：`ToolCallsBlock` 传入 `messageId`、`sessionId`、`topicId`，并传入 `onApprove`/`onReject` 回调，调用 store 方法

### 6.2 中优先级：透传 intervention

1. 在 `transformToolCalls` 或 `toolExecutionsToPayloads` 中保留/透传 `intervention`（若后端返回）
2. 在 `normalizeMessage` 中确保 `message.tools` 内每个 tool 的 `intervention` 正确映射

### 6.3 低优先级：GTD 专用 Render（可选）

- 在 RN 中复用或移植 GTD 的 Render 组件（TodoList、CreatePlan 等），需评估 React Native 与 Web 组件复用成本
- 短期可继续使用通用 ToolCard，优先保证批准流程可用

### 6.4 任务列表（可选）

- 若需 App 端独立任务视图，可新增「任务」Tab，从 Plan 文档或统一任务 API 拉取数据
- 当前 Web 端任务也仅在 Document 内展示，无全局任务列表页面

---

## 七、Web 端类似渲染能力清单（App 需学习实现）

### 7.1 工具相关渲染体系

Web 端通过 `@lobechat/builtin-tools` 提供四类组件注册表，App 端当前均未接入：

| 类型 | 注册表 | 用途 | 涉及工具示例 | App 现状 |
|------|--------|------|--------------|----------|
| **Render** | `getBuiltinRender(identifier, apiName)` | 工具**结果**的富 UI 展示 | GTD TodoList/CreatePlan/ExecTask、Notebook、Memory、WebBrowsing 等 | ❌ 仅通用 ToolCard |
| **Streaming** | `getBuiltinStreaming(identifier, apiName)` | 工具**执行中**的实时反馈 | GTD CreatePlan/ExecTask、Notebook、LocalSystem 等 | ❌ 无 |
| **Intervention** | `getBuiltinIntervention(identifier, apiName)` | 工具**待批准**时的表单/编辑 UI | GTD CreatePlan/AddTodo/ClearTodos、CloudSandbox、LocalSystem 等 | ❌ 无 |
| **Inspector** | `getBuiltinInspector(identifier, apiName)` | 工具**标题区**的自定义展示 | GTD、Notebook、Memory、WebBrowsing、Skills 等 | ❌ 仅 formatToolDisplayTitle |

### 7.2 内置工具 Render 清单（packages/builtin-tools/renders.ts）

| 工具集 | Render 组件 |
|--------|-------------|
| **lobe-gtd** | TodoList、CreatePlan、ExecTask、ExecTasks |
| **lobe-notebook** | NotebookRenders |
| **lobe-memory** | MemoryRenders |
| **lobe-knowledge-base** | KnowledgeBaseRenders |
| **lobe-local-system** | LocalSystemRenders |
| **lobe-web-browsing** | WebBrowsingRenders |
| **lobe-cloud-sandbox** | CloudSandboxRenders |
| **lobe-agent-builder** | AgentBuilderRenders |
| **lobe-agent-management** | AgentManagementRenders |
| **lobe-group-management** | GroupManagementRenders |
| **lobe-skill-store** | SkillStoreRenders |
| **lobe-skills** | SkillsRenders |

### 7.3 工具 UI 增强（Web 有、App 缺）

| 能力 | Web 实现 | App 现状 |
|------|----------|----------|
| **批准/拒绝** | ApprovalActions + approveToolCall/rejectToolCall | 按钮有，未接逻辑 |
| **拒绝并继续** | rejectAndContinueToolCall | ❌ 无 |
| **编辑参数** | KeyValueEditor + updatePluginArguments | ❌ 无 |
| **模式选择** | ModeSelector（auto-run/allow-list/manual） | ❌ 无 |
| **Rejected 文案** | RejectedResponse 组件 | ⚠️ ToolCard 有 isRejected 样式，无专用文案 |
| **Aborted 文案** | AbortResponse 组件 | ⚠️ ToolCard 有 isAborted 样式，无专用文案 |
| **Loading 占位** | LoadingPlaceholder + getBuiltinPlaceholder/Streaming | ❌ 无 |
| **Render/Args 切换** | 可切换「插件渲染」与「原始参数」视图 | ❌ 无 |
| **Debug 模式** | 工具 Debug 面板 | ❌ 无 |
| **删除消息** | deleteAssistantMessage | ❌ 无（工具消息级） |

### 7.4 消息内容块（Web vs App）

| 内容块 | Web | App |
|--------|-----|-----|
| SearchGrounding | ✅ | ✅ |
| AttachmentBlock | ✅ | ✅ |
| ArtifactBlock | ✅ | ✅ |
| RichContentParts（多模态） | ✅ | ✅ RichContentPartsBlock |
| Reasoning/Thinking | ✅ | ✅ ThinkingBlock |
| CompareGroup | ✅ | ✅ CompareGroupBlock |
| GroupTasks | ✅ | ✅ GroupTasksBlock |
| CitationFootnotes | ✅ | ✅ CitationFootnotesBlock |
| ErrorBlock | ✅ | ✅ ErrorBlock |

### 7.5 App 端实现优先级建议

| 优先级 | 任务 | 说明 |
|--------|------|------|
| **P0** | 批准/拒绝流程 | 接好 onApprove/onReject，store + API（依赖后端） |
| **P1** | 透传 intervention | transformToolCalls/toolExecutionsToPayloads 保留 intervention |
| **P2** | GTD Render 移植 | TodoList、CreatePlan、ExecTask 的 RN 版本，提升 GTD 体验 |
| **P2** | Inspector 接入 | 用 getBuiltinInspector 优化工具标题展示 |
| **P3** | Streaming 接入 | 执行中实时反馈（需 store 支持 streaming state） |
| **P3** | Intervention 表单 | CreatePlan、AddTodo 等 RN 表单（依赖批准流程） |
| **P3** | Rejected/Aborted 专用文案 | 对齐 Web 的 RejectedResponse、AbortResponse |
| **P4** | 参数编辑、ModeSelector、Debug | 增强工具控制能力 |

### 7.6 技术约束

- **Web 组件**：基于 React + antd + @lobehub/ui，无法直接在 RN 使用
- **RN 实现**：需用 React Native 组件重写，或通过 `react-native-webview` 嵌入 Web 渲染（复杂度高）
- **数据层**：Render/Streaming/Intervention 依赖 `pluginState`、`result.state` 等，需确保 mobile 消息结构与之对齐

---

## 八、结论

1. **Web 端**：GTD 工具完整，任务在 Document Portal 的 Plan 文档中展示，批准流程依赖本地 Agent Runtime。
2. **无 Theatre 配合**：Theatre 与 GTD 无直接关系。
3. **App 端**：能展示工具调用和 pending 状态，批准/拒绝已接逻辑（store + API），后端占位待实现。
4. **Web 渲染体系**：Render / Streaming / Intervention / Inspector 四类组件覆盖 12+ 内置工具，App 需按优先级逐步移植或重写。

---

## 九、全面支持计划

除 GTD 外，Web 端还有 **Notebook、Memory、Cloud Sandbox、Web Browsing、Knowledge Base、Agent Builder** 等 12+ 内置工具具备专用 Render/Intervention/Streaming/Inspector，App 端当前均未接入。

**完整实施计划**见：[`mobile-builtin-tools-implementation-plan.zh-CN.md`](./mobile-builtin-tools-implementation-plan.zh-CN.md)

该计划包含：
- 所有内置工具能力矩阵
- 分阶段实施路线（框架 → Render → Inspector → Intervention → Streaming）
- 目录与文件规划
- 里程碑与排期建议（约 12–14 周）
