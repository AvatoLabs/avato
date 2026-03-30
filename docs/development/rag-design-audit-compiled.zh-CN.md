# LobeHub RAG 设计审计（合并稿）

> 文档类型：设计 / 架构审计\
> 范围：检索增强生成（RAG）相关主链路，包括分块、向量化、检索、知识库工具、上下文注入、评测与数据血缘。\
> 说明：本文只保留 “适合作为后续实现依据” 的结论。能够直接从代码确认的写成 “已确认问题”；依赖 RLS、部署方式或产品取舍的内容，统一写成 “条件性风险”。

---

## 如何阅读本文

- **已确认问题**：代码已经能直接证明，应作为实现任务处理。
- **条件性风险**：风险存在，但是否真的形成漏洞或用户可见问题，取决于环境前提。
- **设计取舍**：不是单点 bug，但如果不先统一策略，后续迭代会持续复制问题。

---

## 执行摘要

| 优先级 | 结论                                                                                                           | 状态       |
| ------ | -------------------------------------------------------------------------------------------------------------- | ---------- |
| **P0** | 服务端 builtin runtime 注册表中没有 `lobe-source-set`，服务端 Agent Runtime 走知识库工具会报 “not implemented” | 已确认     |
| **P0** | `semanticSearch` 在无 `fileIds` 时，SQL 没有显式用户过滤；若不依赖 RLS 或其他上层边界，存在跨用户检索风险      | 条件性风险 |
| **P1** | `semanticSearchForChat` 会先做 embedding，再解析最终文件范围；当范围为空时仍会产生无效 embedding 成本          | 已确认     |
| **P1** | `semanticSearchForChat` 没走 `checkBudgetsUsage`，而 `semanticSearch` 走了，预算边界不一致                     | 已确认     |
| **P1** | `topK` 同时被用作 “全局 chunk 数量上限” 和 “文件结果数量上限”，参数语义混乱                                    | 已确认     |
| **P1** | 向量维度固定为 `1024`，且 `EmbeddingModel.bulkCreate` 冲突即跳过，模型切换后易静默保留旧向量                   | 已确认     |
| **P1** | `SourceSetManifest` 默认 `topK=15`，客户端 / 服务端执行器默认 `topK=20`，工具契约不一致                        | 已确认     |
| **P2** | 检索仍是单阶段向量 Top-K，缺少 rerank / 多样性控制，`TODO` 仍在主链路中                                        | 已确认     |
| **P2** | `query` 参数在 `ChunkModel.semanticSearch*` 中没有参与 SQL 过滤，名称会误导调用方以为已有混合检索              | 已确认     |
| **P2** | 评测链 `chainAnswerWithContext` 允许较多通用知识补全，与线上知识库工具 “优先基于库内容回答” 的口径不完全一致   | 已确认     |

---

## 一、已确认且会直接影响实现的问题

### 1. 知识库工具只有客户端执行链，缺少服务端 runtime（P0）

当前状态很明确：

- 客户端 builtin executor 已注册：`src/store/tool/slices/builtin/executors/index.ts`
- 服务端 builtin runtime 注册表未注册 `lobe-source-set`：`src/server/services/toolExecution/serverRuntimes/index.ts`
- `BuiltinToolsExecutor` 在服务端会先检查 `hasServerRuntime(identifier)`：`src/server/services/toolExecution/builtin.ts`

因此：

- **客户端 Web 对话流** 可以走知识库工具
- **服务端 Agent Runtime / 队列式执行** 走到该工具会直接报 `Builtin tool "lobe-source-set" is not implemented`

**落地建议**：

1. 补齐 `SourceSetExecutionRuntime` 的注册与上下文接线。
2. 在补齐前，不要把知识库工具写成 “客户端与服务端都可用”。

### 2. `semanticSearchForChat` 会在空范围下白做 embedding（P1）

`src/server/routers/lambda/chunk.ts` 中的顺序是：

1. 先对 `query` 做 embedding
2. 再解析 `fileIds` / `knowledgeIds`
3. 最后把 `finalFileIds` 交给 DB

而 `ChunkModel.semanticSearchForChat()` 在 `!hasFiles` 时会直接返回空数组。\
也就是说，**空检索范围会先付 embedding 成本，再返回空结果**。

**落地建议**：

1. 先解析并去重最终文件范围。
2. 范围为空时直接短路，不要调用 embedding。

