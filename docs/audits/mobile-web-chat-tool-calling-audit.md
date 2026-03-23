# 移动 Web SPA 与 Web 端 Chat 工具调用 / 状态更新 / 批准行为 审计报告

**审计日期**: 2025-03-23\
**审计范围**: `src/routes/(mobile)/`（**移动 Web SPA**，非 React Native 原生 app）\
**说明**: React Native 原生 app 见 `docs/audits/mobile-rn-chat-tool-calling-audit.md`

**修复状态** (2025-03-23):

| 优先级 | 问题                                               | 状态                                                    |
| ------ | -------------------------------------------------- | ------------------------------------------------------- |
| P0     | 消息操作栏仅 onMouseEnter，Mobile 无法访问         | ✅ 已修复：增加 onClick 触发                            |
| P1     | KeyValueEditor min-width: 600px 溢出               | ✅ 已修复：改为 min (600px, 100%)                       |
| P2     | 拒绝 Popover 固定 width: 400                       | ✅ 已修复：小屏为 min (400px, calc (100vw - 32px))      |
| P3     | Popover placement 固定 bottomRight                 | ✅ 已修复：小屏改为 top                                 |
| M1     | ChatInput 未接收 mobile                            | ✅ 已修复：Conversation ChatInput 使用 useIsMobile 传入 |
| M2     | MobileChatInput 未被使用                           | ✅ 已修复：小屏使用 MobileChatInput                     |
| M3     | Agent ChatMiniMap、MessageFromUrl 在 Mobile 仍渲染 | ✅ 已修复：小屏隐藏                                     |

---

## 1. 架构概览

### 1.1 端差异与共享架构

| 维度                | Mobile App                                                 | Web 端                            | 共享 / 差异  |
| ------------------- | ---------------------------------------------------------- | --------------------------------- | ------------ |
| SPA 入口            | `entry.mobile.tsx` → `mobileRoutes`                        | `entry.web.tsx` → `desktopRoutes` | 不同 router  |
| Chat 路由           | `(mobile)/chat`                                            | `(main)/agent`                    | 不同路径     |
| ConversationArea    | 复用 `(main)/agent/features/Conversation/ConversationArea` | 同上                              | **完全共享** |
| ChatList / 消息组件 | 同上                                                       | 同上                              | **完全共享** |
| MainChatInput       | 同上                                                       | 同上                              | **完全共享** |
| Group Chat          | ❌ 无 `/group` 路由                                        | ✅ 有                             | **功能差异** |

Mobile Chat 页面 (`src/routes/(mobile)/chat/index.tsx`) 直接引用 Web 端 agent 的 `ConversationArea`，未传入 `mobile` 属性。工具调用、批准、状态更新均使用同一套组件与 Store。

### 1.2 数据流与 Store

| 层级              | 职责                                                                     | Mobile / Web |
| ----------------- | ------------------------------------------------------------------------ | ------------ |
| ChatStore         | `dbMessagesMap`、`operations`、`approveToolCalling`、`rejectToolCalling` | 共享         |
| ConversationStore | `approveToolCall`、`rejectToolCall`、`updatePluginArguments`             | 共享         |
| useOperationState | `getMessageOperationState`、`getToolOperationState`、`isAIGenerating`    | 共享         |
| OperationState    | `needsHumanInput`、`pendingApproval` 在 ChatStore.operations.metadata    | 共享         |

---

## 2. 工具调用渲染（Tool Invocation Rendering）

### 2.1 组件层级

```
ChatList → VirtualizedList → MessageItem
  → AssistantGroup (role=assistantGroup)
    → Group (blocks)
      → AssistantGroup/Tool (role=tool)
        → Detail (GroupToolRender)
          → Intervention (pending) | ToolRender (approved/result) | LoadingPlaceholder
```

所有工具相关 UI 均为共享代码，Mobile 与 Web 使用同一套实现。

### 2.2 状态驱动逻辑

