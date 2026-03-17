# Group Chat 实现差距审计：App vs Web

本文档全面审计群组对话（Group Chat）在移动端 App 与 Web 端之间的实现差距，包括功能、设定与交互。

**审计范围**：

- **App**：`apps/mobile`（React Native 原生应用）
- **Web**：`src/routes/(main)` + `src/routes/(mobile)`（桌面与移动端 SPA，共享功能）

---

## 一、架构概览

### 1.1 数据层（共享）

| 组件                    | 说明                       |
| ----------------------- | -------------------------- |
| `chat_groups` 表        | 群组元数据、config (jsonb) |
| `chat_groups_agents` 表 | 群组 - 成员关联            |
| `messages.group_id`     | 消息关联群组               |
| `topics.group_id`       | 话题关联群组               |
| `threads.group_id`      | 线程关联群组               |

**ChatGroupConfig（config 字段）**：

- `allowDM`、`revealDM`、`systemPrompt`
- `openingMessage`、`openingQuestions`
- `forkedFromIdentifier`
- 扩展字段（jsonb 可存）：`enableSupervisor`、`orchestratorModel`、`orchestratorProvider`、`maxResponseInRow`、`responseOrder`、`responseSpeed`

### 1.2 API 层（共享）

- `agentGroup.createGroup` / `createGroupWithMembers`
- `agentGroup.getGroupDetail` / `getGroups`
- `agentGroup.updateGroup` / `addAgentsToGroup` / `removeAgentsFromGroup`
- `aiAgent.execGroupAgent`

---

## 二、功能差距对比

### 2.1 路由与导航

| 能力                  | Web                            | Mobile App                              |
| --------------------- | ------------------------------ | --------------------------------------- |
| 群组列表入口          | 侧边栏 Home → 会话分组         | ChatListScreen（会话列表）              |
| 群组对话页            | `/group/:groupId`              | `ChatDetail`（sessionId = groupId）     |
| 群组配置 / Profile 页 | `/group/:groupId/profile`      | **❌ 无**                               |
| 创建群组              | Home 头部 + 按钮、会话分组菜单 | ChatListScreen 底部 FAB「新建群组对话」 |

### 2.2 群组 Profile / 配置页

| 能力              | Web                                                             | Mobile App                             |
| ----------------- | --------------------------------------------------------------- | -------------------------------------- |
| 群组 Profile 页   | ✅ 完整：标题、头像、描述、内容编辑器、开始对话、发布、高级设置 | **❌ 无**                              |
| 成员管理侧边栏    | ✅ Members 手风琴、添加成员、成员列表                           | **❌ 无**                              |
| 话题 / 线程侧边栏 | ✅ Topic 列表、Thread 列表、时间 / 扁平模式                     | **❌ 无**（仅有 TopicListScreen 通用） |
| 群组系统提示词    | ✅ GroupRole 内 EditableMessage                                 | **❌ 无**                              |
| Opening 配置      | ✅ openingMessage、openingQuestions                             | **❌ 无**                              |
| Agent Builder     | ✅ 通过 AI 配置群组                                             | **❌ 无**                              |

### 2.3 对话页（Chat Detail）

| 能力           | Web                                          | Mobile App                          |
| -------------- | -------------------------------------------- | ----------------------------------- |
| 发送消息       | ✅ 支持                                      | ✅ 支持（execGroupAgent）           |
| @ 提及         | ✅ 支持（ALL_MEMBERS + 成员列表）            | **❌ 无**                           |
| 私信 (DM)      | ✅ 支持（trigger_agent_dm）                  | **❌ 无**                           |
| 多成员回复展示 | ✅ Supervisor + Group 消息、AgentGroupAvatar | ✅ 基础（MessageBubble 不区分成员） |
| 话题切换       | ✅ 侧边栏 Topic 列表                         | ✅ TopicListScreen 入口             |
| 线程 / 分支    | ✅ Thread 列表、分支展示                     | **❌ 无**                           |
| 模型切换       | 群组内不展示（主持人模型在配置中）           | ✅ 隐藏（`!isGroupSession`）        |
| 记忆 / 搜索    | 群组内可用                                   | ✅ 隐藏（`isGroupSession` 时禁用）  |
| Skills / 插件  | 群组内可用                                   | ✅ 隐藏（`isGroupSession` 时禁用）  |

### 2.4 群组设置（Settings）

