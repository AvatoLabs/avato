# 完全取消 Upstash QStash 依赖审计

## 审计目标

分析如何完全移除 Upstash QStash / Workflow 依赖，并用项目现有基础设施或新增的站内队列能力替代，同时尽量保留当前异步执行、回调、重试与状态管理语义。

这份文档聚焦两个不同目标，并明确区分：

1. **移除 Upstash 云依赖**
2. **保住当前生产级异步能力**

前者并不自动等于后者。若仅删除 QStash 而不补内部异步基础设施，最终通常会退化成 “可运行，但不可靠”。

---

## 一、执行摘要

### 1.1 结论

- **可以移除 Upstash QStash**
- **对生产环境的最终建议**：建议最终取消 Upstash 依赖，但前提是先完成站内异步基础设施替代，不能直接硬拔
- **但不建议按 “关掉 queue mode + 改成 fetch + direct 同步执行” 这种低改动路径实施**
- **推荐方案**：先引入基于 Redis 的站内异步执行层，再迁移 Agent Runtime、Memory、Bot Callback，最后清理 `@upstash/*`

### 1.2 核心判断

| 结论                                                     | 判断                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 是否保留兼容路径 / 双轨实现                              | ❌ 不保留 QStash / Workflow /internal worker 共存期，不做兼容壳                   |
| 仅通过 `LocalQueueServiceImpl` 替代 QStash               | ❌ 只适合本地 / 单机简化部署，不等价于生产替代                                    |
| `AgentBridgeService` 直接改为 `webhookDelivery: 'fetch'` | ❌ 当前 bot callback 仍依赖 QStash 签名，直接改会打坏 queue-mode 回调             |
| Memory 需要 “新增 direct 模式”                           | ❌ `direct` 执行原语已存在，真正缺的是入口与调度层迁移                            |
| Agent Eval 在本方案中的处理                              | ✅ 不保留临时降级态；要么同批完整迁移，要么直接从当前产品面移除。本文默认建议移除 |
| Web / App 是否需要同步修改                               | ✅ Web 与 App 都必须直接对齐最终态；Web 先完成验证，App 再跟进验证                |
| 完整替代 Workflow 最优选                                 | ✅ 推荐基于 Redis 的内部队列 /worker，BullMQ 最务实                               |

### 1.3 推荐路线

1. 引入 **Redis-backed internal worker**，作为唯一异步基础设施
2. 直接将 Agent Runtime 切到 internal worker，不保留 QStash 路径
3. 直接去掉 bot callback 的内部 HTTP 自回调，改为站内调用
4. 直接将 Memory 主链路切到 internal job graph，不保留 workflow 触发链路
5. Agent Eval 不保留临时降级态：
   - 要么同批完整迁移
   - 要么直接从当前产品面移除
6. Web 与 App 与 Server 同批对齐到最终态，验证顺序先 Web 后 App
7. 同批删除 `@upstash/qstash`、`@upstash/workflow`、workflow 路由、env 与 patch

### 1.4 本次实施顺序

本轮按 “**一次性实现最终态**” 推进：

1. **Server + Web + App 同批切换到最终态**
2. **不保留兼容路径、兼容 route、兼容 webhook、兼容 feature gate**
3. **验证顺序明确为：先测 Web，再测 App**

这意味着：

- 本轮不是 “迁移中间态”，而是 **最终态重构**
- 若某能力本轮不迁移完成，就应直接从当前交付面移除，而不是保留 “暂不可用” 中间形态
- App 端若存在对应入口或调用链路，也必须同批对齐最终态，不能再以后置为理由保留兼容代码
- 上线方式是 **整版切换**
- 若需要回退，只能通过 **整版回滚**，而不是依赖兼容代码路径

---

## 二、QStash 使用全景

### 2.1 依赖与入口

| 包                  | 版本    | 用途                           |
| ------------------- | ------- | ------------------------------ |
| `@upstash/qstash`   | ^2.8.4  | HTTP 调度、签名验证            |
| `@upstash/workflow` | ^0.2.23 | 工作流编排（依赖 QStash 调度） |

**核心入口**：`src/libs/qstash/index.ts`

### 2.2 使用场景汇总

