# Chat 实现审计：Web 与 Mobile 两端差距

> 复核时间：2026-03-20\
> 范围：对话（Chat）功能在 Web/Desktop 与 Mobile App 中的实现对比
>
> 执行摘要：
>
> - Mobile 已覆盖核心聊天主链路，但会话级知识库选择、部分高级消息操作、Web 风格的新建会话心智仍未对齐。
> - 历史上 “Mobile 无 Inbox 入口” 的结论已过时，当前实现会单独渲染 Inbox session；真正需要继续关注的是 “新建聊天” 仍然复用 Inbox + quick topic。
> - 快捷键、拖拽上传这类差异更偏平台能力差异，不应与知识库选择、翻译、TTS、继续生成等高价值能力混为同一优先级。

## 一、架构概览

| 维度     | Web / Desktop                             | Mobile                                          |
| -------- | ----------------------------------------- | ----------------------------------------------- |
| 入口     | `src/routes/(main)/agent`、`group`        | `apps/mobile` ChatListScreen → ChatDetailScreen |
| 消息列表 | `Conversation/ChatList` + VirtualizedList | FlashList + MessageBubble                       |
| 输入框   | `ChatInput` + `@lobehub/editor`           | TextInput + BlurView 浮动条                     |
| 状态管理 | ConversationStore + ChatStore             | useChatStore + useSessionStore + useTopicStore  |
| 数据流   | SWR + tRPC                                | 直接 tRPC mutate/query                          |

---

## 二、输入区域（Input Bar）差距

### 2.1 Web 输入栏能力（ActionBar config）

| 能力                | Web               | Mobile             | 说明                                           |
| ------------------- | ----------------- | ------------------ | ---------------------------------------------- |
| 模型选择            | ✅ Model          | ✅ ModelDrawer     | 均有                                           |
| 文件上传            | ✅ fileUpload     | ✅ AttachmentSheet | 均有，Mobile 支持相机 / 相册 / 文档 / 工作区   |
| 知识库 / 文件       | ✅ Knowledge      | ❌                 | Web 有 AttachKnowledgeModal，会话级选知识库    |
| 搜索                | ✅ Search         | ✅ 搜索开关        | 均有                                           |
| 工具 / Skills       | ✅ Tools          | ✅ SkillsSheet     | 均有                                           |
| 记忆                | ✅ Memory         | ✅ MemoryToolSheet | 均有                                           |
| 历史                | ✅ History        | ❌                 | Web 有 Topic 历史侧边栏，Mobile 无等价入口     |
| 清空                | ✅ Clear          | ✅ Eraser          | 均有                                           |
| 保存 Topic          | ✅ SaveTopic      | ❌                 | Web 可保存到 Notebook                          |
| 语音输入 STT        | ✅ STT            | ❌                 | Web 支持语音转文字                             |
| 参数 / Temperature  | ✅ Params         | ❌                 | Web 可调 temperature 等，Mobile 在 AgentConfig |
| Markdown / 排版辅助 | ✅ Typo           | ❌                 | Web 支持更完整的富文本 / 排版辅助              |
| 拖拽上传            | ✅ DragUploadZone | ❌                 | Web 支持拖拽，Mobile 无                        |

### 2.2 知识库 / 文件上下文

**Web**：`ChatInput/ActionBar/Knowledge`，可勾选「文件 / 知识库」绑定到当前会话，发送时随消息传递。

**Mobile**：

- ChatSettingsScreen 无「文件 / 知识库」选择入口
- 仅能通过 Agent 默认配置使用知识库工具
- **无法在会话级切换知识库**，与 RAG 审计结论一致

---

## 三、消息操作（Message Actions）差距

### 3.1 Web 消息操作（useChatListActionsBar）

