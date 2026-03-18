# App 细节增强全面审计

> 审计日期：2026-03-17  
> 更新日期：2026-03-18（P1/P2 已落地；群聊 @ 提及、DM 已实现；accessibilityHint 已补齐）  
> 范围：`apps/mobile` 全量功能、UX、性能、无障碍、与 Web 对齐

本文档对移动端 App 进行多维度审计，识别可增强的细节与待完善项，为迭代提供优先级指引。

**下一步（P3）**：Thread 列表与分支、任务委托编排流程、深层链接。

**相关专项审计**：

- [app-performance-vs-web-audit.zh-CN.md](./app-performance-vs-web-audit.zh-CN.md) — 数据拉取与请求去重
- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md) — 同步与标题生成（含 6.1 节 Web vs App 架构对比）
- [chat-flow-app-web-audit.zh-CN.md](./chat-flow-app-web-audit.zh-CN.md) — 聊天流程与群聊
- [group-chat-app-web-gap-audit.zh-CN.md](./group-chat-app-web-gap-audit.zh-CN.md) — 群聊功能差距
- [app-web-architecture-alignment-gap-plan.zh-CN.md](./app-web-architecture-alignment-gap-plan.zh-CN.md) — 架构对齐总表
- [app-vs-web-bug-audit.zh-CN.md](./app-vs-web-bug-audit.zh-CN.md) — Bug 汇总
- [chatlist-smart-rename-audit.zh-CN.md](./chatlist-smart-rename-audit.zh-CN.md) — ChatList 智能重命名与 Web 对比审计
- [resource-preview-app-web-gap-audit.zh-CN.md](./resource-preview-app-web-gap-audit.zh-CN.md) — 资源预览
- [mobile-app-issues-audit.zh-CN.md](./mobile-app-issues-audit.zh-CN.md) — 资源 / 商店 / Topic 问题

---

## 一、审计维度总览

| 维度          | 状态                                              | 优先级建议 |
| ------------- | ------------------------------------------------- | ---------- |
| 功能完整性    | 核心流程已覆盖，群聊 @ 提及/DM/GroupTasks/Topic 总结已实现，Thread/任务委托编排待实现 | P3         |
| 同步与标题    | ✅ Focus/重连/前台刷新、默认标题集已对齐 Web      | -          |
| 性能与数据流  | 请求去重已修复，轮询 vs SSE 可优化                | P2         |
| UX / 交互细节 | ✅ 骨架屏、空态、错误重试已补齐                   | -          |
| 无障碍        | ✅ 列表项、Modal、图标按钮已系统性补齐            | -          |
| i18n          | 覆盖较全，审计注释已清理                          | P2         |
| 错误处理      | ✅ Toast 支持 onRetry，session/topic/file 已接入  | -          |
| 导航与入口    | ✅ DiscoverScreen 已从 Profile 接入               | -          |
| 移动端特性    | 触觉、手势、深色模式、下拉刷新已有                | P2         |

---

## 二、功能与入口

### 2.1 屏幕清单与状态

| 屏幕               | 状态 | 说明                                                              |
| ------------------ | ---- | ----------------------------------------------------------------- |
| ChatListScreen     | ✅   | 主入口，HeroComposer、创建会话 / 群聊 / 标签                      |
| ChatDetailScreen   | ✅   | 对话详情、流式、群聊、工具调用                                    |
| ChatSettingsScreen | ✅   | 模型、Agent、群组、标签、清空 / 删除                              |
| TopicListScreen    | ✅   | 主题列表、创建 / 重命名 / 删除                                    |
| StoreScreen        | ✅   | Explore/Installed、MCP/Skills、安装 / 卸载                        |
| ProfileScreen      | ✅   | 工作区概览、统计、快捷设置                                        |
| ResourceScreen     | ✅   | 文件管理、预览（图片 / PDF/Office）                               |
| ArtworkScreen      | ✅   | 图片生成、主题、批次                                              |
| MemoryScreen       | ✅   | 记忆管理、身份 / 活动 / 上下文                                    |
| NotebookScreen     | ✅   | 笔记本文档                                                        |
| SettingsScreen     | ✅   | 全局设置、记忆、深色、语言                                        |
| ServerConfigScreen | ✅   | 服务器 URL、连接测试                                              |
| LoginScreen        | ✅   | OIDC 登录                                                         |
| **DiscoverScreen** | ✅   | 市场浏览（Agents/Models/Providers），已从 Profile「发现」入口接入 |

