# Title 总结审计：Web 与 Mobile App 差异与故障分层

> 复核时间：2026-03-20  
> 范围：会话 / 话题标题自动总结与手动智能重命名  
> 目标问题：为什么 Web 端 title 总结基本可用，而 App 端自动和手动都“不对”甚至几乎不可用

## 一、执行摘要

结论先说：

- **主错误不在模型层，也不在提示词层。**
- **主错误在 App 编排层。** App 现在把“标题总结”实现成了一条薄 RPC 调用链，而 Web 把它实现成了 **topic 生命周期内建能力**。
- **次错误在服务端兼容 RPC 层。** App 依赖的 `topic.generateTopicTitle` / `session.generateSessionTitle` 都是“从数据库反查上下文再总结”的薄接口，和 Web 直接基于当前展示消息流做总结，不是同一层级。
- **第三层问题在结果同步 / 展示层。** 部分 App 页面就算后端生成成功，也不一定会把最近 topic / session 预览一起刷新，用户会误以为“没生效”。

换句话说，App 现在不是“Web 那条成功链路的移动端复刻”，而是“另一套兼容路径”。这就是它为什么手动和自动一起不好用。

---

## 二、最重要的判断：错误到底在哪层

| 层级 | Web | Mobile App | 当前结论 |
|------|-----|------------|----------|
| **触发层** | 会话发送完成后，直接在 topic 生命周期里触发总结 | 多个页面 / store 分散触发 | App 触发点分散且依赖 topicId |
| **编排层** | `summaryTopicTitle(topicId, messages)`，直接基于当前展示消息总结 | `generateBestTitle({ sessionId, topicId })`，优先走 RPC | **主错误层** |
| **接口层** | 不依赖 `topic.generateTopicTitle` / `session.generateSessionTitle` 作为主路径 | 几乎全靠这两个接口 | App 走了“兼容接口”，没走“主实现” |
| **服务端总结层** | Web 已把上下文在前端整理好再发起总结 | 服务端重新查 DB，只取有限上下文 | **次错误层** |
| **结果同步层** | Topic store 内部更新，UI 同步链完整 | fetchTopics / fetchSessions 与 recentTopics 刷新不一致 | **放大故障感知** |
| **模型 / Prompt 层** | `chainSummaryTitle` | 同一 prompt / 同一 systemAgent task 模型来源 | 不是主因 |

最核心的一句：

> **Web 的 title 总结是“主链路内建能力”；App 的 title 总结是“调用兼容接口的外挂功能”。**

---

## 三、Web 端当前主路径

### 3.1 自动总结发生在哪里

Web 的正常路径在：

- `src/store/chat/slices/aiChat/actions/conversationLifecycle.ts`
- `src/store/chat/slices/topic/action.ts`

发送完成后，Web 会直接调用：

```ts
summaryTopicTitle(topicId, messages)
```

它的特点是：

1. **直接使用当前展示消息**，不是重新去数据库猜上下文。
2. **和 topic store 深度绑定**，有 loading、流式输出、最终写回。
3. 新建 topic 与已有 topic 的补总结逻辑都在这条链里。
4. 总结结果写回 topic 后，当前 UI 不需要额外再拼一次“最近话题刷新补丁”。

### 3.2 Web 总结为什么看起来更稳

Web 的 `summaryTopicTitle` 会：

- 先把 topic 置为 loading
- 用 `chatService.fetchPresetTaskResult(...)` 流式拿结果
- 一边流式更新临时标题，一边给 UI loading 状态
- 完成后通过 `internal_updateTopic(topicId, { title: text })` 正式写回

这意味着 Web 的用户感知是：

- 有 loading
- 有过程
- 最终状态和 store / UI 是一条链

这也是为什么 Web 侧“性能体感”虽然未必总是快，但通常**语义正确**。

---

## 四、Mobile App 当前主路径

### 4.1 App 并没有走 Web 那条主链路

App 的标题总结中心函数在：

- `apps/mobile/src/lib/titleGeneration.ts`

核心逻辑是：

- 有 `topicId`：调用 `topicApi.generateTitle(topicId)`
- 没有 `topicId`：调用 `sessionApi.generateTitle(sessionId)`

