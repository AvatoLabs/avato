# 新用户首屏体验审计

> **日期**：2026-03-18\
> **范围**：Mobile App 新用户从启动到首次进入主界面的完整流程\
> **目标**：评估风格连贯性、衔接丝滑度、优雅程度、屏幕数量合理性

---

## 一、流程概览

### 1.1 新用户路径（首次安装、无 URL）

```
Expo Splash (静态图)
    ↓
WelcomeScreen (品牌介绍 + 打字机文案)
    ↓ [Get Started]
ProviderSetupScreen (服务器 URL 配置)
    ↓ [确认] 或 [暂时跳过]
CompletionScreen (完成庆祝)
    ↓ [开始对话]
ServerConfigScreen (若跳过则需配置) 或 LoginScreen (若已配置)
    ↓
LoginScreen (登录 / 无认证直入)
    ↓
MainTabs → ChatListScreen (主界面)
```

### 1.2 屏幕数量统计

| 场景                     | 最少屏幕数 | 最多屏幕数                                                      |
| ------------------------ | ---------- | --------------------------------------------------------------- |
| 新用户 + 跳过配置        | 5          | 5 (Welcome → ProviderSetup → Completion → ServerConfig → Login) |
| 新用户 + 配置 URL        | 5          | 5 (Welcome → ProviderSetup → Completion → Login → MainTabs)     |
| 老用户（有 URL、已登录） | 0          | 0 (直接 MainTabs)                                               |

**核心结论**：新用户必经 **5 个屏幕** 才能进入主界面，其中 Onboarding 3 屏 + 配置 / 登录 1–2 屏。

---

## 二、风格连贯性

### 2.1 布局与间距

| 屏幕                | 水平 padding     | 垂直结构                  | 底部 CTA      |
| ------------------- | ---------------- | ------------------------- | ------------- |
| WelcomeScreen       | `px-8`           | 居中、flex-1              | 底部固定      |
| ProviderSetupScreen | `px-6`           | 顶部对齐、flex-1          | `justify-end` |
| CompletionScreen    | `px-8`           | 居中、flex-1              | 底部固定      |
| ServerConfigScreen  | `mx-5`（卡片内） | ScreenHeader + ScrollView | 卡片流式      |
| LoginScreen         | `px-8`           | 居中、flex-1              | 底部固定      |

**问题**：

- `px-6` vs `px-8` 不一致，ProviderSetup 略窄
- ServerConfig 使用 `ScreenHeader` + `ScrollView`，与 Onboarding 的「全屏居中」风格明显不同
- Login 与 Welcome 布局高度相似（Logo + 标题 + 副标题 + CTA），但文案语义不同（登录 vs 欢迎）

### 2.2 颜色与主题

| 屏幕                | 主色使用                                 | 硬编码                                                                  |
| ------------------- | ---------------------------------------- | ----------------------------------------------------------------------- |
| WelcomeScreen       | `bg-primary`、`text-foreground`          | `#0f172a`（shadow、cursor）、`#5b6778`（副标题）、`#005bb5`（active）   |
| ProviderSetupScreen | `bg-primary`、`bg-primary/10`            | `#007aff`（Server 图标、Check、ActivityIndicator）、`#005bb5`           |
| CompletionScreen    | `bg-primary`                             | `rgba(0,122,255,0.08)`（图标背景）、`#007aff`（CheckCircle）、`#005bb5` |
| ServerConfigScreen  | `colors.primary`、`colors.primarySubtle` | 无硬编码，使用 theme                                                    |
| LoginScreen         | `bg-primary`、`text-primary`             | `#0f172a`（shadow）                                                     |

**问题**：

- Onboarding 三屏大量硬编码 `#007aff`、`#005bb5`，未使用 `useThemeColors()` 或 `colors.primary`
- 用户切换色系（violet/green）时，Onboarding 与 Login 仍为蓝色，与主应用不一致
- ServerConfig 已接入主题，风格更「应用内」，与 Onboarding 的「独立品牌页」感割裂

### 2.3 组件与视觉语言