### 2.2 待完善功能（参考专项审计）

| 能力                        | 来源                    | 优先级 | 状态      |
| --------------------------- | ----------------------- | ------ | --------- |
| 群聊 @ 提及、DM             | group-chat-app-web-gap  | P2     | ✅ 已实现 |
| 群聊 Thread                 | group-chat-app-web-gap  | P3     | 待实现    |
| 群聊 Profile 页、成员管理   | group-chat-app-web-gap  | P2     | ✅ 已实现（ChatSettingsScreen 整合） |
| GroupTasks 展示            | chat-flow-app-web-audit | P3     | ✅ 已实现 |
| 任务委托 execute_tasks     | chat-flow-app-web-audit | P3     | API 已接入，编排流程待实现 |
| compressedGroup 展开 / 折叠 | chat-flow-app-web-audit | P2     | ✅ 已实现 |
| Topic 自动总结              | mobile-app-issues-audit | P2     | ✅ 已实现（triggerTopicTitleGeneration + Toast 失败提示） |
| 群聊重新生成                | chat-flow-app-web-audit | P1     | ✅ 已实现 |
| ChatList 智能重命名         | chatlist-smart-rename-audit | P2     | ✅ 已实现（依赖 SystemAgent 配置，返回 null 时 Toast + 引导提示） |

---

## 三、UX 与交互细节

### 3.1 加载态与骨架屏

| 场景       | 当前                                                        | 状态 |
| ---------- | ----------------------------------------------------------- | ---- |
| 消息列表   | MessageListSkeleton                                         | ✅   |
| 会话列表   | ListSkeleton                                                | ✅   |
| 主题列表   | ListSkeleton                                                | ✅   |
| Store 列表 | CardSkeleton                                                | ✅   |
| 资源列表   | FileGridSkeleton                                            | ✅   |
| 详情页     | ContentSkeleton（AgentDetail、ProviderDetail、AgentConfig） | ✅   |

### 3.2 反馈一致性

| 类型   | 当前                                                         | 状态 |
| ------ | ------------------------------------------------------------ | ---- |
| 成功   | Toast + haptics.success                                      | ✅   |
| 错误   | Toast + classifyError + onRetry（session/topic/file 已接入） | ✅   |
| 加载中 | ActivityIndicator + FilePreview 进度文案                     | ✅   |
| 空态   | EmptyState 统一组件（ChatList、Topic、Store、Resource）      | ✅   |
| 确认   | Alert.alert                                                  | 保持 |

### 3.3 触觉与动效

| 能力            | 状态                                                                |
| --------------- | ------------------------------------------------------------------- |
| haptics.light   | ✅ 部分按钮                                                         |
| haptics.success | ✅ 操作成功                                                         |
| FadeIn/FadeOut  | ✅ 消息、列表项                                                     |
| LayoutAnimation | ✅ 部分列表变更                                                     |
| 下拉刷新        | ✅ ChatList、TopicList、Resource、Store、Profile、Discover 等已支持 |

### 3.4 输入与键盘

| 能力                 | 状态                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| KeyboardAvoidingView | ✅ ChatDetailScreen、ArtworkScreen                                  |
| 发送快捷键           | 无独立配置，依赖系统键盘「发送」键                                   |
| 输入框自动聚焦       | ✅ PromptModal、ProfileEditScreen、MemoryScreen 有 autoFocus        |
| 长按菜单             | ✅ MessageBubble、ChatListScreen（ActionSheet）                       |

---

## 四、无障碍

### 4.1 当前覆盖

