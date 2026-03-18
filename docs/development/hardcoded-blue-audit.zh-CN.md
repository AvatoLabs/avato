# 硬编码蓝色审计

> **日期**：2026-03-18  
> **范围**：`apps/mobile` 中硬编码蓝色及应进入主题的色值  
> **目标**：将硬编码蓝色替换为主题 token，确保深色模式与主题切换一致

---

## 一、审计结果

### 1.1 需修复（组件内硬编码）

| 文件 | 位置 | 硬编码值 | 应使用 Token |
|------|------|----------|-------------|
| ProviderDetailScreen | 653-661 | `bg-green-500/15`, `Check color="#4caf50"`, `bg-red-500/15`, `bg-blue-500/15` | `colors.successSubtle`, `colors.success`, `colors.dangerSubtle`, `colors.primarySubtle` |
| ArtworkScreen | 393-397 | StatusBadge `#f59e0b`, `#3b82f6`, `#10b981`, `#ef4444` | `colors.artworkPending`, `colors.artworkProcessing`, `colors.artworkSuccess`, `colors.artworkError` |
| MemoryScreen | 69-75, 545 | LAYER_COLORS `#3b82f6` (identity), fallback `#6b7280` | `colors.info`, `colors.muted` |
| MemoryDetailScreen | 63-69, 290 | 同上 + ScoreBadge/图标硬编码 | 同上 + `colors.warning`, `colors.danger`, `colors.secondaryText` |
| AIProvidersScreen | 167 | `#34c759`, `#d1d5db` | `colors.success`, `colors.borderDefault` |
| StoreScreen | 2102 | `#f97316` | `colors.fileArchive` |
| TypingIndicator | 72 | `#8e8e93` | `colors.typingIndicator` |
| ResourceScreen | 626, 628 | `#fff` | `colors.iconOnPrimary` |

### 1.2 保留（主题定义层）

以下文件为主题/调色板定义，硬编码为预期行为：

- `apps/mobile/src/theme/colors.ts` — 基础 token 定义
- `apps/mobile/src/theme/palettes.ts` — 色板定义
- `apps/mobile/global.css` — CSS 变量
- `apps/mobile/src/constants/tags.ts` — 标签色板（固定色值）
- `apps/mobile/src/screens/ProfileScreen.tsx` — COLOR_SCHEME_OPTIONS 为色板预览，保留

### 1.3 Tailwind 硬编码类

| 类名 | 问题 | 修复方式 |
|------|------|----------|
| `bg-blue-500/15` | 固定蓝色，不随主题 | `style={{ backgroundColor: colors.primarySubtle }}` |
| `bg-green-500/15` | 固定绿色 | `style={{ backgroundColor: colors.successSubtle }}` |
| `bg-red-500/15` | 固定红色 | `style={{ backgroundColor: colors.dangerSubtle }}` |

---

## 二、实施优先级

1. **P0**：ProviderDetailScreen、ArtworkScreen — 用户高频可见 ✅
2. **P1**：MemoryScreen、MemoryDetailScreen — 记忆模块 ✅
3. **P2**：AIProvidersScreen、StoreScreen、TypingIndicator、ResourceScreen ✅

---

## 四、深色模式图标/文字修复（2026-03-18 补充）

| 文件 | 问题 | 修复 |
|------|------|------|
| MemoryDetailScreen | text-gray-*、bg-gray-*、border-gray-* | 使用 colors.foreground、colors.background、colors.secondaryText、colors.fillTertiary、colors.surface |
| StoreScreen | FileArchive color="#f97316" | colors.fileArchive |
| AIProvidersScreen | 状态点 #34c759、#d1d5db | colors.success、colors.borderDefault |
| ResourceScreen | ActivityIndicator/Download color="#fff" | colors.iconOnPrimary |
| TypingIndicator | 默认 #8e8e93 | useThemeColors().typingIndicator |
| WelcomeScreen、LoginScreen | bg-white  logo 容器 | colors.surface |

---

## 五、硬编码蓝色按钮与字体审计（2026-03-18 补充）

### 5.1 semanticColors（P0 — 不随主题变化）

`semanticColors` 来自 `themeColors`，固定为 light+blue，**不响应主题切换**。使用处应改为 `useThemeColors()`：