| 屏幕                | 图标                                           | 按钮样式                                 | 输入框                       |
| ------------------- | ---------------------------------------------- | ---------------------------------------- | ---------------------------- |
| WelcomeScreen       | Logo（avato-logo.png）                         | `rounded-2xl py-4`、`bg-primary`         | 无                           |
| ProviderSetupScreen | Server（lucide）                               | `rounded-2xl py-4`、`rounded-xl`（测试） | `bg-foreground/5 rounded-xl` |
| CompletionScreen    | CheckCircle（lucide）                          | `rounded-2xl py-4`                       | 无                           |
| ServerConfigScreen  | Server、Globe、Wifi、CheckCircle2、AlertCircle | `PressableScale`、`rounded-2xl`          | 卡片式、`colors.surface`     |
| LoginScreen         | Logo（avato-logo.png）                         | `rounded-2xl py-4`                       | 无                           |

**问题**：

- Onboarding 用 `TouchableOpacity`，ServerConfig 用 `PressableScale`，按压反馈不统一
- ServerConfig 的输入框是「卡片 + 图标 + 标签」结构，ProviderSetup 是「标签 + 单行输入」，同一功能（配置 URL）两套 UI
- Welcome 与 Login 都展示 Logo + 标题 + 副标题，视觉重复感强

### 2.4 动画

| 屏幕                | 入场动画             | 时长 / 延迟                         |
| ------------------- | -------------------- | ----------------------------------- |
| WelcomeScreen       | FadeInUp、FadeInDown | 160–520ms delay，420–860ms duration |
| ProviderSetupScreen | FadeInDown           | 50–250ms delay，350ms duration      |
| CompletionScreen    | FadeInUp、FadeInDown | 100–300ms delay，400–500ms duration |
| ServerConfigScreen  | FadeInDown、FadeIn   | 50–300ms delay，280–350ms duration  |
| LoginScreen         | FadeInUp、FadeInDown | 120–320ms delay，420–720ms duration |

**问题**：

- 各屏 delay/duration 不统一，节奏感不一致
- Welcome 有打字机（TextType），其他屏无，Welcome 独有「叙事感」
- 导航动画：Welcome→ProviderSetup 为 `slide_from_right`，Completion→ServerConfig/Login 为 `reset`，无过渡动画

---

## 三、衔接丝滑度

### 3.1 导航逻辑

- **Welcome → ProviderSetup**：`navigation.navigate`，可返回
- **ProviderSetup → Completion**：`navigate`，可返回；支持「跳过」直接到 Completion
- **Completion → ServerConfig/Login**：`navigation.reset`，清空栈，不可返回

**问题**：

- 从 Completion 到 ServerConfig/Login 是硬切，无过渡
- 若用户从 Completion 进入 ServerConfig，再点返回会去哪？需确认 `firstLaunch` 时是否隐藏返回
- ProviderSetup 的「跳过」语义模糊：跳过配置后，Completion 仍会 `hasConfiguredUrl` 检查，无 URL 则去 ServerConfig，用户可能困惑「跳过了为何还要配置」

### 3.2 文案衔接

| 步骤          | 主文案                     | 副文案                                  | CTA                   |
| ------------- | -------------------------- | --------------------------------------- | --------------------- |
| Welcome       | 欢迎来到 Avato             | 掌控你的 AI 工作流。（打字机）          | 开始使用              |
| ProviderSetup | 连接服务器                 | 输入你的自托管 Avato 实例地址。         | 确认 / 暂时跳过       |
| Completion    | 一切就绪！                 | 你的工作区已准备好。开始与 AI 对话吧。  | 开始对话              |
| ServerConfig  | 服务器配置（ScreenHeader） | serverSubtitle / serverDesc             | 连接并开始 / 保存配置 |
| Login         | Avato（硬编码）            | 掌控你的 AI 工作流。（与 Welcome 相同） | 使用 XXX 登录 / 继续  |

**问题**：

- Login 复用 `onboardingWelcomeDesc`，与 Welcome 完全一致，在登录场景语义不当
- Completion 说「一切就绪」，但下一步可能是 ServerConfig（还要配置）或 Login（还要登录），存在误导
- ProviderSetup 与 ServerConfig 功能重叠（都是配置 URL），但文案、布局、组件均不同，用户可能觉得「又来了一个配置页」