- **accessibilityLabel**：ModelPickerScreen、TopicItem、HeroComposer、ChatDetailScreen、ChatListScreen、MessageBubble、PressableScale、ScreenHeader、FileRow、ItemCard、EmptyState、Toast 重试按钮
- **accessibilityRole**：按钮、列表项、返回键等已覆盖
- **tabBarAccessibilityLabel**：Tab 有（如 "Chats tab"）
- **accessibilityViewIsModal**：AttachmentSheet、PromptModal、AgentSelectionSheet、TagEditorSheet、ModelDrawer、MemoryToolSheet、SkillsSheet、ImageViewer、TopicItem、MessageBubble、ChatListScreen、StoreScreen、ResourceScreen、AgentConfigScreen、ChatSettingsScreen、MemoryScreen 等 Modal 已补齐

### 4.2 待补齐

| 区域              | 建议                                                | 状态      |
| ----------------- | --------------------------------------------------- | --------- |
| 列表项            | 为 FlashList/FlatList 每项增加 `accessibilityLabel` | ✅ 已补齐 |
| 图标按钮          | 所有仅图标按钮需 `accessibilityLabel`               | ✅ 已补齐 |
| 表单              | 输入框需 `accessibilityLabel` 描述用途              | ✅ 已补齐 |
| 弹窗              | Sheet/Modal 需 `accessibilityViewIsModal`           | ✅ 已补齐 |
| 动态内容          | 消息流、加载完成需 `accessibilityLiveRegion`        | ✅ 已补齐 |
| accessibilityHint | 关键操作可增加操作提示                              | ✅ 已补齐（ScreenHeader 返回/保存、Toast 重试） |

### 4.3 对比参考

- Web 有更完整的 aria-\* 与 focus 管理
- App 可参考 [ui-ux-audit-roadmap.zh-CN.md](./ui-ux-audit-roadmap.zh-CN.md) 中的无障碍建议

---

## 五、i18n

### 5.1 实现

- **方案**：自研 store（`apps/mobile/src/lib/i18n.ts`），非 react-i18next
- **语言**：en-US、zh-CN、zh-TW
- **存储**：AsyncStorage `avato_locale`

### 5.2 审计结论（已完成）

| 审计项           | 结论                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| 硬编码           | `chat.ts` 中 `DEFAULT_SESSION_TITLES` 为匹配默认标题用，硬编码合理  |
| 用户文案         | 已通过 `t` 接入，无遗漏                                             |
| 新增功能强制 key | 需在 PR 检查中强制                                                   |

### 5.3 Key 命名规范（建议）

- **格式**：`<模块><子模块>.<功能>.<属性>`，如 `chatListCreateAgent`、`accessibilityGoBack`
- **模块前缀**：`chat`、`topic`、`me`、`discover`、`store`、`accessibility`、`error`、`toast` 等
- **新增时**：同步补充 en-US、zh-CN、zh-TW 三语

### 5.4 群聊设定 keys（Web 有、App 待用）

以下 key 在 `locales/*/setting.json` 已存在，App 实现群组 Profile/设定 UI 时可直接复用：

| Key                                      | 用途               |
| ---------------------------------------- | ------------------ |
| `settingGroupChat.title`                 | 聊天设置           |
| `settingGroupChat.enableSupervisor.*`    | 启用主持人         |
| `settingGroupChat.model.*`               | 主持人模型         |
| `settingGroupChat.orchestratorTitle`     | 主持人设置         |
| `settingGroupChat.maxResponseInRow.*`    | 连续回复数         |
| `settingGroupChat.responseOrder.*`       | 回复顺序           |
| `settingGroupChat.responseSpeed.*`      | 回复速度           |
| `settingGroupChat.allowDM.*`             | 允许私信           |
| `settingGroupChat.revealDM.*`            | 显示私信           |
| `settingGroupChat.systemPrompt.*`        | 主持人系统提示词   |

---

## 六、错误处理

### 6.1 当前模式

- **classifyError**：network、auth、server、timeout、unknown → i18n 键
- **Toast**：`useToast().show('error', t[messageKey])`
- **Store catch**：统一 classifyError + Toast

### 6.2 可增强