| 操作              | Web | Mobile | 说明                                                            |
| ----------------- | --- | ------ | --------------------------------------------------------------- |
| 复制              | ✅  | ✅     | 均有                                                            |
| 编辑              | ✅  | ✅     | 均有                                                            |
| 删除              | ✅  | ✅     | 均有                                                            |
| 重新生成          | ✅  | ✅     | 均有                                                            |
| 删除并重新生成    | ✅  | ❌     | Web 有，Mobile 无                                               |
| 分享              | ✅  | ✅     | 均有                                                            |
| 翻译              | ✅  | ❌     | Web 支持多语言翻译                                              |
| TTS 朗读          | ✅  | ❌     | Web 支持语音播放                                                |
| 导出 PDF          | ✅  | ❌     | Web 支持导出为 PDF                                              |
| 分支（Branching） | ✅  | ❌     | Web 支持从某条消息分支对话                                      |
| 折叠 / 展开       | ✅  | ⚠️     | Web 有 collapse/expand，Mobile 有 contentCollapsed 但无统一入口 |
| 继续生成          | ✅  | ❌     | Web 支持 continueGeneration                                     |

### 3.2 消息结构差异

| 能力            | Web                | Mobile                     |
| --------------- | ------------------ | -------------------------- |
| 压缩消息组      | ✅ CompressedGroup | ✅ compressedGroupMessages |
| 分支消息        | ✅ MessageBranch   | ❌ 无分支 UI               |
| Thread 模式     | ✅ Portal Thread   | ❌ 无                      |
| 群组任务        | ✅ GroupTasks      | ✅ GroupTasksBlock         |
| 工具调用渲染    | ✅ Tool/Detail     | ✅ ToolCallsBlock          |
| Thinking / 推理 | ✅                 | ✅ ThinkingBlock           |
| 引用 / 搜索     | ✅                 | ✅ SearchGroundingBlock    |

---

## 四、会话与 Topic 管理差距

### 4.1 会话（Session）与 Topic

| 能力                 | Web                         | Mobile                                 |
| -------------------- | --------------------------- | -------------------------------------- |
| Session 列表         | ✅ 侧边栏 / Home Agent List | ✅ 抽屉目录                            |
| Topic 列表           | ✅ 侧边栏 Topic 树          | ✅ TopicListScreen / 抽屉内 Topic 列表 |
| 新建会话             | ✅ 新建 Agent/Session       | ⚠️ 复用 inbox（slug='inbox'）          |
| 新建 Topic           | ✅                          | ✅ createQuickTopic                    |
| Inbox 展示           | ✅ InboxItem 单独展示       | ✅ 独立 Inbox session 渲染             |
| 置顶 / 重命名 / 删除 | ✅                          | ✅                                     |

### 4.2 复核备注

- **Inbox 入口**：当前 Mobile 已单独渲染 Inbox session，不应再将「无 Inbox 入口」作为现状结论。
- **新建聊天语义**：Mobile 仍通过 Inbox + `createQuickTopic` 建模 “新建聊天”，与 Web 的独立会话心智仍有差距。
- **优先级划分**：会话级知识库选择、消息级翻译 / TTS /continue generation 应优先于纯平台型差异（如快捷键、拖拽上传）。

---

## 五、其他功能差距

### 5.1 快捷键与交互

| 能力     | Web                 | Mobile            |
| -------- | ------------------- | ----------------- |
| 快捷键   | ✅ Cmd+Enter 发送等 | ❌ 无             |
| 拖拽上传 | ✅                  | ❌                |
| 粘贴图片 | ✅                  | ⚠️ 依赖系统剪贴板 |

### 5.2 欢迎与空状态

| 能力              | Web             | Mobile        |
| ----------------- | --------------- | ------------- |
| Opening Questions | ✅              | ⚠️ 部分场景有 |
| 欢迎区            | ✅ AgentWelcome | ✅ EmptyState |
| 建议问题          | ✅              | ⚠️ hints 轮播 |

### 5.3 上下文与数据

| 能力          | Web                          | Mobile                |
| ------------- | ---------------------------- | --------------------- |
| Notebook 文档 | ✅ useFetchNotebookDocuments | ❌ 无                 |
| Topic 记忆    | ✅ useFetchTopicMemories     | ⚠️ 依赖 Agent 配置    |
| 历史消息数    | ✅ historyCount 可配置       | ✅ AgentConfig 中配置 |

