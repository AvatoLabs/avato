# React Native 应用「设置 / 个人」页 UI/UX 审计报告

**审计日期**: 2025-03-23

**审计范围**:

- 设置主入口：`apps/mobile/src/screens/ProfileScreen.tsx`（底部 Tab `Me`，顶栏标题多为「设置」）
- 概览卡片：`apps/mobile/src/components/ui/WorkspaceOverviewCard.tsx`
- 分组组件：`apps/mobile/src/components/ui/SettingsLayout.tsx`（`SettingsSection` / `SettingsRow`）
- 语言：`apps/mobile/src/components/ui/LanguageSheet.tsx`
- 栈内子页：`ProfileEdit`、`ServerConfig`、`DataManagement`、`AppLogs`、`AIProviders`、`ModelPicker`、`Memory`、`Stats`、`AgentList`、`Notebook` 等（见 `apps/mobile/src/navigation/index.tsx`）
- **不含**：`ChatSettingsScreen`（会话级设置，非应用全局设置；仅作边界说明）

---

## 1. 信息架构

### 1.1 主屏结构（ProfileScreen）

| 区块       | 内容                                                                           |
| ---------- | ------------------------------------------------------------------------------ |
| 顶栏       | `ScreenHeader` + `t.settingsTitle`                                             |
| 工作区概览 | `WorkspaceOverviewCard`：身份、连接、User ID、Endpoint、默认模型、启用服务商数 |
| 工作区     | 统计、记忆（开关 + 力度）、智能体列表、笔记本                                  |
| 连接与 AI  | 服务器、AI 服务商、默认模型                                                    |
| 国际化     | 语言（Bottom Sheet）                                                           |
| 外观       | 浅色 / 深色 / 系统 + 强调色                                                    |
| 数据与语音 | 存储管理；同步 / 语音 / TTS 占位（即将推出）                                   |
| 日志       | 采集开关、查看日志                                                             |
| 账户       | 退出登录                                                                       |
| 页脚       | `APP_NAME` + 版本号                                                            |

### 1.2 心智模型问题

- **Tab 标签**为「我 / Me」（`navigation/index.tsx` → `Tab.Screen` `name="Me"`，`t.tabMe`），**页面大标题**为「设置」（`ProfileScreen` → `t.settingsTitle`）。用户可能预期「个人主页」，实际为「工作区控制台 + 设置列表」，**命名层级略不一致**。
- **默认模型 / AI 服务商**在 `WorkspaceOverviewCard` 与「连接与 AI」分组中**各出现一次**，路径重复；对熟练用户是快捷入口，对扫读用户可能显得冗长。

### 1.3 与 Web / 会话设置的边界

- **ProfileEditScreen**：注释标明对齐 Web `/settings/profile`（头像、姓名、用户名、SSO、兴趣、安全相关外链）。属于「账户资料」，从概览卡身份区进入，**与主列表「设置」并列**，层次合理。
- **ChatSettingsScreen**：会话级（智能体、标签、参数等），**不应**与 Profile 主列表混为一谈；当前路由分离正确。

---

## 2. 视觉与组件一致性

### 2.1 两种列表容器并存

- **工作区内**大量行 / 卡：`fillQuaternary` + `borderSubtle` 圆角块（如统计卡、记忆卡、智能体行）。
- **连接 / 语言 / 外观 / 数据 / 日志**等：外层 `rounded-xl bg-foreground/[0.03]`，内部多行 **无独立卡片边框**（偏 iOS Settings 分组）。

**建议**：在设计规范中明确「大块信息卡」vs「分组列表」的使用场景，或逐步统一为一种主模式，降低扫描认知成本。

### 2.2 `SettingsGroup` vs `SettingsSection` vs 自定义行

- `SettingsLayout.tsx` 提供 `SettingsSection`、`SettingsRow`。
- `SettingsGroup.tsx` 为另一套分组（大写标题、`px-2`），**主设置页未使用**。
- `DataManagementScreen` 等子页使用 `SettingsSection` + **自定义 `TouchableOpacity` 行**，图标尺寸、圆角、间距与 `SettingsRow` **不完全一致**。

