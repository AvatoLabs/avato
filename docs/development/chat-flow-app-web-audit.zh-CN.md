# Chat 流程审计：App vs Web 对齐情况

本文档全面审计 App 与 Web 在聊天流程、群聊功能上的实现差异，识别缺失与待完善项。

**审计范围**：

- **单 Agent 对话**：发送、流式响应、编辑、删除、重新生成、停止
- **群聊（Group Chat）**：发送、流式 / 轮询、compareGroup/compressedGroup 展示、任务委托
- **清空对话**：本地 vs 服务端持久化

---

## 一、单 Agent 对话流程

### 1.1 发送消息与流式响应

| 能力             | Web                                     | App                                                               | 对齐 |
| ---------------- | --------------------------------------- | ----------------------------------------------------------------- | ---- |
| 发送文本         | ✅ `ChatStore.sendMessage` → `fetchSSE` | ✅ `sendMessage` → `aiChatApi.createAssistantMessageStream` (XHR) | ✅   |
| 附件上传         | ✅ `message.createMessage` + files      | ✅ `useFileStore.uploadFile` + `messageApi.create`                | ✅   |
| 流式输出         | ✅ `fetchSSE` (ReadableStream)          | ✅ XHR + `onprogress` 解析 SSE                                    | ✅   |
| Reasoning / 思考 | ✅ `event: reasoning`                   | ✅ `event: reasoning` + `<think>` 标签解析                        | ✅   |
| 图片生成         | ✅ `onImages`                           | ✅ `onImages`                                                     | ✅   |
| 工具调用         | ✅ `onTools` / `onToolExecutions`       | ✅ `onTools` / `onToolExecutions`                                 | ✅   |
| 搜索 / Grounding | ✅ `onSearch`                           | ✅ `onSearch`                                                     | ✅   |
| Memory           | ✅ `chatConfig.memory`                  | ✅ `getSessionChatOptions` + `memory`                             | ✅   |
| Plugins          | ✅ `plugins`                            | ✅ `options.plugins`                                              | ✅   |

### 1.2 消息操作

| 能力     | Web                                                        | App                                                             | 对齐        |
| -------- | ---------------------------------------------------------- | --------------------------------------------------------------- | ----------- |
| 编辑消息 | ✅ `modifyMessageContent` → `messageService.updateMessage` | ✅ `editMessage` → `messageApi.update`                          | ✅          |
| 删除单条 | ✅ `optimisticDeleteMessage` → `message.removeMessage`     | ✅ `deleteMessage` → `messageApi.remove`                        | ✅          |
| 重新生成 | ✅ `regenerateMessage` → `internal_resendMessage`          | ✅ `regenerateMessage`（仅单 Agent，群聊不支持）                | ⚠️ 群聊缺失 |
| 停止生成 | ✅ `stopGenerateMessage` → `cancelOperations`              | ✅ `stopGenerating` → `abortController.abort` + `interruptTask` | ✅          |

### 1.3 Topic 创建与切换

| 能力                 | Web                        | App                                    | 对齐 |
| -------------------- | -------------------------- | -------------------------------------- | ---- |
| 发送后自动创建 Topic | ✅                         | ✅ `shouldCreateTopicAfterResponse`    | ✅   |
| 切换 Topic           | ✅ `switchTopic`           | ✅ `useTopicStore.switchTopic`         | ✅   |
| 拉取消息             | ✅ SWR / `refreshMessages` | ✅ `fetchMessages(sessionId, topicId)` | ✅   |

---

## 二、群聊（Group Chat）流程

### 2.1 发送消息与流式 / 轮询

| 能力       | Web                                                                 | App                                                   | 对齐        |
| ---------- | ------------------------------------------------------------------- | ----------------------------------------------------- | ----------- |
| 发送群消息 | ✅ `sendGroupMessage` → `execGroupAgent`                            | ✅ `aiAgentApi.execGroupAgent`                        | ✅          |
| 流式更新   | ✅ **SSE** `agentRuntimeClient.createStreamConnection(operationId)` | ✅ **轮询** `getOperationStatus` + `getGroupMessages` | ⚠️ 架构不同 |
| 轮询间隔   | 无                                                                  | 1.2s (`GROUP_POLL_INTERVAL_MS`)                       | -           |
| 停止生成   | ✅ `eventSource.abort()`                                            | ✅ `aiAgentApi.interruptTask`                         | ✅          |
| 乐观更新   | ✅ `optimisticCreateTmpMessage`                                     | ✅ placeholder + `mergePersistedMessagesWithLocal`    | ✅          |

**差异说明**：Web 使用 SSE 实时推送，App 因 RN 环境限制使用轮询（`getOperationStatus` + `getGroupMessages`），功能等价但体验略差（延迟、请求次数多）。

### 2.2 群消息展示

| 能力              | Web                                  | App                                            | 对齐    |
| ----------------- | ------------------------------------ | ---------------------------------------------- | ------- |
| compareGroup      | ✅                                   | ✅ `MessageBubble` 支持 `compareGroupChildren` | ✅      |
| compressedGroup   | ✅ 可展开 / 折叠                     | ✅ 展示逻辑有，但无展开 / 折叠                 | ⚠️ 部分 |
| 群成员头像 / 名称 | ✅ `GroupAvatar`、`groupMembersById` | ✅ `groupMembersById`、`groupSupervisorId`     | ✅      |
| 主持人标识        | ✅                                   | ✅ `groupSettingsSupervisor`                   | ✅      |

