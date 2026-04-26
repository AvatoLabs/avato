# LobeHub RN 端内容页面 UI / 架构审计报告

> 审计范围：`apps/mobile/src/screens/` 下全部内容页面
> 审计视角：代码架构、UI 一致性、性能、可维护性

---

## 一、致命问题：God Screen 反模式

| 文件                       | 行数        | 严重性    |
| -------------------------- | ----------- | --------- |
| `ContentScreen.tsx`        | **7473**    | 🔴 灾难级 |
| `StoreScreen.tsx`          | **2763**    | 🔴 严重   |
| `ChatDetailScreen.tsx`     | **1519**    | 🟠 超标   |
| `ChatListScreen.tsx`       | **\~1500+** | 🟠 超标   |
| `ProfileScreen.tsx`        | **1109**    | 🟠 超标   |
| `ProviderDetailScreen.tsx` | **\~751**   | 🟡 偏大   |
| `TopicListScreen.tsx`      | **458**     | 🟢 合理   |
| `ThreadListScreen.tsx`     | **277**     | 🟢 合理   |

**所有 Screen 文件都是单一组件函数包含全部逻辑，没有拆分子模块 /hooks/utils。**

---

## 二、ContentScreen（7473 行）—— 重灾区

### 2.1 手写 Markdown 渲染器（L461-L717）

在 Screen 文件内手搓了一套完整的 Markdown→HTML 转换：

- `renderMarkdownInline()` — 行内语法（链接、代码、粗体、斜体、删除线）
- `renderMarkdownTextSegment()` — 块级语法（标题、列表、引用、分割线）
- `renderMarkdownToHtml()` — 代码块处理
- `buildMarkdownPreviewHtml()` — 80 行内联 CSS 样式

**问题**：项目已在 `NotebookScreen`、`MessageBubble` 中使用 `react-native-markdown-display`。重复造轮导致两套渲染逻辑需要分别维护，且手写版不支持表格渲染、语法高亮等。

### 2.2 工具函数堆在 Screen 里（L300-L449）

以下通用函数直接定义在 ContentScreen 顶层，而非 `lib/` 目录：

| 函数                                       | 用途           | 应归属                |
| ------------------------------------------ | -------------- | --------------------- |
| `formatBytes()`                            | 文件大小格式化 | `lib/format.ts`       |
| `isImage()` / `hasImageExtension()`        | 文件类型判断   | `lib/fileType.ts`     |
| `isDocument()` / `isAudio()` / `isVideo()` | 文件类型判断   | `lib/fileType.ts`     |
| `isTextLikeFile()`                         | 文本文件检测   | `lib/fileType.ts`     |
| `escapeHtml()`                             | HTML 转义      | `lib/html.ts`         |
| `sortFileList()`                           | 文件排序       | `lib/resourceList.ts` |
| `IMAGE_EXTENSIONS` / `TEXT_EXTENSIONS`     | 扩展名集合     | `lib/fileType.ts`     |
| `matchesCategory()`                        | 分类过滤       | `lib/resourceList.ts` |

### 2.3 内部自造组件（L238-L298）

`AdaptiveSheetModal` 在文件内部定义，实现了一个响应式 Modal 容器。项目已有：

- `BottomSheetScaffold`
- `PortalScaffold`

应合并到 `components/ui/` 下统一复用。

### 2.4 文件内部还定义了 UI 子组件

`FileTypeIcon`（L741-L761）、`ResourceListRowSeparator`（L223-L225）等 UI 组件直接写在 7473 行的文件里，无法被其他 Screen 复用。

---

## 三、ChatDetailScreen（1519 行）—— 状态管理灾难

### 3.1 useState 爆炸

单个组件函数内有 **40+ 个 useState**，摘录部分：

```
inputText, searchEnabled, memoryEnabled, memoryEffort,
globalMemoryEnabled, globalMemoryEffort, memorySheetVisible,
modelDrawerVisible, attachmentSheetVisible, resourcePickerVisible,
providerLogoError, showScrollToTop, keyboardOffset,
skillsSheetVisible, installedPlugins, builtinSkillItems,
agentSkillItems, loadingSkills, listRefreshing, enabledPlugins,
agentId, groupDetail, conversationFiles, hintIndex, pendingRouteTopicId
```

另有 **10+ 个 useRef**、**15+ 个 useCallback**、**10+ 个 useEffect**。

### 3.2 建议重构方向

| 关注点              | 建议抽取                               |
| ------------------- | -------------------------------------- |
| 消息数据获取与刷新  | `useChatMessages(sessionId)`           |
| 键盘高度追踪        | `useKeyboardLift(insets)`              |
| 技能 / 插件管理     | `useSkillsManager(sessionId)`          |
| 记忆配置            | `useMemoryConfig(sessionId)`           |
| 文件附件处理        | `useAttachments(sessionId)`            |
| Sheet/Drawer 可见性 | `useSheetVisibility()` 或 `useReducer` |
| 自动滚动逻辑        | `useAutoScroll(listRef, generating)`   |
| 占位提示轮换        | `useRotatingHints(hints)`              |

---

## 四、ProfileScreen（1109 行）—— UI 模式重复

### 4.1 同一卡片模式重复 10+ 次

以下 JSX 结构在文件中至少出现 10 次：