| 场景               | 文件 / 位置                                                                                                                                           | 功能                                | 风险等级 | 可替代性                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------- | -------------------------------------------------------- |
| **QueueService**   | `src/server/services/queue/impls/qstash.ts`                                                                                                           | Agent Runtime 步骤调度              | 高       | ⚠️ 不能直接用 LocalQueue 视为等价替代                    |
| **Memory 提取**    | `src/server/routers/lambda/userMemory.ts`、`src/server/services/memory/userMemory/extract.ts`、`src/app/(backend)/api/workflows/memory-user-memory/*` | 异步记忆提取 pipeline               | 高       | ✅ 可迁移到内部队列                                      |
| **Agent 评估**     | `src/server/workflows/agentEvalRun/*`、`src/app/(backend)/api/workflows/agent-eval-run/*`                                                             | Benchmark 多阶段 fan-out            | 中       | ⚠️ 本次必须二选一：完整迁移或直接移除产品面              |
| **Agent API 认证** | `src/app/(backend)/api/agent/route.ts`、`src/app/(backend)/api/agent/run/route.ts`、`src/app/(backend)/api/agent/webhooks/bot-callback/route.ts`      | QStash 回调签名验证                 | 高       | ⚠️ 影响面不止 `/api/agent`                               |
| **Webhook 投递**   | `src/server/services/agentRuntime/AgentRuntimeService.ts`                                                                                             | `fetch` / `qstash` 二选一           | 高       | ⚠️ 外部 webhook 可改 `fetch`，内部 callback 不能直接照搬 |
| **Bot 回调**       | `src/server/services/bot/AgentBridgeService.ts`、`/api/agent/webhooks/bot-callback`                                                                   | Agent step/completion 回传 bot 平台 | 高       | ✅ 但应改为站内调用而非自 HTTP 回调                      |
| **Persona 更新**   | `src/app/(backend)/api/webhooks/memory-user-memory/persona/update-writing/route.ts`                                                                   | 用户 Persona 写入                   | 低       | ✅ 已支持 `mode: 'direct'`                               |

---

## 三、关键事实校对

### 3.1 QueueService 的 LocalQueue 不是生产等价替代

**当前逻辑**：

- `AGENT_RUNTIME_MODE=queue` 时，使用 `QStashQueueServiceImpl`
- 默认使用 `LocalQueueServiceImpl`
- `LocalQueueServiceImpl` 的实现是 `setTimeout`
- 文档注释已经明确其用例是 **Local development without QStash**

**风险**：

- 无持久化
- 无可靠重试
- 无真正取消能力
- 进程重启即丢任务
- 多实例下不具备生产语义
- 关闭 queue mode 后，Agent Runtime 状态与 stream 管理会退回 in-memory 实现

**结论**：

- `LocalQueueServiceImpl` 只能作为 **本地开发 / 单机简化部署兜底**
- 不能把 “不启用 `AGENT_RUNTIME_MODE=queue`” 写成生产推荐方案

---

### 3.2 Agent API 认证影响面不止 `/api/agent`

**当前逻辑**：

- `/api/agent`：支持 **QStash 签名** 或 **API Key**
- `/api/agent/run`：只接受 **QStash 签名**
- `/api/agent/webhooks/bot-callback`：只接受 **QStash 签名**

**含义**：

- “保留 API Key 即可” 只适用于 `/api/agent`
- 若仍保留 queue-mode 里的 HTTP 回调链路，就必须重新设计 `/api/agent/run` 和 `bot-callback` 的鉴权

**结论**：

- 移除 QStash 时，认证改造必须覆盖全部内部回调入口
- 更优解不是补一个新签名，而是尽量删除这些内部 HTTP 自回调

---

### 3.3 Memory 的 direct 模式已经存在，缺的是入口与调度迁移

**当前逻辑**：

- `extract.ts` 的 payload 已支持 `mode: 'workflow' | 'direct'`
- `/api/webhooks/memory-extraction` 已可在 `direct` 模式下直接执行
- `/api/webhooks/memory-user-memory/persona/update-writing` 已支持 `direct`
- 但 `userMemory.extractWithChatTopic` 的 tRPC 用户入口仍强制：
  - 要求 `QSTASH_TOKEN`
  - 强制 `mode: 'workflow'`

**结论**：

- 这里不是 “新增 direct 模式”
- 真正要做的是把用户入口从 “强制 workflow trigger” 改成 “创建 async task 并投递到内部 worker”
- `runDirect` 应作为 **worker 执行原语**，而不是默认把大任务塞回单次请求同步执行

---

### 3.4 `fetch` 可以替代外部 webhook，但不能直接替代内部 bot callback

**当前逻辑**：