### 2.3 群聊特有功能

| 能力                        | Web                                      | App                                         | 对齐    |
| --------------------------- | ---------------------------------------- | ------------------------------------------- | ------- |
| 任务委托 (execute_tasks)    | ✅ `createClientGroupAgentTaskThread`    | ❌ 未实现                                   | ❌ 缺失 |
| GroupTasks                  | ✅ `GroupTasksMessage` 展示多 Agent 任务 | ❌ 无                                       | ❌ 缺失 |
| compressedGroup 展开 / 折叠 | ✅ `toggleMessageGroupExpand`            | ❌ 无                                       | ❌ 缺失 |
| 群聊重新生成                | ✅ 支持                                  | ❌ `regenerateMessage` 中 group 直接 return | ❌ 缺失 |

---

## 三、清空对话

### 3.1 Web 行为

```ts
// src/store/chat/slices/message/actions/publicApi.ts
clearMessage = async () => {
  if (activeGroupId) {
    await messageService.removeMessagesByGroup(activeGroupId, activeTopicId);
  } else {
    await messageService.removeMessagesByAssistant(activeAgentId, activeTopicId);
  }
  if (activeTopicId) {
    await topicService.removeTopic(activeTopicId);
  }
  await refreshTopic();
  this.#get().replaceMessages([]);
  switchTopic(null);
};
```

- 调用后端 `removeMessagesByGroup` / `removeMessagesByAssistant`
- 删除当前 Topic
- 刷新 Topic 列表
- 清空本地消息并切换回默认 Topic

### 3.2 App 行为

```ts
// apps/mobile/src/store/chat.ts
clearMessages: (sessionId: string) => {
  set((s) => ({
    messagesBySession: { ...s.messagesBySession, [sessionId]: [] },
  }));
};
```

- **仅清空本地 state**
- 不调用 `removeMessagesByGroup` / `removeMessagesByAssistant`
- 不调用 `removeTopic`
- 不刷新 Topics

**结果**：用户点击「清空对话」后，消息仅在前端清空；重新进入会话或刷新后，会从服务端拉回原消息，**清空未持久化**。

### 3.3 API 对齐（已修复）

| API                         | Web | App | 说明              |
| --------------------------- | --- | --- | ----------------- |
| `removeMessagesByAssistant` | ✅  | ✅  | 单 Agent 清空会话 |
| `removeMessagesByGroup`     | ✅  | ✅  | 群聊清空会话      |

---

## 四、差距归纳

### 4.1 高优先级（需修复）

| 序号 | 问题               | 影响                                 | 状态                                                                                                                    |
| ---- | ------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| 1    | 清空对话未持久化   | 用户点击清空后，重新进入会看到旧消息 | ✅ 已修复：`messageApi` 增加 `removeMessagesByAssistant`、`removeMessagesByGroup`，`clearMessages` 调用后端并删除 Topic |
| 2    | 群聊重新生成不支持 | 群聊中无法重新生成                   | ⏳ 待评估：需后端支持                                                                                                   |

### 4.2 中优先级（体验增强）

| 序号 | 问题                          | 影响                 | 建议                                       |
| ---- | ----------------------------- | -------------------- | ------------------------------------------ |
| 3    | 群聊流式用轮询                | 延迟、请求多         | 若 RN 支持 EventSource/SSE，可考虑迁移 SSE |
| 4    | compressedGroup 无展开 / 折叠 | 长对话压缩后无法展开 | 增加 `toggleMessageGroupExpand` 或类似逻辑 |

### 4.3 低优先级（功能增强）

| 序号 | 问题                                | 影响                           | 建议                                |
| ---- | ----------------------------------- | ------------------------------ | ----------------------------------- |
| 5    | 无 GroupTasks                       | 任务委托类消息展示不完整       | 实现 `GroupTasksMessage` 或等价组件 |
| 6    | 无 createClientGroupAgentTaskThread | 无法执行 Supervisor 下发的任务 | 实现任务委托流程（需后端支持）      |

---

## 五、相关文件

### Web

- `src/store/chat/slices/aiAgent/actions/agentGroup.ts` — 群聊发送
- `src/store/chat/slices/message/actions/publicApi.ts` — clearMessage
- `src/services/message/index.ts` — removeMessagesByAssistant / removeMessagesByGroup
- `src/features/Conversation/Messages/GroupTasks/index.tsx` — GroupTasks

### App

- `apps/mobile/src/store/chat.ts` — sendMessage、clearMessages、regenerateMessage
- `apps/mobile/src/lib/api.ts` — messageApi、aiAgentApi
- `apps/mobile/src/screens/ChatSettingsScreen.tsx` — handleClearHistory
- `apps/mobile/src/components/ui/MessageBubble.tsx` — compareGroup、compressedGroup

### 后端

- `src/server/routers/lambda/message.ts` — removeMessagesByAssistant、removeMessagesByGroup
- `src/server/routers/lambda/aiAgent.ts` — execGroupAgent、createClientGroupAgentTaskThread
