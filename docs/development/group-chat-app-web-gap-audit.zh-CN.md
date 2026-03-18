# Group Chat 实现差距审计：App vs Web（全面对齐版）

> **审计日期**：2026-03-18（全面重审）  
> **范围**：`apps/mobile` 与 Web 群聊功能逐项对比

本文档对群组对话（Group Chat）在移动端 App 与 Web 端进行逐项对齐审计，识别已实现能力与剩余差距。

---

## 一、对齐总览

| 类别           | 已对齐 | 部分对齐 | 缺失 | 说明 |
| -------------- | ------ | -------- | ---- | ---- |
| 发送与流式     | 4      | 1        | 0    | 流式用轮询，架构不同 |
| 消息展示       | 5      | 0        | 0    | compareGroup、compressedGroup、GroupTasks、成员头像 |
| 消息操作       | 3      | 0        | 0    | 重新生成、编辑、删除 |
| 配置与入口     | 4      | 0        | 0    | ChatSettingsScreen 整合 |
| 对话内功能     | 2      | 0        | 1    | @ 提及、DM 已实现；Thread 缺失 |
| 其他           | 2      | 1        | 0    | GroupTasks 已实现；任务委托 API 已接入 |

---

## 二、逐项对齐矩阵

### 2.1 发送与流式

| 能力         | Web                         | App                         | 状态        |
| ------------ | --------------------------- | --------------------------- | ----------- |
| 发送群消息   | execGroupAgent              | execGroupAgent              | ✅ 对齐     |
| 流式更新     | SSE createStreamConnection  | 轮询 1.2s getOperationStatus + getGroupMessages | ⚠️ 架构不同 |
| 停止生成     | eventSource.abort           | interruptTask               | ✅ 对齐     |
| 乐观更新     | optimisticCreateTmpMessage  | placeholder + merge         | ✅ 对齐     |
| targetId/DM  | trigger_agent_dm           | parseTargetIdFromMentions + targetId | ✅ 对齐 |

### 2.2 消息展示

| 能力                  | Web                         | App                         | 状态    |
| --------------------- | --------------------------- | --------------------------- | ------- |
| compareGroup          | children 递归渲染           | MessageBubble compareGroupChildren | ✅ 对齐 |
| compressedGroup       | toggleMessageGroupExpand    | toggleMessageCollapsed      | ✅ 对齐 |
| 群成员头像/名称        | GroupAvatar、groupMembersById | groupMembersById、groupSupervisorId | ✅ 对齐 |
| GroupTasks            | GroupTasksMessage           | GroupTasksBlock + buildDisplayMessagesWithGroupTasks | ✅ 对齐 |
| supervisor/assistant  | 区分 role                   | MessageBubble 按 agentId 展示 | ✅ 对齐 |

### 2.3 消息操作

| 能力           | Web    | App    | 状态    |
| -------------- | ------ | ------ | ------- |
| 群聊重新生成   | ✅     | ✅ 单条/compareGroup/compressedGroup | ✅ 对齐 |
| 编辑用户消息   | ✅     | ✅     | ✅ 对齐 |
| 删除单条       | ✅     | ✅     | ✅ 对齐 |

### 2.4 配置与入口（ChatSettingsScreen 整合）

| 能力                 | Web                         | App                         | 状态    |
| -------------------- | --------------------------- | --------------------------- | ------- |
| 群组标题/描述        | Profile 页                  | SessionHeaderSection        | ✅ 对齐 |
| 成员管理             | Sidebar Members             | ChatSettingsScreen 成员区   | ✅ 对齐 |
| 添加成员             | AddGroupMemberModal         | AddGroupMemberModal（addAgentsToGroup） | ✅ 对齐 |
| 移除成员             | removeAgentsFromGroup       | removeAgentsFromGroup       | ✅ 对齐 |
| 主持人模型           | GroupRole / MemberSelectionModal | 成员区 Supervisor 行点击 ModelDrawer | ✅ 对齐 |
| allowDM / revealDM   | GroupRole                   | GroupSettingsSection        | ✅ 对齐 |
| 系统提示词           | GroupRole EditableMessage   | GroupSettingsSection        | ✅ 对齐 |
| Opening 消息/问题     | AgentSettings               | GroupSettingsSection        | ✅ 对齐 |
| 清空历史/删除会话    | ✅                          | DangerZoneSection           | ✅ 对齐 |

### 2.5 创建群组流程

| 步骤           | Web                         | App                         | 状态    |
| -------------- | --------------------------- | --------------------------- | ------- |
| 选择成员       | MemberSelectionModal        | AgentSelectionSheet（agentIds） | ✅ 对齐 |
| 主持人模型     | MemberSelectionModal        | AgentSelectionSheet showSupervisorModelPicker | ✅ 对齐 |
| 标题输入       | ✅                          | AgentSelectionSheet showTitleInput | ✅ 对齐 |
| 创建 API       | createGroupWithMembers      | createGroup + addAgentsToGroup | ✅ 对齐 |
| 创建后跳转     | /group/:id 或 profile        | ChatDetail sessionId=group.id | ✅ 对齐 |

### 2.6 对话内功能

| 能力       | Web                         | App                         | 状态    |
| ---------- | --------------------------- | --------------------------- | ------- |
| @ 提及     | mentionItems ALL_MEMBERS + 成员 | GroupMentionInput           | ✅ 对齐 |
| 私信 DM    | targetMemberId + trigger_agent_dm | parseTargetIdFromMentions + targetId | ✅ 对齐 |
| 线程/分支  | Thread 列表、MessageBranch、openThreadInPortal | ❌ 无                       | ❌ 缺失 |
| DM Portal  | GroupThread Portal          | ❌ 无（DM 仅通过 @ 发送）   | ⚠️ 简化 |