- `AgentRuntimeService.deliverWebhook` 已支持 `'fetch' | 'qstash'`
- `AgentBridgeService` 当前硬编码 `webhookDelivery: 'qstash'`
- queue mode 下的 bot callback URL 指向站内 `/api/agent/webhooks/bot-callback`
- 该路由当前要求 QStash 签名

**结论**：

- 对真正的外部 webhook，改成 `fetch` 没问题
- 对 bot callback 这种内部 continuation，不应继续走 “自己 POST 自己”
- 推荐迁移为：
  - worker 直接调用 `BotCallbackService`
  - 或内部事件总线 / 站内任务回调

---

### 3.5 Agent Eval 与 Upstash Workflow 是强耦合关系

**当前逻辑**：

- `startRun`
- `retryRunErrors`
- `retryRunCase`

以上用户入口都直接触发 `AgentEvalRunWorkflow.triggerXxx()`

**含义**：

- 只要 Upstash 被移除，这些入口就必须：
  - 要么整体迁到内部 worker /job graph
  - 要么从当前产品面直接移除

**结论**：

- 在 “一步到位、无中间阶段” 的方案里，不应保留 “先降级、以后再说” 的临时态
- 必须在立项时二选一：
  - **同批完整迁移**
  - **同批从当前产品面移除**
- 若以 “尽快完成去 Upstash” 为目标，默认更推荐 **移除 Eval 产品面**

---

### 3.6 Web 端不是完全无感，必须同步对齐最终态

**当前逻辑**：

- `/eval` 页面、benchmark 列表、run 详情、start/retry/retryCase 按钮都直接调用后端 `agentEval` 能力
- `Eval` 页面当前没有 “部署中不可用” 的显式 gate，更接近 “只要路由存在就允许继续操作”
- `Memory Analysis` 的触发器在请求失败时只展示通用 toast
- Memory 浏览、Memory CRUD、Settings 中的 memory 开关并不直接依赖 Upstash

**含义**：

- 如果本轮不迁移 Agent Eval，而 Web 仍保留旧入口，就会出现：
  - 还能进入 `/eval`
  - 还能点击创建 / 开始 / 重试
  - 但后端不再承诺该能力
- 如果 Memory Extraction 在迁移过程中被暂时禁用，Memory Analysis 会退化成 “请求失败，请重试”，错误语义不够明确

**结论**：

- Web 必须与 Server 同批切到最终态
- 若本轮不迁移 `Agent Eval`，Web 应直接隐藏 / 移除相关入口、路由与操作，而不是保留临时 unavailable 页面
- `Memory Analysis` 至少要补明确错误语义，不再只用泛化的 “请重试”
- 普通 Memory 页面、聊天侧 Memory 注入、Settings Memory 开关，不是这次迁移的前端重点

---

### 3.7 App 端影响面较小，但也要同步对齐最终态

**当前逻辑**：

- Mobile App 的 `MemoryScreen` 会直接调用 `memoryApi.requestMemoryFromChatTopic({})`
- App 会轮询 `getMemoryExtractionTask()`，并根据 task 状态展示进行中、成功、失败信息
- 失败提示已优先透传后端 `error.message`，找不到明确错误时才回退到通用文案
- 当前未发现 Mobile App 暴露与 Web 对应的 `Agent Eval` 产品面

**含义**：

- 只要 `Memory Extraction` 的最终协议、状态机或错误语义发生变化，App 就必须同批对齐
- App 端虽然不像 Web 那样需要清理 `/eval` 路由，但也不能假设 “Server 改完就天然兼容”
- 若最终态仍保留 async task 契约，App 的改造量会明显小于 Web，但验证不能省略

**结论**：

- App 端纳入本轮一步到位实现范围
- App 端重点是 `Memory Extraction` 的最终协议、轮询状态与错误展示对齐
- 验证顺序应为 **先测 Web，再测 App**

---

## 四、各场景详细分析与替代方案

### 4.1 QueueService（Agent Runtime 队列）

**当前逻辑**：

- queue mode：QStash 调度步骤执行
- non-queue mode：LocalQueue + in-memory state/stream

**替代方案**：