### 3. 预算中间件只覆盖了 `semanticSearch`，没有覆盖聊天主路径（P1）

当前：

- `semanticSearch`：`.use(checkBudgetsUsage)`
- `semanticSearchForChat`：没有预算中间件

这会导致：

- 面向工具 / 主聊天路径的检索成本边界不一致
- 后续做预算、限流或计费时需要维护两套心智

**落地建议**：统一把聊天主路径也纳入预算检查，或者明确说明其预算由别的链路承担。

### 4. `topK` 语义混用，调用方无法准确预期结果（P1）

当前同一个 `topK` 同时参与：

- `ChunkModel.semanticSearchForChat().limit(topK)`：限制 chunk 条数
- `groupAndRankFiles(...).slice(0, topK)`：限制文件结果数

这会让调用方无法准确理解 “我请求的到底是多少个 chunk，还是多少个文件”。

**落地建议**：

1. 拆成 `chunkTopK` 与 `fileTopK`。
2. 如果短期不改接口，至少在 Schema 和文档里写清当前行为。

### 5. 工具默认值不一致（P1）

当前三个位置的默认值不同：

- `packages/builtin-tool-knowledge-base/src/manifest.ts`：`topK = 15`
- `packages/builtin-tool-knowledge-base/src/executor/index.ts`：`topK = 20`
- `packages/builtin-tool-knowledge-base/src/ExecutionRuntime/index.ts`：`topK = 20`

这不是小问题，因为它已经影响到：

- 工具 schema 对模型的暗示
- 客户端执行结果
- 未来服务端执行结果

**落地建议**：统一 manifest、客户端 executor、服务端 runtime 的默认值。

### 6. 向量维度与重嵌入策略过于脆弱（P1）

当前可以直接确认两点：

- 向量 schema 固定为 `vector(1024)`：`packages/database/src/schemas/rag.ts`
- `EmbeddingModel.bulkCreate()` 对 `chunkId` 冲突执行 `onConflictDoNothing()`：`packages/database/src/models/embedding.ts`

这组合起来意味着：

- 更换 embedding 模型或维度时，迁移成本高
- 如果未先清理旧向量，重跑任务可能静默跳过写入
- 查询向量和库内向量可能来自不同模型空间，但系统不一定报错

**落地建议**：

1. 明确 embedding 模型版本字段或重嵌入策略。
2. 不要继续依赖 “冲突即忽略” 作为默认重建行为。

### 7. 当前检索缺少多样性控制和 rerank（P2）

从代码可确认：

- 现在是单阶段向量 Top-K
- `groupAndRankFiles` 只是后处理聚合
- `src/server/routers/lambda/chunk.ts` 里仍有 `// TODO: need to rerank the chunks`

这意味着当前系统更像 “向量召回 + 简单分组”，还不是成熟的多阶段检索。

**落地建议**：

1. 先引入文件级多样性控制或简单 rerank。
2. 长期再考虑混合检索、MMR 等。

### 8. `query` 参数名会误导调用方（P2）

`ChunkModel.semanticSearch()` 与 `semanticSearchForChat()` 的签名都有 `query`，\
但 SQL 实际只使用 embedding，相当于：

- 参数存在
- 语义上像 “文本查询”
- 实际上没有关键词 / BM25 / 混合检索参与

**落地建议**：

1. 要么接入真正的文本侧检索；
2. 要么在命名和文档里明确它目前只是 “待 embedding 的原始 query”。

### 9. `finalFileIds` 直接 `concat`，没有去重（P2）

`semanticSearchForChat` 中，知识库文件和显式传入文件直接 `concat`。\
这不是功能性大 bug，但会带来：

- 重复 ID
- 查询与调试信息不干净
- 语义边界不清晰

**落地建议**：在进入 DB 前统一去重。

### 10. 服务端工具结果统一截断，与 “读取完整文件” 口径存在张力（P2）

`src/server/services/toolExecution/index.ts` 对所有工具结果调用 `truncateToolResult()`。\
默认截断上限是 `25_000` 字符。

因此：

- `readSourceFiles` 在服务端路径下并不能保证 “读到完整文件”
- 更准确的说法应该是 “尽量读取完整文件，但服务端执行链会受工具结果长度上限约束”

**落地建议**：把文案改准确，或为读取型工具单独定义更合适的返回策略。

