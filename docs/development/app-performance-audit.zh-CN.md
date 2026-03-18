# App 性能实现审计

> **审计日期**：2026-03-18\
> **范围**：`apps/mobile` 全量性能相关实现\
> **目标**：识别不合理、可优化的性能问题

---

## 一、列表虚拟化 (List Virtualization)

### 1.1 高优先级

| 文件                  | 行号      | 问题                                                                                                                         | 建议                                                                    |
| --------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **ChatListScreen**    | 1442-1647 | 主列表用 `ScrollView` + `filteredSessions.slice(0, 20).map()`、`recentTopics.map()`、`filteredSearchResults.map()`，无虚拟化 | 改用 `FlatList` 或 `FlashList`，`SectionList` 可支持 pinned/recent 分区 |
| **AIProvidersScreen** | 190-243   | `ScrollView` + `filtered.map()` 渲染所有 provider                                                                            | 改用 `FlatList`                                                         |

### 1.2 中优先级

| 文件               | 行号    | 问题                             | 建议                    |
| ------------------ | ------- | -------------------------------- | ----------------------- |
| **NotebookScreen** | 484-528 | `ScrollView` + `documents.map()` | 文档多时改用 `FlatList` |
| **AppLogsScreen**  | 79-101  | `ScrollView` + `logs.map()`      | 日志多时改用 `FlatList` |

### 1.3 已正确使用 FlatList/FlashList

- ChatDetailScreen (FlashList)
- ModelListScreen、AgentListScreen、TopicListScreen
- MemoryScreen、ResourceScreen、ProviderListScreen、StoreScreen
- DiscoverScreen 主列表、SkillsSheet (FlashList)

---

## 二、Zustand 选择器 (Store Selectors)

### 2.1 选择器过多导致重渲染

| 文件                 | 行号    | 问题                                                                                   | 建议                                                |
| -------------------- | ------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **ChatDetailScreen** | 102-166 | 20+ 个独立 `useChatStore` / `useSessionStore` / `useTopicStore` / `useModelStore` 调用 | 合并为 `useShallow` 或自定义 selector，减少订阅粒度 |
| **ChatDetailScreen** | 114     | `useSessionStore((s) => s.sessions.find(...))` 每次返回新引用，触发重渲染              | 使用 `useShallow` 或稳定 selector                   |
| **ChatDetailScreen** | 159-166 | `useModelStore` 内联 `modelSupportsVision` 逻辑，`providers` 变化即重算                | 提取为 `useMemo` 或独立 selector                    |
| **ModelDrawer**      | 90-97   | 9 个 `useModelStore` 调用                                                              | 合并 selector                                       |
| **DiscoverScreen**   | 39-46   | 6 个 `useDiscoverStore` 调用                                                           | 合并 selector                                       |

### 2.2 正面示例

- ChatListScreen 使用 `useShallow` 选择 `sessions` 等字段

---

## 三、内联对象 / 函数 (Inline Object/Function in Render)

### 3.1 问题

每次渲染创建新的 `style={{}}`、`onPress={() => {}}`，导致子组件无法通过浅比较跳过重渲染。

| 文件                 | 问题                                  |
| -------------------- | ------------------------------------- |
| **MessageBubble**    | 大量内联 style/onPress，列表项未 memo |
| **ArtworkScreen**    | 61+ 处内联 style/onPress              |
| **ChatListScreen**   | 52+ 处内联 style/onPress              |
| **StoreScreen**      | 51+ 处内联 style/onPress              |
| **ChatDetailScreen** | 19+ 处内联 style/onPress              |
| **ResourceScreen**   | 26+ 处内联 style/onPress              |

### 3.2 建议

- 提取 `style` 为常量或 `useMemo`
- 提取 `onPress` 为 `useCallback`
- 列表项组件使用 `React.memo`

---

## 四、重型组件 (Heavy Components)

### 4.1 单文件过大

| 文件                 | 行数   | 问题                                               | 建议                                                          |
| -------------------- | ------ | -------------------------------------------------- | ------------------------------------------------------------- |
| **MessageBubble**    | \~2780 | 单文件过大，含 Markdown、代码高亮、WebView、表格等 | 拆分为 MessageContent、MessageActions、MarkdownBlock 等子组件 |
| **StoreScreen**      | \~2150 | 单屏逻辑过多                                       | 拆分为 ExploreTab、InstalledTab、ItemCard 等                  |
| **ChatListScreen**   | \~2041 | 单屏逻辑过多                                       | 拆分为 SessionList、TopicList、SearchResults、HeroComposer 等 |
| **ArtworkScreen**    | \~1673 | 单屏逻辑过多                                       | 拆分为 Sidebar、ModelSelector、PromptInput 等                 |
| **ChatDetailScreen** | \~1277 | 单屏逻辑较多                                       | 可拆分为 MessageList、InputBar、TopicHeader 等                |

### 4.2 memo 使用不足

**已使用 memo：** ToastContainer、StreamingCursor、FilePreviewModal、FilePreview

**未使用 memo 的列表项：** SessionRow、TopicItem、AgentCard、ModelCard、ItemCard、MessageBubble 等

---

## 五、useEffect 清理 (useEffect Cleanup)

### 5.1 未正确清理

