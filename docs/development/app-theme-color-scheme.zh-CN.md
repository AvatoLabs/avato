# App 主题与色系实现

> **日期**：2026-03-18\
> **范围**：`apps/mobile` 主题系统、色系切换、颜色抽象

---

## 一、架构概览

### 1.1 主题维度

| 维度     | 类型                          | 说明                   |
| -------- | ----------------------------- | ---------------------- |
| **亮度** | `light` \| `dark` \| `system` | 浅色 / 深色 / 跟随系统 |
| **色系** | `blue` \| `violet` \| `green` | 品牌主色 / 强调色      |

### 1.2 文件结构

```
apps/mobile/src/
├── theme/
│   ├── colors.ts      # ColorTokens、getThemeTokens、useThemeColors
│   ├── palettes.ts    # 色系调色板 (blue/violet/green)
│   ├── tokens.ts      # 间距、圆角、图标等
│   └── index.ts       # 导出
├── store/
│   └── theme.ts       # preference + colorScheme 持久化
├── components/
│   └── ThemeProvider.tsx  # 应用主题 + 导航主题
└── global.css         # Tailwind CSS 变量 (:root, .dark, .theme-violet, .theme-green)
```

---

## 二、色系调色板 (palettes.ts)

每个色系定义：

- `primary`, `primaryBorder`, `primaryFocused`, `primaryMuted`, `primarySubtle`
- `switchTrackOn`, `activeTabBg`, `inactiveTabBg`
- `userBubbleBg`, `userBubbleLink`
- `markdownLink`
- `chatAccentBadgeBg`, `chatAccentBadgeText`, `chatAccentChipBg`, `chatAccentChipBorder`, `chatAccentQuoteBorder`
- `sourceMarket`, `sourceMarketMuted`

**当前色系：**

| ID     | 主色    | 说明   |
| ------ | ------- | ------ |
| blue   | #007aff | 默认蓝 |
| violet | #8b5cf6 | 紫色   |
| green  | #10b981 | 绿色   |

---

## 三、颜色抽象 (colors.ts)

### 3.1 合并逻辑

```
ColorTokens = baseTokens(light|dark) + palette(blue|violet|green)
```

- **baseTokens**：中性色（背景、前景、边框、语义色 success/danger/warning/info 等）
- **palette**：主色、用户气泡、聊天强调、来源徽章等

### 3.2 新增 Token（原 uiColors）

以下硬编码已并入 `ColorTokens`：

- `inputBg`, `sliderThumb`, `sliderTrack`, `sliderTrackDisabled`
- `shadow`, `codeBlockLight`, `typingIndicator`
- `artworkPending`, `artworkProcessing`, `artworkSuccess`, `artworkError`
- `fileArchive`, `textDark`, `textGray`, `cachedToken`
- `modalOverlay`, `modalDarkBg`, `progressBarTrack`

使用方式：`useThemeColors().inputBg` 等。

### 3.3 废弃导出（保留兼容）

- `uiColors` → 使用 `useThemeColors()` 对应字段
- `chatAccent` → 使用 `getChatAccent(useThemeColors())`
- `semanticColors` → 使用 `useSemanticColors()` 或 `useThemeColors()`

---

## 四、设置页

**主题**：浅色 / 深色 / 跟随系统\
**色系**：蓝色 / 紫色 / 绿色

i18n 新增：

- `themeColorScheme`, `themeColorBlue`, `themeColorViolet`, `themeColorGreen`

---

## 五、Tailwind / NativeWind

`global.css` 中新增：

```css
.theme-violet {
  --color-primary: #8b5cf6;
}
.dark.theme-violet {
  --color-primary: #a78bfa;
}

.theme-green {
  --color-primary: #10b981;
}
.dark.theme-green {
  --color-primary: #34d399;
}
```

`ThemeProvider` 根据 `colorScheme` 应用 `theme-violet` 或 `theme-green`，使 `bg-primary`、`text-primary` 等 Tailwind 类随色系变化。

---

## 六、扩展新色系

1. 在 `palettes.ts` 中新增 `ColorSchemePalette` 并加入 `COLOR_SCHEMES`
2. 在 `store/theme.ts` 的 `ColorSchemeId` 中加入新 ID
3. 在 `global.css` 中增加 `.theme-{id}` 与 `.dark.theme-{id}`
4. 在 Settings 的 `COLOR_SCHEME_OPTIONS` 和 i18n 中补充选项与文案