问题在于：

1. **当前所有主要调用点基本都会传 `topicId`**
2. 所以 App 实际上几乎总是走 `topic.generateTopicTitle`
3. 一旦 `topic.generateTopicTitle` 返回 `null`，App 就直接失败
4. **不会在 `topicId` 存在时 fallback 到 session 总结**

这意味着 `generateBestTitle` 这个名字本身就带有误导性：  
它现在并不是“best”，而是“topic first, fail closed”。

### 4.2 App 自动总结发生在哪里

App 自动总结主要在：

- `apps/mobile/src/store/chat.ts`

逻辑大意：

1. 发送消息
2. assistant 回复持久化
3. 如果还没有 topic，就在回复后创建 topic
4. 然后调用 `triggerTopicTitleGeneration(sessionId, topicId)`

而 `triggerTopicTitleGeneration` 还多了一层 gating：

- 没有 `topicId` 就不触发
- topic 当前标题不是默认标题就不触发

这和 Web 的差异非常大：

- Web：topic 总结属于 topic 生命周期一部分
- App：topic 总结是“消息完成后补做的一件事”

所以 App 天然更容易出现：

- topic 还没准备好
- 当前页面和 store 的 activeTopic 不一致
- 触发发生了，但后面刷新没跟上

---

## 五、服务端兼容 RPC 为什么更脆

App 目前主要依赖两个接口：

- `src/server/routers/lambda/topic.ts` -> `generateTopicTitle`
- `src/server/routers/lambda/session.ts` -> `generateSessionTitle`

### 5.1 `topic.generateTopicTitle` 的局限

它当前做的事情是：

1. 从数据库按 `topicId` 把消息查出来
2. 取 **第一条 user**
3. 取 **最后一条 assistant**
4. 送给 `SystemAgentService.generateTopicTitle`

这条路径的问题：

- 它只拿 **第一问 + 最后一答**
- 它不使用 Web 当前正在展示的 `displayMessages`
- 它没有 Web 那种流式总结状态
- 如果 topic 内消息结构稍复杂，就容易返回 `null`

典型脆弱点包括：

- topic 刚创建、消息绑定刚完成时
- 第一条 user 很短，但后面 conversation 才真正有主题
- 多模态 / 压缩消息 / 群聊等结构下，数据库原始消息不等于最终展示语义

### 5.2 `session.generateSessionTitle` 的局限

它当前逻辑是：

1. 按 session 或 group 取消息
2. 从后往前找 **最近一个 assistant**
3. 再向前找 **对应 user**
4. 用这对消息做标题总结

这条路径本身是“session / group 标题总结”的兼容实现，不是 Web 正常对话标题的主路径。

更关键的是：

- App 当前主调用几乎不会走到这里
- 因为一旦有 `topicId`，`generateBestTitle` 就直接只走 topic 路线

所以它不是“失败兜底”，而是“几乎闲置的另一条语义分支”。

---

## 六、为什么 App 的手动和自动会一起坏

这是本次审计最关键的结论之一。

### 6.1 自动坏，不是自动逻辑单独坏

App 自动总结调用：

- `apps/mobile/src/store/chat.ts` -> `generateBestTitle({ sessionId, topicId })`

### 6.2 手动也坏，不是 UI toast 单独坏

App 手动智能重命名调用：

- `apps/mobile/src/screens/ChatDetailScreen.tsx`
- `apps/mobile/src/screens/ChatListScreen.tsx`
- `apps/mobile/src/screens/TopicListScreen.tsx`

它们最终也都调用：

```ts
generateBestTitle({ sessionId, topicId })
```

也就是说：

> **手动和自动现在并不是两套不同能力。它们只是同一条薄链路的两个入口。**

因此只要这条链路本身设计错位，手动和自动就会一起表现为：

- 返回 `null`
- 弹通用失败 toast
- 结果不稳定
- 和 Web 观感完全不同

---

## 七、结果同步层还在放大问题

即使不考虑总结本身的成功率，App 还有一层“看起来没成功”的同步问题。