**建议**：子页列表优先复用 `SettingsRow`，或抽一层 `SettingsListItem` 统一尺寸与 chevron。

### 2.3 平台差异

- `WorkspaceOverviewCard`：iOS 使用 `BlurView`，Android 为纯色容器（`Platform.OS !== 'android'`）。**视觉档次不一致**为常见取舍；若需对齐，可在 Android 加强阴影 / 边框。

---

## 3. 交互与反馈

### 3.1 触觉反馈不一致

- `ProfileScreen` 中 `safeNavigate` 含 `haptics.light()`。
- 「连接与 AI」内 **Server / AIProviders / ModelPicker** 使用 `TouchableOpacity` **直接 `navigate`，未走 `safeNavigate`**，无统一轻触反馈。

**建议**：该分组内导航统一走 `safeNavigate`（或统一在 `onPress` 调用 `haptics.light()`）。

### 3.2 记忆：关闭时仍可切换力度

- 力度 chip 在 `memoryEnabled === false` 时仍调用 `updateMemorySettings(memoryEnabled, opt.value)`，会更新服务端 effort。
- **UX 风险**：用户以为「已关闭」则不会改任何选项，实际仍会写入 effort。

**建议**：若产品意图为「预设备用档位」，在 UI 上加一句说明；否则在 `!memoryEnabled` 时禁用力度或收起该段。

### 3.3 下拉刷新

- 主列表带 `RefreshControl`，刷新统计、连接、用户、记忆、默认模型等，**对高级用户友好**。

### 3.4 退出登录

- `Alert` 二次确认 + destructive 按钮，**符合危险操作范式**。

---

## 4. 内容与占位

### 4.1 「即将推出」行

- 同步备份、语音识别、TTS：`opacity-60`、无 chevron，**不易误触为可导航项**—— 较好。
- 长期占位会增加首屏长度；可考虑收入「实验室 / 即将推出」折叠分组或独立子页。

### 4.2 记忆区块

- 标题行右侧小圆形 chevron 进入 `Memory` 详情，与下方大开关区域视觉接近，**首次用户可能不清楚「详情 vs 快捷开关」分工**。
- 可考虑副标题「管理条目与详情」或增大可点击区域说明。

### 4.3 统计文案

- 展示消息数、会话数、话题数；需与产品内 **Session / Topic** 用语（见 `docs/development/topic-chat-conversation-semantic-audit.zh-CN.md`）保持一致，避免与 Web 端歧义。

---

## 5. 无障碍与国际化

| 项目                       | 现状                                              | 建议                                            |
| -------------------------- | ------------------------------------------------- | ----------------------------------------------- |
| Tab                        | `tabBarAccessibilityLabel: 'Me tab'` 等英文固定串 | 与 `useI18n` 对齐或使用本地化读屏文案           |
| `Switch`（记忆、日志采集） | 依赖系统默认                                      | 补充 `accessibilityLabel` / `accessibilityHint` |
| 语言 Sheet                 | 固定三种语言 + 半屏高度                           | 语言增多时确认滚动与焦点顺序                    |

---

## 6. 子页要点（续审计）

### 6.1 ServerConfigScreen

- 首次启动与设置内改服共用一屏：URL、测试、保存流程清晰；`haptics` 在测试等关键操作已有使用。
- 与 Profile 主列表「服务器」行状态点 + URL 摘要 **信息互补**，整体合理。

### 6.2 ProfileEditScreen

- 分段多（头像、姓名、用户名、关联登录、兴趣、安全外链），**与 Web 对齐**利于跨端认知。
- 长表单需注意 **保存按钮可见性**（已有顶部 / 键盘相关布局时可再对照小屏机型）。

### 6.3 DataManagementScreen / AppLogs

- 使用 `SettingsSection` + 自定义行；建议与主列表 **行高与图标规范对齐**（见 §2.2）。

---

## 7. 建议优先级汇总

| 优先级 | 项                                                         |
| ------ | ---------------------------------------------------------- |
| P1     | 统一 Tab「我」与顶栏「设置」的心智模型（副标题或改名策略） |
| P1     | 连接分组导航统一触觉反馈（`safeNavigate` 或等价）          |
| P2     | 弱化或标注「模型 / 服务商」双入口，减少重复感              |
| P2     | 记忆关闭时力度交互或文案                                   |
| P2     | 子页列表组件与 `SettingsRow` 统一                          |
| P3     | Tab / Switch 无障碍文案本地化                              |
| P3     | 「即将推出」收纳，缩短主列表                               |

