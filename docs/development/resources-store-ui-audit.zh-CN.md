# 资源页与商店页 UI 审计

> **日期**：2026-03-18\
> **范围**：`ResourceScreen`、`StoreScreen`，及与 Tab 体系的一致性\
> **约束**：可优化，但不得打破 Tabs 之间的默契与整体化

---

## 一、Tab 体系默契（需保持）

| 维度        | 约定                                                    | 当前遵守情况                               |
| ----------- | ------------------------------------------------------- | ------------------------------------------ |
| 主屏无返回  | Tab 主屏无 leftElement                                  | ✅ Resource、Store 均无                    |
| 标题 + 图标 | ScreenHeader title + titleIcon                          | ✅ 均有                                    |
| 右操作      | Plus 或 rightActions                                    | ✅ Resource=Plus (上传)、Store=Plus (创建) |
| 内容区背景  | bg-background                                           | ✅                                         |
| 底部安全区  | contentContainerStyle paddingBottom: insets.bottom + 80 | ✅                                         |
| 下拉刷新    | RefreshControl，tintColor=primary                       | ✅                                         |

---

## 二、ResourceScreen vs StoreScreen 对比

### 2.1 结构差异

| 维度              | ResourceScreen                   | StoreScreen                                   |
| ----------------- | -------------------------------- | --------------------------------------------- |
| 搜索栏位置        | **ScreenHeader 外**，独立 View   | **ScreenHeader 内**，children 首项            |
| 筛选 / 分类 pills | ScreenHeader 外，ScrollView      | ScreenHeader 内，多层 ScrollView              |
| 层级              | 单层：Search → Pills → List      | 多层：Search → Tab → Source → Category → List |
| 添加入口          | Header Plus + **FAB**            | 仅 Header Plus                                |
| 空态              | EmptyState（外裹 Animated.View） | EmptyState（无外裹，组件自带 entering）       |

### 2.2 样式差异

| 维度         | ResourceScreen             | StoreScreen                          |
| ------------ | -------------------------- | ------------------------------------ |
| 颜色来源     | `useThemeColors()`         | `semanticColors`（constants/colors） |
| Pills 激活色 | `colors.primary`           | `semanticColors.primary`             |
| Pills 未激活 | `colors.fillTertiary`      | `semanticColors.fillTertiary`        |
| Pills 尺寸   | `rounded-full px-4 py-1.5` | `rounded-full px-4 py-1.5`           |
| Search 容器  | `bg-foreground/[0.04]`     | `bg-foreground/[0.04]`               |

### 2.3 与 ChatListScreen 对照

| 维度          | ChatListScreen        | Resource       | Store                 |
| ------------- | --------------------- | -------------- | --------------------- |
| Pills 位置    | ScreenHeader children | 独立 View      | ScreenHeader children |
| Pills padding | `px-4 py-2`           | `px-4 py-1.5`  | `px-4 py-1.5`         |
| 颜色          | useThemeColors        | useThemeColors | semanticColors        |

---

## 三、问题与风险

### 3.1 结构不一致

1. **搜索栏位置**：Resource 在 Header 外，Store 在 Header 内。用户切换 Tab 时，搜索框位置会「跳」，破坏体感一致。
2. **Pills 归属**：Resource 的 category pills 在 Header 外；Store 的 tab/source/category 全在 Header 内。视觉上 Resource 的筛选区与标题区割裂感更强。

### 3.2 颜色来源不统一

- `semanticColors` 与 `useThemeColors()` 在多数场景等价，但语义不同：semanticColors 为静态导出，不随主题实时更新（除非 constants/colors 内部已接 theme）。
- 建议 Tab 主屏统一使用 `useThemeColors()`，保证主题切换时一致。

### 3.3 Store 筛选层级过深