### 7.1 `generateBestTitle` 只刷新部分 store

它内部会：

- topic 成功时：更新 `topicsBySession`，然后 `fetchTopics(sessionId)`
- session 成功时：更新 session store，然后 `fetchSessions()`

但 App 首页和部分列表还会依赖别的本地状态，例如：

- `recentTopics`

只有部分页面手动做了额外刷新，例如 ChatListScreen 的 `refreshRecentTopics()`。

结果就是：

- 后端可能已经生成成功
- topic store 也可能已经更新
- 但当前页面依赖的是另一份 recent list，本地没刷
- 用户看到的就是“没变”

这不是根因，但它会极大放大“标题总结完全没用”的体感。

---

## 八、模型层是不是主因

不是。

本次审计反而确认了一点：

- Web `summaryTopicTitle`
- Server `SystemAgentService.generateTopicTitle`

二者都使用同一个 prompt 生成器：

- `packages/prompts/src/chains/summaryTitle.ts`

而服务端 systemAgent 还专门写了注释，说明 session title 这条兼容路径会使用与 Web topic summary **同源的 task model 配置**。

---

## 九、2026-03-20 远端复核结论

本次在生产实例上直接核对数据库后，拿到了一个决定性证据：

- `topics.id = tpc_xNkuwJy5WkTw` 的 `title` 已经被写成一整段多行 Markdown 长文
- 但该 `topic` 实际保存的消息内容是：
  - `user`: `推荐一些skills`
  - `assistant`: 一段“技能推荐”回答
- 也就是说：

> **被写入 title 的内容，并不来自该 topic 在数据库中的真实消息。**

这说明问题不只是“模型偶尔总结差”，而是 **App 端把错误的话题上下文送去做了标题总结**。

### 9.1 已确认的真实根因

根因分两层：

1. **App 端把 `messagesBySession[sessionId]` 当成 `topicId` 的可靠消息源**
   - 但 Mobile Store 这里是 **session 级缓存**
   - 并不是像 Web 那样天然绑定“当前 topic 的 displayMessages”
   - 一旦 session 内切 topic、创建新 topic、恢复历史 topic，内存里的“当前消息”就可能和要总结的 `topicId` 不一致

2. **服务端没有对异常 title 做最后一道硬性拒收**
   - 即使模型返回了多行 Markdown / 长段落
   - 也会直接写进 `topics.title`

### 9.2 修复原则

因此最终修复不能只是“换一个 prompt”或者“改成最新一轮消息”，而必须同时做到：

- **App 不再把 session 级内存消息直接传给 topic 标题 RPC**
- **Server 只信 `topicId -> 数据库里的该 topic 消息`**
- **Server 对多行 / Markdown / 超长标题直接拒收**

否则只是把错消息总结得“更像标题”，但仍然会串题。

所以这次问题的主要矛盾不是：

- 模型没配对
- prompt 不一致
- provider 不同

真正的主要矛盾是：

- **Web 用的是“当前消息流 + topic store 主链路”**
- **App 用的是“topic/session 薄 RPC + 结果回填”**

---

## 九、为什么 Web 端“手动看起来也正常”

当前仓库里我**没有找到 Web 客户端直接调用**：

- `topic.generateTopicTitle`
- `session.generateSessionTitle`

这说明一个重要事实：

> **Web 端并不是靠这两个 RPC 实现标题总结的。**

Web 侧真正可靠的是自动总结主链路。  
而 App 现在的“手动智能重命名”其实是一个 Mobile 自己做出来的能力层，它没有对齐 Web 主链路，只是绕去调用了兼容接口。

因此如果你拿 Web 的“自动总结体验”去对照 App 的“手动智能重命名体验”，会感觉像同一功能一边正常一边完全不对，其实它们底下根本不是同一套实现。

---

## 十、故障分级：到底谁是第一责任层

### P0：App 编排层（第一责任层）

文件：

- `apps/mobile/src/lib/titleGeneration.ts`
- `apps/mobile/src/store/chat.ts`
- `apps/mobile/src/screens/ChatDetailScreen.tsx`
- `apps/mobile/src/screens/ChatListScreen.tsx`
- `apps/mobile/src/screens/TopicListScreen.tsx`

