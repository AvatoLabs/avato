# LobeHub RAG 支持审计

> 复核时间：2026-03-20\
> 范围：检索增强生成（RAG）相关能力在 LobeHub 中的实现程度
>
> 执行摘要：
>
> - 服务端 RAG 主链路已完整打通，覆盖文件处理、向量化、语义检索、工具调用、上下文注入与评估。
> - 当前最关键的缺口不是 “有没有 RAG”，而是检索质量增强项尚未落地，包括 Rerank、混合检索，以及 Mobile 会话级知识库选择入口。
> - 文档里需要明确区分 “后端能力已经存在” 和 “端上配置入口尚未补齐”，避免把同一问题同时描述成能力缺失与 UI 缺口。

## 一、总体结论

LobeHub 已具备**完整的 RAG 基础能力**，覆盖文档解析、向量化、语义检索、工具调用与上下文注入。核心链路在 Web 端打通，移动端支持部分能力，Rerank 与混合检索尚未落地。

---

## 二、已实现能力

### 2.1 文档处理流水线

| 环节                | 实现状态 | 说明                                                 |
| ------------------- | -------- | ---------------------------------------------------- |
| 文件上传            | ✅       | S3 兼容存储（RustFS/MinIO/AWS S3）                   |
| 文档解析            | ✅       | 支持 PDF、MD、DOC、XLS、PPT 等，可选 Unstructured.io |
| 分块（Chunking）    | ✅       | `ChunkService.asyncParseFileToChunks`，异步任务      |
| 向量化（Embedding） | ✅       | 默认 `text-embedding-3-small`，可配置多 Provider     |
| 向量存储            | ✅       | PostgreSQL + PGVector，HNSW 索引，cosine 相似度      |
| 异步任务            | ✅       | 解析与 Embedding 均支持异步队列                      |

**相关代码**：

- `src/server/services/chunk`：Chunk 服务
- `src/server/routers/lambda/chunk.ts`：chunk 路由（parse、embedding、search）
- `packages/database/src/models/chunk.ts`：Chunk 模型与 `semanticSearchForChat`

### 2.2 语义检索

| 能力           | 实现状态 | 说明                                                              |
| -------------- | -------- | ----------------------------------------------------------------- |
| 向量语义搜索   | ✅       | `ChunkModel.semanticSearchForChat`，按 fileIds /knowledgeIds 检索 |
| 知识库范围检索 | ✅       | 支持按 knowledgeBaseIds 限定检索范围                              |
| Top-K 控制     | ✅       | 默认 15，可配置 5–100                                             |
| 结果聚合       | ✅       | `groupAndRankFiles` 按文件聚合，取 top3 chunk 平均分              |

**检索流程**：

1. 用户 query → Embedding 模型生成向量
2. 按 knowledgeIds 解析为 fileIds
3. PGVector cosine 相似度检索
4. 按文件聚合、排序后返回

### 2.3 内置知识库工具（Builtin Tool）

| 工具                  | 实现状态 | 说明                               |
| --------------------- | -------- | ---------------------------------- |
| `searchKnowledgeBase` | ✅       | 语义搜索，返回文件摘要与相关 chunk |
| `readKnowledge`       | ✅       | 按 fileIds 读取完整文件内容        |

**Agent 集成**：

- Agent 可绑定知识库（knowledgeBaseIds）和文件（fileIds）
- 工具从 Agent 配置中读取 knowledgeBaseIds 作为检索范围
- 系统提示词（`systemRole.ts`）包含搜索策略、引用规范、错误处理

**相关代码**：

- `packages/builtin-tool-knowledge-base/`
- `src/server/modules/AgentRuntime/RuntimeExecutors.ts`：工具执行

### 2.4 上下文注入（Context Engineering）

| 能力             | 实现状态 | 说明                                         |
| ---------------- | -------- | -------------------------------------------- |
| Agent 文件注入   | ✅       | 绑定文件全文注入到首条用户消息前             |
| 知识库元信息注入 | ✅       | 知识库列表作为元信息注入，具体检索由工具完成 |
| MessagesEngine   | ✅       | `KnowledgeInjector` 负责 knowledge 注入      |