---

## 六、能力矩阵汇总

| 类别     | 能力               | Web     | Mobile         |
| -------- | ------------------ | ------- | -------------- |
| **输入** | 知识库 / 文件选择  | ✅      | ❌             |
| **输入** | STT 语音输入       | ✅      | ❌             |
| **输入** | 拖拽上传           | ✅      | ❌             |
| **输入** | 参数 / Temperature | ✅      | ⚠️ AgentConfig |
| **输入** | 保存到 Notebook    | ✅      | ❌             |
| **消息** | 翻译               | ✅      | ❌             |
| **消息** | TTS 朗读           | ✅      | ❌             |
| **消息** | 导出 PDF           | ✅      | ❌             |
| **消息** | 分支对话           | ✅      | ❌             |
| **消息** | 继续生成           | ✅      | ❌             |
| **消息** | 删除并重新生成     | ✅      | ❌             |
| **会话** | Inbox 入口         | ✅      | ✅ 独立渲染    |
| **会话** | 新建会话语义       | ✅ 清晰 | ⚠️ 复用 inbox  |
| **其他** | 快捷键             | ✅      | ❌             |
| **其他** | Notebook 文档      | ✅      | ❌             |

---

## 七、建议改进方向（按优先级）

### P0（高优先级）

1. **会话级知识库选择**：在 ChatSettingsScreen 或输入栏增加「文件 / 知识库」入口，与 Web Knowledge 对齐。
2. **新建会话语义**：明确「新建聊天」= 新建 Topic（inbox 下），或在 UI 上区分「收件箱」与「助理会话」，避免用户误判进入历史会话。
3. **高价值消息操作补齐**：优先补齐翻译、TTS、继续生成，减少与 Web 在核心消息消费场景上的落差。

### P1（中优先级）

4. **消息翻译**：在 MessageBubble 操作菜单中增加翻译。
5. **TTS 朗读**：增加消息 TTS 播放（依赖 expo-av 或类似）。
6. **删除并重新生成**：在消息操作中增加该选项。
7. **继续生成**：在 assistant 消息操作中增加「继续生成」。

### P2（低优先级）

8. **STT 语音输入**：接入系统语音识别或与现有 Speech Service 对齐的移动端 STT 能力，不建议使用仅提供 TTS 的 `expo-speech` 作为方案描述。
9. **导出 PDF**：实现单条 / 多条消息导出为 PDF。
10. **分支对话**：实现从某条消息分支（需 Topic 创建与路由支持）。
11. **拖拽上传**：仅在支持拖拽的平台（如 iPad / 大屏壳体）评估，避免将其作为手机端默认追平目标。
12. **Notebook 文档**：若 Mobile 有 Notebook 场景，增加文档上下文注入。

---

## 八、相关文件索引

| 模块                 | Web                                               | Mobile                                                                                   |
| -------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 对话主入口           | `src/routes/(main)/agent/features/Conversation/`  | `apps/mobile/src/screens/ChatDetailScreen.tsx`                                           |
| 输入栏               | `src/features/ChatInput/`                         | ChatDetailScreen 内联 BlurView                                                           |
| 消息列表             | `src/features/Conversation/ChatList/`             | FlashList + MessageBubble                                                                |
| 消息操作             | `useChatItemContextMenu`、`useChatListActionsBar` | MessageBubble 内 showActions                                                             |
| 知识库               | `src/features/ChatInput/ActionBar/Knowledge/`     | 无                                                                                       |
| 会话列表             | `src/routes/(main)/home/`                         | `ChatListScreen.tsx`                                                                     |
| Topic 管理           | `ConversationStore`                               | `useTopicStore`                                                                          |
| Inbox / 新建话题流程 | -                                                 | `apps/mobile/src/screens/ChatListScreen.tsx`（`ensureInboxSession`、`createQuickTopic`） |