---

## 8. 关键代码锚点

| 说明                               | 路径                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| 主设置屏布局与分组                 | `apps/mobile/src/screens/ProfileScreen.tsx`               |
| 概览三触点（资料 / 模型 / 服务商） | `apps/mobile/src/components/ui/WorkspaceOverviewCard.tsx` |
| 分组标题与行组件                   | `apps/mobile/src/components/ui/SettingsLayout.tsx`        |
| Tab `Me` → `ProfileScreen`         | `apps/mobile/src/navigation/index.tsx`（`BottomTabs`）    |

---

**文档状态**: 初版审计；下方为已落地的代码修复（2025-03-23）。

---

## 9. 修复记录

| 审计项                            | 处理                                                                                                                                            |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Tab「我」与顶栏「设置」心智不一致 | `ProfileScreen` 根 `ScreenHeader` 增加 `subtitle`（`t.settingsHeaderSubtitle`）；`ScreenHeader` 的 `headerLevel="root"` 布局支持展示 `subtitle` |
| 连接分组导航无统一触觉反馈        | `ServerConfig` / `AIProviders` / `ModelPicker` 的 `onPress` 改为 `safeNavigate`；语言行打开 Sheet 前补 `haptics.light()`                        |
| 模型 / 服务商双入口               | 「连接与 AI」分组增加 `SettingsSection` 可选 `description`（`t.settingsConnectionAlsoInOverview`）                                              |
| 记忆关闭时仍可切力度              | 力度 `Pressable` 在 `!memoryEnabled` 时 `disabled`                                                                                              |
| Tab 读屏为英文固定串              | `BottomTabs` 各 `tabBarAccessibilityLabel` 改为对应 `t.*` 文案                                                                                  |
| 日志 / 记忆开关无障碍             | 两处 `Switch` 增加 `accessibilityLabel` / `accessibilityHint`（复用现有 `t` 键）                                                                |

**涉及文件**: `ProfileScreen.tsx`、`ScreenHeader.tsx`、`SettingsLayout.tsx`、`navigation/index.tsx`、`i18n.ts`（新文案键：`settingsHeaderSubtitle`、`settingsConnectionAlsoInOverview`）。

### 9.2 第二轮（子页统一、折叠占位、死代码）

| 审计项                           | 处理                                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 数据管理子页列表与主设置行不一致 | `DataManagementScreen` 改为使用 `SettingsRow` + `SettingsSection`；清除缓存确认框英文硬编码改为 `t.dataManageClearCacheMessage`                                                     |
| `SettingsRow` 能力不足           | 增加可选 `danger`（危险色标题）、`iconSize`（默认 16）                                                                                                                              |
| 「即将推出」占位占满一屏         | `ProfileScreen`「数据与语音」内三项占位默认 **折叠**，可点「即将推出」行展开；文案 `settingsComingSoonSection` / `settingsComingSoonHint`；折叠控件带 `accessibilityState.expanded` |
| `SettingsGroup.tsx` 无引用       | **删除**未使用组件                                                                                                                                                                  |

### 9.3 第三轮（App 日志页）

| 项                                         | 处理                                                                                                                                                |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 日志页顶部为胶囊按钮，与设置列表风格不一致 | `AppLogsScreen` 改为 `FlatList` 的 `ListHeaderComponent`：`SettingsSection` + `SettingsRow`（刷新 / 复制 / 清除）；清除行使用 `danger` + 红色图标底 |
| 文案                                       | 新增 `logsActions`、`logsRefresh`（en / zh-TW / zh-CN）                                                                                             |
| 首屏误触触觉                               | 仅用户点击「刷新」时 `haptics.light()`；挂载拉取列表不振动                                                                                          |
| 横向 padding                               | 列表 `contentContainerStyle` 去掉全局 `paddingHorizontal`，由 `SettingsSection` 与条目 `mx-5` 各自负责，避免与 section 双重缩进                     |