### 2.7 群组设定 UI（ChatSettingsScreen）

| 设定项       | Web    | App    | 状态    |
| ------------ | ------ | ------ | ------- |
| allowDM      | ✅     | ✅ GroupSettingsSection | ✅ 对齐 |
| revealDM     | ✅     | ✅ GroupSettingsSection | ✅ 对齐 |
| systemPrompt | ✅     | ✅ GroupSettingsSection | ✅ 对齐 |
| openingMessage | ✅  | ✅ GroupSettingsSection | ✅ 对齐 |
| openingQuestions | ✅ | ✅ GroupSettingsSection | ✅ 对齐 |
| 主持人模型   | ✅     | ✅ 成员区 Supervisor 行 | ✅ 对齐 |
| maxResponseInRow | 有 i18n | ❌ 无 UI | ⚠️ 可选 |
| responseOrder | 有 i18n | ❌ 无 UI | ⚠️ 可选 |
| responseSpeed | 有 i18n | ❌ 无 UI | ⚠️ 可选 |

### 2.8 其他

| 能力               | Web                         | App                         | 状态    |
| ------------------ | --------------------------- | --------------------------- | ------- |
| GroupTasks 展示    | GroupTasksMessage           | GroupTasksBlock             | ✅ 对齐 |
| 任务委托 API       | createClientGroupAgentTaskThread | createClientGroupAgentTaskThread、updateClientTaskThreadStatus | ✅ API 已接入 |
| 任务委托编排       | createGroupOrchestrationExecutors | ❌ 无（依赖 SSE 事件）   | ❌ 缺失 |
| 记忆/搜索/Skills   | 群组内可用（leftActions 含 tools） | 群组内隐藏                 | ⚠️ 差异 |

---

## 三、剩余差距与优先级

### 3.1 缺失（需实现）

| 优先级 | 能力           | 说明                                           |
| ------ | -------------- | ---------------------------------------------- |
| P3     | Thread 列表/分支 | Topic 下 Thread 列表、MessageBranch、DM Portal |
| P3     | 任务委托编排   | 检测 execute_tasks、调用 createClientGroupAgentTaskThread、执行任务（需 SSE 或改造轮询） |

### 3.2 差异（可选增强）

| 能力               | 说明                                           |
| ------------------ | ---------------------------------------------- |
| 流式 SSE           | 用 react-native-sse 替代轮询，实时性更好       |
| 记忆/搜索/Skills   | Web 群组内可用，App 当前隐藏；可评估是否开放   |
| maxResponseInRow 等 | 高级群组参数，Web 有 i18n，App 无 UI           |
| DM Portal          | Web 有独立 DM 对话 Portal，App 仅支持 @ 发送   |

### 3.3 架构差异（保持）

| 维度       | Web    | App    | 说明                     |
| ---------- | ------ | ------ | ------------------------ |
| 流式       | SSE    | 轮询   | RN 环境限制，可后续迁移  |
| 配置入口   | 独立 Profile 页 | ChatSettingsScreen 整合 | 移动端整合更符合 UX |
| 路由       | /group/:id/profile | ChatDetail → ChatSettings | 功能等价           |

---

## 四、相关文件索引

### App（apps/mobile）

| 功能       | 路径 |
| ---------- | ---- |
| 对话       | `screens/ChatDetailScreen.tsx` |
| 设置       | `screens/ChatSettingsScreen.tsx` |
| 群组设定   | `features/ChatSettings/GroupSettingsSection.tsx` |
| 创建群组   | `screens/ChatListScreen.tsx`（AgentSelectionSheet） |
| @ 提及     | `components/ui/GroupMentionInput.tsx` |
| GroupTasks | `lib/groupTasksTransform.ts`、`MessageBubble` GroupTasksBlock |
| Store      | `store/chat.ts`（sendMessage、regenerateMessage、toggleMessageCollapsed、parseTargetIdFromMentions） |
| API        | `lib/api.ts`（agentGroupApi、aiAgentApi、createClientGroupAgentTaskThread） |

### Web（src）

| 功能       | 路径 |
| ---------- | ---- |
| 群聊布局   | `routes/(main)/group/_layout/` |
| 对话       | `routes/(main)/group/features/Conversation/` |
| 输入       | `routes/(main)/group/features/Conversation/MainChatInput/GroupChat.tsx` |
| Profile    | `routes/(main)/group/profile/` |
| 成员管理   | `routes/(main)/group/_layout/Sidebar/GroupConfig/GroupMember.tsx` |
| Thread     | `features/Portal/GroupThread/`、`routes/(main)/group/features/Conversation/ChatItem/Thread.tsx` |

### 共享

| 类型       | 路径 |
| ---------- | ---- |
| 类型       | `packages/types/src/agentGroup/` |
| 数据库     | `packages/database/src/schemas/chatGroup.ts` |
| 默认配置   | `packages/const/src/settings/group.ts` |

---

## 五、审计结论

**已对齐**：发送、停止、乐观更新、compareGroup、compressedGroup、GroupTasks、群成员展示、重新生成、编辑删除、群组配置（ChatSettingsScreen 整合）、成员管理、创建时选成员/主持人、@ 提及、DM、任务委托 API。

**剩余**：Thread 列表与分支、任务委托编排流程（依赖 SSE 或轮询改造）。

**可选**：流式 SSE、群组内记忆/搜索/Skills、高级群组参数 UI。