| 方案                         | 描述                                                     | 是否推荐                     |
| ---------------------------- | -------------------------------------------------------- | ---------------------------- |
| **A. LocalQueue 兜底**       | 不启用 `AGENT_RUNTIME_MODE=queue`，继续使用 `setTimeout` | ⚠️ 仅限本地开发 / 低要求单机 |
| **B. RedisQueueServiceImpl** | 新增 Redis-backed 队列实现，由站内 worker 消费           | ✅ 推荐                      |
| **C. PostgreSQL 任务表**     | 用任务表 + 轮询 / 通知实现 job system                    | ⚠️ 可行，但实现复杂度更高    |

**推荐**：

- 用 **Redis-backed internal worker** 替换 QStash
- 若希望尽快落地，优先采用 **BullMQ**
- 不推荐把 LocalQueue 升格为生产方案

---

### 4.2 Memory 提取（memory-user-memory）

**当前逻辑**：

- 用户入口强制 workflow
- workflow 链路为多层 fan-out：
  - process-users
  - process-user-topics
  - process-topics
  - process-topic
- direct 执行原语已存在，但未被主入口使用

**替代方案**：

| 方案                              | 描述                                                               | 是否推荐                            |
| --------------------------------- | ------------------------------------------------------------------ | ----------------------------------- |
| **A. 请求内 direct 同步执行**     | 无 QStash 时，直接在入口请求内跑完整提取                           | ❌ 仅适用于极小任务，不适合默认方案 |
| **B. 内部队列化 direct executor** | 保留 `runDirect` 作为执行原语，通过内部 job graph 执行分层 fan-out | ✅ 推荐                             |

**推荐**：

- **不要**默认把大规模 extraction 退回同步请求
- 应将 `userMemory.extractWithChatTopic` 改为：
  1. 创建 async task
  2. 投递 `process-users` job
  3. 后续由 worker 逐层 fan-out
- 可复用现有 `MemoryExtractionExecutor.runDirect`
- 本方案不采用 “先禁用、以后再补” 的中间态

---

### 4.3 Agent 评估（agent-eval-run）

**当前逻辑**：

- 整体基于 Upstash Workflow
- 入口、fan-out、完成回调都与 workflow 强绑定

**替代方案**：

| 方案                         | 描述                                                               | 是否推荐                         |
| ---------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| **A. 同批完整迁移**          | 迁移为 Redis 队列 + worker fan-out，保留现有产品能力               | ⚠️ 成本高，但若业务刚需可做      |
| **B. 同批从产品面移除**      | Server 不再暴露当前 Eval 能力，Web 直接移除 `/eval` 入口与相关操作 | ✅ 本文默认推荐                  |
| **C. 临时降级 /unavailable** | 保留原产品面，仅在运行时提示不可用                                 | ❌ 不符合 “一步到位、无中间阶段” |

**推荐**：

- 在本方案中，`Agent Eval` 不保留临时过渡态
- 如果它不是当前去 Upstash 的核心业务能力，建议 **直接从本轮当前产品面移除**
- 若业务要求必须保留，则必须 **同批完整迁移**，不能依赖后续补票

---

### 4.4 Agent API 认证

**当前逻辑**：

- `/api/agent` 可保留 API Key
- `/api/agent/run` / `bot-callback` 当前依赖 QStash 签名

**替代方案**：

| 方案                              | 描述                                              | 是否推荐            |
| --------------------------------- | ------------------------------------------------- | ------------------- |
| **A. 保留 HTTP 回调并自建 HMAC**  | 继续走 HTTP continuation，但改成内部签名          | ⚠️ 可行，但不是最优 |
| **B. 删除内部 HTTP continuation** | worker 直接调用站内 service，不再需要这类内部路由 | ✅ 推荐             |

**推荐**：

- 尽量删除内部自回调链路
- 最终只把 `/api/agent` 视为对外入口

---

### 4.5 Webhook 投递

**当前逻辑**：

- `deliverWebhook` 支持 `fetch` 和 `qstash`
- 内部 bot callback 与外部 webhook 共用这一投递抽象

**问题**：

- “外部通知” 和 “内部 continuation” 是两种不同语义
- 前者是通知
- 后者是系统内部执行链路

**推荐**：

- **拆开两类概念**
- 对外 webhook：
  - 保留 `fetch`
  - 如需可靠投递，可在内部 worker 中做 retry/backoff
- 对内 continuation：
  - 改为直接 service 调用或内部事件
  - 不再走 HTTP 自回调

---

### 4.6 Persona 更新（update-writing）

**当前逻辑**：

- 已支持 `mode: 'workflow' | 'direct'`

**推荐**：

- 小批量可以保留 `direct` 兜底
- 若纳入统一异步体系，仍建议迁到内部 worker

