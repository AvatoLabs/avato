# UI 动效审计报告：低成本、企业感、专业感、未来感

> **日期**：2026-03-18\
> **范围**：`apps/mobile` 全量 UI\
> **参考**：React Native Reanimated 4.x 官方动效 + React Bits 动效理念（克制、科技感）\
> **目标**：识别开销小、可落地的动效增强点

---

## 一、Reanimated 动效清单（选型参考）

### 1.1 Entering / Exiting 动效（按气质分类）

| 类别           | 动效                                                  | 气质         | 开销 | 适用场景         |
| -------------- | ----------------------------------------------------- | ------------ | ---- | ---------------- |
| **Fade**       | FadeIn, FadeInUp, FadeInDown, FadeInLeft, FadeInRight | 企业、克制   | 极低 | 通用入场         |
|                | FadeOut, FadeOutUp, FadeOutDown...                    | 同上         | 极低 | 通用退场         |
| **Slide**      | SlideInRight, SlideInLeft, SlideInUp, SlideInDown     | 专业、方向感 | 低   | 列表项、侧边内容 |
|                | SlideOutRight, SlideOutLeft...                        | 同上         | 低   | 退场             |
| **Zoom**       | ZoomIn, ZoomOut, ZoomInEasyUp, ZoomInEasyDown         | 未来、聚焦   | 低   | 弹窗、卡片展开   |
| **Bounce**     | BounceIn, BounceOut, BounceInDown...                  | 活泼         | 中   | 慎用（企业感弱） |
| **Flip**       | FlipInEasyX, FlipInEasyY, FlipOutEasyX...             | 科技、炫     | 中   | 卡片翻转、切换   |
| **LightSpeed** | LightSpeedInRight, LightSpeedOutLeft                  | 炫酷         | 中   | 慎用             |
| **Pinwheel**   | PinwheelIn, PinwheelOut                               | 旋转缩放     | 中   | 图标、徽章       |
| **Roll**       | RollInRight, RollOutLeft                              | 滚动感       | 中   | 慎用             |
| **Rotate**     | RotateInDownLeft, RotateOutUpRight...                 | 角向         | 中   | 特殊场景         |

### 1.2 Layout Transitions（列表 / 布局变化）

| 动效                | 气质                    | 开销 | 适用                      |
| ------------------- | ----------------------- | ---- | ------------------------- |
| LinearTransition    | 专业、顺滑              | 极低 | FlatList 项增删、布局变化 |
| FadingTransition    | 克制、淡入淡出          | 极低 | 列表项、区块显隐          |
| SequencedTransition | 有序、分步              | 低   | 多列、网格重排            |
| JumpingTransition   | 跳跃                    | 低   | 慎用（偏活泼）            |
| CurvedTransition    | 曲线路径                | 中   | 特殊布局                  |
| EntryExitTransition | 自定义 entering/exiting | 可调 | 列表项自定义              |

### 1.3 修饰符（统一节奏）

```js
// 企业感：短、克制的 timing
FadeIn.duration(250).delay(0);
FadeInDown.duration(280).delay(80);

// 未来感：轻 spring
FadeInUp.springify().damping(18).stiffness(120);
ZoomIn.duration(220).easing(Easing.out(Easing.cubic));
```

---

## 二、现状动效分布

### 2.1 已有动效

| 位置                                    | 动效                                   | 说明             |
| --------------------------------------- | -------------------------------------- | ---------------- |
| WelcomeScreen                           | FadeInUp, FadeInDown                   | 品牌页，节奏偏慢 |
| ChatListScreen                          | FadeInDown, SlideInRight/SlideOutRight | 区块、删除项     |
| ProfileScreen                           | FadeInDown.delay(50–150)               | 多区块逐项       |
| ServerConfigScreen                      | FadeInDown, FadeIn                     | 表单、状态       |
| ChatDetailScreen                        | FadeInUp                               | 空状态           |
| MessageBubble                           | FadeIn                                 | 消息气泡         |
| SettingsLayout, ChatSettings 各 Section | FadeInDown.delay                       | 区块入场         |
| AgentDetailScreen, ProviderDetailScreen | FadeInDown                             | 详情页           |
| ModelListScreen, ProviderListScreen     | FadeInDown                             | 列表头           |
| NotebookScreen                          | FadeInDown                             | 空状态           |
| StoreScreen                             | FadeInDown                             | 空状态           |
| navigation MeTab                        | scale + spring                         | Tab 切换         |
| Toast                                   | RN Animated (spring + timing)          | 通知气泡         |

