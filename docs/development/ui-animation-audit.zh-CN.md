# UI 动效审计与实施分配（恢复增强版）

> **日期**：2026-03-18\
> **范围**：`apps/mobile` 主要页面与组件动效，及 Web 端动效体系对照\
> **参考**：React Native Reanimated 4.x、React Bits（Staggered / Liquid / Subtle）\
> **目标**：恢复动效遴选清单，并给出可执行的实现分配方案

---

## 一、TL;DR

1. 你的反馈是对的，之前版本弱化了 “动效遴选” 部分。该部分已完整恢复并升级。
2. 现状核心问题不是 “有没有动画”，而是 “缺统一参数层、策略层、分配层”。
3. 最佳落地路径：先做低成本统一（P0），再做全局 token + 策略（P1），最后做可配置与性能精修（P2）。

---

## 二、Reanimated 动效遴选清单（恢复）

### 2.1 Entering / Exiting 动效（按气质与开销）

| 类别                     | 动效                                              | 气质         | 开销 | 适用场景                         |
| ------------------------ | ------------------------------------------------- | ------------ | ---- | -------------------------------- |
| Fade                     | `FadeIn` / `FadeInUp` / `FadeInDown` / `FadeOut*` | 企业、克制   | 极低 | 通用入场 / 退场                  |
| Slide                    | `SlideInRight` / `SlideInUp` / `SlideOutRight`    | 专业、方向感 | 低   | 导航相关内容、列表项侧向变化     |
| Zoom                     | `ZoomIn` / `ZoomOut` / `ZoomInEasyUp`             | 未来、聚焦   | 低   | Modal 内容区、聚焦卡片           |
| Bounce                   | `BounceIn*` / `BounceOut*`                        | 活泼         | 中   | 不建议用于主流程                 |
| Flip                     | `FlipInEasyX/Y` / `FlipOutEasyX/Y`                | 科技感强     | 中   | 局部实验性区域                   |
| Rotate / Pinwheel / Roll | 旋转类                                            | 炫技感强     | 中   | 仅图标徽章等点缀，不用于业务流程 |

### 2.2 Layout Transitions（列表与布局变化）

| 动效                  | 特征         | 开销 | 推荐场景                         |
| --------------------- | ------------ | ---- | -------------------------------- |
| `LinearTransition`    | 顺滑、稳     | 极低 | FlatList 项增删、排序变化        |
| `FadingTransition`    | 柔和淡入淡出 | 极低 | 区块显隐、列表空态切换           |
| `SequencedTransition` | 分步重排     | 低   | 网格 / 瀑布流重排                |
| `EntryExitTransition` | 自定义强     | 可控 | 需要统一 entering+exiting 的容器 |

### 2.3 修饰符参数建议（统一节奏）

```ts
// 企业感（默认）
FadeIn.duration(220);
FadeInDown.duration(240).delay(40);

// 专业感（结构变化）
SlideInRight.duration(220);
SlideOutRight.duration(180);

// 未来感（谨慎用于聚焦）
ZoomIn.duration(200);
FadeInUp.springify().damping(18).stiffness(130);
```

### 2.4 React Bits 理念映射（恢复并细化）

| React Bits 概念 | Reanimated 映射                | 移动端建议                                |
| --------------- | ------------------------------ | ----------------------------------------- |
| Staggered       | `FadeInDown.delay(i * n)`      | 仅 2-3 级错峰，`n <= 40ms`                |
| Liquid          | `FadingTransition` / 轻 spring | 用在卡片 / 面板切换，不用于主列表高频滚动 |
| Subtle          | `FadeIn` + 短 duration         | 默认策略，优先于复杂动画                  |

---

## 三、现状审计（Mobile vs Web）

### 3.1 Mobile 现状（代码事实）

1. Onboarding / Login 入场时长偏长。
2. 大量页面独立硬编码 `delay/duration`，参数离散。
3. Modal/Sheet 多处仅使用 `animationType`，缺 “内容层 entering”。

关键位置：

- `apps/mobile/src/screens/onboarding/WelcomeScreen.tsx`
- `apps/mobile/src/screens/LoginScreen.tsx`
- `apps/mobile/src/components/ui/PromptModal.tsx`
- `apps/mobile/src/components/ui/SkillsSheet.tsx`
- `apps/mobile/src/components/ui/ModelDrawer.tsx`
- `apps/mobile/src/components/ui/AttachmentSheet.tsx`

### 3.2 Web 基线（可对齐能力）