| 场景     | 建议                                 | 状态                                             |
| -------- | ------------------------------------ | ------------------------------------------------ |
| 网络错误 | 增加「重试」按钮或自动重试           | ✅ Toast 支持 onRetry，session/topic/file 已接入 |
| 401/403  | 引导至登录或权限说明                 | ✅ errorAuth 文案已更新，Toast 支持「前往登录」按钮 |
| 上传失败 | 区分「重试上传」与「取消」           | ✅ FilePreview 有重试，Toast 支持 onRetry        |
| 流式中断 | 明确提示「生成已停止」与「继续」选项 | ✅ 停止生成时 Toast 提示「生成已停止」           |

---

## 七、性能与数据流

### 7.1 已修复（见 app-performance-vs-web-audit）

- fetchSessions、fetchMessages、fetchTopics 请求去重
- reset 时清理 in-flight Map

### 7.2 可优化

| 项           | 说明                                                                 |
| ------------ | -------------------------------------------------------------------- |
| 群聊流式     | Web 用 SSE，App 用轮询（1.2s）。技术方案见「群聊与 Web 对齐专项」   |
| 图片加载     | 已用 expo-image，可评估尺寸 / 缩略图策略                             |
| 列表虚拟化   | FlashList 已用，可确认长列表性能                                     |
| Store 初始化 | 可评估按需加载、懒加载                                               |

### 7.3 同步与标题生成专项（对齐 Web）

> 参考：[chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md)、[app-web-architecture-alignment-gap-plan.zh-CN.md](./app-web-architecture-alignment-gap-plan.zh-CN.md) Milestone A

#### 7.3.1 同步机制对比

| 维度           | Web                                   | App                                              | 状态 |
| -------------- | ------------------------------------- | ------------------------------------------------ | ---- |
| 数据获取       | SWR（`useClientDataSWR`）             | 手动 `fetchXxx` + `useEffect` / `useFocusEffect` |
| Focus 刷新     | `revalidateOnFocus: true`，5 分钟节流 | ChatDetailScreen、StoreScreen、ChatListScreen 有 | ✅  |
| 重连刷新       | `revalidateOnReconnect: true`         | NetInfo `wasOffline && !offline` → syncMobileBootstrapState | ✅  |
| 前台唤醒       | -                                     | AppState `active` → syncMobileBootstrapState     | ✅  |
| 刷新范围       | ChatListScreen focus 时               | ChatListScreen、ChatDetailScreen、StoreScreen focus 时 fetchSessions | ✅  |
| Messages/Topics | Tab focus 时                         | ChatDetailScreen useFocusEffect 时 fetchMessages、fetchTopics | ✅  |

**结论**：同步机制已对齐。详见 chat-sync-app-web-audit 第八节「已实施的改进」。

#### 7.3.2 标题生成触发时机与架构差异

| 场景       | Web                         | App                                                                 | 状态 |
| ---------- | --------------------------- | ------------------------------------------------------------------- | ---- |
| 单 Agent   | streaming 完成、assistant 持久化后 | 同上，`triggerTopicTitleGeneration` + `sessionApi.generateTitle` | ✅  |
| 群聊       | execGroupAgent 完成、settle 后 | 同上，group polling 中 didSettle 后触发                           | ✅  |
| 后端 API   | -                           | `session.generateSessionTitle`、`topic.generateTopicTitle`        | 共享 |
| 模型来源   | systemAgent.topic           | SystemAgentService.getTaskModelConfig('topic')                      | 共享 |

**架构差异**：Web 的 Topic 标题（含智能重命名）用 `chatService.fetchPresetTaskResult`（客户端 LLM 流式）；App 用服务端 tRPC。详见 [chat-sync-app-web-audit 6.1 节](./chat-sync-app-web-audit.zh-CN.md)、[chatlist-smart-rename-audit](./chatlist-smart-rename-audit.zh-CN.md)。

#### 7.3.3 默认标题识别集

| 类型       | 服务端（session.ts）                                      | App（chat.ts）                                                          | 状态 |
| ---------- | --------------------------------------------------------- | ----------------------------------------------------------------------- | ---- |
| Session    | `''`, `New Chat`, `New Conversation`, `New conversation`, `New Group Chat`, `新对话`, `新對話`, `Untitled` | 已对齐（含上述 + 动态 `t.chatListNewConversation` 等）                  | ✅  |
| Topic      | -                                                         | `''`, `New Chat`, `New Conversation`, `新对话`, `新對話`, `Topics`, `话题`, `話題`, `Untitled` + 动态 | 服务端 topic 无独立列表，App 自洽 |