| 状态                                  | 来源                                                   | 渲染表现                                     |
| ------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `intervention?.status === 'pending'`  | ConversationStore / DB                                 | 显示 Intervention 组件（参数编辑、批准按钮） |
| `intervention?.status === 'rejected'` | -                                                      | RejectedResponse                             |
| `intervention?.status === 'aborted'`  | -                                                      | AbortResponse                                |
| `isArgumentsStreaming`                | args 未完成 JSON 解析                                  | 无结果时显示 streaming 或 null               |
| `isToolCalling`                       | `operationSelectors.isMessageInToolCalling` + fallback | LoadingPlaceholder                           |
| `result` 有内容                       | -                                                      | ToolRender（自定义或内置）                   |

### 2.3 Mobile 特有差异（无）

- 工具调用渲染组件未使用 `useIsMobile`、`isMobile`、`mobile` 做条件分支。
- `AssistantGroup/Tool`、`Detail`、`Intervention` 等均无 mobile 分支。

---

## 3. 状态更新（State Updates）

### 3.1 Operation 与 Tool Calling 状态

| 状态                                     | 更新路径                                      | Mobile / Web |
| ---------------------------------------- | --------------------------------------------- | ------------ |
| `isMessageInToolCalling(messageId)`      | ChatStore `operations` + `operationSelectors` | 共享         |
| `toolCallingStreamIds[messageId][index]` | 流式工具调用                                  | 共享         |
| `optimisticUpdatePlugin`                 | 批准 / 拒绝时更新 intervention                | 共享         |
| `refreshMessages`                        | step_complete 时刷新                          | 共享         |
| `needsHumanInput` / `pendingApproval`    | runAgent 处理 step_start phase=human_approval | 共享         |

### 3.2 批准前后流程

1. **step_start phase=human_approval** → `updateOperationMetadata({ needsHumanInput, pendingApproval })` → `internal_toggleMessageLoading(false)`
2. 用户点击批准 → `approveToolCall(messageId, assistantGroupId)` → ConversationStore → ChatStore `approveToolCalling`
3. `optimisticUpdatePlugin(toolMessageId, { intervention: { status: 'approved' } })`
4. `internal_createAgentState` → `internal_execAgentRuntime` 以 `human_approved_tool` 继续
5. 工具执行完成后 `refreshMessages` 更新列表

Mobile 与 Web 使用同一套状态更新逻辑。

### 3.3 Mobile 特有差异（无）

- 无 mobile 专属状态分支。
- 无针对移动端的乐观更新或错误处理差异。

---

## 4. 批准行为（Approval Behavior）

### 4.1 批准相关组件

| 组件            | 位置                                                          | 职责                                                             |
| --------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| ApprovalActions | `AssistantGroup/Tool/Detail/Intervention/ApprovalActions.tsx` | 批准、拒绝、拒绝并继续                                           |
| Intervention    | `.../Intervention/index.tsx`                                  | 参数编辑、BuiltinToolIntervention、ModeSelector、ApprovalActions |
| Fallback        | `.../Intervention/Fallback.tsx`                               | 无内置 Intervention 时的 JSON 编辑 + ApprovalActions             |

### 4.2 批准行为逻辑

- `handleApprove(remember?)`：`onBeforeApprove` flush → `approveToolCall` → 可选 `addToolToAllowList`
- `handleReject`：`rejectToolCall`
- `handleRejectAndContinue`：`rejectAndContinueToolCall`

所有逻辑均无 mobile 分支。

### 4.3 UI 布局与交互

| 项目                           | 实现                                    | Mobile 适配情况 |
| ------------------------------ | --------------------------------------- | --------------- |
| Popover (拒绝)                 | `placement="bottomRight"`，`width: 400` | ⚠️ 未适配       |
| ApprovalActions 按钮           | Flexbox horizontal gap=8                | 小屏可能挤压    |
| KeyValueEditor                 | `min-width: 600px`                      | ❌ 明显溢出风险 |
| DropdownMenu (allow-list 模式) | Space.Compact + ChevronDown             | 小屏可用        |
| ModeSelector                   | -                                       | 需视内部实现    |

