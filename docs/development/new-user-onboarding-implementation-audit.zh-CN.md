# 新用户 Onboarding 实施完备性审计

> **日期**：2026-03-18\
> **目的**：验证改造后流程无堵塞点、无疏漏

---

## 一、路径覆盖验证

### 1.1 App 冷启动分流（App.tsx init）

| 条件                                    | 目标路由          | 验证 |
| --------------------------------------- | ----------------- | ---- |
| `!onboardingDone && !hasUrl`            | OnboardingWelcome | ✅   |
| `hasUrl === false`（含 onboardingDone） | ServerConfig      | ✅   |
| `hasUrl && enableNoAuth`                | MainTabs          | ✅   |
| `hasUrl && enableOIDC && 有 session`    | MainTabs          | ✅   |
| `hasUrl && enableOIDC && 无 session`    | Login             | ✅   |
| 异常 catch                              | Login             | ✅   |

### 1.2 用户操作路径

| 起点                          | 操作                     | 终点                      | 验证                                                 |
| ----------------------------- | ------------------------ | ------------------------- | ---------------------------------------------------- |
| Welcome                       | 点击「开始使用」         | ServerConfig(firstLaunch) | ✅ `navigate('ServerConfig', { firstLaunch: true })` |
| ServerConfig(firstLaunch)     | 保存成功 + enableNoAuth  | MainTabs                  | ✅                                                   |
| ServerConfig(firstLaunch)     | 保存成功 + enableOIDC    | Login                     | ✅                                                   |
| ServerConfig(firstLaunch)     | 保存成功 + auth 配置失败 | Login（fallback）         | ✅                                                   |
| ServerConfig(firstLaunch)     | 未填 URL 点保存          | Alert 校验                | ✅                                                   |
| Login                         | 点击「服务器」           | ServerConfig              | ✅ `navigate('ServerConfig')`                        |
| ServerConfig (非 firstLaunch) | 保存且 URL 变更          | Login                     | ✅                                                   |
| ServerConfig (非 firstLaunch) | 保存且 URL 未变          | goBack                    | ✅                                                   |

---

## 二、堵塞点检查

### 2.1 无返回陷阱

| 场景                                | 风险                     | 结论                                  |
| ----------------------------------- | ------------------------ | ------------------------------------- |
| Welcome → ServerConfig(firstLaunch) | 无返回按钮，用户无法回退 | ✅ 符合设计：单主任务，不提供跳过     |
| ServerConfig (firstLaunch) 保存失败 | 用户卡在 Connect 屏      | ✅ 可重试保存；可修改 URL 再试        |
| Login 认证失败                      | 用户卡在 Login           | ✅ 可点「服务器」回 ServerConfig 修改 |

### 2.2 死循环 / 死锁

- Welcome 仅能进入 ServerConfig，无循环 ✅
- ServerConfig 保存后 reset 到 Login 或 MainTabs，栈清空 ✅
- Login 可进入 ServerConfig，ServerConfig 可回到 Login（通过 reset），无循环 ✅

### 2.3 未处理分支

| 分支                          | 处理                       | 结论                                        |
| ----------------------------- | -------------------------- | ------------------------------------------- |
| fetchMobileAuthConfig 抛错    | catch 后 fallback 到 Login | ✅                                          |
| setApiUrl 失败                | 未显式 try/catch           | ⚠️ 低风险：setApiUrl 通常不抛，且用户可重试 |
| syncMobileBootstrapState 失败 | 已 log，继续导航           | ✅                                          |

---

## 三、疏漏检查

### 3.1 已修复项

| 项                                      | 状态                          |
| --------------------------------------- | ----------------------------- |
| ONBOARDING_KEY 首启完成时写入           | ✅ ServerConfig handleSave 中 |
| syncMobileBootstrapState 抽到 appState  | ✅ 避免重复定义               |
| Login 独立文案 loginDesc                | ✅ 三语已补全                 |
| Welcome/Login 硬编码色 → useThemeColors | ✅                            |

### 3.2 遗留项（非阻塞）

| 项                                    | 说明                 | 状态                              |
| ------------------------------------- | -------------------- | --------------------------------- |
| ProviderSetupScreen.tsx               | 已脱离路由，为死代码 | ✅ 已删除                         |
| CompletionScreen.tsx                  | 同上                 | ✅ 已删除                         |
| .qoder/repowiki 引用                  | 仍指向旧文件         | 文档类，可后续更新                |
| ServerConfig 保存前未强制「测试通过」 | 用户可保存未验证 URL | 可选：保存前校验 status===success |

### 3.3 潜在改进（非疏漏）

| 项                | 说明                                     |
| ----------------- | ---------------------------------------- |
| 保存中 loading 态 | 当前无遮罩，用户可能重复点击             |
| 连接成功内联反馈  | 审计建议「内联状态切换」，当前仍依赖跳转 |

---

## 四、数据流一致性

| 检查项                              | 结论                                    |
| ----------------------------------- | --------------------------------------- |
| ONBOARDING_KEY 与 App init 读取一致 | ✅ 均用 `avato_onboarding_complete`     |
| setApiUrl 与 getApiUrl 时序         | ✅ 先 set 再 fetch auth，baseUrl 已更新 |
| checkConnection 调用时机            | ✅ 保存后、导航前已调用                 |

---

## 五、结论

**完备性**：✅ 主路径与分流逻辑完整，无堵塞点。

**疏漏**：仅存在非阻塞遗留（死代码、文档引用），不影响运行。

**建议**：

1. ~~删除 `ProviderSetupScreen.tsx`、`CompletionScreen.tsx`~~ ✅ 已完成
2. 若需更严格体验，可在 ServerConfig 保存前增加「测试通过」校验（可选）