### 2.2 无动效 / 弱动效

| 位置                                      | 类型                   | 建议                       |
| ----------------------------------------- | ---------------------- | -------------------------- |
| EmptyState                                | 纯 View                | 包裹 FadeIn                |
| FlatList/FlashList 列表项                 | 无 itemLayoutAnimation | LinearTransition           |
| Modal 内容（PromptModal, SkillsSheet 等） | 仅 animationType       | 内容区 FadeIn 或 ZoomIn    |
| 成功 / 错误状态块                         | 部分有 FadeIn          | 统一 FadeIn.duration (200) |
| Tab 切换内容                              | 无                     | FadeIn.duration(180)       |
| 下拉刷新指示                              | 系统默认               | 可保持                     |
| 加载 Skeleton                             | 无                     | 可选 FadeIn                |

---

## 三、低成本动效增强清单

### 3.1 极低成本（单行或少量改动）

| 序号 | 位置                                                               | 动效             | 实现方式                                                                                           | 气质 |
| ---- | ------------------------------------------------------------------ | ---------------- | -------------------------------------------------------------------------------------------------- | ---- |
| 1    | EmptyState                                                         | FadeIn           | 外层包 `Animated.View entering={FadeIn.duration(280)}`                                             | 企业 |
| 2    | FlatList (Store, AIProviders, Notebook, AppLogs, Memory, Discover) | LinearTransition | `itemLayoutAnimation={LinearTransition}`，需 `Animated.FlatList`                                   | 专业 |
| 3    | FlashList (ChatDetail, SkillsSheet)                                | —                | FlashList 不支持 itemLayoutAnimation，需用 `prepareLayoutAnimationRender()` + entering；或保持现状 | 见注 |
| 4    | 成功 / 错误状态块                                                  | FadeIn           | 已有部分，统一为 `FadeIn.duration(200)`                                                            | 企业 |
| 5    | ListEmptyComponent                                                 | FadeIn           | 空列表时 `Animated.View entering={FadeIn.duration(300)}`                                           | 企业 |

### 3.2 低成本（小范围改动）

| 序号 | 位置                                                           | 动效                   | 实现方式                                       | 气质 |
| ---- | -------------------------------------------------------------- | ---------------------- | ---------------------------------------------- | ---- |
| 6    | PromptModal 内容区                                             | ZoomIn.duration(220)   | 内容 View 包 `entering={ZoomIn.duration(220)}` | 未来 |
| 7    | SkillsSheet / 底部 Sheet 内容                                  | FadeInUp.duration(250) | 内容区入场                                     | 专业 |
| 8    | ModelDrawer 内容                                               | FadeIn.duration(200)   | 抽屉展开时                                     | 企业 |
| 9    | AttachmentSheet 内容                                           | FadeInUp.duration(220) | 同上                                           | 企业 |
| 10   | Tab 切换（Store explore/installed, Discover agents/resources） | FadeIn.duration(180)   | 切换时内容区 key 变化 + entering               | 专业 |

### 3.3 中成本（需结构调整）

| 序号 | 位置              | 动效                       | 实现方式                                 | 气质 |
| ---- | ----------------- | -------------------------- | ---------------------------------------- | ---- |
| 11   | Toast             | 迁移至 Reanimated          | 用 FadeIn + SlideInDown 替代 RN Animated | 未来 |
| 12   | ScreenHeader 切换 | layout={LinearTransition}  | 标题 / 副标题变化时                      | 专业 |
| 13   | 区块展开 / 折叠   | FadingTransition 或 layout | 如 ChatSettings 可折叠区块               | 企业 |