#### 7.3.4 标题生成后刷新

| 动作                 | App 当前行为                                               | 状态 |
| -------------------- | ---------------------------------------------------------- | ---- |
| 生成成功             | `updateSessionTitle` + `fetchSessions` 或 `fetchTopics`   | ✅  |
| 生成失败             | Toast 提示 `toastTitleGenerationFailed`                   | ✅ 已补齐 |
| 跨端可见性           | Web 改标题后 App 需 focus ChatListScreen 才刷新           | ✅ 已满足（focus 触发 fetchSessions） |

#### 7.3.5 与架构对齐总表的关系

- **app-web-architecture-alignment-gap-plan** Milestone A 第 3 项：「群聊/普通会话标题同步不一致」
- **已落地**：Focus 刷新、重连刷新、标题生成触发时机、群聊 settle 后触发、**DEFAULT_SESSION_TITLES 与服务端对齐**
- **已补齐**：生成失败时 Toast 提示；流式中断时 Toast 提示「生成已停止」；401/403 时 Toast 支持「前往登录」按钮

---

## 八、导航与结构

### 8.1 DiscoverScreen

- **现状**：DiscoverScreen 已从 ProfileScreen（Me tab）「发现」入口接入，可正常访问

### 8.2 导航层级

- RootNavigator → MainTabs + Stack 屏幕
- 动画：fade、slide_from_right、slide_from_bottom
- 建议：统一返回手势与过渡动画

### 8.3 深层链接

- **现状**：无显式 deep link 配置；`Linking.openURL` 用于打开外链，ChatDetailScreen 注释提及 topicId 可来自 search/deep link，但入口未实现
- **建议**：可评估 `expo-linking` 或 React Navigation linking 配置，支持 `/chat/:sessionId`、通知点击跳转

---

## 九、移动端特性

### 9.1 已支持

- 深色模式（ThemeProvider、theme store）
- 触觉反馈（haptics）
- 安全区域（useSafeAreaInsets）
- 图片选择（expo-image-picker）
- 文档选择（expo-document-picker）
- 文件系统（expo-file-system）

### 9.2 可增强

| 能力     | 建议                          | 状态      |
| -------- | ----------------------------- | --------- |
| 下拉刷新 | 会话列表、主题列表、资源列表  | ✅ 已支持 |
| 左滑操作 | 会话项删除 / 固定 | ✅ 已实现（左滑显示删除，确认后删除；长按 ActionSheet 保留） |
| 长按预览 | 链接、图片预览                | 待增强    |
| 分享     | 消息、文件分享到系统          | 部分支持  |
| 后台刷新 | 可选，用于同步未读等          | 待评估    |

---

## 十、资源与预览

### 10.1 参考 resource-preview-app-web-gap-audit

- 图片：已用 expo-image + 缓存
- PDF/Office：WebView，比 Web react-pdf 慢
- 可评估：缩略图、预加载、离线缓存

---

## 十一、优先级路线图

### P0（已完成）

- 清空对话持久化
- 请求去重（session/topic/chat）
- 默认模型解析

### P1（已完成 ✅）

1. **DiscoverScreen**：已从 Profile 接入
2. **群聊重新生成**：已实现
3. **骨架屏扩展**：ListSkeleton、CardSkeleton、FileGridSkeleton、ContentSkeleton
4. **空态统一**：EmptyState 组件

### P2（体验增强）

| 项                                                                      | 状态          |
| ----------------------------------------------------------------------- | ------------- |
| 无障碍：accessibilityLabel/Role、Modal accessibilityViewIsModal、列表项 | ✅ 已补齐     |
| 无障碍：图标按钮 ScreenHeader rightElement、AgentDetail 返回键          | ✅ 已补齐     |
| 错误重试：Toast onRetry、session/topic/file                             | ✅ 已实现     |
| compressedGroup 展开 / 折叠                                             | ✅ 已实现     |
| 下拉刷新                                                                | ✅ 已确认支持 |
| i18n：审计与规范、key 命名、settingGroupChat keys 文档                    | ✅ 已完成    |
| 群聊 SSE：技术方案、实现步骤、可行性评估                                 | ✅ 已完成    |

