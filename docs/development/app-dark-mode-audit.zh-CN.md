# App Dark Mode 全面审计

> **审计日期**：2026-03-18\
> **现象**：Dark Mode 下字体黑色看不见，部分视觉元素不可见\
> **范围**：`apps/mobile` 全量颜色、边框、主题相关

---

## 一、根因

### 1.1 静态 themeColors /semanticColors

```ts
// theme/colors.ts
export const themeColors: ColorTokens = lightTokens; // 始终为 light！
export const semanticColors = { ...themeColors }; // 始终为 light！
```

- `semanticColors.foreground` = `#111111`（黑）→ Dark Mode 下黑字在黑底 = **不可见**
- `semanticColors.secondaryText` = `#9ca3af` → 深色背景下勉强可见但偏暗
- 任何 `style={{ color: semanticColors.xxx }}` 在 Dark Mode 下均使用 light 色值

### 1.2 硬编码 border-black

| 类名                  | 问题                              |
| --------------------- | --------------------------------- |
| `border-black/5`      | Dark Mode 下黑边框在黑底 = 不可见 |
| `border-black/10`     | 同上                              |
| `border-black/[0.03]` | 同上                              |

应使用 `border-border` 或 `border-foreground/5`（依赖 CSS var，随主题切换）。

### 1.3 BlurView tint 固定

- `tint="light"` 在 Dark Mode 下可能不协调，但非主要问题
- 部分卡片（WorkflowCard、AssistantCard）同时有 `border-black/5`，边框不可见

---

## 二、需修复项

### 2.1 使用 useThemeColors () 替代静态引用

| 文件                  | 当前                            | 修复                     |
| --------------------- | ------------------------------- | ------------------------ |
| ScreenHeader          | `semanticColors.muted`          | `useThemeColors().muted` |
| ProfileScreen         | `semanticColors.primary` 多处   | `useThemeColors()`       |
| ProfileEditScreen     | `border-black/[0.03]`           | `border-border`          |
| SessionHeaderSection  | `semanticColors.secondaryText`  | `useThemeColors()`       |
| DangerZoneSection     | `semanticColors.danger` (style) | `useThemeColors()`       |
| EmptyState            | `semanticColors.foreground`     | `useThemeColors()`       |
| WorkspaceOverviewCard | `semanticColors.primary`        | `useThemeColors()`       |
| ChatListScreen        | `semanticColors.foreground`     | `useThemeColors()`       |
| ResourceScreen        | `semanticColors.foreground`     | `useThemeColors()`       |
| MessageBubble         | `themeColors` 多处              | `useThemeColors()`       |
| SearchField           | `themeColors.secondaryText`     | `useThemeColors()`       |
| ServerConfigScreen    | `themeColors`                   | `useThemeColors()`       |
| 其他                  | 见 grep 结果                    | 同上                     |

### 2.2 border-black → border-border / border-foreground

| 文件                 | 当前                  | 修复                   |
| -------------------- | --------------------- | ---------------------- |
| SurfaceCard          | `border-black/5`      | `border-border`        |
| SearchField          | `border-black/5`      | `border-border`        |
| AgentCard            | `border-black/5`      | `border-border`        |
| WorkflowCard         | `border-black/5`      | `border-border`        |
| AssistantCard        | `border-black/5`      | `border-border`        |
| ModelChip            | `border-black/5`      | `border-border`        |
| FilePreview          | `border-black/10`     | `border-foreground/10` |
| ProfileEditScreen    | `border-black/[0.03]` | `border-border`        |
| ProviderDetailScreen | `border-black/[0.03]` | `border-border`        |

### 2.3 其他硬编码颜色

| 文件           | 问题                                                         |
| -------------- | ------------------------------------------------------------ |
| uiColors       | `textDark: '#333333'`, `textGray: '#666666'` 等为 light 专用 |
| ResourceScreen | `#f8f8fa`, `#fff` 等背景色硬编码                             |

---

## 三、实施状态（2026-03-18）

- [x] 新增 `useSemanticColors()` 便捷 hook
- [x] 替换所有 `semanticColors` / `themeColors` 为 `useThemeColors()` 或 `useSemanticColors()`
- [x] 替换 `border-black/*` 为 `border-border` 或 `border-foreground/*`
- [ ] 验证 global.css `.dark` 变量与 ThemeProvider 同步

### 已修复 Screen 列表

ChatListScreen、ProfileEditScreen、AIProvidersScreen、DataManagementScreen、ServerConfigScreen、AgentConfigScreen、ChatDetailScreen、MemoryScreen、ModelListScreen、ModelPickerScreen、AgentListScreen、DiscoverScreen、ArtworkScreen、MemoryDetailScreen、TopicListScreen、AppLogsScreen、ResourceScreen

---

## 四、相关文件

| 用途          | 路径                                           |
| ------------- | ---------------------------------------------- |
| 主题 Token    | `apps/mobile/src/theme/colors.ts`              |
| CSS 变量      | `apps/mobile/global.css`                       |
| ThemeProvider | `apps/mobile/src/components/ThemeProvider.tsx` |
| 主题 Store    | `apps/mobile/src/store/theme.ts`               |
