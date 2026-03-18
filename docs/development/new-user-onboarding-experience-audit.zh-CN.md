# 新用户 Onboarding 体验审计与综合方案（定稿）

> **日期**：2026-03-18\
> **范围**：Mobile App 新用户从启动到首次发送消息前的完整体验链路\
> **目标**：解决风格不连贯、衔接不丝滑、路径冗余问题，形成可落地的统一方案

---

## 一、TL;DR

当前新用户首路径的核心问题不是单点 UI，而是**信息架构重复**：

1. `ProviderSetupScreen` 与 `ServerConfigScreen` 功能重叠，用户要学两套 “同一件事” 的界面。
2. `CompletionScreen` 在流程中承担 “情绪庆祝” 但不承载关键决策，导致额外跳转。
3. Onboarding/Login 与应用内页面在颜色、组件、动效上存在两套视觉语言。
4. 文案链路存在语义冲突（如 Login 复用欢迎文案、跳过配置后仍被要求配置）。

**综合结论**：现状 “可用”，但不够优雅。应从 “多屏串联” 改为 “单主任务闭环”。

---

## 二、现状路径与问题归因

### 2.1 当前新用户路径（首次安装、无 URL）

```
Splash
  -> WelcomeScreen
  -> ProviderSetupScreen
  -> CompletionScreen
  -> ServerConfigScreen 或 LoginScreen
  -> MainTabs / ChatList
```

### 2.2 核心问题

| 维度       | 现状问题                                  | 本质归因                          |
| ---------- | ----------------------------------------- | --------------------------------- |
| 风格连贯性 | Onboarding/Login 与应用内页面视觉语言割裂 | 主题 token 未统一、存在硬编码色值 |
| 衔接丝滑度 | Completion 后 reset 硬切，跳过语义误导    | 路由分流与文案意图不一致          |
| 优雅程度   | 多次 “确认 / 继续” 但信息增量低           | 屏幕职责拆分不合理                |
| 屏幕数量   | 新用户常见路径 5 屏                       | 配置与认证流程重复、庆祝屏独立    |

---

## 三、设计原则（先定约束）

1. **单主任务原则**：新用户首路径唯一目标是 “连上可用服务并进入主界面”。
2. **单一配置真源**：服务器 URL 配置只能有一套 UI / 逻辑。
3. **语义一致原则**：页面文案必须匹配当前任务状态，避免 “已完成” 假象。
4. **风格同源原则**：Onboarding、Login、Settings 共用同一主题与交互组件体系。
5. **最短可达原则**：优先降低 “首次可聊天” 前的必要步骤数。

---

## 四、综合方案（推荐架构）

### 4.1 目标信息架构

采用 **2 屏主路径**（必要时 3 屏）：

1. **Welcome（可选品牌引导）**
2. **Connect & Sign In（合并屏）**：完成 URL 配置、连通验证、登录 / 免登分流
3. （可选）仅在特定 SSO 场景下出现外部授权回跳，不新增本地中间屏

### 4.2 目标流程

#### 场景 A：首次安装、无 URL、服务需登录

```
Welcome -> Connect & Sign In -> MainTabs
```

#### 场景 B：首次安装、无 URL、服务无认证

```
Welcome -> Connect & Start -> MainTabs
```

#### 场景 C：已有 URL、未登录

```
Login(或 Connect & Sign In 的登录态) -> MainTabs
```

#### 场景 D：已有 URL、已登录

```
直接 MainTabs
```

### 4.3 屏幕层面的收敛决策

1. **移除 `CompletionScreen` 的独立路由角色**：成功反馈改为 Connect 屏内联状态 + 轻量动效。
2. **合并 `ProviderSetupScreen` 与 `ServerConfigScreen` 能力**：保留一套 URL 输入、测试、保存、错误处理、主题样式。
3. **`LoginScreen` 角色收敛**：当 URL 未配置时不再出现纯登录页，统一回到 Connect 屏先完成连接。

---

## 五、风格统一方案（视觉与交互）

### 5.1 视觉系统

1. Onboarding/Login 禁止使用品牌色硬编码，统一走主题 token。
2. 统一主 CTA / 次 CTA 样式、圆角、间距、按压反馈。
3. 输入区统一为 “标签 + 图标 + 输入 + 状态反馈” 结构，不再双轨并行。
4. 保留品牌表达，但从 “独立品牌页风格” 过渡到 “应用内风格”。

### 5.2 动效系统