### 4.4 具体问题

#### P1: KeyValueEditor 固定 `min-width: 600px` 导致 Mobile 溢出（✅ 已修复）

已改为 `min-width: min(600px, 100%)`，小屏下不会溢出。

#### P2: 拒绝原因 Popover 固定宽度 400px（✅ 已修复）

小屏使用 `width: min(400px, calc(100vw - 32px))`，避免超出视口。

#### P3: Popover placement 固定 bottomRight（✅ 已修复）

使用 `useIsMobile()` 在小屏时改为 `placement="top"`，避免被键盘或安全区遮挡。

---

## 5. ChatInput 与 ActionBar

### 5.1 Mobile 检测传递链

| 环节                   | 是否传递 mobile                         | 说明                                 |
| ---------------------- | --------------------------------------- | ------------------------------------ |
| Conversation ChatInput | ❌ 未传                                 | 未向 ChatInputProvider 传 `mobile`   |
| ChatInputProvider      | 接收 `mobile`                           | 由 props 传入                        |
| StoreUpdater           | 写入 ChatInput store                    | `useStoreUpdater('mobile', mobile!)` |
| ActionBar              | 读取 `useChatInputStore(s => s.mobile)` | 用于 `collapseOffset`                |

**已修复**：Conversation ChatInput 现已使用 `useIsMobile()` 传入 `mobile` 给 ChatInputProvider，ActionBar 可根据小屏调整 `collapseOffset`。

### 5.2 MobileChatInput 未被使用

- `src/features/ChatInput/Mobile/index.tsx` 存在且导出为 `MobileChatInput`。
- Conversation ChatInput 固定使用 `DesktopChatInput`，从未按平台切换。
- Mobile App 实际使用的是与 Web 相同的 `DesktopChatInput`。

### 5.3 leftActions 与 tools

- Agent MainChatInput 配置: `leftActions = ['model','search','memory','fileUpload','tools','---',['typo','params','clear'],'mainToken']`。
- `tools` 在 Mobile 与 Web 均存在，无裁剪。
- Mobile 端同样展示完整 ActionBar，可能与小屏空间冲突。

---

## 6. ConversationArea 布局差异

### 6.1 Agent ConversationArea（Mobile 与 Web 共用）

```tsx
// src/routes/(main)/agent/features/Conversation/ConversationArea.tsx
<ChatList />
<TodoProgress />
<MainChatInput />
<ChatHydration />
<ThreadHydration />
<ChatMiniMap />
<MessageFromUrl />
```

**已修复**：使用 `useIsMobile()`，小屏时隐藏 ChatMiniMap 与 MessageFromUrl。

### 6.2 Group ConversationArea（仅 Web）

```tsx
// src/routes/(main)/group/features/Conversation/ConversationArea.tsx
{
  !mobile && (
    <>
      <ChatMiniMap />
      <MessageFromUrl />
    </>
  );
}
```

Group 支持 `mobile` 时隐藏 ChatMiniMap 和 MessageFromUrl，但 Mobile App 无 group 路由，此逻辑对 Mobile 不生效。

---

## 7. 深度审计补充（API 路径、消息操作栏、后端差异）

### 7.0 API 与执行路径

| 路径                                                      | 用途                                             | 工具批准          | Mobile / Web |
| --------------------------------------------------------- | ------------------------------------------------ | ----------------- | ------------ |
| `lambdaClient.aiChat.sendMessageInServer`                 | 创建 user/assistant 消息占位、写入 DB            | 不涉及            | 共享         |
| `internal_execAgentRuntime`                               | 客户端执行 Agent Runtime、流式 LLM、工具调用     | ✅ 支持           | 共享         |
| `approveToolCalling`                                      | 乐观更新 + 继续 `internal_execAgentRuntime`      | ✅ 完全客户端     | 共享         |
| `API_ENDPOINTS.chat(provider)` (`/webapi/chat/:provider`) | MobileChatService，非流式 JSON、服务端工具自执行 | ❌ **无人工批准** | 独立路径     |

