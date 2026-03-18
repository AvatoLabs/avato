# App UI 尺寸、对齐、宽度全面审计

> **审计日期**：2026-03-18\
> **范围**：`apps/mobile` 全量 UI 元素的尺寸、内边距、外边距、对齐、圆角、字体

---

## 一、设计 Token 现状

| Token        | 值  | 说明 |
| ------------ | --- | ---- |
| spacing.xs   | 4   |      |
| spacing.sm   | 8   |      |
| spacing.md   | 16  |      |
| spacing.lg   | 24  |      |
| spacing.xl   | 32  |      |
| spacing.xxl  | 48  |      |
| radius.sm    | 8   |      |
| radius.md    | 12  |      |
| radius.lg    | 16  |      |
| radius.xl    | 24  |      |
| icon.size.sm | 16  |      |
| icon.size.md | 20  |      |
| icon.size.lg | 24  |      |
| icon.size.xl | 28  |      |

**Tailwind 映射**：默认 scale（1 unit = 4px）→ px-5 = 20px, rounded-2xl = 16px

---

## 二、不一致项与建议

### 2.1 水平内边距 (px)

| 现状 | 使用位置                                                        | 建议                                         |
| ---- | --------------------------------------------------------------- | -------------------------------------------- |
| px-4 | ProviderListScreen header, AgentDetailScreen header, 部分输入框 | 屏幕主内容区统一 `px-5`；输入框可保持 `px-4` |
| px-5 | 多数 Screen、SettingsLayout、ChatSettings                       | 主内容区标准                                 |
| px-6 | AgentDetailScreen 内容区、NotebookScreen                        | 详情 / 大屏可保留                            |
| mx-4 | 少数区块                                                        | 统一 `mx-5`                                  |
| mx-5 | 多数区块                                                        | 区块外边距标准                               |

### 2.2 垂直内边距 (py)

| 现状   | 使用位置                                      | 建议       |
| ------ | --------------------------------------------- | ---------- |
| py-2   | ModelChip, QuickActionChip                    | 小按钮保持 |
| py-3   | 部分输入框、SessionHeaderSection              | 输入框标准 |
| py-3.5 | SettingsRow, AgentListScreen, TopicListScreen | 列表项标准 |
| py-4   | DangerZoneSection, LoginScreen 主按钮         | 主操作按钮 |

### 2.3 区块间距 (mb /mt)

| 现状 | 使用位置                                     | 建议         |
| ---- | -------------------------------------------- | ------------ |
| mb-2 | SettingsRow 项间、部分列表                   | 列表项间     |
| mb-3 | AgentConfigScreen 表单项                     | 表单项间     |
| mb-4 | ProfileScreen 卡片、HeroComposer             | 区块间       |
| mb-5 | AgentSection, ParamsSection, SettingsSection | 区块间标准   |
| mt-4 | DangerZoneSection                            | 与 mb-5 对齐 |
| mt-5 | SessionHeaderSection                         | 区块顶距     |

### 2.4 ScrollView paddingBottom

| 现状   | 使用位置                                       | 建议                |
| ------ | ---------------------------------------------- | ------------------- |
| 24–30  | 部分 Sheet、DiscoverScreen                     | 轻量列表 30         |
| 40     | 多数主屏                                       | 主屏标准            |
| 48–60  | AgentConfigScreen, ServerConfigScreen          | 长表单              |
| 80–100 | ProfileScreen, ChatListScreen, AgentListScreen | 带底部 FAB / 操作栏 |

### 2.5 字体大小

| 现状           | 用途                  | 建议                  |
| -------------- | --------------------- | --------------------- |
| text-\[10px]   | 小标签                | 保留                  |
| text-\[11px]   | 区块标题（uppercase） | 保留                  |
| text-\[12px]   | 副标题、描述          | 次要文字              |
| text-\[12.5px] | SettingsRow subtitle  | 可统一为 12px 或 14px |
| text-\[13px]   | 部分描述              | 可统一为 12px 或 14px |
| text-\[14px]   | body、按钮            | body 标准             |
| text-\[15px]   | 列表项主文字          | 列表项主文字          |
| text-\[15.5px] | SettingsRow label     | 可统一为 15px 或 16px |
| text-\[16px]   | 输入框、大按钮        | 输入 / 主按钮         |
| text-\[17px]   | 子屏标题              | 子屏标题              |
| text-\[18px]   | 大标题                | 大标题                |
| text-\[22px]   | ScreenHeader 主标题   | 主标题                |

