# 移动端 App 问题审计（资源预览、商店、Topic 总结）

本文档针对用户反馈的三个问题进行审计分析，并记录移动端当前已完成的修复。

---

## 一、资源预览加载慢（相比 Web）

### 1.1 现象

资源预览能载入，但非常慢，相比 Web 版本明显更慢。

### 1.2 实现差异

| 维度       | Web                            | App                                                   |
| ---------- | ------------------------------ | ----------------------------------------------------- |
| **图片**   | `<img src={url}>` 浏览器原生   | `expo-image`，启用磁盘 / 内存缓存                     |
| **PDF**    | react-pdf 直接渲染，无 WebView | WebView 加载 URL                                      |
| **Office** | Microsoft Office Viewer iframe | Microsoft Office Viewer iframe                        |
| **URL**    | 同源，302 后直接 fetch         | 使用 `/f/:id` 代理 URL，图片不再附带额外 auth headers |

### 1.3 已落地优化

1. **图片预览 / 缩略图**：已从 RN `Image` 切到 `expo-image`，启用缓存策略，减少重复解码与重复下载。
2. **公共文件代理**：`/f/:id` 本身无需鉴权，App 预览已移除额外 auth headers，避免影响原生图片缓存命中。
3. **Office 对齐**：已与 Web 一致，统一走 Microsoft Office Viewer。

### 1.4 仍然慢于 Web 的原因

1. **WebView 开销**：App 用 WebView 加载 PDF/Office，比 Web 的 react-pdf 多一层 WebView 初始化与渲染。
2. **无缓存策略**：`/f/:id` 返回 302 到 S3 预签名 URL，服务端有 Redis 缓存，但客户端（Image/WebView）每次打开预览都会重新请求，无本地缓存。
3. **网络路径**：App 在移动网络下，请求链为「App → 服务器 → 302 → S3」，可能比 Web 同源请求更慢。
4. **图片未做尺寸优化**：Web 可能有响应式 / 缩略图，App 的 `Image` 直接加载原图。

### 1.5 建议排查

- 用 React DevTools / Flipper 看 Network 请求耗时。
- 对比同一文件在 Web 与 App 的首次加载时间。
- 检查 S3 预签名 URL 的 CDN / 地域配置。

---

## 二、商店「已安装」页 focus 后不断刷新

### 2.1 现象

切换到「已安装」Tab 后，列表不断刷新。

### 2.2 根因分析

此前 `StoreScreen.tsx` 中存在重复 effect：

```
useEffect(() => {
  if (activeTab === 'installed') void fetchInstalled();
}, [activeTab, fetchInstalled]);

useEffect(() => {
  if (activeTab !== 'explore') return;
  void fetchMarketCategories(activeExploreSource);
}, [activeTab, activeExploreSource, fetchMarketCategories]);
```

**依赖链**：

1. `fetchInstalled` 执行 → `setBuiltinSkillsCatalog(builtinSkillList)` 更新状态
2. `builtinSkillsCatalog` 变化 → `builtinMarketItems`（useMemo）重新计算
3. `builtinMarketItems` 在 `fetchMarket` 的 useCallback 依赖中 → `fetchMarket` 引用变化
4. `fetchMarket` 在 useEffect 依赖中 → useEffect 再次执行
5. 当 `activeTab === 'installed'` 时 → 再次调用 `fetchInstalled`
6. 回到步骤 1，形成循环

### 2.3 当前修复状态

已拆分 installed /explore 的 effect，避免 installed tab 被 explore 侧依赖链反复拉起。当前 focus 回到「已安装」页时，只会执行一次 `fetchInstalled`。

### 2.4 修复思路（供实现参考）

将 effect 拆成两个，避免 `fetchMarket` 影响「已安装」Tab：

```ts
// 仅切换 Tab 时拉取
useEffect(() => {
  if (activeTab === 'installed') void fetchInstalled();
}, [activeTab, fetchInstalled]);

useEffect(() => {
  if (activeTab === 'explore') void fetchMarket(activeExploreSource, 1, false);
}, [activeTab, activeExploreSource, debouncedQuery, fetchMarket]);
```