1. 引导链路统一路由转场（同方向 slide 或统一 fade，避免混杂）。
2. 页面内元素入场采用统一节奏（例如固定 3 级 delay 档位）。
3. 成功态采用 “内联状态切换” 替代 “跳到庆祝屏再跳回业务屏”。

### 5.3 文案系统

1. Login 页使用独立登录语义文案，不复用 Welcome 副文案。
2. 去除 “跳过配置” 歧义文案；若不可跳过则明确 “需要先连接服务器”。
3. “已就绪” 类文案只在真实可进入主界面时出现。

---

## 六、屏幕数量评估（改造前后）

| 场景                | 改造前 | 改造后（目标） |
| ------------------- | ------ | -------------- |
| 首次安装 + 需登录   | 5 屏   | 2 屏           |
| 首次安装 + 无认证   | 5 屏   | 2 屏           |
| 已配置 URL + 未登录 | 1–2 屏 | 1 屏           |
| 已配置 URL + 已登录 | 0 屏   | 0 屏           |

**结论**：新用户常见路径可从 5 屏压缩到 2 屏，减少 60% 跳转。

---

## 七、落地路线图（不改业务能力，只改体验编排）

### Phase 1（P0，先打通主路径）

1. 取消 `CompletionScreen` 在首路径中的强依赖。
2. 统一连接配置入口：仅保留一套连接 UI 与逻辑。
3. 调整路由分流：无 URL 一律先连接，再决定登录 / 直入。

### Phase 2（P1，统一视觉语言）

1. 清理 Onboarding/Login 的硬编码色值与不一致按钮风格。
2. 统一转场与页面内动效节奏。
3. 修正文案语义（欢迎、连接、登录、完成）。

### Phase 3（P2，精修与验证）

1. 首次路径埋点与漏斗监控。
2. 异常路径打磨（连接失败、认证失败、切换服务器）。
3. 小规模灰度与 A/B 对照。

---

## 八、验收标准（产品与体验）

1. 新用户从启动到可聊天不超过 2 次显式 “下一步” 点击。
2. 不再出现 “跳过后仍需立即配置” 的语义反转。
3. 首路径视觉风格与应用内页面无明显割裂（颜色、组件、动效一致）。
4. 连接失败与登录失败可在当前屏完成修复，不强制跳新屏。
5. 首次消息发送前路径无冗余庆祝屏。

---

## 九、效果指标（上线后观察）

1. `First Launch -> MainTabs` 完成率。
2. `First Launch -> First Message` 中位时长。
3. 连接失败后恢复成功率（同屏重试成功）。
4. 新用户路径平均屏幕访问数。
5. 登录页退出率与服务器配置页退出率。

---

## 十、最终结论

本次综合方案不追求 “再做一个更美的 onboarding”，而是把新用户路径从 “多屏叙事流” 重构为 “任务闭环流”。\
通过**屏幕职责合并 + 视觉系统统一 + 文案语义对齐**，在不增加业务复杂度的前提下，能显著提升首日体验的一致性、丝滑度与优雅度。

---

## 十一、实施记录（2026-03-18）

### Phase 1 (P0)

| 项                                                         | 状态          |
| ---------------------------------------------------------- | ------------- |
| 取消 CompletionScreen 在首路径中的强依赖                   | ✅ 已移除路由 |
| 统一连接配置入口：Welcome → ServerConfig (firstLaunch)     | ✅            |
| 移除 ProviderSetupScreen、CompletionScreen 路由            | ✅            |
| ServerConfig 首启后：enableNoAuth → MainTabs；否则 → Login | ✅            |
| 首启完成时设置 ONBOARDING_KEY                              | ✅            |

### Phase 2 (P1)

| 项                                                     | 状态 |
| ------------------------------------------------------ | ---- |
| WelcomeScreen 硬编码色 → useThemeColors                | ✅   |
| LoginScreen 硬编码色 → useThemeColors                  | ✅   |
| Login 独立文案 loginDesc，不复用 onboardingWelcomeDesc | ✅   |

### 变更文件

- `App.tsx`：ONBOARDING_KEY 移至 appState，syncMobileBootstrapState 移至 appState
- `lib/appState.ts`：新增 ONBOARDING_KEY、syncMobileBootstrapState
- `WelcomeScreen.tsx`：Get Started → ServerConfig (firstLaunch)，主题色接入
- `ServerConfigScreen.tsx`：首启保存后分流 Login/MainTabs，设置 onboarding done
- `navigation/index.tsx`：移除 ProviderSetup、Completion 路由
- `LoginScreen.tsx`：loginDesc 替代 onboardingWelcomeDesc，主题色接入
- `i18n.ts`：新增 loginDesc