**结论**：Agent Chat（含 Mobile）走 tRPC `sendMessageInServer` + 客户端 `internal_execAgentRuntime`，工具批准在客户端完成，逻辑一致。`/webapi/chat`（MobileChatService）为另一套 API，工具在服务端自动执行，无人工批准流程。

**aiChat 路由**：`approveToolCall`、`rejectToolCall` 当前抛出 `"Tool approval is not yet supported for mobile/cloud flow"`，为预留接口，Agent Chat 未使用。

### 7.1 消息操作栏（Message Action Bar）仅依赖 hover

| 组件           | 触发方式       | Mobile 可用性       |
| -------------- | -------------- | ------------------- |
| AssistantGroup | `onMouseEnter` | ❌ 触摸设备无 hover |
| Assistant      | `onMouseEnter` | ❌ 同上             |
| User           | `onMouseEnter` | ❌ 同上             |
| Supervisor     | `onMouseEnter` | ❌ 同上             |
| AgentCouncil   | `onMouseEnter` | ❌ 同上             |

**位置**：`AssistantGroup/index.tsx`、`Assistant/index.tsx`、`User/index.tsx` 等均通过 `onMouseEnter` 设置 `MessageItemActionElementPortialContext`，使单例 `SingletonMessageActionsBar` 渲染到对应消息的 portal 占位。

**影响**：在 Mobile 上，消息操作栏（复制、折叠、分享、重新生成、删除等）无法通过点击触发显示。

**已修复**：AssistantGroup、Assistant、User、Supervisor、CouncilMember 均已增加 `onClick` 触发，触摸设备可通过点击消息显示操作栏。

### 7.2 工具 Accordion 与 Actions 触控

| 组件                | 实现                                  | Mobile 问题                |
| ------------------- | ------------------------------------- | -------------------------- |
| AssistantGroup/Tool | AccordionItem + Actions (ActionIcon)  | 触控目标约 28px，可能偏小  |
| ModeSelector        | DropdownMenu `placement="bottomLeft"` | 小屏可能被裁剪             |
| Tool Actions        | Debug、自定义渲染切换、Settings、删除 | 多个小图标横向排列，易误触 |

### 7.3 MobileChatService 工具执行（非 Agent Chat）

- **调用方**：`ChatService` 在 `isEnableFetchOnClient(provider)` 为 false 时通过 `fetch(API_ENDPOINTS.chat(provider))` 调用。
- **行为**：`stream: false`，`responseMode: 'json'`，工具在服务端循环执行，无 `userInterventionConfig`，**不等待人工批准**。
- **与 Agent Chat 区分**：Agent Chat 使用 tRPC + 客户端 Agent Runtime，支持 `userInterventionConfig` 与批准流程；两者执行路径不同。

---

## 8. 问题汇总与建议

### 8.1 高优先级（影响 Mobile 使用）

| 编号   | 问题                                       | 状态      |
| ------ | ------------------------------------------ | --------- |
| **P0** | 消息操作栏仅 onMouseEnter，Mobile 无法访问 | ✅ 已修复 |
| P1     | KeyValueEditor `min-width: 600px` 导致溢出 | ✅ 已修复 |
| P2     | 拒绝 Popover 固定 `width: 400`             | ✅ 已修复 |
| P3     | Popover `placement` 固定 bottomRight       | ✅ 已修复 |

### 8.2 中优先级（体验优化）

| 编号 | 问题                                                  | 状态                                                                      |
| ---- | ----------------------------------------------------- | ------------------------------------------------------------------------- |
| M1   | ChatInput 未接收 `mobile`                             | ✅ 已修复：Conversation ChatInput 使用 useIsMobile 传入 ChatInputProvider |
| M2   | MobileChatInput 未被使用                              | ✅ 已修复：Conversation ChatInput 小屏使用 MobileChatInput                |
| M3   | Agent 端 ChatMiniMap、MessageFromUrl 在 Mobile 仍渲染 | ✅ 已修复：Agent ConversationArea 小屏隐藏                                |