---

## 四、按 React Bits 理念的动效选型

React Bits 强调：**Staggered（错峰）、Liquid（流动）、Subtle（克制）**。映射到 RN：

| React Bits 概念 | Reanimated 对应                              | 推荐用法                                       |
| --------------- | -------------------------------------------- | ---------------------------------------------- |
| Staggered List  | FadeInDown.delay (i\*50) 或 LinearTransition | 列表项错峰入场；或仅用 LinearTransition 更轻量 |
| Fade / Opacity  | FadeIn, FadeOut, FadingTransition            | 通用                                           |
| Slide           | SlideInRight, SlideInUp                      | 方向性入场                                     |
| Scale / Zoom    | ZoomIn, ZoomInEasyUp                         | 弹窗、聚焦                                     |
| Blur / Glass    | 非 Reanimated，expo-blur                     | 已有                                           |
| Parallax        | scrollView scrollHandler + useAnimatedStyle  | 中高成本                                       |

---

## 五、企业感 / 专业感 / 未来感 动效规范

### 5.1 企业感（克制、可预期）

- **首选**：FadeIn, FadeInDown, FadeOut
- **时长**：200–300ms
- **延迟**：0–80ms，不逐项大 delay
- **避免**：Bounce、Roll、LightSpeed、过强 spring

### 5.2 专业感（秩序、清晰）

- **首选**：LinearTransition（列表）、SlideInRight（侧边内容）
- **时长**：250–350ms
- **方向**：与导航方向一致（右进左出）

### 5.3 未来感（微妙、科技）

- **首选**：ZoomIn、FadeInUp.springify()、FadingTransition
- **参数**：springify 时 damping 16–20，stiffness 120–150
- **慎用**：Flip、Pinwheel 仅限特殊入口

---

## 六、实施优先级

### P0（极低成本，立即见效）

1. EmptyState 包裹 FadeIn
2. FlatList/FlashList 添加 `itemLayoutAnimation={LinearTransition}`（需 Animated 版本）
3. ListEmptyComponent 统一 FadeIn

### P1（低成本）

4. PromptModal、ModelDrawer、AttachmentSheet 内容区入场动效
5. 底部 Sheet 内容 FadeInUp
6. Tab 切换内容 FadeIn

### P2（可选）

7. Toast 迁移 Reanimated
8. 区块展开 / 折叠 layout 动效

---

## 七、技术注意点

1. **Animated.FlatList**：需从 `react-native-reanimated` 导入 `Animated`，用 `Animated.FlatList` 替代 `FlatList` 才能使用 `itemLayoutAnimation`。
2. **FlashList**：不支持 `itemLayoutAnimation`（CellRenderer 限制）。可选：`prepareLayoutAnimationRender()` + entering/exiting，或 `renderItem` 内包 `Animated.View entering={FadeIn.duration(200)}`（虚拟化回收时可能重复触发，需测试）。
3. **ReduceMotion**：动效应支持 `ReduceMotion`，Reanimated 提供 `.reduceMotion()` 修饰符。
4. **Modal**：`animationType` 与 `entering` 可叠加，内容区加 entering 即可，无需改 Modal 本身。

---

## 八、总结

| 维度       | 建议                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------- |
| **开销**   | 优先 LinearTransition、FadeIn、FadeInDown；避免逐项大 delay、复杂 spring                  |
| **企业感** | Fade 系 + 短 duration (200–300)                                                           |
| **专业感** | LinearTransition 列表 + Slide 方向一致                                                    |
| **未来感** | ZoomIn 弹窗 + 轻 spring 的 FadeInUp                                                       |
| **参考**   | Reanimated 官方 entering/exiting + layout transitions，与 React Bits 的克制、错峰理念对齐 |
