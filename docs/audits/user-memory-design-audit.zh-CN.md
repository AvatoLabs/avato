# LobeHub 用户记忆（User Memory）设计审计

**范围**：Web SPA 注入链路、移动端注入链路、`userMemories`/`userMemory` 路由、话题检索、异步抽取、Webhook、安全边界与文档口径。\
**方法**：基于仓库静态代码阅读。本文只把代码已直接证明的事项写成 “已确认”；涉及部署方式、产品承诺或线上配置的内容，统一写成 “依赖前提” 或 “文档口径待校准”。

---

## 如何阅读本文

- **已确认问题**：代码已经能直接证明，适合纳入实现计划。
- **依赖前提的风险**：风险真实存在，但是否会外溢到用户 / 安全边界，取决于部署配置或运行策略。
- **文档 / 产品口径问题**：不是代码 bug，但如果不先收敛定义，后续实现很容易走偏。

---

## 执行摘要

| 优先级 | 结论                                                                                                                    | 状态   |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| **P0** | 记忆抽取 Webhook 只有在配置了 `MEMORY_USER_MEMORY_WEBHOOK_HEADERS` 时才校验请求头                                       | 已于 2026-04-05 收紧 |
| **P1** | Web 侧标准记忆注入路径不含 `identities`，移动端注入路径包含 `identities`，两端行为不一致                                | 已确认 |
| **P1** | 话题检索查询串按时间升序拼接并截取前 7000 字符，长话题会偏向早期轮次                                                    | 已确认 |
| **P1** | 话题记忆 SWR 仅以 `topicId` 为 key，且无失效调用方；同一话题内结果可能长期陈旧                                          | 已确认 |
| **P1** | 话题一旦被标记 `completed`，默认批量抽取路径不会自动因新消息再次进入抽取                                                | 已确认 |
| **P1** | `activities` 会被检索、缓存、组装进 `UserMemoryData`，但标准 `promptUserMemory` / `UserMemoryInjector` 不会把它注入模型 | 已确认 |
| **P2** | `useInitIdentities` / `globalIdentities` / `queryIdentitiesForInjection` 管线已存在，但当前没有调用方                   | 已确认 |
| **P2** | `retrieveMemoryForTopic` 走的是全局 memory effort，和 per-chat/per-agent 的 effort 设定没有打通                         | 已于 2026-04-05 接通 |
| **P2** | “自动注入记忆” 与 “Memory 工具是否启用” 是两套开关，产品口径若不澄清，文档会误导落地                                    | 已确认 |

---

## 一、已确认且会直接影响实现的问题

### 1. 话题检索查询串偏向对话开头（P1）

`packages/database/src/repositories/userMemory/UserMemoryTopicRepository.ts`：

- 只取 `role = 'user'` 的消息
- 按 `createdAt asc` 拼接
- 最后 `slice(0, 7000)`

这意味着长话题的检索 query 天然偏向早期轮次，而不是最近语境。

**落地建议**：

1. 至少改为 “最近优先”。
2. 更稳妥的方案是 “最近窗口 + 摘要”。
3. 如果仍保留顺序拼接，文档必须明确这是 “话题早期上下文检索”，不要误写成 “当前话题语境检索”。

### 2. Web 与移动端的 identity 注入不一致（P1）

当前两条路径是分叉的：

- **Web**：`src/services/chat/mecha/contextEngineering.ts`\
  通过 `resolveTopicMemories()` + `resolveUserPersona()` 组装 `combineUserMemoryData()`，结果里**没有 identities**。
- **Mobile**：`src/server/services/memory/buildMobileChatUserMemoryPrompt.ts`\
  明确调用 `queryForInjection()` 注入 `identities`。

这不是 “配置差异”，而是当前实现就不一致。

**落地建议**：

1. 先决定 “标准用户记忆注入是否包含 identities”。
2. 决定后，两端必须统一，不要继续分叉。

### 3. identity 初始化管线目前未接线（P2）

可以确认以下代码都存在：

- `useInitIdentities`
- `globalIdentities`
- `queryIdentitiesForInjection`

但全仓库检索下，当前没有 `useInitIdentities` 的调用方。\
也就是说，这是一条**已建但未接入运行链路**的管线。

**落地建议**：

1. 如果要保留 Web 侧 identity 注入，就接通这条链路。
2. 如果不准备用它，就及时删掉，避免文档误判为 “已可用能力”。

### 4. `activities` 被检索到了，但不会进入标准注入 XML（P1）

当前链路是这样的：

