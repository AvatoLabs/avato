# 设置语义审计（现状版）

> 审计日期：2026-03-18\
> 前置： [topic-chat-conversation-semantic-audit.zh-CN.md](./topic-chat-conversation-semantic-audit.zh-CN.md)

---

## 一、语义基线

为避免 Session/Topic 混用，移动端设置文案按以下基线执行：

1. **Session（会话）**：容器层，承载模型、记忆开关、标签、清空、删除等设置。
2. **Topic（话题 / 对话）**：会话内的一次对话，不应被误称为会话设置对象。
3. **Chat（聊天）**：可作为产品入口名（如 Tab 名），不作为配置对象语义。

---

## 二、设置层级与对象（当前）

| 层级   | 页面 / 模块            | 配置对象                              | 语义状态  |
| ------ | ---------------------- | ------------------------------------- | --------- |
| 会话级 | `ChatSettingsScreen`   | Session                               | ✅ 已对齐 |
| 助手级 | `AgentConfigScreen`    | Agent（影响该 Agent 的 Session 行为） | ✅ 已对齐 |
| 群组级 | `GroupSettingsSection` | Group Session                         | ✅ 已对齐 |
| 个人级 | `SettingsScreen`       | User                                  | ✅ 已对齐 |

---

## 三、已验证的关键文案（2026-03-18）

以下关键 key 已与 Session 语义一致：

| Key                                      | 当前语义                                |
| ---------------------------------------- | --------------------------------------- |
| `chatSettingsTitle`                      | Session Settings / 会话设置             |
| `chatSettingsClearHistory`               | Clear History / 清空记录（会话内消息）  |
| `chatSettingsDeleteDesc`                 | 删除会话及其中所有话题                  |
| `sessionRenameTitle`                     | Rename Session / 重命名会话             |
| `agentConfigChats`                       | Session / 会话偏好                      |
| `agentConfigSessionOnlyDesc`             | 明确使用 session 术语                   |
| `groupSettingsRevealDMDesc`              | DM 显示在当前 session                   |
| `settingsSavedChat`                      | Session settings saved / 会话设置已保存 |
| `memoryToolOffDesc` / `memoryToolOnDesc` | 作用域明确为当前会话                    |
| `skillsBuiltinMemoryDesc`                | 明确跨会话（across sessions）           |

---

## 四、保留 “对话” 用词的场景（有意保留）

以下文案继续使用 “对话 /conversation” 是合理的，不建议强行替换：

1. `topicEmptyDesc`：Topic 层说明（组织你的对话）。
2. `chatListTopicEmptyDesc`：最近话题视图文案（最近对话）。
3. `memoryEmptyDesc` / `memoryExtractDesc`：记忆从对话内容提取，语义指向 Topic 内容而非 Session 容器。
4. `tabChats` / `chatTitle`：产品入口命名（功能名），非配置对象。

---

## 五、代码侧验证锚点

- `apps/mobile/src/screens/ChatSettingsScreen.tsx`：文件注释已明确 `session-level settings only`。
- `apps/mobile/src/features/ChatSettings/DangerZoneSection.tsx`：注释明确 “delete session (with all its topics)”。
- `apps/mobile/src/features/ChatSettings/GroupSettingsSection.tsx`：`groupSettingsRevealDMDesc` 用 session 语义。
- `apps/mobile/src/screens/AgentConfigScreen.tsx`：`agentConfigChats`、记忆描述均为 session 语义。
- `apps/mobile/src/lib/i18n.ts`：三语 key 已同步为会话语义。

---

## 六、剩余语义债务（低优先级）

1. 组件内部变量名仍有历史命名（如 `conversationExpanded`），虽不影响用户文案，但可逐步重命名为 `session*`。
2. 需持续防止新增文案回归为 “conversation = 会话 / 话题混用”。

---

## 七、变更守则（后续 PR 必遵守）

1. 涉及设置对象时，优先使用 **Session / 会话**。
2. 涉及一次聊天内容时，使用 **Topic / 话题 / 对话**。
3. `Chat` 仅用于功能入口名，不用于精确配置对象。
4. 新增 i18n key 时同步三语，且在 PR 描述中写明 “语义对象是谁”。

---

## 八、结论

设置语义整改已从 “补丁阶段” 进入 “守护阶段”。\
当前重点不是继续大规模改词，而是通过 PR 守则和回归检查防止语义回退。
