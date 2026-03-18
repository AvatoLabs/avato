# 设置页面层级审计

> **日期**：2026-03-18\
> **范围**：`ProfileScreen`、`SettingsScreen`、`SettingsLayout`\
> **目标**：审计层级结构，取消「更多设置」容器与分类，扁平化设置入口

---

## 一、现状层级

```
ProfileScreen (Me Tab)
├── ScreenHeader: "Settings"
├── WorkspaceOverviewCard (身份 / 模型 / 提供商)
├── Usage Stats (统计概览)
├── Quick Settings (4 项)
│   ├── Server Config
│   ├── AI Providers
│   ├── Default Model
│   └── Language
├── More Settings ← 容器入口，跳转 SettingsScreen
│   └── "更多设置" + "资料、语音、关于等更多设定"
└── Sign Out
```

```
SettingsScreen (独立页面)
├── ScreenHeader: "更多设置"
├── SettingsSection: 外观 (themeTitle)
│   ├── 主题 (亮/暗/跟随系统)
│   └── 配色 (蓝/紫/绿/灰)
├── SettingsSection: 记忆 (memoryTitle)
│   ├── 记忆开关 + 强度
│   └── ...
├── SettingsSection: 数据存储 (settingsDataStorage)
│   ├── 同步备份 (Coming Soon)
│   └── 存储管理 → DataManagement
└── SettingsSection: 语音 (settingsVoice)
    ├── 语音识别 (Coming Soon)
    └── TTS (Coming Soon)
```

---

## 二、问题

1. **「更多设置」是多余容器**：用户需多一次点击才能到达 Theme、Memory、Data 等，增加认知负担。
2. **Quick Settings vs More Settings 语义模糊**：Server、Model、Language 与 Theme、Memory 无本质区别，均为用户级配置。
3. **SettingsSection 分类过细**：4 个 section 标题（外观、记忆、数据存储、语音）在移动端单屏内显得碎片化。
4. **双页面割裂**：ProfileScreen 与 SettingsScreen 职责重叠，均为「用户设置」，无必要分层。

---

## 三、建议方案：扁平化合并

### 3.1 目标

- 取消「更多设置」入口，所有设置项直接出现在 ProfileScreen。
- 取消或弱化 SettingsSection 分类标题，采用统一列表样式。
- 保留 SettingsScreen 作为路由目标（便于深链、返回栈），但内容与 Profile 合并展示；或直接删除 SettingsScreen，全部内联到 ProfileScreen。

### 3.2 合并后 ProfileScreen 结构（推荐）

```
ProfileScreen
├── WorkspaceOverviewCard
├── Usage Stats
├── 设置列表（统一卡片样式，无 section 标题）
│   ├── Server Config
│   ├── AI Providers
│   ├── Default Model
│   ├── Language
│   ├── 主题 (Theme)
│   ├── 配色 (Color Scheme)
│   ├── 记忆 (Memory) — 可展开或跳转子页
│   ├── 存储管理 (Data Management)
│   ├── 语音识别 (Coming Soon)
│   └── TTS (Coming Soon)
└── Sign Out
```

### 3.3 实施要点

1. **移除「更多设置」卡片**：不再 `navigate('Settings')`。
2. **Theme / Color Scheme**：从 SettingsScreen 迁移到 ProfileScreen，使用与 Quick Settings 相同的行样式。
3. **Memory**：迁移到 ProfileScreen；若 UI 较复杂，可保留 Memory 子页或内联折叠。
4. **Data / Voice**：迁移到 ProfileScreen，Coming Soon 项保持禁用或灰态。
5. **SettingsScreen**：删除或改为重定向到 ProfileScreen；若保留路由，仅作兼容用。
6. **SettingsSection**：不再使用 section 标题，改用 `SettingsRow` 或统一 `PressableScale` 行样式。

---

## 四、验收标准

1. 用户从 Me Tab 进入后，无需点击「更多设置」即可看到 Theme、Memory、Data、Voice。
2. 设置项视觉风格统一（图标 + 标题 + 副标题 + ChevronRight）。
3. 无「Quick Settings」「More Settings」等容器级分类文案。
4. 导航栈简化：Me → 具体设置子页，无 Me → Settings → 子页 的中间层。

---

## 五、实施记录（2026-03-18）

| 项                                       | 状态                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| 取消「更多设置」入口                     | ✅ 已移除 ProfileScreen 中的 More Settings 卡片                            |
| 合并 SettingsScreen 内容到 ProfileScreen | ✅ Theme、Color、Memory 配置、Data、Voice 已内联                           |
| 删除 SettingsScreen                      | ✅ 已删除                                                                  |
| 移除 Settings 路由                       | ✅ 已从 navigation 移除                                                    |
| 弱化分类                                 | ✅ 无 SettingsSection 标题，仅用轻量 label（themeTitle、themeColorScheme） |