**注入逻辑**：

- **Agent 文件**：全文注入，不参与向量检索
- **知识库**：仅注入知识库元信息，实际检索由 `searchKnowledgeBase` / `readKnowledge` 完成

### 2.5 Query 重写（Query Rewrite）

| 能力              | 实现状态 | 说明                                                  |
| ----------------- | -------- | ----------------------------------------------------- |
| 系统 Agent 配置   | ✅       | `queryRewrite` 可配置模型                             |
| 用户问题重写      | ✅       | 将后续问题改写为包含上下文的独立问题                  |
| MessageQuery 存储 | ✅       | `messageQueries` 表存 userQuery、rewriteQuery         |
| UI 展示           | ✅       | Web 端展示 ragQuery、ragRawQuery，支持删除 / 重新生成 |

### 2.6 RAG 评估（RAG Eval）

| 能力         | 实现状态 | 说明                                                 |
| ------------ | -------- | ---------------------------------------------------- |
| 评估流程     | ✅       | `ragEvalRouter`：检索 → 生成答案 → 写入 evalRecord   |
| 语义搜索集成 | ✅       | 使用 `chunkModel.semanticSearchForChat` 获取 context |
| 答案链       | ✅       | `chainAnswerWithContext` 构造 prompt                 |

### 2.7 多 Provider 支持

| 能力           | 实现状态  | 说明                                                                                                                           |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Embedding 模型 | ✅        | 支持 openai/zhipu/github/bedrock/ollama 等                                                                                     |
| 配置方式       | ✅        | 默认模型 ID 为 `text-embedding-3-small`；环境变量中可写作 `DEFAULT_FILES_CONFIG=embedding_model=openai/embedding-text-3-small` |
| Reranker 配置  | ⚠️ 仅配置 | 支持 `reranker_model=cohere/rerank-english-v3.0`，但**尚未接入检索主流程**                                                     |

---

## 三、部分实现 / 待完善

当前最值得继续投入的三项分别是：**Rerank 接入**、**混合检索**、**Mobile 会话级知识库选择**。

### 3.1 Rerank（重排序）

- **配置**：`parseFilesConfig` 已解析 `reranker_model`
- **代码**：`chunk.ts` 第 282 行有 `// TODO: need to rerank the chunks`
- **结论**：Reranker 配置存在，但**未接入检索流程**

### 3.2 混合检索（Hybrid Search）

- **BM25 / 全文**：`packages/database/src/core/getTestDB.ts` 中有 pg_search/bm25 相关判断，但未在 SearchRepo / ChunkModel 中实现混合检索
- **结论**：当前仅有向量检索，无 BM25 或混合检索

### 3.3 移动端（Mobile）支持

| 能力             | 实现状态 | 说明                                           |
| ---------------- | -------- | ---------------------------------------------- |
| 知识库列表       | ✅       | `knowledgeBaseApi.list`，ResourceScreen 展示   |
| 文件管理         | ✅       | 上传、移动、删除、按知识库筛选                 |
| 知识库工具渲染   | ✅       | `SearchKnowledgeBase` 结果展示、Streaming 占位 |
| 会话级知识库选择 | ❌       | ChatSettingsScreen 无知识库 / 文件选择入口     |
| 工具调用         | ✅       | 与 Web 共用 Lambda，Agent 启用知识库工具即可   |

**结论**：移动端可**使用**已绑定知识库的 Agent 进行 RAG 对话，但**无法在会话设置中切换知识库**，这是当前最主要的产品侧缺口，而不是服务端能力缺失。

---

## 四、架构依赖

### 4.1 基础设施

| 组件                     | 用途                 |
| ------------------------ | -------------------- |
| PostgreSQL + PGVector    | 向量存储与 HNSW 索引 |
| S3 兼容存储              | 原始文件存储         |
| OpenAI Embedding（默认） | 向量生成             |
| Unstructured.io（可选）  | 复杂文档解析         |

### 4.2 是否依赖 Upstash