1. Web 有用户级过渡设置：`transitionMode = none | fadeIn | smooth`。
2. Web 大量使用 `cssVar.motionDuration*` / `cssVar.motionEase*`，可统一节奏。
3. Web 默认配置已有过渡模式基线（`fadeIn`）。

关键位置：

- `src/routes/(main)/settings/chat-appearance/features/ChatAppearance/index.tsx`
- `packages/const/src/settings/common.ts`
- `src/features/**` / `src/routes/**`（token 化 transition 广泛存在）

### 3.3 差距总结

| 维度         | Mobile         | Web                  |
| ------------ | -------------- | -------------------- |
| 参数统一     | 弱（页面自配） | 强（token / 变量化） |
| 用户控制     | 弱             | 中 - 强              |
| 可访问性策略 | 弱             | 中                   |
| 动效治理     | 局部优化       | 系统化更好           |

---

## 四、动效分配方案（模块到文件）

### 4.1 P0 优先分配（1-2 个迭代）

| 模块                               | 目标         | 文件范围                                                          | 建议动效配方                                                     | 优先级 |
| ---------------------------------- | ------------ | ----------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| 首路径（Onboarding/Login/Connect） | 降低 “拖感”  | `WelcomeScreen` / `LoginScreen` / `ServerConfigScreen`            | `FadeIn*` 时长收敛到 220-420ms，上限不超 450ms                   | P0     |
| 空态与骨架                         | 统一反馈节奏 | `EmptyState` / `CardSkeleton` / 使用空态的列表页                  | 空态 `FadeIn.duration(180-220)`，骨架可选 `FadeIn.duration(150)` | P0     |
| Sheet/Modal 内容层                 | 提升层次感   | `PromptModal` / `SkillsSheet` / `ModelDrawer` / `AttachmentSheet` | 保留 `animationType`，增加内容容器 `FadeInUp` 或 `ZoomIn`        | P0     |
| 导航与页面转场                     | 减少混乱     | `navigation/index.tsx`                                            | 主流程统一 `slide_from_right`，首路径避免 fade/slide 混杂        | P0     |

### 4.2 P1 分配（系统化）

| 模块          | 目标           | 文件范围                                            | 建议                                                     | 优先级 |
| ------------- | -------------- | --------------------------------------------------- | -------------------------------------------------------- | ------ |
| Motion Token  | 建立统一参数层 | `apps/mobile/src/theme/tokens.ts`（新增 motion）    | 提供 duration/easing/spring preset                       | P1     |
| Motion Helper | 建立统一调用层 | `apps/mobile/src/theme/motion.ts`（新增）           | 场景化 helper：`enteringListItem`/`enteringModalContent` | P1     |
| 列表布局动画  | 统一增删体感   | `StoreScreen` / `DiscoverScreen` / 其他 FlatList 页 | `Animated.FlatList + itemLayoutAnimation`（支持处）      | P1     |

### 4.3 P2 分配（策略与可访问性）

| 模块           | 目标          | 文件范围                 | 建议                                                | 优先级 |
| -------------- | ------------- | ------------------------ | --------------------------------------------------- | ------ |
| 用户偏好       | 对齐 Web 语义 | 设置页 + 用户配置存储    | 增加 `transitionMode` / `animationMode`（跨端一致） | P2     |
| Reduced Motion | 可访问性合规  | motion helper 与关键页面 | 系统开关触发全局降级（none/agile）                  | P2     |
| 性能预算       | 防止回退      | 高频列表与聊天页         | 建立动画预算与回归检查                              | P2     |

---

## 五、实现意见（工程细节）

### 5.1 先补 Motion Token（最关键）

建议在 `apps/mobile/src/theme/tokens.ts` 增加：

```ts
motion: {
  duration: { fast: 180, normal: 220, slow: 300, hero: 420 },
  stagger: { none: 0, short: 24, normal: 40 },
  spring: {
    gentle: { damping: 18, stiffness: 130 },
    snappy: { damping: 14, stiffness: 180 },
  },
}
```

### 5.2 再补 Motion Helper（禁止页面随意调参）

```ts
// pseudo: apps/mobile/src/theme/motion.ts
export const enteringListItem = (index = 0) =>
  FadeInDown.duration(tokens.motion.duration.normal).delay(
    Math.min(index, 3) * tokens.motion.stagger.short,
  );

export const enteringModalContent = () => FadeInUp.duration(tokens.motion.duration.normal);
```

### 5.3 FlatList 与 FlashList 分开处理