**P2 审计结论**：

- **i18n**：见第五节 5.2–5.4，规范与群聊 keys 已文档化。
- **群聊 SSE**：见「群聊与 Web 对齐专项」技术方案。

### 群聊与 Web 对齐专项（详细审计）

#### 对齐矩阵

| 能力                     | Web                         | App                         | 状态        | 备注 |
| ------------------------ | --------------------------- | --------------------------- | ----------- | ---- |
| **发送与流式**           |                             |                             |             |      |
| 发送群消息               | execGroupAgent             | execGroupAgent              | ✅ 对齐     |      |
| 流式更新                 | SSE `createStreamConnection`| 轮询 1.2s                   | ⚠️ 架构不同 | 见 SSE 方案 |
| 停止生成                 | eventSource.abort           | interruptTask               | ✅ 对齐     |      |
| 乐观更新                 | optimisticCreateTmpMessage  | placeholder + merge         | ✅ 对齐     |      |
| **消息展示**             |                             |                             |             |      |
| compareGroup             | ✅                          | MessageBubble compareGroupChildren | ✅ 对齐 |      |
| compressedGroup 展开折叠 | toggleMessageGroupExpand   | toggleMessageCollapsed      | ✅ 已实现   | chat store |
| 群成员头像/名称          | GroupAvatar、groupMembersById | groupMembersById、groupSupervisorId | ✅ 对齐 |      |
| **消息操作**             |                             |                             |             |      |
| 群聊重新生成             | regenerateMessage          | regenerateMessage（group 分支） | ✅ 已实现 | 单条/compareGroup/compressedGroup |
| 编辑/删除单条            | ✅                          | ✅                          | ✅ 对齐     |      |
| **配置与入口**           |                             |                             |             |      |
| 群组 Profile 页          | `/group/:id/profile`       | ChatSettingsScreen 整合     | ✅ 已实现   | -    |
| 成员管理                 | Members 侧边栏、添加/移除   | ChatSettingsScreen 成员区   | ✅ 已实现   | -    |
| 创建时选成员/主持人      | MemberSelectionModal       | CreateGroupSheet 支持 agentIds + supervisorConfig | ✅ 已实现 | -   |
| **对话内功能**           |                             |                             |             |      |
| @ 提及                   | ALL_MEMBERS + 成员列表     | GroupMentionInput           | ✅ 已实现   | -    |
| 私信 DM                  | trigger_agent_dm           | parseTargetIdFromMentions + targetId | ✅ 已实现 | -    |
| 线程/分支                | Thread 列表、分支展示      | ❌ 无                       | ❌ 缺失     | P3   |
| **群组设定 UI**          |                             |                             |             |      |
| 主持人/模型/allowDM 等   | GroupRole、MemberSelectionModal | ChatSettingsScreen GroupSettingsSection | ✅ 已实现 | -   |
| **其他**                 |                             |                             |             |      |
| GroupTasks 展示          | GroupTasksMessage          | GroupTasksBlock + buildDisplayMessagesWithGroupTasks | ✅ 已实现 | -    |
| 任务委托 execute_tasks   | createClientGroupAgentTaskThread | API 已接入，编排流程待实现 | ⚠️ 部分 | P3   |

#### 群聊 SSE 技术方案（已完成评估）

**现状**：App 使用轮询（`getOperationStatus` + `getGroupMessages`，1.2s 间隔），Web 使用 SSE（`/api/agent/stream?operationId=xxx`）。

**可行性**：

- **库**：`react-native-sse`（99K weekly）或 `react-native-event-source-ts`，均基于 XHR，支持 RN。
- **端点**：`${baseUrl}/api/agent/stream?operationId=${operationId}&includeHistory=false&lastEventId=0`
- **认证**：需在 headers 中传入 `X-lobe-chat-auth` 或 `Oidc-Auth`（与现有 trpc 一致）。