| 文件 | 用法 | 修复 |
|------|------|------|
| SkillsSheet | `semanticColors.primary` | `useThemeColors().primary` |
| ChatSettingsScreen | `semanticColors.primary`, `semanticColors.danger`, `semanticColors.secondaryText` | `useThemeColors()` |
| MemoryToolSheet | `semanticColors.foreground` | `useThemeColors().foreground` |
| SliderWithInput | `semanticColors.foreground` | `useThemeColors().foreground` |
| TagEditorSheet | `semanticColors.secondaryText` | `useThemeColors().secondaryText` |
| TagSection | `semanticColors.secondaryText`, `semanticColors.fillTertiary` | `useThemeColors()` |
| AttachmentSheet | `semanticColors.foreground` | `useThemeColors().foreground` |
| constants/tags.ts | `resolveTagColor` fallback `semanticColors.primary` | 需传入 tokens 或使用 hook 上下文 |

### 5.2 colors.info（固定蓝色）

`colors.info` 在 base 中为 `#0A84FF`（light）/ `#64d2ff`（dark），始终为蓝色。用于「展开更多」、工具 pending 等。若需随主题变化，可考虑加入 palette 的 `iconOnPrimary` 或新增 `info` 覆盖。

| 文件 | 用法 |
|------|------|
| MessageBubble | Show more/less、Tool pending、Approve 按钮 |
| MemoryScreen | identity 层颜色 |
| MemoryDetailScreen | identity |

### 5.3 NativeWind 类（text-primary / bg-primary）

`text-primary`、`bg-primary` 使用 CSS 变量 `--color-primary`，理论上随 ThemeProvider 的 theme 类变化。若仍出现蓝色，需检查：

- 组件是否在 ThemeProvider 子树内
- NativeWind 是否正确解析 `theme-{colorScheme}`

**使用 text-primary / bg-primary 的组件（共 40+ 处）：**

| 文件 | 典型用法 |
|------|----------|
| HeroComposer | `bg-primary` 发送按钮、模型选择 |
| ChatDetailScreen | `bg-primary` 发送按钮 |
| StoreScreen | `bg-primary` 多个 CTA 按钮、`text-primary` |
| LoginScreen | `bg-primary` 登录按钮、`text-primary` |
| WelcomeScreen | `bg-primary` CTA |
| AgentConfigScreen | `bg-primary` 保存、`text-primary`、`bg-primary/10` 图标背景 |
| AgentListScreen | `bg-primary` 创建按钮、FAB |
| ChatSettingsScreen | `text-primary`、`bg-primary/10` |
| ProfileScreen | `bg-primary/10` 色系选择、统计图标 |
| TopicItem / TopicListScreen | `bg-primary/10`、`text-primary` 选中态 |
| ModelChip | `text-primary`、`bg-primary/10` |
| QuickActionChip | `text-primary`、`bg-primary/10` |
| GroupMentionInput | `text-primary`、`bg-primary/10` |
| MessageBubble | `bg-primary` 编辑保存、`text-primary` Thinking |
| WorkflowCard | `text-primary`、`bg-primary/10` |
| ProfileEditScreen | `text-primary`、`bg-primary/10` |
| WorkspaceOverviewCard | `text-primary`、`bg-primary/10` |
| AssistantCard | `bg-primary/10` |
| SettingsLayout | `iconBg = 'bg-primary/10'` |
| SectionBlock | `text-primary` |
| ModelDrawer | `text-primary` 选中 |
| ModelPickerScreen | `text-primary` 选中 |
| ProviderDetailScreen | `bg-primary` CTA |
| TagEditorSheet | `bg-primary` 保存 |
| PromptModal | `text-primary` |
| ServerConfigScreen | `text-primary` |
| ChatListScreen | `bg-primary` 创建按钮、`text-primary` |
| ParamsSection | `bg-primary/10` |
| AgentSection | `text-primary`、`bg-primary/10` |
| StatsScreen | `text-primary`、`bg-primary/10` |

### 5.4 其他硬编码

| 文件 | 问题 |
|------|------|
| App.tsx | `color: '#fff'` 离线错误文案 |
| ProfileScreen:81 | `COLOR_SCHEME_OPTIONS` 的 `color` — 色板预览用，保留 |

---

## 六、修复优先级建议

1. **P0**：将 `semanticColors` 替换为 `useThemeColors()`（7 个文件）
2. **P1**：验证 NativeWind `text-primary`/`bg-primary` 在 ThemeProvider 下是否生效；若不生效，改为 `style={{ color: colors.primary }}` 等
3. **P2**：评估 `colors.info` 是否需进入 palette 以支持主题色

---

## 三、参考

- 主题 token 定义：`apps/mobile/src/theme/colors.ts`
- `useThemeColors()` 获取响应式颜色
- 深色模式审计：`docs/development/ui-animation-audit.zh-CN.md`