---

### 4.7 Web / App 端联动改造

**当前逻辑**：

- `Eval` 的首页、列表页、详情页、创建 run、开始 run、重试错误、重试单 case 都假设后端能力可用
- `Memory Analysis` 假设后端至少能接受请求，失败时使用通用错误提示
- Mobile App 的 `MemoryScreen` 会直接发起记忆提取，并轮询异步任务状态
- 当前未发现 Mobile App 暴露 `Agent Eval` 产品面

**替代方案**：

| 方案                                        | 描述                                               | 是否推荐                         |
| ------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| **A. 不改 Web / App，完全依赖后端返回错误** | 前端继续暴露旧入口，用户操作后再看到失败提示       | ❌ 不推荐                        |
| **B. Web / App 直接对齐最终态**             | Web 移除或改接最终能力，App 对齐最终协议与错误语义 | ✅ 推荐                          |
| **C. 保留 unavailable 中间页 / 中间提示**   | 用不可用提示替代真正的产品面调整                   | ❌ 不符合 “一步到位、无中间阶段” |

**推荐**：

- `Eval`：
  - 若本轮不迁移，则直接移除 overview /sidebar/footer /route/create /start/retry /retryCase
  - 若本轮迁移，则直接接入最终实现，不保留旧逻辑和中间提示页
- `Memory Analysis`：
  - 保留现有 async task UI
  - 但请求失败时应优先展示后端明确错误，而不是泛化成 “请重试”
- `App Memory`：
  - 保留现有 async task 交互模型
  - 但必须对齐最终 task 协议、状态枚举与错误文案
  - 若后端返回明确不可用 / 配置错误，应直接展示后端细节，不再吞成统一失败
- `Memory` 其余页面：
  - 若后端保持现有 async task 契约，通常不需要结构性修改

---

## 五、现有工具清单

| 工具                      | 用途                                             | 替代 QStash 的适配度          |
| ------------------------- | ------------------------------------------------ | ----------------------------- |
| **Redis (ioredis)**       | 缓存、会话、Agent Runtime 状态、BotMessageRouter | ✅ 很适合承接 job queue       |
| **LocalQueueServiceImpl** | `setTimeout` 调度                                | ⚠️ 仅适合本地开发或简化部署   |
| **PostgreSQL**            | 主库                                             | ⚠️ 能做任务表，但不是最短路径 |
| **BullMQ**（未引入）      | Redis 队列 + worker                              | ✅ 当前最务实的完整替代方案   |

---

## 六、一步到位实施方案（Server + Web + App）

### 6.0 实施前提

- **不考虑后向兼容**
- **不保留中间阶段**
- **不保留双轨实现**
- **不保留兼容 workflow route、兼容 webhook、兼容 QStash 签名路径**
- **本轮交付 Server + Web + App 的最终态**
- **验证顺序明确为：先测 Web，再测 App**

在这个前提下，本文默认采用以下最终取舍：

- `Agent Runtime`：本轮完整迁移
- `Memory Extraction`：本轮完整迁移
- `Agent Eval`：本轮不迁移，直接从当前产品面移除

如果业务要求必须保留 `Agent Eval`，则只能选择 “同批完整迁移”，而不能退回 “先降级” 的中间方案。

### 6.1 本次最终态

本轮完成后，目标状态应为：

- Redis + internal worker 成为唯一异步基础设施
- `Agent Runtime` 不再依赖 QStash 调度
- bot callback 不再依赖内部 HTTP 自回调
- `Memory Extraction` 不再依赖 Upstash Workflow
- Web 与 App 只暴露和消费与最终 Server 一致的产品面与协议
- `Agent Eval` 从本轮交付面移除
- `@upstash/qstash`、`@upstash/workflow`、workflow routes、QStash env 与 patch 同批清理

### 6.2 本轮范围与非目标

**本轮范围（必须完成）**：

- Server：
  - internal worker /queue 基础设施
  - Agent Runtime 去 QStash
  - bot callback 去内部 HTTP 自回调
  - Memory Extraction 主链路迁移
  - Agent Eval 从当前交付面移除
- Web：
  - 与最终 Server 对齐
  - 移除 Eval 入口、路由与相关操作
  - 补齐 Memory Analysis 错误语义
- App：
  - 与最终 Server 对齐
  - 对齐 `Memory Extraction` 的最终 task 协议、轮询状态与错误展示
  - 校验不存在与已移除能力冲突的旧入口