或从 `fetchMarket` 的依赖中移除 `builtinMarketItems`，改用 ref 等方式打破循环。

---

## 三、Topic 自动总结：Web 有、App 无

### 3.1 现象

在 env 中配置 API 后，Web 能自动 summarize topic，App 不能。

### 3.2 实现对比

| 维度         | Web                                                  | App                                                             |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------- |
| **触发**     | `conversationLifecycle` 中 `summaryTitle()`          | `triggerTopicTitleGeneration()`                                 |
| **实现**     | `chatService.fetchPresetTaskResult`（客户端 / 代理） | `topicApi.generateTitle(topicId)`（服务端 tRPC）                |
| **模型来源** | `systemAgentSelectors.topic(useUserStore)`           | `SystemAgentService.getTaskModelConfig('topic')`（DB 用户设置） |
| **API 路径** | 聊天 API，使用用户配置的 provider                    | `topic.generateTopicTitle` → `SystemAgentService`               |

### 3.3 共同点

- 都依赖用户 `systemAgent.topic` 的 model/provider 配置
- 服务端 `SystemAgentService` 使用 `initModelRuntimeFromDB`，需要对应 provider 的 API 已配置

### 3.4 已确认根因

1. **无 topic 时的创建策略与切换时机不一致**：
   - Web：当前没有 `topicId` 时，会先完成本轮消息创建，再切到服务端确认后的新 topic。
   - App：此前会在发送前就 `createTopic + switchTopic`，导致页面先刷新到一个还没有消息的新 topic；首轮消息容易被后续 `fetchMessages` 覆盖，看起来像 “发送后刷新掉、回复消失”。

2. **默认标题判断过窄**：
   - App 之前只把 `'' / New Conversation / 新对话` 识别为默认标题。
   - 手动创建 topic 时使用的 `Topics / 话题 / 話題` 会被当成 “用户自定义标题”，从而跳过总结。

### 3.5 当前修复状态

1. 已对齐 web：移动端现在会在 assistant 消息持久化完成后，再创建并切换到新 topic；若该会话已有历史消息，会把已持久化消息 ID 一并挂到新 topic。
2. 已扩展默认标题识别，`Topics / 话题 / 話題` 也会继续触发 AI 总结。

### 3.6 其他可能原因

1. **触发时机**：App 的 `triggerTopicTitleGeneration` 仅在以下场景调用：
   - 单 Agent：`persist` 回调中，当 `persistedAssistant?.messages?.length` 时
   - 群聊：轮询中 `isGroupAssistantSettled` 为 true 时\
     若 persist 失败、未完成或群聊轮询异常，则不会触发。

2. **标题过滤**：`DEFAULT_TOPIC_TITLES = ['', 'New Conversation', '新对话']`，只有标题为空或为默认值时才生成。若 topic 已有非默认标题，会直接 return。

3. **Topic 未同步**：`triggerTopicTitleGeneration` 从 `topicsBySession[sessionId]` 取 topic。若 `syncTopicsForSession` 未及时更新，可能找不到对应 topic。

4. **请求失败无提示**：`topicApi.generateTitle` 失败时仅 `console.warn`，用户无感知。

### 3.7 建议排查

1. 在 `triggerTopicTitleGeneration` 内加日志，确认是否被调用、`topicId` 和 `sessionId`。
2. 在 `topicApi.generateTitle` 的 catch 中加日志，确认是否有网络 / 服务端错误。
3. 检查 `persist` 回调是否在 App 单 Agent 流程中正常执行。
4. 确认用户 `systemAgent.topic` 在 DB 中的配置，以及默认 provider 的 API 是否已在 env 中配置。

---

## 四、总结

| 问题             | 根因 / 方向                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| 资源预览慢       | 已优化图片缓存与请求头；剩余差距主要来自 WebView 和代理跳转链           |
| 已安装页不断刷新 | 已修复为 effect 拆分，避免 installed /explore 互相触发                  |
| Topic 不自动总结 | 已修复 topic 自动创建与默认标题识别；若仍失败，应继续排查服务端模型配置 |
