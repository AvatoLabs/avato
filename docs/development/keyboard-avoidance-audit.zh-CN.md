# 键盘遮挡修复审计

> **日期**：2026-03-18  
> **范围**：`apps/mobile` 输入框键盘避让

---

## 一、问题

多处输入框聚焦时键盘未正确避让，遮挡输入区域。

## 二、修复内容

### 2.1 已有 KAV 的页面 — 修正 `keyboardVerticalOffset`

| 页面 | 修改 |
|------|------|
| **ArtworkScreen** | `keyboardVerticalOffset={insets.top + 64}`，ScrollView 增加 `keyboardShouldPersistTaps="handled"` |
| **ChatDetailScreen** | KAV 仅包裹底部输入区（非整屏），`keyboardVerticalOffset={0}`，FlashList 增加 `keyboardShouldPersistTaps="handled"` |
| **MemoryDetailScreen** | `keyboardVerticalOffset={insets.top + 48}`，`behavior` 改为 `'height'`（Android） |
| **NotebookScreen** | `keyboardVerticalOffset={insets.top + 56}`，`behavior` 改为 `'height'`（Android） |
| **ServerConfigScreen** | 新增 `useSafeAreaInsets`，`keyboardVerticalOffset={insets.top + 64}` |

### 2.2 新增 KeyboardAvoidingView 的页面

| 页面 | 修改 |
|------|------|
| **ProfileEditScreen** | 根节点改为 KAV，`keyboardVerticalOffset={insets.top + 64}` |
| **ProviderDetailScreen** | 根节点改为 KAV，`keyboardVerticalOffset={insets.top + 64}` |
| **AgentConfigScreen** | SessionOnly、SessionAgent、AgentConfigByAgentId 三个子屏均包裹 KAV |
| **ChatSettingsScreen** | 根节点改为 KAV，ScrollView 增加 `keyboardShouldPersistTaps="handled"` |

### 2.3 Modal / Sheet 内键盘避让

| 组件 | 修改 |
|------|------|
| **AgentSelectionSheet** | 在 Modal 内容外层包裹 KeyboardAvoidingView，ScrollView 增加 `keyboardShouldPersistTaps="handled"` |

### 2.4 `keyboardVerticalOffset` 取值说明

- **ScreenHeader**：`insets.top + 64`（安全区 + 标题栏约 64px）
- **自定义 header**：`insets.top + 48` ~ `insets.top + 56`（按实际高度）
- **Modal 底部弹出**：通常为 0，由 KAV 自动处理

## 三、未改动页面（风险较低）

- **StoreScreen AddCustomMcp**、**MemoryScreen Create Modal**：输入在 Modal 中部，遮挡风险中等，可后续按需补充 KAV
- **ChatListScreen**、**TopicListScreen**、**ResourceScreen**、**AIProvidersScreen**：搜索在顶部，遮挡风险低

## 四、建议

1. 新页面含底部输入时，优先使用 `KeyboardAvoidingView` 包裹
2. 使用 `useSafeAreaInsets()` 动态计算 `keyboardVerticalOffset`
3. ScrollView / FlatList / FlashList 建议设置 `keyboardShouldPersistTaps="handled"`，避免键盘弹出时点击无效