问题：

1. 有 `topicId` 时永远只走 topic RPC
2. topic 失败不 fallback session
3. 自动与手动共用同一条薄链路
4. 这条链路本身与 Web 主路径不一致

### P1：服务端兼容 RPC 层

文件：

- `src/server/routers/lambda/topic.ts`
- `src/server/routers/lambda/session.ts`

问题：

1. `topic.generateTopicTitle` 只看第一问 + 最后一答
2. `session.generateSessionTitle` 是另一套 session 语义
3. 两条路都不是 Web 正常 title 总结主路径

### P2：同步 / 展示层

文件：

- `apps/mobile/src/lib/titleGeneration.ts`
- `apps/mobile/src/screens/ChatListScreen.tsx`

问题：

1. `fetchTopics` / `fetchSessions` 与 `recentTopics` 刷新不统一
2. 成功了也可能看起来像没成功

### 非主因：模型 / Prompt 层

文件：

- `packages/prompts/src/chains/summaryTitle.ts`
- `src/server/services/systemAgent/index.ts`

结论：

- 不是本次主要矛盾

---

## 十一、推荐修复方向

### 11.1 短期止血

1. **废弃 App 里的 `generateBestTitle` 分流逻辑**
2. 有 `topicId` 时，不要失败即返回 `null`
3. 至少做成：
   - 先尝试 topic 总结
   - topic 失败后，如果产品语义允许，再 fallback session / group
4. 手动与自动的刷新链要统一，避免一边刷新 topic store、一边漏 recentTopics
5. **在服务端先修一刀最明显的脆弱点**：`topic.generateTopicTitle` 不应再取“第一条 user + 最后一条 assistant”，至少应改成与 `session.generateSessionTitle` 同样的“最近一轮 user + assistant”提取逻辑（例如复用 `pickLatestSessionTitleContext`）

### 11.2 中期正确修复

让 App 对齐 Web 的正确方向不是“继续堆 RPC fallback”，而是：

1. **把标题总结升级为 App chat/topic store 的内建能力**
2. 让 App 在发送完成后，直接基于当前对话上下文触发总结
3. 由 store 统一管理：
   - loading
   - 临时标题
   - 最终写回
   - 列表同步

也就是把 App 从：

> “我去问服务器，帮我总结一个标题”

改成：

> “我的 topic 生命周期中，本来就包含标题总结”

这才是真正和 Web 对齐。

### 11.3 服务端接口层建议

如果还保留 `topic.generateTopicTitle` 这类接口，它更适合作为：

- 老数据补修
- 调试工具
- 后台修复入口

而不应该继续承担 App 的主用户路径。

---

## 十二、最终结论

App 端 title 总结“完全不能用”，不是一个简单的“模型失败”或“toast 失败”问题。

真正的根因是：

1. **App 走错了实现层级**：它没有走 Web 的 topic 生命周期主链路
2. **App 把手动和自动都绑定到了同一条薄 RPC 链**
3. **服务端 RPC 又是简化版上下文总结，不够稳**
4. **列表刷新不同步进一步放大了失败感知**

所以答案是：

> **错误首先在 App 编排层，其次在服务端兼容 RPC 层，最后才是展示同步层；不在模型层。**

---

## 十三、相关文件索引

### Web 主路径

- `src/store/chat/slices/aiChat/actions/conversationLifecycle.ts`
- `src/store/chat/slices/topic/action.ts`

### Mobile 主路径

- `apps/mobile/src/lib/titleGeneration.ts`
- `apps/mobile/src/store/chat.ts`
- `apps/mobile/src/screens/ChatDetailScreen.tsx`
- `apps/mobile/src/screens/ChatListScreen.tsx`
- `apps/mobile/src/screens/TopicListScreen.tsx`

### 服务端兼容接口

- `src/server/routers/lambda/topic.ts`
- `src/server/routers/lambda/session.ts`
- `src/server/services/systemAgent/index.ts`

### 共享 Prompt

- `packages/prompts/src/chains/summaryTitle.ts`