**本轮非目标（明确不做）**：

- Agent Eval 的完整内部 job graph 迁移
- 为不存在的 App Eval 产品面新增替代页或过渡页
- 为旧路径保留兼容壳、兼容开关或兼容路由

### 6.3 单次实现顺序

#### 工作包 A：internal worker 与统一队列抽象

**改造点**：

- 引入 Redis-backed job runner，推荐 `bullmq`
- 建立统一抽象：
  - `enqueue(jobName, payload, options)`
  - `registerWorker(jobName, handler)`
- 明确 job 分类：
  - `agent-runtime-step`
  - `memory-process-users`
  - `memory-process-user-topics`
  - `memory-process-topics`
  - `memory-process-topic`
  - `persona-update`

**交付物**：

- internal worker 启动入口
- 统一 queue /worker 抽象
- 基本可观测性：enqueue、start、success、failure、retry

**验收标准**：

- 在不配置 `QSTASH_TOKEN` 的前提下，内部 worker 可正常消费测试 job
- job 失败可重试，且重试行为可观测
- worker 异常退出后，任务不会静默丢失

#### 工作包 B：Agent Runtime 与 bot callback 终态改造

**改造点**：

- 新增 `RedisQueueServiceImpl`
- queue mode 改为投递 internal worker job，而不是 QStash HTTP POST
- worker 直接调用 step 执行逻辑
- 删除 bot callback 的内部 HTTP 自回调设计
- step /completion 后直接调用 `BotCallbackService` 或等价站内分发

**交付物**：

- Agent Runtime 的最终态队列实现
- bot progress /completion 的站内分发实现
- 不再依赖 `/api/agent/run` 和 `/api/agent/webhooks/bot-callback` 作为内部 continuation 主路径

**验收标准**：

- `AGENT_RUNTIME_MODE=queue` 时不再要求 `QSTASH_TOKEN`
- 多步 agent 执行在无 QStash 环境下可完整跑通
- queue mode 下 bot 进度与完成事件可正常回传
- server logs 中不再出现内部自回调作为主路径

#### 工作包 C：Memory Extraction 终态改造

**改造点**：

- 保留 `MemoryExtractionExecutor.runDirect` 作为执行原语
- 用 internal worker 重写 memory fan-out job graph
- 修改 `userMemory.extractWithChatTopic`：
  - 不再要求 `QSTASH_TOKEN`
  - 改为创建 async task 并投递首个 job
- 删除 workflow 触发链路
- 若 `/api/webhooks/memory-extraction` 与 persona webhook 仅是 workflow 壳，则一并删除；若仍需保留，必须重写为最终态接口而非兼容壳

**交付物**：

- `requestMemoryFromChatTopic` 的最终实现
- async task 协议在最终态下继续可用
- Memory job graph 跑在 internal worker 上

**验收标准**：

- Memory 提取任务可创建、可轮询、可失败、可恢复
- Web 侧现有 Memory Analysis 轮询协议仍可用，或同步改成最终协议
- 主链路不再要求 workflow route trigger

#### 工作包 D：Agent Eval 从当前产品面移除

**改造点**：

- Server 不再把 `agentEval` 作为本轮交付能力
- Web 直接移除 `/eval` 入口、路由与所有 create/start/retry/retryCase 交互
- App 侧确认无旧入口依赖该能力；若存在隐藏入口或跳转，同批删除
- 不保留 “暂不可用” 的中间页或中间错误态作为默认产品形态

**交付物**：

- Eval 从本轮交付面消失
- 与 Eval 相关的旧 UI 入口、实验入口、导航入口一并清理

**验收标准**：

- 用户无法再从当前交付面进入或触发旧的 Eval 流程
- 本轮上线不再承诺 Eval 能力
- 若未来需要恢复 Eval，需作为新项目重新迁移与上线

#### 工作包 E：Web 最终态对齐

**改造点**：

- 删除或隐藏所有 Eval 入口、路由与相关操作
- `Memory Analysis` 在请求失败时优先展示后端明确错误
- 保持普通 Memory 页面、Settings Memory 开关、聊天侧 Memory 注入的最终协议一致

**交付物**：

- 与最终 Server 一致的 Web 产品面
- 不再存在 “可见、可点、但一定失败” 的假可用入口

**验收标准**：

- Web 不再暴露 Eval 入口
- Memory Analysis 不再只提示泛化的 “请重试”
- Web 对外呈现的能力与最终 Server 完全一致

