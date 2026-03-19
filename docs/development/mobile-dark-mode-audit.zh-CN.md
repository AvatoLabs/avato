# Mobile Dark Mode 审计

> 审计日期：2026-03-19  
> 范围：Modal/Sheet 等弹层组件中 `text-foreground`、`bg-card`、`bg-foreground/xx` 在 dark mode 下可能显示黑色字体或错误背景的问题

## 一、已修复

| 组件 | 说明 |
|------|------|
| `AgentSelectionSheet` | 新建群组会话 |
| `TagEditorSheet` | 新建/编辑标签 |

## 二、待修复

### 2.1 Sheet 组件（与已修复组件同类型）

| 组件 | 路径 | 问题 |
|------|------|------|
| **SkillsSheet** | `components/ui/SkillsSheet.tsx` | `bg-card`、`text-foreground`、`bg-foreground/5`、`bg-foreground/10` |
| **AttachmentSheet** | `components/ui/AttachmentSheet.tsx` | `bg-card`、`text-foreground`、`bg-foreground/[0.04]`、`bg-foreground/5`、`bg-foreground/10` |
| **MemoryToolSheet** | `components/ui/MemoryToolSheet.tsx` | `bg-card`、`text-foreground`、`bg-foreground/[0.04]`、`bg-foreground/5`、`bg-foreground/10` |
| **LanguageSheet** | `components/ui/LanguageSheet.tsx` | `bg-card`、`text-foreground`、`bg-foreground/[0.04]`、`bg-foreground/10`、`active:bg-foreground/5` |
| **ResourcePickerSheet** | `components/ui/ResourcePickerSheet.tsx` | `bg-card`、`text-foreground`、`bg-foreground/5`、`bg-foreground/10` |
| **PromptModal** | `components/ui/PromptModal.tsx` | `bg-card`、`text-foreground`、`bg-foreground/5`、`bg-foreground/[0.04]`、`text-foreground/50` |

### 2.2 内嵌 Modal

| 位置 | 文件 | 问题 |
|------|------|------|
| AgentConfig 技能选择 | `AgentConfigScreen.tsx` L1040, L1690 | `bg-card`、`text-foreground`、`bg-foreground/xx` |
| ChatSettings 标签选择 | `ChatSettingsScreen.tsx` L692 | `bg-card`、`text-foreground`、`bg-foreground/xx` |

### 2.3 其他页面（可能受影响）

| 文件 | 说明 |
|------|------|
| `AgentConfigScreen.tsx` | SectionCard、InputRow 等大量 `bg-foreground/[0.02]`、`text-foreground`、`text-secondary/xx` |
| `ChatSettingsScreen.tsx` | 同上 |
| `StoreScreen.tsx` | 弹层、表单、卡片 |
| `ProviderDetailScreen.tsx` | 表单、卡片 |
| `MemoryScreen.tsx` | 表单、卡片 |
| `ModelPickerScreen.tsx` | 列表、标签 |
| `AIProvidersScreen.tsx` | 卡片 |
| `ParamsSection.tsx` | 表单区块 |

## 三、修复模式

统一替换规则：

1. **Modal/Sheet 背景**：`className="bg-card"` → `style={{ backgroundColor: colors.card }}`
2. **文本**：`className="text-foreground"` → `style={{ color: colors.foreground }}`
3. **次要文本**：`className="text-secondary/60"` → `style={{ color: colors.secondaryText }}`
4. **背景块**：
   - `bg-foreground/[0.04]` → `style={{ backgroundColor: colors.fillTertiary }}`
   - `bg-foreground/[0.03]` → `style={{ backgroundColor: colors.fillQuaternary }}`
   - `bg-foreground/5` → `style={{ backgroundColor: colors.fillTertiary }}`（或 `fillQuaternary`）
   - `bg-foreground/10` → 拖柄等可保留或使用 `colors.border`
5. **TextInput**：`style={{ backgroundColor: colors.fillTertiary, color: colors.foreground }}`

## 四、优先级

1. **P0**：Sheet/Modal 弹层（用户直接可见，与 AgentSelectionSheet、TagEditorSheet 相同场景）
2. **P1**：AgentConfigScreen、ChatSettingsScreen 内嵌 Modal
3. **P2**：全屏页面内的表单、卡片（若 NativeWind 在 dark mode 下已正确解析 `text-foreground` 则可暂缓）