**实现步骤**：

1. 安装 `react-native-sse`，封装 `createGroupStreamConnection(operationId, { onEvent, onError, onConnect, onDisconnect })`。
2. 在 `chat.ts` 的 `sendMessage` 群聊分支中，`execGroupAgent` 返回 `operationId` 后，连接 SSE 替代轮询。
3. 解析 `StreamEvent`（与 Web `internal_handleAgentStreamEvent` 一致），合并到 `messagesBySession`。
4. `abortController` 时调用 `eventSource.close()`。

**收益**：实时推送、减少轮询请求、与 Web 架构一致。**风险**：需验证 RN 环境下长连接稳定性与后台恢复。

### P3（功能扩展 / 下一步）

| 项                     | 说明                                                         | 状态   |
| ---------------------- | ------------------------------------------------------------ | ------ |
| 群聊 Thread            | Thread 列表、分支展示                                        | 待实现 |
| GroupTasks 展示        | 解析并渲染 GroupTasksMessage                                 | ✅ 已实现 |
| 任务委托 execute_tasks | createClientGroupAgentTaskThread API 已接入；编排流程（检测 execute_tasks、触发执行）待实现 | 部分   |
| Topic 自动总结         | triggerTopicTitleGeneration、默认标题识别、失败 Toast         | ✅ 已实现 |
| 深层链接、推送跳转     | expo-linking、通知点击跳转                                   | 待实现 |

---

## 十二、相关文件索引

| 类别       | 路径                                                                                         |
| ---------- | -------------------------------------------------------------------------------------------- |
| 导航       | `apps/mobile/src/navigation/index.tsx`                                                       |
| Store      | `apps/mobile/src/store/*.ts`                                                                 |
| API        | `apps/mobile/src/lib/api.ts`                                                                 |
| i18n       | `apps/mobile/src/lib/i18n.ts`                                                                |
| 错误       | `apps/mobile/src/lib/errorHandler.ts`                                                        |
| 主题       | `apps/mobile/src/theme/`、`ThemeProvider.tsx`                                                |
| 核心 UI    | `MessageBubble`、`HeroComposer`、`ScreenHeader`                                              |
| 骨架屏     | `ListSkeleton`、`CardSkeleton`、`FileGridSkeleton`、`ContentSkeleton`、`MessageListSkeleton` |
| 空态       | `EmptyState`                                                                                 |
| 群聊       | `chat.ts`（sendMessage、regenerateMessage、toggleMessageCollapsed、parseTargetIdFromMentions）、`MessageBubble`、`GroupMentionInput`、`groupTasksTransform.ts` |
| 任务委托   | `api.ts`（createClientGroupAgentTaskThread、updateClientTaskThreadStatus） |
| 同步/标题  | `chat.ts`（DEFAULT_SESSION_TITLES、triggerTopicTitleGeneration）、`App.tsx`（syncMobileBootstrapState）、`ChatDetailScreen`（useFocusEffect）、`ChatListScreen`（handleSmartRename） |

---

## 十三、审计总结（截至 2026-03-18）

| 维度         | 结论                                                                 |
| ------------ | -------------------------------------------------------------------- |
| **功能**     | 核心流程完整，群聊重新生成、compressedGroup、ChatList 智能重命名、@ 提及、DM、GroupTasks、Topic 总结已实现；Thread、任务委托编排待实现 |
| **同步**     | Focus 刷新、重连刷新、前台唤醒已对齐 Web；Session/Topic 标题生成依赖服务端 SystemAgent |
| **UX**       | 骨架屏、空态、错误重试、Toast onRetry 已补齐                         |
| **无障碍**   | 列表项、Modal、图标按钮、accessibilityLiveRegion、accessibilityHint 已补齐 |
| **性能**     | 请求去重已修复；群聊 SSE 技术方案已评估，可替代轮询                   |
| **待办**     | Thread、任务委托、深层链接（@ 提及、DM、GroupTasks、群聊 Profile/成员管理/左滑删除已实现） |
