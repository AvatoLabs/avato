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

## 三、参考

- 主题 token 定义：`apps/mobile/src/theme/colors.ts`
- `useThemeColors()` 获取响应式颜色
- 深色模式审计：`docs/development/ui-animation-audit.zh-CN.md`