### 2.6 图标 / 头像尺寸

| 现状        | 使用位置                          | 建议              |
| ----------- | --------------------------------- | ----------------- |
| w-8 h-8     | SettingsRow, ProfileScreen Memory | 小图标容器        |
| w-9 h-9     | ProviderCard, ModelCard           | 卡片头像          |
| w-10 h-10   | AssistantCard, ScreenHeader 按钮  | 列表项 / 按钮标准 |
| w-12 h-12   | WorkspaceOverviewCard 头像        | 大头像            |
| style 48×48 | AgentListScreen, ResourceScreen   | 改为 `w-12 h-12`  |

### 2.7 圆角

| 现状        | 使用位置               | 建议       |
| ----------- | ---------------------- | ---------- |
| rounded-lg  | 小标签、badge          | 小元素     |
| rounded-xl  | 子卡片、输入框         | 中等元素   |
| rounded-2xl | 主卡片、区块、主按钮   | 主卡片标准 |
| rounded-3xl | AgentDetailScreen 头像 | 大头像     |

### 2.8 内联 style 可改为 Tailwind

| 文件              | 当前                                                                  | 建议                               |
| ----------------- | --------------------------------------------------------------------- | ---------------------------------- |
| DangerZoneSection | `style={{ marginRight: 12 }}`                                         | `className="mr-3"`                 |
| GroupMentionInput | `style={{ width: 36, height: 36 }}`                                   | `className="w-9 h-9"`              |
| Toast             | `style={{ marginLeft: 8, paddingVertical: 4, paddingHorizontal: 8 }}` | `className="ml-2 py-1 px-2"`       |
| ProfileEditScreen | `style={{ width: 40, height: 40, borderRadius: 8 }}`                  | `className="w-10 h-10 rounded-lg"` |
| ResourceScreen    | `style={{ width: 48, height: 48, marginRight: 12 }}`                  | `className="w-12 h-12 mr-3"`       |

---

## 三、优化实施（2026-03-18）

### 3.1 内联 style → Tailwind ✅

- DangerZoneSection：`marginRight: 12` → `View` 包裹 + `mr-3`
- Toast 重试按钮：`marginLeft: 8, paddingVertical: 4, paddingHorizontal: 8` → `ml-2 py-1 px-2`
- GroupMentionInput：`style={{ width: 36, height: 36 }}` → `className="h-9 w-9"`
- ResourceScreen 列表项：容器 `width: 48, height: 48, marginRight: 12` → `mr-3 h-12 w-12`；`flex: 1, minWidth: 0` → `min-w-0 flex-1`；Eye 图标 `marginLeft: 8` → `View` 包裹 + `ml-2`
- ProfileEditScreen：头像 `width: 40, height: 40, borderRadius: 8` → `h-10 w-10 rounded-lg`；ActivityIndicator/Icon `marginRight` → `View` 包裹 + `mr-1.5`

### 3.2 水平对齐统一 ✅

- ProviderListScreen header：`px-4 py-2.5` → `px-5 py-3`
- AgentDetailScreen header：`px-4 py-2.5` → `px-5 py-3`
- ProfileEditScreen：`px-4` → `px-5`（Full Name、Interests 行）

### 3.3 区块间距统一

- 区块间：`mb-5`（已有）
- 列表项间：`mb-2` 或 `mb-3`（已有）

### 3.4 图标尺寸统一

- 列表项头像：`w-10 h-10`（40px）或 `w-12 h-12`（48px）按上下文

---

## 四、相关文件

| 用途          | 路径                                                         |
| ------------- | ------------------------------------------------------------ |
| 设计 Token    | `apps/mobile/src/theme/tokens.ts`                            |
| 颜色          | `apps/mobile/src/theme/colors.ts`                            |
| Tailwind 配置 | `apps/mobile/tailwind.config.js`                             |
| 通用布局      | `ScreenHeader`, `SettingsLayout`, `SettingsRow`              |
| 区块组件      | `SessionHeaderSection`, `DangerZoneSection`, `ParamsSection` |