#### 工作包 F：App 最终态对齐

**改造点**：

- 对齐 Mobile App 中 `Memory Extraction` 的最终请求协议
- 对齐任务轮询状态、成功提示与失败提示
- 继续优先展示后端明确错误，不把配置 / 能力错误吞成通用失败
- 校验移动端不存在指向已移除能力的旧入口或旧导航

**交付物**：

- 与最终 Server 一致的 App 产品面与任务交互
- Memory 提取在 App 中保持可用且语义与 Web 一致

**验收标准**：

- App 可在无 QStash 环境下正常发起并轮询 Memory Extraction
- App 在失败时能优先展示后端明确错误
- Web 验证通过后，App 再完成一轮独立联调与回归验证

#### 工作包 G：同批清理 Upstash

**改造点**：

1. 删除 `@upstash/qstash`
2. 删除 `@upstash/workflow`
3. 删除 `src/libs/qstash/`
4. 删除 `src/app/(backend)/api/workflows/` 下 workflow 路由
5. 删除 `pnpm-workspace.yaml` 中的 `@upstash/qstash` patch
6. 清理 `.env.example`、`.env.dev`、`.env.prod`、`.env.example.development` 中的 QStash 说明
7. 清理相关测试、日志与文档引用

**验收标准**：

- 代码中不再存在生产主路径上的 `@upstash/*` 依赖
- workflow route 不再保留兼容壳
- Server + Web + App 在无 QStash 环境下可完整部署

### 6.4 上线验收清单

上线前必须满足：

1. Server 在不配置任何 QStash 环境变量的情况下可启动
2. Agent Runtime 多步执行可跑通
3. bot callback 在最终站内分发路径下可跑通
4. Memory Extraction 可创建任务、轮询状态并完成
5. Web 不再暴露 Eval 入口
6. Memory Analysis 在异常时能展示明确错误
7. Web 端先完成联调、回归与人工验收
8. App 端随后完成联调、回归与人工验收
9. 代码清理完成，`@upstash/*` 不再参与生产主路径

### 6.5 回滚方式

由于本方案 **不保留兼容路径**，回滚方式只有一种：

- **整版回滚**

这意味着上线前必须准备：

- 可快速回退的发布版本
- 清晰的回滚检查表
- 避免把不可逆的迁移与本次 cutover 强绑定

---

## 七、不采用的方案

以下方案不在本文推荐范围内：

- 用 `LocalQueueServiceImpl` 充当生产替代
- 保留 “先降级、后迁移” 的 Agent Eval 中间态
- 保留 compatibility gate /unavailable page 作为长期产品形态
- 保留 workflow route /webhook/ QStash 签名兼容壳
- 以 App 后置为理由拆成本轮不完整 cutover

---

## 八、工作量评估

### 8.1 一次性实现估算

| 范围                                                                    | 估算      |
| ----------------------------------------------------------------------- | --------- |
| **Server + Web + App 一步到位最终态，且本轮直接移除 Agent Eval 产品面** | 约 4–6 周 |
| **Server + Web + App 一步到位最终态，且同批完整迁移 Agent Eval**        | 约 6–9 周 |

### 8.2 为什么仍然不轻

- Memory 不是单 job，而是多层 fan-out
- Agent Runtime 不是简单队列切换，还涉及状态管理和回调模型
- bot callback 当前与内部 HTTP continuation 强耦合
- Web 端要同步删入口、删路由、改错误语义
- App 端虽然范围较小，但也要同步校验 Memory 提取协议、轮询与错误展示
- 一次性切换虽然减少了兼容复杂度，但提高了 cutover 风险

### 8.3 当前建议

- **本轮做 Server + Web + App 最终态**
- **本轮直接移除 Agent Eval 产品面**
- **验证顺序先 Web，再测 App**

这是当前最干净、也最符合 “一步到位” 的实现方式。

---

## 九、相关代码索引