- Explore 模式下有 3 层 pills：Tab (Explore|Installed) → Source (MCP|Skills) → Category (全部 | xxx)。
- 移动端横向空间有限，三层横向滚动易造成「切了不知道在哪一层」的困惑。
- 可考虑：Source 与 Category 合并为单层可切换，或 Category 收起到「筛选」入口内。

### 3.4 Resource 的 FAB 与 Store 的 Header Plus

- Resource：Header Plus + FAB 双入口，均触发 AttachmentSheet。
- Store：仅 Header Plus 触发创建菜单。
- 若希望「添加」行为统一，可二选一：要么都只用 Header，要么都提供 FAB（但 Store 创建流程更复杂，FAB 可能不合适）。当前可接受差异，因「上传文件」vs「添加扩展」操作权重不同。

### 3.5 空态动效冗余

- Resource 的 `ListEmptyComponent` 使用 `<Animated.View entering={FadeInDown}>` 包裹 `EmptyState`。
- `EmptyState` 已内置 `entering={enteringEmptyState()}`。
- 双重 entering 可能导致动画叠加或冲突，建议移除外层 Animated.View。

---

## 四、优化建议（不破坏 Tab 默契）

### 4.1 高优先级（一致性）

| 项              | 建议                                                           | 影响                       |
| --------------- | -------------------------------------------------------------- | -------------------------- |
| 统一搜索栏位置  | Resource 将 Search 移入 ScreenHeader children（与 Store 一致） | 切换 Tab 时搜索框位置稳定  |
| 统一 Pills 位置 | Resource 将 category pills 移入 ScreenHeader children          | 筛选区与标题区视觉一体     |
| 统一颜色来源    | Store 改用 `useThemeColors()` 替代 `semanticColors`            | 主题切换一致，代码语义清晰 |

### 4.2 中优先级（体验）

| 项                         | 建议                                                                         | 影响                 |
| -------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| 移除 Resource 空态外层动效 | 删除 `ListEmptyComponent` 外的 `Animated.View entering`，直接用 `EmptyState` | 避免双重 entering    |
| Store 筛选层级             | 评估 Source + Category 是否可合并为单层，或 Category 折叠到「筛选」按钮      | 降低认知负担，不强制 |

### 4.3 低优先级（可选）

| 项             | 建议                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------- |
| Pills 组件抽离 | 将 `rounded-full px-4 py-1.5` + 激活态样式抽成 `FilterPill` 或 `TabPill`，Resource/Store/ChatList 共用  |
| FAB 一致性     | 若希望 Resource 与 Store 添加入口完全统一，可考虑 Resource 移除 FAB，仅保留 Header Plus；需评估上传频率 |

---

## 五、不可改动（保持 Tab 默契）

1. **Tab 主屏无返回按钮**：不增加 leftElement。
2. **标题 + titleIcon 结构**：不改为纯文字或纯图标。
3. **底部安全区**：保持 `paddingBottom: insets.bottom + 80` 量级。
4. **RefreshControl**：保持下拉刷新能力与 primary 色。
5. **整体背景**：保持 `bg-background`，不引入与其它 Tab 不同的背景模式。

---

## 六、验收标准

1. Resource 与 Store 的搜索栏、筛选 pills 在 ScreenHeader 内的层级与顺序一致。
2. 两屏均使用 `useThemeColors()` 作为颜色来源。
3. 切换 Chats / Resources / Store 时，Header 下方「搜索 + 筛选」区域视觉结构一致。
4. 空态无双重 entering 动效。
5. 上述改动不改变 Tab 导航、无返回、标题结构等默契。

---

## 七、已实施优化（2026-03-18）

| 项                                                 | 状态 |
| -------------------------------------------------- | ---- |
| Resource 搜索栏 + pills 移入 ScreenHeader children | ✅   |
| Resource 移除空态外层 Animated.View entering       | ✅   |
| Store 使用 useThemeColors () 替代 semanticColors   | ✅   |
| Store 移除空态外层 Animated.View entering          | ✅   |