| 文件                   | 行号  | 问题                                                                              | 建议                |
| ---------------------- | ----- | --------------------------------------------------------------------------------- | ------------------- |
| **PromptModal**        | 34-39 | `setTimeout(() => inputRef.current?.focus(), 100)` 未在 cleanup 中 `clearTimeout` | 添加 cleanup        |
| **ServerConfigScreen** | 61-68 | `getApiUrl().then(...)` 无取消逻辑，卸载后可能 setState                           | 使用 cancelled 标志 |

### 5.2 已正确清理

- DecryptedText、SplashScreen、AgentSelectionSheet
- ChatDetailScreen、App.tsx 的 NetInfo/AppState 监听
- MemoryScreen 的 poll timer

---

## 六、重复 / 并行数据获取 (Duplicate Data Fetching)

| 场景               | 调用位置                                                                                               | 影响                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `fetchSessions`    | ChatListScreen (mount + useFocusEffect)、ChatDetailScreen、App.tsx                                     | store 有 `fetchSessionsInFlight` 去重，影响有限 |
| `fetchModels`      | ChatListScreen、ChatDetailScreen、ModelDrawer、ModelPickerScreen、AgentConfigScreen、AIProvidersScreen | ModelStore 有缓存，可考虑更统一刷新策略         |
| `fetchSessionTags` | ChatListScreen (mount + useFocusEffect)                                                                | 每次 focus 都拉取，可加短期缓存                 |

---

## 七、动画 (Animation)

### 7.1 长列表逐项进入动画

| 文件                     | 行号       | 问题                                           | 建议                          |
| ------------------------ | ---------- | ---------------------------------------------- | ----------------------------- |
| **AIProvidersScreen**    | 211        | `FadeInDown.delay(index * 30)` 对每个 provider | 仅对首屏可见项动画，或取消    |
| **DataManagementScreen** | 112        | `FadeInDown.delay(index * 50)`                 | 项少，可保留                  |
| **NotebookScreen**       | 493        | `FadeInDown.delay(index * 40)` 对每个文档      | 文档多时取消或限制            |
| **StoreScreen**          | 1787, 2001 | `FadeInDown.delay(index * 30)` 对市场列表项    | 改用 `LayoutAnimation` 或取消 |

### 7.2 其他

- ChatDetailScreen：`LayoutAnimation.configureNext` 在消息列表更新时触发 — 合理
- DiscoverScreen：切换 tab 时 `LayoutAnimation` — 合理

---

## 八、图片加载 (Image Loading)

| 文件            | 行号  | 问题                                                             | 建议                                  |
| --------------- | ----- | ---------------------------------------------------------------- | ------------------------------------- |
| **FilePreview** | 6, 40 | 使用 `react-native` 的 `Image` 而非 `expo-image`，无缓存、无占位 | 改用 `expo-image`，启用 `cachePolicy` |

**已使用 expo-image：** AgentPillTabs、ChatListScreen、ResourceScreen

---

## 九、Bundle / 依赖 (Bundle & Dependencies)

| 文件              | 问题                                                                                   | 建议                 |
| ----------------- | -------------------------------------------------------------------------------------- | -------------------- |
| **MessageBubble** | 引入 `react-syntax-highlighter`、`react-native-markdown-display`、`WebView` 等较重依赖 | 考虑懒加载或按需加载 |

---

## 十、其他

### 10.1 ProviderDetailScreen

- 行 716：`filteredModels.map()` 渲染模型列表，无虚拟化；模型数量通常有限，影响中等

### 10.2 ModelListScreen

- 行 116：`providerModels.map()` 渲染模型卡片，按 provider 分组，每组数量有限，可接受

### 10.3 StatsScreen

- 热力图、排行榜等为固定数量，使用 `.map()` 合理

---

## 十一、优先级建议

### 高优先级

1. **ChatListScreen 主列表虚拟化** — 会话 / 话题列表是核心入口，数据量可能较大
2. ~~**ChatDetailScreen Zustand 选择器优化**~~ — ✅ 已修复：modelSupportsVision 改为 useMemo
3. **MessageBubble 拆分与 memo** — 单文件 2780 行，列表项未 memo，影响滚动流畅度

### 中优先级

4. ~~AIProvidersScreen、NotebookScreen 虚拟化~~ — ✅ 已修复：改用 FlatList
5. ~~PromptModal 的 setTimeout 清理~~ — ✅ 已修复
6. ~~AppLogsScreen 虚拟化~~ — ✅ 已修复：改用 FlatList
7. ~~ServerConfigScreen getApiUrl 取消逻辑~~ — ✅ 已修复
8. FilePreview 改用 expo-image
9. 减少长列表逐项进入动画（StoreScreen）
10. 列表项组件（SessionRow 等）加 memo — TopicItem、AgentCard 已有 memo

### 低优先级

11. 内联 style/onPress 提取为常量或 useCallback
12. 重复 fetch 的缓存策略优化
13. StoreScreen、ChatListScreen 等大文件拆分

---

## 十二、相关文件

| 用途     | 路径                              |
| -------- | --------------------------------- |
| 主题     | `apps/mobile/src/theme/`          |
| Store    | `apps/mobile/src/store/`          |
| 列表组件 | `@shopify/flash-list`、`FlatList` |
| 图片     | `expo-image`                      |