- `retrieveMemoryForTopic` 会返回 `activities`
- `resolveTopicMemories()` 会读取 `activities`
- `combineUserMemoryData()` 也把 `activities` 放进 `UserMemoryData`
- 但 `packages/prompts/src/prompts/userMemory/index.ts` 的 `promptUserMemory()` **并不渲染 activities**
- `UserMemoryInjector` 也是直接依赖 `promptUserMemory()`

因此，当前标准 Web 注入路径下：

- `activities` 会被检索和缓存
- 但不会出现在最终注入给模型的 XML 中

**落地建议**：

1. 要么补齐 `activities` 的 prompt 表达；
2. 要么从注入链路里去掉这层，避免 “检索了但没注入” 的假象；
3. 文档里不要再写成 “当前标准注入包含 activities”。

### 5. 同一话题内的记忆结果可能长期陈旧（P1）

`src/store/userMemory/slices/agent/action.ts` 中：

- SWR key 只有 `['useFetchMemoriesForTopic', topicId]`
- `revalidateOnFocus: false`
- `clearTopicMemories` 存在但无调用方

`src/features/Conversation/ChatList/index.tsx` 中会持续调用 `useFetchTopicMemories(topicId)`，\
但因为 key 不变、没有失效点，同一话题内新消息落库后，检索结果不会自动重算。

**更准确的结论**：

- 这不是 “永远不更新”，因为切 topic、手动刷新、重新挂载都可能触发；
- 但它**不会随着同一话题内的新消息自然失效**，这对 “按当前话题检索记忆” 的产品语义是不成立的。

**落地建议**：

1. 在消息发送成功后对当前 topic 触发 revalidate。
2. 或在话题 messageCount/lastMessageAt 变化时重算 key。

### 6. Webhook 认证曾经是 “有配置才启用”（P0，已于 2026-04-05 收紧）

`src/app/(backend)/api/webhooks/memory-extraction/route.ts` 中，只有在：

```ts
if (webhook.headers && Object.keys(webhook.headers).length > 0) {
  // 校验 header
}
```

时才会做鉴权。也就是说，**不配置 header 时，此路由默认可调用**。

这本身就是需要收紧的默认值。

**更新（2026-04-05）**：

1. 该链路现在默认 fail-closed，不再因为处于 `development/test` 就自动放行。
2. 只有三种情况会通过：内部服务鉴权、显式配置 `MEMORY_USER_MEMORY_WEBHOOK_HEADERS`、或在非生产环境显式设置 `MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV=true`。
3. 生产环境始终不会接受 `MEMORY_USER_MEMORY_WEBHOOK_ALLOW_INSECURE_DEV` 作为绕过条件。

**落地建议**：

1. 生产环境默认拒绝无认证调用。
2. 至少要求共享密钥、签名或内网隔离其一。
3. 文档里不要把 “可选 header” 写成 “安全 webhook”。

### 7. `completed` 话题不会因新消息自动回到待抽取（P1）

当前可以直接确认：

- `packages/memory-user-memory/src/providers/chatTopic.ts` 在抽取成功后把 `userMemoryExtractStatus` 写成 `completed`
- `packages/database/src/models/topic.ts` 的 `listTopicsForMemoryExtractor()` 默认排除 `completed`
- `src/server/services/memory/userMemory/extract.ts` 的 `isTopicExtracted()` 只认 `completed`

虽然 recorder 也记录了 `lastMessageAt` 与 `messageCount`，\
但当前代码里**没有看到基于新消息自动把 `completed` 降级为待抽取**的逻辑。

**结论要点**：

- 这不代表 “话题后续绝不会写入记忆”，因为 Memory 工具路径仍可写；
- 但**默认后台批量抽取**不会自动重扫这个已完成话题。

**落地建议**：

1. 新消息到达时重置状态，或
2. 批量抽取时比较 `messageCount/lastMessageAt` 与上次抽取状态。

### 8. `retrieveMemoryForTopic` 和 per-chat effort 语义曾未打通（P2，已于 2026-04-05 接通）

`searchUserMemories()` 支持 `input.effort ?? ctx.memoryEffort`。

**更新（2026-04-05）**：

1. `retrieveMemoryForTopic` 已接收并透传 `effort`
2. Web 侧 `ChatList` 已把 per-chat/per-agent 的 `effectiveMemoryEffort` 传给话题记忆预取
3. 这条审计结论已不再代表当前实现现状

在更早的实现阶段，`retrieveMemoryForTopic` 没有传 `input.effort`，因此它走的是：

- `memoryProcedure` 从 DB 用户设置读取的全局 `memory.effort`

与此同时，前端对话流里又有 per-chat/per-agent 的 `effectiveMemoryEffort` 概念。\
这两者不是一条链。

**落地建议**：