### 3.3 数据流

- ProviderSetup 可 `setApiUrl` 后进入 Completion
- Completion 根据 `hasConfiguredUrl` 决定去 Login 还是 ServerConfig
- 若用户在 ProviderSetup 跳过，Completion 会去 ServerConfig，此时需再次输入 URL
- ServerConfig 与 ProviderSetup 的 URL 输入、测试、保存逻辑重复，未复用

---

## 四、可优化点（更优雅）

### 4.1 屏幕数量

**现状**：5 屏（Welcome → ProviderSetup → Completion → ServerConfig/Login → MainTabs）

**建议**：

1. **合并 Welcome + ProviderSetup**：首屏下方直接放「输入服务器 URL」+「暂时跳过」，减少一次点击和一次过渡
2. **合并 Completion + Login**：若已配置 URL，Completion 的「开始对话」可直接进入 Login 布局（同一屏），完成登录后进入 MainTabs，减少一次「庆祝屏」
3. **极端精简**：Welcome（含 URL 输入）+ Login，2 屏；或单屏 Welcome（URL + 登录入口），1 屏

### 4.2 风格统一

1. **主题接入**：Onboarding 与 Login 全部使用 `useThemeColors()`，移除 `#007aff`、`#005bb5` 等硬编码
2. **布局统一**：统一 `px-8` 或统一使用 `ScreenHeader` + 内容区
3. **组件统一**：CTA 统一用 `PressableScale` 或统一用 `TouchableOpacity`；输入框复用 ServerConfig 的卡片式设计
4. **动画节奏**：定义统一的 delay/duration 规范（如 80/160/240ms delay，350/420ms duration）

### 4.3 衔接优化

1. **跳过语义**：ProviderSetup 的「暂时跳过」改为「稍后配置」，并在 Completion 明确提示「请先配置服务器」或「请先登录」
2. **Completion 分流**：若 `hasConfiguredUrl` 且 `enableNoAuth`，Completion 的 CTA 直接进入 MainTabs，无需经过 Login
3. **Login 文案**：Login 使用独立文案（如「登录以继续」），不再复用 `onboardingWelcomeDesc`
4. **ProviderSetup 与 ServerConfig 合并**：Onboarding 内的「连接服务器」直接使用 ServerConfig 的 UI 与逻辑，避免两套实现

### 4.4 视觉层次

1. **Welcome 打字机**：可保留，但考虑提供「跳过动画」按钮，避免用户等待
2. **Logo 复用**：Welcome 与 Login 的 Logo 展示可考虑差异化（如 Login 缩小、或仅保留品牌名）
3. **ServerConfig 的 firstLaunch**：与 Onboarding 视觉风格拉齐，或明确区分「应用内设置」与「首次引导」

---

## 五、总结

| 维度           | 评分   | 说明                                                                        |
| -------------- | ------ | --------------------------------------------------------------------------- |
| **风格连贯性** | ⭐⭐⭐ | 布局、颜色、组件有差异；硬编码多；ServerConfig 与 Onboarding 割裂           |
| **衔接丝滑度** | ⭐⭐   | 导航 reset 硬切；文案重复与语义不当；ProviderSetup 与 ServerConfig 功能重叠 |
| **优雅程度**   | ⭐⭐⭐ | 动画与打字机有亮点，但整体节奏不统一，可更精致                              |
| **屏幕数量**   | ⭐⭐   | 5 屏偏多，存在合并空间；Completion 作为「纯庆祝」屏价值有限                 |

**优先建议**：

1. 接入主题，移除 Onboarding/Login 硬编码颜色
2. 合并或复用 ProviderSetup 与 ServerConfig 的 URL 配置逻辑与 UI
3. 重新评估 Completion 屏必要性，或与 Login 合并
4. 统一 Login 文案，不再复用 onboardingWelcomeDesc
5. 定义 Onboarding 设计规范（间距、动画、组件），并让各屏遵循