| 文件                                                                                | 说明                                                |
| ----------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/libs/qstash/index.ts`                                                          | QStash / Workflow 客户端与签名验证                  |
| `src/server/services/queue/impls/qstash.ts`                                         | QStash 队列实现                                     |
| `src/server/services/queue/impls/local.ts`                                          | 本地队列实现，仅适用于本地 / 简化场景               |
| `src/server/services/queue/impls/index.ts`                                          | QueueService 创建入口                               |
| `src/server/modules/AgentRuntime/factory.ts`                                        | queue mode 与 in-memory/Redis state manager 切换    |
| `src/server/routers/lambda/userMemory.ts`                                           | 记忆提取用户入口，当前强制 workflow                 |
| `src/server/services/memory/userMemory/extract.ts`                                  | 记忆提取核心逻辑与 workflow trigger/direct executor |
| `src/app/(backend)/api/webhooks/memory-extraction/route.ts`                         | Memory webhook，已支持 direct                       |
| `src/app/(backend)/api/webhooks/memory-user-memory/persona/update-writing/route.ts` | Persona webhook，已支持 direct                      |
| `apps/mobile/src/screens/MemoryScreen.tsx`                                          | Mobile App 的记忆提取入口、task 轮询与错误提示      |
| `src/app/(backend)/api/agent/route.ts`                                              | Agent 外部入口，支持 API Key                        |
| `src/app/(backend)/api/agent/run/route.ts`                                          | Agent step 执行入口，当前仅接受 QStash 签名         |
| `src/app/(backend)/api/agent/webhooks/bot-callback/route.ts`                        | bot callback 入口，当前仅接受 QStash 签名           |
| `src/server/services/agentRuntime/AgentRuntimeService.ts`                           | `deliverWebhook` 与 step/completion webhook         |
| `src/server/services/bot/AgentBridgeService.ts`                                     | queue-mode bot callback 与 webhookDelivery          |
| `src/server/workflows/agentEvalRun/index.ts`                                        | Agent Eval workflow trigger                         |
| `src/app/(backend)/api/workflows/*`                                                 | 全部 Upstash Workflow 路由                          |

---

## 十、环境变量清理

在本方案的一次性切换完成后，以下变量应直接删除：

```bash
QSTASH_TOKEN
QSTASH_URL
QSTASH_CURRENT_SIGNING_KEY
QSTASH_NEXT_SIGNING_KEY
```

---

## 十一、最终建议

### 11.1 对生产环境的最终判断

- **战略上**：建议最终取消 Upstash 依赖
- **执行上**：如果决定做，就按最终态一次切换来做，不保留兼容路径
- **原因**：
  - 项目已经有 Redis，可承接统一的站内异步基础设施
  - 长期保留 Upstash 会导致内部异步链路、认证与回调模型持续外部化
  - 对自托管、企业部署、成本控制与可运维性而言，站内化更合理
- **前提**：
  - 本轮范围明确限定为 `Server + Web + App`
  - Agent Runtime、bot callback、Memory 主链路必须同批切到最终态
  - Agent Eval 要么同批完整迁移，要么直接从当前产品面移除
  - Web 与 App 都要直接对齐最终态，且验证顺序先 Web 后 App

换句话说：

- **生产环境最终方向是去 Upstash**
- **如果决定实施，推荐按 Server + Web + App 最终态整版切换**

### 11.2 单次切换顺序

| 顺序 | 动作                                           | 说明                                          |
| ---- | ---------------------------------------------- | --------------------------------------------- |
| 1    | 引入 Redis-backed internal worker              | 建立最终态异步基础设施                        |
| 2    | Agent Runtime 改为内部 job 调度                | 替掉 QStash step 调度                         |
| 3    | 去掉 bot callback 的内部 HTTP 自回调           | 完成站内分发                                  |
| 4    | Memory 改为内部 job graph + direct executor    | 完成 Memory 主链路替换                        |
| 5    | Agent Eval 从当前产品面移除                    | 本文默认取舍                                  |
| 6    | Web 直接对齐最终态并先完成验证                 | 移除 Eval 入口并补齐 Memory Analysis 错误语义 |
| 7    | App 直接对齐最终态并在 Web 通过后验证          | 对齐 Memory Extraction 协议、轮询与错误展示   |
| 8    | 删除 `@upstash/*`、workflow routes、env、patch | 完成依赖清理                                  |

**推荐的本轮完成条件**：

- Server + Web + App 已完全切到无 Upstash 的最终态
- Agent Eval 已按本轮取舍从当前产品面移除
- `@upstash/*` 与 workflow 相关主路径已删除
- Web 已先完成验证，App 随后完成验证

**不推荐的方案**：

- 先降级 Eval，后面再补
- 先保留 workflow route，后面再删
- 先做 Server，再用 unavailable page 顶着 Web 或 App
- 把 App 放到本轮之后再补

这些方案都不符合 “一步到位、无中间阶段” 的目标。