### 8.3 低优先级（功能对等）

| 编号 | 问题                            | 状态                                |
| ---- | ------------------------------- | ----------------------------------- |
| L1   | Mobile 无 Group Chat            | 设计取舍，可后续支持                |
| L2   | ApprovalActions 水平布局        | ✅ 已修复：小屏改为 vertical        |
| L3   | 工具 Accordion Actions 触控目标 | 待优化                              |
| L4   | ModeSelector Dropdown placement | ✅ 已修复：小屏改为 placement="top" |

---

## 9. 文件索引

| 路径                                                                                             | 职责                                              |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `src/routes/(mobile)/chat/index.tsx`                                                             | Mobile Chat 页面，复用 agent ConversationArea     |
| `src/features/Conversation/Messages/Contexts/MessageActionProvider.tsx`                          | 消息操作栏 Portal，依赖 onMouseEnter              |
| `src/routes/(main)/agent/features/Conversation/ConversationArea.tsx`                             | Agent 对话区域（共享）                            |
| `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/index.tsx`                        | 工具详情渲染（Intervention / ToolRender）         |
| `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/index.tsx`           | 批准态 UI 入口                                    |
| `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/ApprovalActions.tsx` | 批准 / 拒绝按钮与 Popover                         |
| `src/features/Conversation/Messages/AssistantGroup/Tool/Detail/Intervention/KeyValueEditor.tsx`  | 参数 key-value 编辑（min-width 问题）             |
| `src/features/Conversation/store/slices/tool/action.ts`                                          | `approveToolCall`、`rejectToolCall`               |
| `src/store/chat/slices/aiChat/actions/conversationControl.ts`                                    | `approveToolCalling`                              |
| `src/store/chat/slices/aiAgent/actions/runAgent.ts`                                              | `human_approval` 状态处理                         |
| `src/features/Conversation/ChatInput/index.tsx`                                                  | 对话 ChatInput，未传 mobile                       |
| `src/features/ChatInput/Mobile/index.tsx`                                                        | MobileChatInput（未使用）                         |
| `src/features/ChatInput/ChatInputProvider.tsx`                                                   | ChatInput 容器，接收 mobile                       |
| `src/hooks/useOperationState.ts`                                                                 | OperationState 桥接                               |
| `src/server/services/mobileChat/index.ts`                                                        | webapi/chat 实现，服务端工具自执行、无批准        |
| `src/server/routers/lambda/aiChat.ts`                                                            | approveToolCall/rejectToolCall 预留（抛出未支持） |
| `src/const/messageActionPortal.ts`                                                               | 消息操作栏 Portal 选择器                          |

---

## 10. 结论

- **工具调用渲染、状态更新、批准行为**：Mobile 与 Web 使用相同实现，逻辑无差异。
- **API 路径**：Agent Chat 统一走 tRPC + 客户端 execAgentRuntime，工具批准在客户端完成；`/webapi/chat`（MobileChatService）为另一套 API，工具在服务端自动执行，无批准流程。
- **P0 严重问题**：消息操作栏（复制、分享、重新生成等）仅依赖 `onMouseEnter`，在 Mobile 触屏上**完全不可用**。
- **UI 适配**：工具干预（Intervention）、KeyValueEditor、ApprovalActions 的 Popover 缺少移动端适配，存在溢出和布局问题。
- **ChatInput**：`mobile` 未传入，ActionBar 未针对 Mobile 做布局优化；`MobileChatInput` 未被使用。
- **布局**：Agent ConversationArea 未区分 mobile，ChatMiniMap、MessageFromUrl 在 Mobile 仍渲染。

P0–P3 已修复。可继续考虑 M1–M3（ChatInput mobile、MobileChatInput、ChatMiniMap）和 L 系列。