1. FlatList：优先 `Animated.FlatList + itemLayoutAnimation={LinearTransition}`。
2. FlashList：不强推 `itemLayoutAnimation`，优先容器级 entering，避免回收重绘闪烁。

### 5.4 Modal 规范

1. `animationType` 只处理 “容器层” 转场。
2. 内容区统一使用 `entering`（`FadeInUp` / `ZoomIn`）增强层次。
3. 避免同一组件既有重 Modal 动画又有长延迟内容动画。

### 5.5 React Bits 实施边界

1. 用 `Staggered` 但限制级数，避免 “演示感”。
2. `Subtle` 作为默认，`Liquid` 只在低频高价值区域。
3. 不在长列表滚动区引入重 spring 或复杂变换。

---

## 六、建议的人力分配

| 角色               | 责任                             | 交付                                       |
| ------------------ | -------------------------------- | ------------------------------------------ |
| 平台负责人（1 人） | motion token + helper + 规范守卫 | `tokens.motion`、`motion.ts`、动效规范文档 |
| 体验负责人（1 人） | 首路径、Modal/Sheet 动效统一     | onboarding/login/connect + modal 组件改造  |
| 列表负责人（1 人） | FlatList/FlashList 策略与稳定性  | Store/Discover/ChatList 等高频列表收敛     |
| QA / 性能（1 人）  | 低端机与弱网动效回归             | 帧率、卡顿、降级策略验证报告               |

---

## 七、验收标准

1. 首路径（欢迎 -> 连接 -> 登录）体感无明显 “慢入场”。
2. 同类组件（Modal/Sheet/ 空态）动效风格一致。
3. 高频列表在弱性能设备无明显掉帧。
4. 页面新增动画必须走 token+helper，不再出现大规模硬编码散点。
5. 用户可选择至少一档动效偏好（与 Web 语义对齐）。

---

## 八、最终结论

这版方案不是 “再加几个动画”，而是恢复并升级为完整的动效工程方法：

1. 先恢复动效遴选（已恢复）。
2. 再做现状审计（已补全 Mobile vs Web）。
3. 最后做按模块分配与落地（已给出 P0/P1/P2 与角色分配）。

执行顺序建议：**先 P0，再 P1，最后 P2**。

---

## 九、实施记录（2026-03-18）

### P0 已完成

| 模块               | 实现                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Motion Token       | `tokens.ts` 新增 `motion.duration` / `stagger` / `spring`                                                                             |
| Motion Helper      | 新增 `theme/motion.ts`：`enteringEmptyState`、`enteringSkeleton`、`enteringListItem`、`enteringModalContent`、`enteringDialogContent` |
| 首路径             | WelcomeScreen / LoginScreen / ServerConfigScreen 时长收敛至 220–420ms，使用 tokens                                                    |
| 空态与骨架         | EmptyState 使用 `enteringEmptyState()`；CardSkeleton 使用 `enteringSkeleton()`                                                        |
| Sheet/Modal 内容层 | PromptModal、SkillsSheet、ModelDrawer、AttachmentSheet 增加内容容器 `enteringModalContent()` / `enteringDialogContent()`              |

---

## 十、全面动效缺口审计（2026-03-18）

> 用户反馈：Tab 之前的过渡动画、弹出、过渡等都没了，需全面审计并保证系统丝滑。

### 10.1 Tab 切换动画（缺口）

| 位置           | 文件:行              | 现状                         | 建议                                                                 |
| -------------- | -------------------- | ---------------------------- | -------------------------------------------------------------------- |
| Tab.Navigator  | `navigation/index.tsx` 179 | 无 `animation`，切换时内容硬切 | `screenOptions: { animation: 'fade' }` 或 `animation: 'shift'`        |
| Tab 栏动画     | 同上 116–165, 54–114 | 已有 AnimatedTabLabel、MeTabIcon | 保持                                                               |

**API 支持**：`@react-navigation/bottom-tabs` 7.x 支持 `animation: 'none' | 'fade' | 'shift'` 和 `sceneStyleInterpolator`。

### 10.2 Stack 过渡

| Screen           | 现状                     | 建议                                      |
| ---------------- | ------------------------ | ----------------------------------------- |
| MainTabs         | 无 options，默认 slide   | 从 Login 进入时用 `animation: 'fade'` 更顺滑 |
| 其他 Stack.Screen | 均已配置 slide/fade/modal | 保持                                      |

### 10.3 屏幕级 entering

