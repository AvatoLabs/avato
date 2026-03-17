# App 细节增强全面审计

> 审计日期：2026-03-17\
> 更新日期：2026-03-18（P1/P2 主要项已落地）\
> 范围：`apps/mobile` 全量功能、UX、性能、无障碍、与 Web 对齐

本文档对移动端 App 进行多维度审计，识别可增强的细节与待完善项，为迭代提供优先级指引。

**相关专项审计**：

- [app-performance-vs-web-audit.zh-CN.md](./app-performance-vs-web-audit.zh-CN.md) — 数据拉取与请求去重
- [chat-flow-app-web-audit.zh-CN.md](./chat-flow-app-web-audit.zh-CN.md) — 聊天流程与群聊
- [group-chat-app-web-gap-audit.zh-CN.md](./group-chat-app-web-gap-audit.zh-CN.md) — 群聊功能差距
- [app-vs-web-bug-audit.zh-CN.md](./app-vs-web-bug-audit.zh-CN.md) — Bug 汇总
- [resource-preview-app-web-gap-audit.zh-CN.md](./resource-preview-app-web-gap-audit.zh-CN.md) — 资源预览
- [mobile-app-issues-audit.zh-CN.md](./mobile-app-issues-audit.zh-CN.md) — 资源 / 商店 / Topic 问题

---

## 一、审计维度总览

| 维度          | 状态                                              | 优先级建议 |
| ------------- | ------------------------------------------------- | ---------- |
| 功能完整性    | 核心流程已覆盖，群聊重新生成已实现，Thread 有差距 | P2         |
| 性能与数据流  | 请求去重已修复，轮询 vs SSE 可优化                | P2         |
| UX / 交互细节 | ✅ 骨架屏、空态、错误重试已补齐                   | -          |
| 无障碍        | ✅ 列表项、Modal、ScreenHeader 已系统性补齐       | P2 剩余    |
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
| 群聊 @ 提及、DM、Thread     | group-chat-app-web-gap  | P2     | 待实现    |
| 群聊 Profile 页、成员管理   | group-chat-app-web-gap  | P2     | 待实现    |
| GroupTasks、任务委托        | chat-flow-app-web-audit | P2     | 待实现    |
| compressedGroup 展开 / 折叠 | chat-flow-app-web-audit | P2     | ✅ 已实现 |
| Topic 自动总结              | mobile-app-issues-audit | P2     | 待实现    |
| 群聊重新生成                | chat-flow-app-web-audit | P1     | ✅ 已实现 |

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

| 能力                 | 状态                |
| -------------------- | ------------------- |
| KeyboardAvoidingView | ✅ ChatDetailScreen |
| 发送快捷键           | 需确认              |
| 输入框自动聚焦       | 需确认              |
| 长按菜单             | ✅ MessageBubble    |

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
| 图标按钮          | 所有仅图标按钮需 `accessibilityLabel`               | 部分      |
| 表单              | 输入框需 `accessibilityLabel` 描述用途              | 待补齐    |
| 弹窗              | Sheet/Modal 需 `accessibilityViewIsModal`           | ✅ 已补齐 |
| 动态内容          | 消息流、加载完成需 `accessibilityLiveRegion`        | 待补齐    |
| accessibilityHint | 关键操作可增加操作提示                              | 待补齐    |

### 4.3 对比参考

- Web 有更完整的 aria-\* 与 focus 管理
- App 可参考 [ui-ux-audit-roadmap.zh-CN.md](./ui-ux-audit-roadmap.zh-CN.md) 中的无障碍建议

---

## 五、i18n

### 5.1 实现

- **方案**：自研 store（`src/lib/i18n.ts`），非 react-i18next
- **语言**：en-US、zh-CN、zh-TW
- **存储**：AsyncStorage `avato_locale`

### 5.2 已知问题

- `i18n.ts` 中审计注释已清理
- 部分文案可能硬编码或 fallback 不统一
- 新增功能需同步补充三语

### 5.3 建议

- 建立 i18n key 命名规范
- 新增功能时强制补充 key
- 定期审计未使用 key 与缺失 key

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
| 401/403  | 引导至登录或权限说明                 | 待增强                                           |
| 上传失败 | 区分「重试上传」与「取消」           | ✅ FilePreview 有重试，Toast 支持 onRetry        |
| 流式中断 | 明确提示「生成已停止」与「继续」选项 | 待增强                                           |

---

## 七、性能与数据流

### 7.1 已修复（见 app-performance-vs-web-audit）

- fetchSessions、fetchMessages、fetchTopics 请求去重
- reset 时清理 in-flight Map

### 7.2 可优化

| 项           | 说明                                                  |
| ------------ | ----------------------------------------------------- |
| 群聊流式     | Web 用 SSE，App 用轮询（1.2s），可评估 RN EventSource |
| 图片加载     | 已用 expo-image，可评估尺寸 / 缩略图策略              |
| 列表虚拟化   | FlashList 已用，可确认长列表性能                      |
| Store 初始化 | 可评估按需加载、懒加载                                |

---

## 八、导航与结构

### 8.1 DiscoverScreen

- **现状**：DiscoverScreen 已从 ProfileScreen（Me tab）「发现」入口接入，可正常访问

### 8.2 导航层级

- RootNavigator → MainTabs + Stack 屏幕
- 动画：fade、slide_from_right、slide_from_bottom
- 建议：统一返回手势与过渡动画

### 8.3 深层链接

- 需确认是否支持 deep link（如 `/chat/:sessionId`）
- 可评估通知点击跳转

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
| 左滑操作 | 会话项删除 / 固定（若未实现） | 待评估    |
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
| 错误重试：Toast onRetry、session/topic/file                             | ✅ 已实现     |
| compressedGroup 展开 / 折叠                                             | ✅ 已实现     |
| 下拉刷新                                                                | ✅ 已确认支持 |
| i18n：审计与规范                                                        | 待审计        |
| 群聊 SSE：若 RN 支持 EventSource                                        | 待评估        |

### P3（功能扩展）

1. 群聊 @ 提及、DM、Thread
2. GroupTasks、任务委托
3. Topic 自动总结
4. 深层链接、推送跳转

---

## 十二、相关文件索引

| 类别    | 路径                                                                                         |
| ------- | -------------------------------------------------------------------------------------------- |
| 导航    | `apps/mobile/src/navigation/index.tsx`                                                       |
| Store   | `apps/mobile/src/store/*.ts`                                                                 |
| API     | `apps/mobile/src/lib/api.ts`                                                                 |
| i18n    | `apps/mobile/src/lib/i18n.ts`                                                                |
| 错误    | `apps/mobile/src/lib/errorHandler.ts`                                                        |
| 主题    | `apps/mobile/src/theme/`、`ThemeProvider.tsx`                                                |
| 核心 UI | `MessageBubble`、`HeroComposer`、`ScreenHeader`                                              |
| 骨架屏  | `ListSkeleton`、`CardSkeleton`、`FileGridSkeleton`、`ContentSkeleton`、`MessageListSkeleton` |
| 空态    | `EmptyState`                                                                                 |