```tsx
<PressableScale
  className="flex-row items-center rounded-xl px-5 py-3.5"
  style={{ backgroundColor: colors.fillQuaternary, borderColor: colors.borderSubtle, borderWidth: 1 }}
  onPress={...}
>
  <View className="mr-4 h-8 w-8 rounded-full items-center justify-center"
    style={{ backgroundColor: colors.primarySubtle }}>
    <SomeIcon color={colors.primary} size={16} />
  </View>
  <View className="flex-1">
    <Text className="text-foreground text-[15px] font-medium">{title}</Text>
    <Text className="text-[12px]" style={{ color: colors.secondaryText }}>{desc}</Text>
  </View>
  <ChevronRight color={colors.primary} size={18} />
</PressableScale>
```

### 4.2 已有组件未复用

项目已有 `SettingsRow` 组件（`components/ui/SettingsLayout.tsx`），功能完全匹配上述模式，但 ProfileScreen 里大部分卡片没有使用它。

### 4.3 交互组件不一致

同一页面内，相同功能的列表项交替使用：

- `PressableScale`（带缩放反馈）
- `TouchableOpacity`（带透明度反馈）
- 裸 `View`（无交互反馈）

用户感知上同类卡片点击手感不同。

---

## 五、样式系统混乱

### 5.1 三套方案混搭

整个 RN 端同时使用三种样式写法，无统一规范：

| 方案                 | 示例                                      | 出现频率 |
| -------------------- | ----------------------------------------- | -------- |
| NativeWind className | `className="text-foreground text-[15px]"` | 高       |
| 内联 style 对象      | `style={{ color: colors.secondaryText }}` | 高       |
| 混合使用             | 同一元素同时写 className 和 style         | 极高     |

### 5.2 颜色引用不一致

同一个「前景色」的两种写法混在同文件中：

```tsx
// 方式 A：NativeWind token
<Text className="text-foreground">...</Text>

// 方式 B：theme hook
<Text style={{ color: colors.foreground }}>...</Text>
```

当主题系统变更时，两套引用路径可能不同步。

---

## 六、关注点零分离

### 6.1 API 调用直接写在组件中

每个 Screen 都直接 `import` 并调用 API 模块：

```tsx
// ChatDetailScreen 中直接调用 API
const config = await agentApi.getConfigBySession(sessionId);
await messageApi.removeAll(ids);
await sessionApi.updateChatConfig(sessionId, {...});
await topicApi.create(sessionId, title, {...});
```

没有 Service 层抽象，无法复用、无法统一错误处理、无法 mock 测试。

### 6.2 业务逻辑内联

文件上传权限请求、图片选择、键盘事件监听、AppState 监听等系统级逻辑全部平铺在 Screen 组件函数体内。

---

## 七、组件一致性问题

| 维度         | 现状                                                           | 期望                    |
| ------------ | -------------------------------------------------------------- | ----------------------- |
| **头部**     | ChatDetailHeader / ScreenHeader / ChatHeader (lobehub/ui) 三套 | 统一一套可配置的 Header |
| **空状态**   | EmptyState 组件 vs 内联 JSX                                    | 统一使用 EmptyState     |
| **骨架屏**   | 5 种互不通用：MessageList / List / Card / FileGrid / Content   | 组合式骨架屏            |
| **确认操作** | Alert.alert/ ConfirmModal / PromptModal 三种                   | 统一确认组件            |
| **底部弹出** | BottomSheetScaffold / AdaptiveSheetModal / Modal 三种          | 统一 Sheet 组件         |

---

## 八、性能隐患

| 问题                                           | 位置         | 影响                      |
| ---------------------------------------------- | ------------ | ------------------------- |
| ContentScreen 7473 行全量解析                  | 首次 import  | 冷启动耗时增加            |
| ChatDetailScreen `renderMessage` 依赖 11 项    | 每次渲染     | 几乎每次都重建 renderItem |
| StoreScreen 文件顶层 400 行 helper 函数        | 热更新       | 每次 HMR 全量重执行       |
| FlashList 估算基于 12 条采样                   | 消息列表     | 大量消息时列表跳动        |
| ProfileScreen `useFocusEffect` 内 5 个并发 API | 每次切换 tab | 不必要的网络请求风暴      |

---

## 九、优先级排序

| 优先级 | 问题                                         | 工作量 | 影响范围        |
| ------ | -------------------------------------------- | ------ | --------------- |
| **P0** | ContentScreen 拆分（7473 行）                | XL     | 可维护性        |
| **P0** | ChatDetailScreen 状态管理重构                | L      | 可维护性 + 性能 |
| **P1** | 抽取可复用 Hooks（数据获取 / 状态）          | L      | 全部 Screen     |
| **P1** | ProfileScreen 消除 UI 重复，复用 SettingsRow | M      | UI 一致性       |
| **P1** | 统一样式规范（className vs style）           | M      | 全局一致性      |
| **P2** | 去掉手写 Markdown，用现有库替代              | S      | 维护成本        |
| **P2** | 工具函数迁移到 lib/ 共享                     | S      | 代码复用        |
| **P2** | 统一确认 / 空状态 / 骨架屏 / Sheet 组件      | M      | UI 一致性       |
| **P3** | StoreScreen 拆分                             | L      | 可维护性        |
| **P3** | 统一 Header 组件体系                         | M      | 导航一致性      |

---

## 十、对标建议

一个健康的 RN Screen 文件结构应该是：

```
screens/
  ChatDetail/
    index.tsx              # 主 Screen（<300 行）
    hooks/
      useChatMessages.ts   # 消息数据管理
      useKeyboardLift.ts   # 键盘适配
      useSkillsManager.ts  # 技能管理
      useAttachments.ts    # 附件管理
    components/
      MessageList.tsx      # 消息列表
      EmptyConversation.tsx # 空状态
      ComposerArea.tsx     # 输入区域
    types.ts               # 类型定义
```

而非当前的单文件 1519 行。