| 设定项                                  | Web                                                  | Mobile App |
| --------------------------------------- | ---------------------------------------------------- | ---------- |
| 主持人 (enableSupervisor)               | ✅ MemberSelectionModal 创建时、CollapseGroup 创建时 | **❌ 无**  |
| 主持人模型 (orchestratorModel/Provider) | ✅ MemberSelectionModal                              | **❌ 无**  |
| 连续回复数 (maxResponseInRow)           | 有 i18n；Group Agent Builder 可通过 AI 配置          | **❌ 无**  |
| 回复顺序 (responseOrder)                | 同上                                                 | **❌ 无**  |
| 回复速度 (responseSpeed)                | 同上                                                 | **❌ 无**  |
| 允许私信 (allowDM)                      | ✅ 配置可更新                                        | **❌ 无**  |
| 显示私信 (revealDM)                     | ✅ 配置可更新                                        | **❌ 无**  |
| 主持人系统提示词 (systemPrompt)         | ✅ GroupRole 编辑                                    | **❌ 无**  |
| Opening 消息 / 问题                     | ✅ AgentSettings Opening tab                         | **❌ 无**  |

### 2.5 ChatSettingsScreen（会话级设置）

| 能力            | Web | Mobile App                              |
| --------------- | --- | --------------------------------------- |
| 重命名          | ✅  | ✅                                      |
| 标签 (tag)      | ✅  | ✅ 仅单 agent 会话（`!isGroupSession`） |
| 跳转 Agent 配置 | ✅  | ✅ 仅单 agent（`!isGroupSession`）      |
| 清空历史        | ✅  | ✅                                      |
| 删除会话        | ✅  | ✅                                      |

**Mobile**：群组会话时，标签、Agent 配置入口被隐藏，仅保留重命名、清空、删除。

### 2.6 创建群组流程

| 步骤       | Web                                        | Mobile App                               |
| ---------- | ------------------------------------------ | ---------------------------------------- |
| 选择成员   | ✅ MemberSelectionModal（create/add 模式） | **❌ 无**，直接 `createGroup({ title })` |
| 主持人开关 | ✅ MemberSelectionModal                    | **❌ 无**                                |
| 主持人模型 | ✅ MemberSelectionModal                    | **❌ 无**                                |
| 创建后跳转 | `/group/:id/profile` 或 `/group/:id`       | `ChatDetail`（sessionId = group.id）     |

**Mobile**：创建群组时不选成员、不设主持人，仅创建空群组并进入对话。API 虽有 `createGroupWithMembers`，但 UI 未调用。

### 2.7 其他入口与模式

| 能力                     | Web                                                        | Mobile App                      |
| ------------------------ | ---------------------------------------------------------- | ------------------------------- |
| Home 输入「sendAsGroup」 | ✅ 输入框选 group 模式，发送后创建群组并跳转 profile       | **❌ 无**（无 Home 输入区模式） |
| CommandMenu 创建群组     | ✅ AskAIMenu 可调用 sendAsGroup                            | **❌ 无**                       |
| 创建入口位置             | 桌面：Home 头部 + 会话分组；移动端 SPA：CollapseGroup 菜单 | ChatListScreen 底部 FAB         |

---

## 三、设定相关 i18n

以下 key 在 `locales/*/setting.json` 中存在，但 **Mobile 无对应 UI**：

- `settingGroupChat.allowDM.*`
- `settingGroupChat.enableSupervisor.*`
- `settingGroupChat.maxResponseInRow.*`
- `settingGroupChat.model.*`（主持人模型）
- `settingGroupChat.orchestratorTitle`
- `settingGroupChat.responseOrder.*`
- `settingGroupChat.responseSpeed.*`
- `settingGroupChat.revealDM.*`
- `settingGroupChat.systemPrompt.*`
- `settingGroupChat.title`

---

## 四、实现差距汇总

### 4.1 Mobile 缺失的核心能力

1. **群组 Profile 页**：无独立配置入口，无法编辑群组元数据、系统提示词、Opening。
2. **成员管理**：无法在 App 内添加 / 移除成员。
3. **@ 提及**：无法 @ 全体或 @ 指定成员。
4. **私信 (DM)**：无 DM 能力。
5. **群组设定 UI**：无 enableSupervisor、主持人模型、allowDM、revealDM 等配置界面。
6. **创建时选成员**：创建群组时不能选择初始成员或主持人配置。
7. **线程 / 分支**：无 Thread 相关 UI。

### 4.2 Web 存在但 Mobile 简化的能力