**RAG 不依赖 Upstash。**

| 能力                          | 实现方式                                       | 是否用 Upstash |
| ----------------------------- | ---------------------------------------------- | -------------- |
| 文档解析（parseFileToChunks） | HTTP 调用 `/trpc/async/file.parseFileToChunks` | ❌             |
| 向量化（embeddingChunks）     | HTTP 调用 `/trpc/async/file.embeddingChunks`   | ❌             |
| 语义检索                      | 同步 DB 查询，无队列                           | ❌             |
| 知识库工具调用                | 同步 Lambda 调用                               | ❌             |

RAG 的异步任务（解析、Embedding）通过 `createAsyncCaller` 以 **HTTP 请求** 触发内部 async 路由，不经过 QStash 或 Upstash Workflow。

**Upstash 在项目中的其他用途**（与 RAG 无关）：

- **QStash**：`AGENT_RUNTIME_MODE=queue` 时用于 Agent 步骤回调；记忆提取等 Workflow
- **Upstash Workflow**：记忆提取流水线、Agent 评估流水线
- **Upstash Redis**：可选，用于会话存储、限流（非 RAG 必需）

### 4.3 数据流

```
文件上传 → S3
    ↓
解析任务 → ChunkService.asyncParseFileToChunks
    ↓
Chunk 写入 DB
    ↓
Embedding 任务 → ChunkService.asyncEmbeddingFileChunks
    ↓
Embedding 写入 DB（embeddings 表）
    ↓
用户提问 → semanticSearchForChat（query 向量化 → 检索 → 聚合）
    ↓
工具 / 上下文注入 → LLM 生成
```

---

## 五、能力矩阵汇总

| 能力                      | Web | Mobile | 备注           |
| ------------------------- | --- | ------ | -------------- |
| 文件上传与解析            | ✅  | ✅     | 共用 API       |
| 向量化与存储              | ✅  | ✅     | 服务端         |
| 语义检索                  | ✅  | ✅     | 通过工具调用   |
| 知识库工具（search/read） | ✅  | ✅     | 共用 Lambda    |
| Agent 绑定知识库          | ✅  | ✅     | 配置同步       |
| 会话级选择知识库          | ✅  | ❌     | Mobile 无 UI   |
| Query 重写                | ✅  | ⚠️     | 依赖 Web 配置  |
| Rerank                    | ❌  | ❌     | 仅配置，未实现 |
| 混合检索                  | ❌  | ❌     | 未实现         |
| RAG 评估                  | ✅  | N/A    | 评估后台能力   |

---

## 六、建议改进方向

1. **P0. Rerank 接入**：在 `semanticSearchForChat` 返回前，对 chunks 调用 Reranker 重排，先解决 “召回到了但排序不稳” 的问题。
2. **P1. 混合检索**：引入 BM25 或 pg_search，与向量检索结果融合，提升关键词型问题和长尾命中率。
3. **P1. 移动端会话设置**：在 ChatSettingsScreen 增加知识库 / 文件选择，与 Web 的「文件 / 知识库」入口对齐。
4. **P2. 文档完善**：补充 RAG 自托管部署、Embedding 成本、向量存储估算与常见排障说明。

---

## 七、相关文件索引

| 模块       | 路径                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------ |
| 知识库工具 | `packages/builtin-tool-knowledge-base/`                                                                |
| Chunk 路由 | `src/server/routers/lambda/chunk.ts`                                                                   |
| RAG 服务   | `src/services/rag.ts`                                                                                  |
| 上下文注入 | `packages/context-engine/src/providers/KnowledgeInjector.ts`                                           |
| 上下文工程 | `src/services/chat/mecha/contextEngineering.ts`                                                        |
| RAG 评估   | `src/server/routers/async/ragEval.ts`                                                                  |
| 配置解析   | `src/server/globalConfig/parseFilesConfig.ts`                                                          |
| 自托管文档 | `docs/self-hosting/advanced/knowledge-base.zh-CN.mdx`、`docs/self-hosting/advanced/knowledge-base.mdx` |
