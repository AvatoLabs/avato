# 群聊功能审计：Mobile vs Web 对齐情况

## 一、新建群聊创建的是什么？

### 结论：新建群聊创建的是 **ChatGroup**（chat_groups 表），不是 Agent、不是 Session、不是 Topic。

| 实体 | 说明 | 新建群聊时是否创建 |
|------|------|-------------------|
| **ChatGroup** | 群组实体，`chat_groups` 表 | ✅ 是 |
| **Supervisor Agent** | 虚拟编排 Agent，`agents` 表 `virtual=true` | ✅ 是（自动创建） |
| **Session** | 单聊会话，`sessions` 表 | ❌ 否 |
| **Topic** | 话题/对话，`topics` 表 | ❌ 否（首次发消息或进入时创建） |

群组在会话列表中**表现为 Session**：`getGroupedSessions` 将 `chat_groups` 映射为 `groupSessions`，与普通 `sessions` 合并返回。群组 ID（`cg_xxx`）作为 `sessionId` 用于路由和 ChatDetail 导航。

---

## 二、Web 端新建群聊流程

### 2.1 创建空群组（新建群聊 → 配置页）

- **入口**：`createGroupChatMenuItem` → `createEmptyGroup` → `mutateGroup`
- **调用**：`createGroup({ config, title }, [], true)`（silent 模式）
- **创建**：ChatGroup + Supervisor Agent
- **导航**：`navigate(\`/group/${groupId}/profile\`)` → **群组配置页**
- **用途**：先配置成员、编排模型等，再开始聊天

### 2.2 创建带成员群组（选成员后创建）

- **入口**：`createGroupWithMembers` / `createGroupChatInGroupMenuItem` 等
- **调用**：`createGroup({ config, title }, selectedAgents)`（非 silent）
- **创建**：ChatGroup + Supervisor Agent + `addAgentsToGroup`
- **导航**：`switchToGroup(group.id)` → `/group/{groupId}`（**聊天页**，无 topic 时为新话题）

### 2.3 数据流

```
chatGroupService.createGroup
  → agentGroupRepo.createGroupWithSupervisor
    → 插入 agents（supervisor 虚拟 agent）
    → 插入 chat_groups
    → 插入 chat_groups_agents（supervisor + members）

getGroupedSessions
  → sessionModel.queryWithGroups()  // 普通 sessions
  → chatGroupModel.queryWithMemberDetails()  // chat_groups
  → groupSessions = chatGroups 映射为 session 形态
  → allSessions = [...sessions, ...groupSessions]
```

---

## 三、Mobile 端新建群聊流程

### 3.1 创建群组

- **入口**：`handleCreateGroup` → `AgentSelectionSheet` → `handleCreateGroupSubmit`
- **调用**：`agentGroupApi.createGroup` + `agentGroupApi.addAgentsToGroup`
- **创建**：ChatGroup + Supervisor Agent（与 Web 相同后端）
- **导航**（与 Web 对齐）：
  - 空群组（无成员）→ `ChatSettings` 配置页，可添加成员后点击「开始对话」进入聊天
  - 带成员群组 → `ChatDetail` 聊天页

### 3.2 与 Web 的差异（已对齐）

| 维度 | Web | Mobile |
|------|-----|--------|
| 空群组创建后 | 进入 `/group/{id}/profile` 配置页 | 进入 ChatSettings 配置页 ✅ |
| 带成员群组创建后 | 进入 `/group/{id}` 聊天页 | 进入 ChatDetail 聊天页 ✅ |
| 群组配置入口 | 新建空群组即进配置页 | 新建空群组即进 ChatSettings ✅ |

---

## 四、对齐情况总结

### 4.1 已对齐

- ✅ **创建实体**：均为 ChatGroup + Supervisor Agent，不创建 Session/Topic
- ✅ **API**：共用 `agentGroup.createGroup`、`addAgentsToGroup`
- ✅ **会话列表**：`getGroupedSessions` 统一返回，群组以 session 形态展示
- ✅ **Topic 创建时机**：首次发消息或进入对话时创建，两端一致

### 4.2 已对齐的差异

- **新建空群组**：Mobile 现与 Web 一致，进入 ChatSettings（配置页）而非 ChatDetail
- **新建带成员群组**：进入 ChatDetail（聊天页），与 Web 一致

---

## 五、相关代码位置

| 功能 | Web | Mobile |
|------|-----|--------|
| 新建群聊入口 | `useCreateMenuItems` createGroupChatMenuItem | `ChatListScreen` handleCreateGroup |
| 创建 API | `chatGroupService.createGroup` | `agentGroupApi.createGroup` |
| 成员选择 | `CreateGroupModal` / `ChatGroupWizard` | `AgentSelectionSheet` |
| 群组配置 | `/group/{id}/profile` | `ChatSettingsScreen`（新建空群组即进 / 从 ChatDetail 进入） |
| 开始对话按钮 | Group Profile 顶部 | ChatSettings 群组配置页顶部（replace 到 ChatDetail，返回至 ChatList） |
| 会话列表 | `getGroupedSessions` | `sessionApi.list` → `getGroupedSessions` |

---

## 六、待后续对齐（可选）

| 功能 | Web | Mobile |
|------|-----|--------|
| 从模板创建群组 | `createGroupFromTemplate` / `ChatGroupWizard` | 未实现 |
| 在会话分组内新建群聊 | `createGroupChatInGroupMenuItem` | 未实现 |