---

## 二、条件性风险与设计取舍

### 1. `semanticSearch` 的隔离边界依赖外部前提（P0，条件性风险）

`packages/database/src/models/chunk.ts` 的 `semanticSearch()` 在 `fileIds` 为空时：

- 没有使用 `this.userId`
- 没有显式加 `fileChunks.userId = currentUser`

因此，从 SQL 代码本身看，隔离边界并不自解释。\
如果系统完全依赖数据库 RLS 或别的上层边界，这可以成立；\
如果没有这些前提，就会形成跨用户检索风险。

**建议写法**：

- 不要把它写成 “已确认数据泄漏”
- 但要明确标为 “若无 RLS / 等价隔离，将产生越权检索风险”

### 2. `LEFT JOIN embeddings` 没有显式排除空向量（P2）

当前检索 SQL 都是 `LEFT JOIN embeddings`。\
这会让 “没有向量的 chunk 是否进入排序集合” 变得不够直观，虽然具体行为还受 PG/pgvector 表达式影响。

**建议**：改成更显式的写法，例如 `INNER JOIN` 或 `IS NOT NULL` 过滤。

### 3. Agent 文件全文注入与知识库检索是两条语义不同的路径（设计取舍）

`KnowledgeInjector` 当前语义很明确：

- Agent 绑定文件：直接全文注入
- 知识库：只注入 “可搜索的知识库列表”，真正内容靠 `searchSourceSet`

这不是 bug，但需要产品和文档明确：

- “给 Agent 绑了文件” 不等于 “这些文件也会出现在 searchSourceSet 范围内”

### 4. 评测链与线上工具链口径不完全一致（P2）

`packages/prompts/src/chains/answerWithContext.ts` 中：

- 有上下文时允许大量 “上下文 + 通用知识” 的补全
- 无上下文时还会构造 `specialized in ${knowledge.join('/')}`，在 `knowledge: []` 时出现不自然文本

而 `ragEval` 当前正是拿这条链做评测。\
这意味着评测高分不一定等于线上知识库工具体验一致。

---

## 三、建议实施顺序

1. 先补服务端 `lobe-source-set` runtime，让客户端和服务端能力对齐。
2. 让 `semanticSearchForChat` 先解析范围再做 embedding，并补预算中间件。
3. 为检索 SQL 增加显式的用户隔离条件，不再把安全边界藏在外部前提里。
4. 统一 `topK` 语义与默认值。
5. 设计 embedding 版本化 / 重嵌入策略，再考虑切模型。
6. 最后处理 rerank、评测链与线上策略对齐。

---

## 四、主要代码索引

| 模块                       | 路径                                                                 |
| -------------------------- | -------------------------------------------------------------------- |
| Chunk 路由                 | `src/server/routers/lambda/chunk.ts`                                 |
| Chunk 模型                 | `packages/database/src/models/chunk.ts`                              |
| Embedding 模型             | `packages/database/src/models/embedding.ts`                          |
| 向量 schema                | `packages/database/src/schemas/rag.ts`                               |
| 知识注入                   | `packages/context-engine/src/providers/KnowledgeInjector.ts`         |
| Agent 文件 / 知识库 prompt | `packages/prompts/src/prompts/files/knowledgeBase.ts`                |
| 客户端知识库 executor      | `packages/builtin-tool-knowledge-base/src/executor/index.ts`         |
| 服务端知识库 runtime       | `packages/builtin-tool-knowledge-base/src/ExecutionRuntime/index.ts` |
| 服务端 runtime 注册表      | `src/server/services/toolExecution/serverRuntimes/index.ts`          |
| 服务端 builtin 执行器      | `src/server/services/toolExecution/builtin.ts`                       |
| 工具结果截断               | `src/server/services/toolExecution/index.ts`                         |
| RAG 评测路由               | `src/server/routers/async/ragEval.ts`                                |
| 评测 prompt 链             | `packages/prompts/src/chains/answerWithContext.ts`                   |

---

**修订说明**：本次修订删除了 “已确认跨租户泄漏”“所有路径都支持知识库工具” 等过强结论，改为把服务端缺口、预算不一致、空范围空跑、向量生命周期、评测偏差等真正会影响落地的设计问题单独拎出来，并把依赖 RLS / 部署前提的安全风险明确标记为条件性风险。