1. 明确 “话题检索 effort 是否允许被会话覆盖”。
2. 如果允许，`retrieveMemoryForTopic` 需要接收 effort。
3. 如果不允许，产品文档要写清 “对话 effort 不影响话题记忆检索条数”。

---

## 二、依赖前提的风险与工程说明

### 1. 抽取结果持久化主要依赖上游去重

从当前调用路径看，`context / experience / preference` 等层的持久化更偏向 “创建新记录”，\
不像 identity 那样有更明确的 add/update/remove 语义。

这不一定立刻构成 bug，但意味着：

- 语义去重更多依赖模型输出质量
- 后续如果检索或展示质量下降，排查难点会落在 “抽取重复” 而不是 “查询错误”

**建议**：把 “是否需要服务端去重 / 合并策略” 作为设计项明确，而不是默认相信上游抽取结果足够稳定。

### 2. 检索失败此前对用户近乎不可见（已于 2026-04-05 部分收口）

`retrieveMemoryForTopic` 失败后直接返回空结果。\
这让前端无法区分：

- 真正没有相关记忆
- 服务异常导致没检索出来

**更新（2026-04-05）**：

1. `retrieveMemoryForTopic` 失败时现在会返回显式的 `retrieval.status = 'error'`
2. Web 对话页会显示轻量 warning，而不是继续完全静默回空

如果未来要把记忆作为关键能力，这条链路仍值得继续补更强的观测与诊断。

---

## 三、文档和产品口径必须先收敛的点

### 1. “自动注入记忆” 不是 “Memory 工具开关”

当前有两套相互独立的能力：

- **自动注入**：已有记忆是否进上下文
- **Memory 工具**：模型是否能主动写记忆

因此完全可能出现：

- 没开 Memory 工具，但仍会自动注入已有记忆

如果后续设计文档仍把它们写成一回事，落地一定会混乱。

### 2. 分享页不拉记忆是当前有意行为

`src/features/Conversation/ChatList/index.tsx` 中，分享页会跳过记忆和 notebook 拉取。\
这更符合隐私预期，应当视为**明确行为**，不是待修 bug。

### 3. “导出 / 批准制 / 过期” 之类文档表述不能直接当实现现状

这些属于产品承诺或发行版能力口径，不是当前代码已经自证的事实。\
后续若依据这些文档落地，应先核对：

- 是否真有对应入口
- 是开源版、商业版还是特定部署态能力
- 是 “可见可编辑可删除” 还是 “逐条审批”

### 4. 内部记忆 ID 与用户可见文案要分离

当前 XML 注入里包含记忆 `id`，而 Memory 工具又要求助手不要向用户暴露内部 ID。\
这不是立即失效的 bug，但属于明显的策略缝隙。

---

## 四、建议实施顺序

1. 先统一 Web / Mobile 的 identity 注入策略。
2. 决定 `activities` 是否属于标准注入层，不要继续 “检索但不注入”。
3. 修复 topic memory 失效策略，让同一话题内的记忆结果能随着新消息更新。
4. 收紧 webhook 默认认证策略。
5. 为 `completed` 话题增加增量抽取语义。
6. 最后再统一 effort 语义和文档口径。

---

## 五、主要代码索引

| 主题              | 路径                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| 话题 query 串生成 | `packages/database/src/repositories/userMemory/UserMemoryTopicRepository.ts` |
| Web 记忆组装      | `src/services/chat/mecha/memoryManager.ts`                                   |
| Web 注入上下文    | `src/services/chat/mecha/contextEngineering.ts`                              |
| 标准记忆注入      | `packages/context-engine/src/providers/UserMemoryInjector.ts`                |
| 记忆 XML prompt   | `packages/prompts/src/prompts/userMemory/index.ts`                           |
| 移动端记忆 prompt | `src/server/services/memory/buildMobileChatUserMemoryPrompt.ts`              |
| 话题记忆 SWR      | `src/store/userMemory/slices/agent/action.ts`                                |
| 话题预取入口      | `src/features/Conversation/ChatList/index.tsx`                               |
| 抽取 Webhook      | `src/app/(backend)/api/webhooks/memory-extraction/route.ts`                  |
| 抽取执行器        | `src/server/services/memory/userMemory/extract.ts`                           |
| 话题抽取列表      | `packages/database/src/models/topic.ts`                                      |
| 话题抽取结果写回  | `packages/memory-user-memory/src/providers/chatTopic.ts`                     |

---

**修订说明**：本次修订删除或降级了 “必然安全漏洞”“功能已经完整可用”“文档承诺即实现现状” 这类过强表述，保留了真正可从代码直接证明的问题，并把部署相关风险与产品口径问题分开描述，便于后续按实现优先级落地。