1. **消息展示**：Mobile 的 MessageBubble 不区分 Supervisor/Group 结构，无 AgentGroupAvatar，不展示回复成员头像 / 名称。
2. **话题**：有 TopicListScreen，但无群组专属侧边栏。
3. **ChatSettings**：群组会话时隐藏标签、Agent 配置，仅保留基础操作。
4. **群组消息操作**：群组内禁用 regenerate、edit（用户消息），保留 copy、share、delete。

### 4.3 共享且一致的能力

1. 发送消息、execGroupAgent 调用。
2. 话题创建与切换（通过 topicApi）。
3. 清空历史、删除会话。
4. 重命名会话（群组标题）。

### 4.4 群聊消息持久化（createMessage）—— 已修复 ✅

**原问题**：App 端曾仅传 `sessionId: cg_xxx`，未传 `groupId`。

**当前**：`buildMessageContainerParams` 在 `sessionType === 'group'` 时正确传 `groupId` + `sessionId: null`；`messageApi.create` 有 `normalizeCreateMessageParams` 兜底；后端 `createMessage` 亦有 `cg_` 检测兜底。详见 `chat-sync-app-web-audit.zh-CN.md` 第九节。

### 4.5 群聊 settle 判定 —— 已修复 ✅

**原问题**：App 对 group completion 判定与 Web 的消息结构语义不一致，导致「group completed but assistant not settled」频发。

**当前**：

- `isGroupAssistantSettled`：compressedGroup 支持 `compressedMessages` 子节点判定；compareGroup 递归检查 children
- `findSettledGroupAssistant`：递归搜索 compareGroup 内嵌套的 assistant
- **信任后端**：当 `operationStatus.isCompleted` 且能在消息树中找到 assistant（by id），直接视为 settled，不再依赖纯 content 判定

---

## 五、建议优先级

| 优先级 | 能力                           | 说明                                           |
| ------ | ------------------------------ | ---------------------------------------------- |
| P0     | 群组 Profile / 配置入口        | 提供编辑群组元数据、系统提示词、Opening 的入口 |
| P0     | 成员管理                       | 添加 / 移除成员                                |
| P1     | @ 提及                         | 输入框支持 @ 选择成员                          |
| P1     | 群组设定（主持人、allowDM 等） | 至少支持常用设定                               |
| P2     | 创建时选成员                   | 创建群组时可选成员与主持人                     |
| P2     | 私信 (DM)                      | 支持 @ 成员发私信                              |
| P3     | 线程 / 分支                    | 视产品需求决定是否在 Mobile 支持               |

---

## 六、相关文件索引

### Web

- 路由：`src/routes/(main)/group/`、`src/spa/router/desktopRouter.config*.tsx`
- 群组 Store：`src/store/agentGroup/`
- 对话：`src/routes/(main)/group/features/Conversation/`
- 输入：`MainChatInput/GroupChat.tsx`（mentionItems）
- 成员选择：`src/components/MemberSelectionModal/`
- 设定：`src/routes/(main)/group/profile/features/AgentSettings/`、`GroupRole.tsx`

### Mobile

- 对话：`apps/mobile/src/screens/ChatDetailScreen.tsx`
- 设置：`apps/mobile/src/screens/ChatSettingsScreen.tsx`
- 列表：`apps/mobile/src/screens/ChatListScreen.tsx`（handleCreateGroup）
- Store：`apps/mobile/src/store/chat.ts`（sendMessage 中 group 分支）
- API：`apps/mobile/src/lib/api.ts`（agentGroupApi、aiAgentApi）

### 共享

- 类型：`packages/types/src/agentGroup/`
- 数据库：`packages/database/src/schemas/chatGroup.ts`、`types/chatGroup.ts`
- 默认配置：`packages/const/src/settings/group.ts`

---

## 七、Web 端路由差异（Desktop vs Mobile SPA）

| 场景           | Desktop                                     | Mobile SPA                           |
| -------------- | ------------------------------------------- | ------------------------------------ |
| 群组对话       | `/group/:id`                                | `/agent/:aid`（aid = groupId）       |
| 群组 Profile   | `/group/:id/profile`                        | 无独立路由                           |
| 群组布局       | GroupLayout + Sidebar（Members、Topic）     | 复用 Agent Chat Layout               |
| 创建群组选成员 | MemberSelectionModal（Home、CollapseGroup） | 同左（CollapseGroup 在 mobile 布局） |

---

## 八、特性开关

- `enableGroupChat`：用户偏好中的实验室开关（`packages/types/src/user/preference.ts`），控制群聊功能可见性。
- `features.groupChat`：labs 文案，用于设置页展示。