| 屏幕             | 根内容 entering | 说明                                                         |
| ---------------- | --------------- | ------------------------------------------------------------ |
| ChatListScreen   | 分段有          | Hero、Section 等有 FadeInDown，根无                           |
| ArtworkScreen    | 局部有          | 侧边栏、GenerationBatchCard 有 entering                     |
| ResourceScreen  | 无              | 主内容无 entering，仅 FilePreviewModal 有                     |
| StoreScreen     | 无              | 主内容无 entering                                            |
| ProfileScreen   | 分段有          | WorkspaceOverviewCard 有，SettingsSection 有                  |
| DiscoverScreen  | ListHeader 有   | 主内容无，ListHeader 有 FadeInDown                            |

**建议**：Tab 主屏（ChatList、Artwork、Resource、Store、Profile）可用 `useIsFocused` + 根容器 `entering` 实现切换时的淡入，或依赖 Tab `animation: 'fade'` 统一处理。

### 10.4 Modal / Sheet 内容层

| 组件                 | animationType | 内容 entering | 缺口 |
| -------------------- | ------------- | ------------- | ---- |
| PromptModal          | fade          | ✅ enteringDialogContent | 无   |
| SkillsSheet          | slide         | ✅ enteringModalContent  | 无   |
| ModelDrawer          | slide         | ✅ enteringModalContent  | 无   |
| AttachmentSheet      | slide         | ✅ enteringModalContent  | 无   |
| **AgentSelectionSheet** | slide      | ❌ 无         | **需补** |
| MemoryToolSheet      | slide         | 未审计       | 可选 |
| GroupMentionInput    | fade          | 未审计       | 可选 |

### 10.5 骨架屏 entering

| 组件               | 现状   | 建议                    |
| ------------------ | ------ | ----------------------- |
| CardSkeleton       | ✅ 有  | 保持                    |
| **FileGridSkeleton** | ❌ 无 | 加 `enteringSkeleton()` |
| **ListSkeleton**   | ❌ 无  | 加 `enteringSkeleton()` |
| **MessageListSkeleton** | ❌ 无 | 加 `enteringSkeleton()` |

### 10.6 列表项 entering

| 位置                 | 现状   | 建议                                      |
| -------------------- | ------ | ----------------------------------------- |
| ChatListScreen 搜索结果 | ✅ SlideInRight | 保持                                      |
| DiscoverScreen renderItem | 无   | 可选 `enteringListItem(index)`            |
| StoreScreen renderItem   | 无   | 可选 `enteringListItem(index)`            |
| TopicListScreen TopicItem | 无 | 可选 entering                             |
| FlatList itemLayoutAnimation | 未使用 | P1：`LinearTransition` 等（需评估性能） |

### 10.7 实施优先级汇总

| 优先级 | 项                         | 文件                         | 动作                                      |
| ------ | -------------------------- | ---------------------------- | ----------------------------------------- |
| **P0** | Tab 切换动画               | `navigation/index.tsx`       | `screenOptions: { animation: 'fade' }`    |
| **P0** | MainTabs 栈过渡           | `navigation/index.tsx`       | `options={{ animation: 'fade' }}`         |
| **P0** | AgentSelectionSheet 内容   | `AgentSelectionSheet.tsx`     | 内容包 `Animated.View entering={enteringModalContent()}` |
| **P0** | 骨架屏 entering            | FileGridSkeleton, ListSkeleton, MessageListSkeleton | 加 `enteringSkeleton()` |
| P1     | 列表项 entering            | 各 FlatList renderItem       | 按需加 `enteringListItem(index)`          |
| P1     | Tab 内屏根 entering        | ChatList, Store, Resource 等 | 可选，Tab fade 已覆盖大部分体感            |

### 10.8 P0 实施记录（2026-03-18）

| 项                     | 实现                                                                 |
| ---------------------- | -------------------------------------------------------------------- |
| Tab 切换动画           | `Tab.Navigator screenOptions: { animation: 'fade' }`                 |
| MainTabs 栈过渡        | `Stack.Screen MainTabs options={{ animation: 'fade' }}`               |
| AgentSelectionSheet    | 内容包 `Animated.View entering={enteringModalContent()}`             |
| FileGridSkeleton       | 根包 `Animated.View entering={enteringSkeleton()}`                   |
| ListSkeleton           | 根包 `Animated.View entering={enteringSkeleton()}`                   |
| MessageListSkeleton    | 根包 `Animated.View entering={enteringSkeleton()}`                   |
