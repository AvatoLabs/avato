# LobeHub 原生 DeerFlow Harness 方案

> 文档类型：架构方案 / 迁移设计\
> 状态：Draft\
> 目标读者：Agent Runtime、Chat、Tooling、Context、Infra 相关开发者\
> 复核基线：2026-03-26

---

## 0. 执行摘要

本文档讨论的不是 “起一个 DeerFlow 服务再通过 MCP/HTTP 接进来”，而是：

- 在 **LobeHub 现有仓库内**
- 基于 **现有 TypeScript / Next.js/agent-runtime /group orchestration /tool execution**
- **原生实现一套 DeerFlow 风格的 task harness 语义**

这里的 “DeerFlow 风格语义” 指的是以下能力组合，而不是追求与 DeerFlow 仓库逐文件同构：

1. 面向复杂任务的 **任务级运行时**，而不是单轮聊天参数调优
2. 可重规划的 **Plan -> Research -> Reflect -> Synthesize** 循环
3. 多子代理或多角色并行执行
4. 基于证据与来源的中间态沉淀
5. 可恢复、可中断、可审计、可回放的执行链路

核心判断：

- **可做，而且推荐做。**
- 但不能把它做成第二套与现有系统割裂的 workflow 平台。
- 正确方向是：**在现有 `agent-runtime` 之上新增 task harness 层**，并复用现有 operation、SSE、tool intervention、context-engine、group orchestration。

---

## 1. 目标与非目标

### 1.1 目标

本方案目标是让 LobeHub 从 “单次对话 + 工具调用” 提升为 “复杂任务执行面”，并满足以下要求：

- 支持复杂研究、调研、分析、实现类任务
- 支持任务拆解、并行子任务、反思重规划、最终汇总
- 支持长执行链路的中间态展示，而不是只展示最终回答
- 支持把 sources /evidence/artifacts /plan 作为一等对象管理
- 支持后续接入 workspace 级策略、审批、审计、回放

### 1.2 非目标

本方案明确不做以下事情：

- 不直接 vendoring DeerFlow Python runtime 到主执行链路
- 不通过 MCP 包一层 DeerFlow 外部实例
- 不新起一套与现有 `agent-runtime` 不兼容的 workflow DSL
- 不把 provider 原生 reasoning 参数当成 harness 本身
- 不在 Phase 1 解决完整企业级多租户隔离与全部治理问题

---

## 2. 现状审计

### 2.1 前端看到的 “深度思考” 不是 harness

当前仓库里，Claude / Kimi / Gemini / GPT-5 等模型上看到的：

- 深度思考
- 自适应思维
- 思考预算
- 努力程度

本质都是 **模型卡元数据驱动的 provider 参数透传**，不是库内独立的思考执行框架。

关键事实：

- 模型扩展参数来自 `model.settings.extendParams`\
  见 [packages/model-bank/src/aiModels/anthropic.ts](/Users/arthur/RustroverProjects/lobehub/packages/model-bank/src/aiModels/anthropic.ts#L33)、
  [packages/model-bank/src/aiModels/moonshot.ts](/Users/arthur/RustroverProjects/lobehub/packages/model-bank/src/aiModels/moonshot.ts#L27)
- 前端控件按 `modelExtendParams` 动态渲染\
  见 [src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx](/Users/arthur/RustroverProjects/lobehub/src/features/ModelSwitchPanel/components/ControlsForm/ControlsForm.tsx#L60)
- 请求前只做 `chatConfig -> thinking/reasoning_effort/...` 参数映射\
  见 [src/services/chat/mecha/modelParamsResolver.ts](/Users/arthur/RustroverProjects/lobehub/src/services/chat/mecha/modelParamsResolver.ts#L39)
- provider runtime 再把这些参数翻译成各家 API payload\
  见 [packages/model-runtime/src/core/anthropicCompatibleFactory/index.ts](/Users/arthur/RustroverProjects/lobehub/packages/model-runtime/src/core/anthropicCompatibleFactory/index.ts#L173)、
  [packages/model-runtime/src/providers/google/index.ts](/Users/arthur/RustroverProjects/lobehub/packages/model-runtime/src/providers/google/index.ts#L144)、
  [packages/model-runtime/src/core/openaiCompatibleFactory/index.ts](/Users/arthur/RustroverProjects/lobehub/packages/model-runtime/src/core/openaiCompatibleFactory/index.ts#L972)

结论：

- 现有 “thinking/reasoning” 只能算 **模型能力适配层**
- 不能直接承接 DeerFlow 类复杂任务 harness

### 2.2 当前已经有可复用的运行时骨架

虽然没有 task harness，但当前仓库并非空白。

已经存在的关键底座：

1. **Agent Runtime**
   - `Plan -> Execute` 型指令执行引擎
   - 支持 `call_llm / call_tool / finish / request_human_*`
   - 见 [packages/agent-runtime/src/core/runtime.ts](/Users/arthur/RustroverProjects/lobehub/packages/agent-runtime/src/core/runtime.ts#L21)

2. **Group Orchestration Runtime**
   - 已有 supervisor + executor 双层结构
   - 能驱动单代理 / 多代理 / 并行代理
   - 见 [packages/agent-runtime/src/groupOrchestration/GroupOrchestrationRuntime.ts](/Users/arthur/RustroverProjects/lobehub/packages/agent-runtime/src/groupOrchestration/GroupOrchestrationRuntime.ts#L12)
   - 以及 [src/store/chat/agents/GroupOrchestration/createGroupOrchestrationExecutors.ts](/Users/arthur/RustroverProjects/lobehub/src/store/chat/agents/GroupOrchestration/createGroupOrchestrationExecutors.ts#L41)

3. **Context Pipeline**
   - 已有 messages engineering、skills、memories、group context 注入
   - 见 [src/services/chat/mecha/contextEngineering.ts](/Users/arthur/RustroverProjects/lobehub/src/services/chat/mecha/contextEngineering.ts#L97)
   - 以及 [packages/context-engine/src/providers/SkillContextProvider.ts](/Users/arthur/RustroverProjects/lobehub/packages/context-engine/src/providers/SkillContextProvider.ts#L28)

4. **Operation + Stream**
   - 现有 operation 体系已经具备长运行、事件流、取消、子操作树
   - 见 [src/services/agentRuntime/type.ts](/Users/arthur/RustroverProjects/lobehub/src/services/agentRuntime/type.ts#L3)
   - 现有 chat store 已按 operation 组织事件与状态

5. **Tool Execution / Human Intervention**
   - 当前工具执行、审批、取消、审计链路已经存在
   - 这是 task harness 必须复用的基础设施

### 2.3 当前缺的不是 “会调用模型”，而是 “任务级语义”

当前系统的短板主要在下面几件事：

- 缺少任务级 planner 与 re-planner
- 缺少 source /evidence ledger
- 缺少 task-scoped artifact 与中间产物模型
- 缺少 task run /step graph 的持久化结构
- 缺少把子代理成果合并为最终 deliverable 的汇总协议

因此本方案不应继续在 `model-runtime` 上打补丁，而应补一层 **Task Harness Runtime**。

---

## 3. 架构原则

本方案必须遵守仓库已有的架构规则：

1. **不把目标态写成现状**
   - 当前没有 DeerFlow harness
   - Phase 1 也只是最小可用，不是完全体

2. **必须写清过渡设计**
   - 当前对话链路仍偏 user-scoped
   - 任何治理、审计、workspace 化能力都必须分阶段落地
   - 见 [docs/architecture/ARCHITECTURE_RULES.md](/Users/arthur/RustroverProjects/lobehub/docs/architecture/ARCHITECTURE_RULES.md#L1)

3. **不新起第二套 workflow runtime**
   - DeerFlow 语义必须编译或映射到现有 runtime 能力
   - 不能在仓库里并排造一套互不兼容的执行平台

4. **复用既有工具执行与审批系统**
   - 不能绕开现有 `ToolExecutionService` / `humanIntervention`

5. **Run 是一等对象**
   - 后续 task harness 的执行记录，不能脱离现有 operation /run 方向单独发明主键

---

## 4. 目标架构

### 4.1 分层总览

建议新增一层 **Task Harness Layer**，位置如下：

```text
UI / Chat / Agent Panel
        ↓
Task Harness Layer            ← 本方案新增
        ↓
Agent Runtime / Group Orchestration
        ↓
Context Engineering / Tool Execution / Human Intervention
        ↓
Model Runtime / Provider Adapters
```

职责划分：

- **Model Runtime**
  - 只负责模型 API 适配
- **Agent Runtime**
  - 只负责指令执行
- **Task Harness Layer**
  - 负责任务拆解、并行研究、反思重规划、证据沉淀、产物汇总

### 4.2 不建议的新 package 形态

不建议一上来直接新建独立的 `packages/deerflow-runtime` 或新的通用 workflow DSL。

更稳妥的做法是：

- Phase 1 将 harness 放在 `packages/agent-runtime/src/taskHarness/*`
- 或 `src/services/agentRuntime/taskHarness/*` 做业务编排
- 等语义和数据模型稳定后，再决定是否抽成 package

原因：

- 当前最大不确定性不在 runtime 抽象，而在任务状态与 UI 语义
- 过早独立 package，容易把目标态抽象成错误接口

### 4.3 核心对象

建议把 task harness 的一等对象定义为：

1. **TaskRun**
   - 一个复杂任务的执行实例
   - 与现有 `operationId` 对齐
   - 后续可映射到持久化 run 记录

2. **TaskPlan**
   - 当前有效计划
   - 支持版本化
   - 支持 re-plan

3. **TaskStep**
   - planner /research/tool /reflect/synthesize 等阶段性步骤

4. **Evidence**
   - 来源片段、工具输出、文件观察、网页引用、结构化事实

5. **Artifact**
   - 计划草案、调研报告、代码 patch、结构化输出、最终交付

6. **TaskThread**
   - 面向用户展示的消息流
   - 与内部 step graph 解耦

### 4.4 Harness 语义状态机

建议最小状态机如下：

```text
idle
  -> planning
  -> researching
  -> reflecting
  -> synthesizing
  -> waiting_for_human
  -> completed
  -> failed
  -> cancelled
```

其中：

- `planning`
  - 生成可执行计划
- `researching`
  - 并行或串行执行子任务
- `reflecting`
  - 判断是否达到完成条件，必要时重规划
- `synthesizing`
  - 汇总证据并输出最终结果

### 4.5 DeerFlow 风格语义如何映射到现有 runtime

建议采用 “外层 harness supervisor + 内层 agent runtime” 的模式：

```text
Harness Supervisor
  -> decide next phase
  -> dispatch executor

Executor
  -> call planner agent
  -> call researcher agents
  -> call tools
  -> collect evidence
  -> call synthesizer agent
```

与现有能力映射关系：

| DeerFlow 风格语义 | LobeHub 现有可复用能力             |
| ----------------- | ---------------------------------- |
| Planner           | `call_llm` / supervisor agent      |
| 多子任务并行      | `parallel_call_agents`             |
| 反思重规划        | supervisor 再决策循环              |
| 工具研究          | `call_tool` + ToolExecutionService |
| 人工介入          | `request_human_*` + intervention   |
| 长执行事件流      | operation + SSE stream             |

结论：

- **不需要重写底层执行机**
- 需要新增的是 **任务级 supervisor、task state、evidence/artifact 模型**

---

## 5. 设计细化

### 5.1 Phase 1 推荐的最小实现结构

建议最小目录结构：

```text
packages/agent-runtime/src/taskHarness/
  types.ts
  HarnessRuntime.ts
  HarnessSupervisor.ts
  planners/
  synthesizers/
  reducers/

src/services/agentRuntime/taskHarness/
  createTaskHarness.ts
  taskToOperation.ts
  eventMapper.ts

src/store/chat/slices/taskHarness/
  initialState.ts
  action.ts
  selectors.ts

src/features/TaskHarness/
  RunPanel/
  PlanView/
  EvidenceView/
  ArtifactView/
```

### 5.2 Harness Runtime 的职责

`HarnessRuntime` 不直接请求模型。它只负责：

- 驱动 task phase 状态机
- 管理当前 plan 版本
- 管理 evidence /artifact 聚合
- 决定何时调用 planner /researcher/synthesizer
- 把内部步骤转换为 operation stream event

换句话说：

- `ModelRuntime` 是模型调用层
- `AgentRuntime` 是执行层
- `HarnessRuntime` 是任务语义层

### 5.3 推荐角色模型

Phase 1 建议固定四类逻辑角色：

1. **Planner**
   - 读取用户目标
   - 生成计划树与完成判定标准

2. **Researcher**
   - 执行网页、文件、工具、代码等研究子任务
   - 产出 evidence

3. **Reflector**
   - 判断当前证据是否足够
   - 决定继续研究、缩小范围、扩大范围或直接汇总

4. **Synthesizer**
   - 面向用户最终交付
   - 负责引用证据、输出结构化结果或 artifact

注意：

- 这里的 “角色” 首先是 runtime 语义，不要求都映射为持久化 agent 记录
- Phase 1 可以先用内置 agent profile + 动态 system role 实现

### 5.4 Evidence Ledger

这是 DeerFlow 类 harness 与普通 chat agent 的关键差异。

建议 Evidence 最小结构：

```ts
interface TaskEvidence {
  id: string;
  stepId: string;
  sourceType: 'tool' | 'web' | 'file' | 'memory' | 'llm';
  sourceRef?: string;
  title?: string;
  snippet: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
}
```

要求：

- Evidence 必须与 `stepId` 绑定
- 最终答案若宣称 “基于调研结果”，应能回链到 evidence
- 后续 agent tracing /replay/eval 可直接复用 evidence

### 5.5 Artifact 模型

建议 Artifact 与聊天消息解耦。

最小类型：

- `plan`
- `outline`
- `report`
- `code_patch`
- `table`
- `json_result`

Phase 1 可以先把 artifact 保存在 operation metadata 与消息附件结构中；
Phase 2 再做独立持久化。

### 5.6 Context 策略

复杂任务最容易死在上下文爆炸。

因此 harness 必须内建三层上下文：

1. **User Goal Context**
   - 用户原始目标、限制、交付格式

2. **Working Context**
   - 当前 step 直接需要的信息

3. **Compressed Task Memory**
   - 已完成步骤的摘要、有效 evidence 索引、失败尝试摘要

建议：

- 复用现有 `contextEngineering`
- 但新增 `taskMemoryContext`
- 让 planner /reflector/synthesizer 使用不同上下文切片

不能做的事：

- 把整个任务所有中间消息无差别塞回模型

### 5.7 工具执行与审批

本方案必须复用现有工具执行链路。

要求：

- 所有工具调用仍走现有 ToolExecutionService
- 所有人工审批仍走现有 intervention 语义
- harness 只负责声明 “当前 step 想做什么工具动作”
- 不能做只服务 task harness 的第二套审批系统

### 5.8 Operation / Stream 对齐

Phase 1 不建议新起第二条 SSE 协议。

建议：

- 继续使用现有 `operationId`
- 在 stream event 中扩展 `task_phase`、`plan_update`、`evidence_added`、`artifact_update`
- 前端基于同一流渲染消息与任务面板

这样做的好处：

- 不打断现有流式链路
- tracing、取消、子 operation 树都可直接复用

### 5.9 UI 形态

建议把 task harness 视为 “聊天上的高级模式”，不是独立产品。

Phase 1 UI 需要的最小面板：

1. **Plan 面板**
   - 当前任务计划
   - 当前 phase
   - 已完成 / 进行中 / 待执行步骤

2. **Evidence 面板**
   - 来源列表
   - 关键摘录
   - 可定位到消息 / 工具结果

3. **Artifact 面板**
   - 当前草稿
   - 最终交付

4. **Run Timeline**
   - 按 step 展示 planner /researcher/reflector /synthesizer 的动作

原则：

- 不要求 Phase 1 做完整 Workflow Studio
- 但必须让用户看见任务的中间结构，不再只有聊天气泡

---

## 6. 落地路线

### 6.1 Phase 0：语义对齐与 POC

目标：

- 明确 DeerFlow 风格最小语义，不追求一比一兼容
- 完成单任务、单 planner、单 synthesizer 的 POC

交付：

- `HarnessRuntime` 内存版
- planner -> synthesize 两阶段闭环
- operation stream 能输出 phase 事件

不做：

- 并行子代理
- evidence 持久化
- 独立 artifact 存储

### 6.2 Phase 1：最小可用原生 Harness

目标：

- 在现有聊天产品里可实际开启复杂任务模式

交付：

- planner /researcher/reflector /synthesizer 最小闭环
- 可并行子任务
- 可人工中断 / 恢复 / 审批
- Plan / Evidence / Artifact 基础 UI
- evidence 与 artifact 挂到 operation metadata

### 6.3 Phase 2：持久化与回放

目标：

- 让 task run 成为可查询、可恢复、可审计对象

交付：

- `TaskRun`、`TaskStep`、`TaskEvidence`、`TaskArtifact` 的持久化模型
- 与 operationId /runId 对齐
- replay /tracing 支持 task harness 语义

### 6.4 Phase 3：治理与空间化

目标：

- 让 task harness 真正进入 workspace /policy/audit 体系

交付：

- task-scoped policy
- task artifact ACL
- evidence /source 的权限回链
- 空间级限制与配额

### 6.5 Phase 4：评测与优化

目标：

- 让 harness 具备可量化的质量指标

交付：

- 扩展现有 eval 体系，而不是新起一套
- 评测维度包括：
  - 计划质量
  - 证据有效率
  - 工具成功率
  - 重规划次数
  - 最终答案质量

---

## 7. 推荐的首版实现策略

### 7.1 不要先做数据库大设计

首版不要一上来先造很多表。

正确顺序：

1. 跑通任务语义
2. 跑通事件流与 UI
3. 再固化持久化模型

原因：

- 当前最大不确定性是 task state 的形状
- 过早定表，后续会被运行时现实打回重做

### 7.2 先复用 operation metadata

Phase 1 建议将以下内容先挂在 operation metadata：

- currentPhase
- plan
- evidenceSummary
- artifacts
- taskMode

这样可以：

- 少一轮 schema 设计
- 不影响后续迁移到正式 run 表

### 7.3 先用内置逻辑角色，不先上动态 agent 市场化

Phase 1 不建议让用户自由拼 “planner agent /critic agent /reporter agent”。

先做：

- 内置 planner profile
- 内置 reflector profile
- 内置 synthesizer profile

理由：

- 先稳定运行时语义
- 再开放角色配置

### 7.4 先做 “复杂任务模式”，不直接替换默认聊天

建议新增 task mode，而不是直接把所有聊天都切到 harness。

原因：

- 普通问答不需要 task overhead
- task harness 会增加 tokens、步骤数与 UI 复杂度
- 需要显式入口才能建立用户预期

---

## 8. 风险与取舍

### 8.1 最大风险：做成第二套产品

如果把 task harness 做成独立页面、独立 store、独立协议、独立 runtime：

- 会与现有 chat /agent/tool /tracing 脱节
- 长期维护成本会翻倍

规避：

- 保持 chat-first
- 保持 operation-first
- 保持 tool execution 统一

### 8.2 最大技术风险：上下文与成本失控

DeerFlow 类 harness 一旦没有 evidence ledger 与 compression：

- 会快速膨胀 token
- 会让 planner /reflector 被噪音淹没

规避：

- 强制分层上下文
- evidence 先结构化，再注入
- 每个 phase 用不同 context slice

### 8.3 最大产品风险：用户看不懂中间态

如果只做 runtime，不做可视化：

- 用户只会觉得 “更慢了”
- 无法建立对复杂任务模式的信任

规避：

- Phase 1 必须有 Plan / Evidence / Artifact 三个最小面板

### 8.4 最大架构风险：过早 workflow 化

如果为了 harness 一步做到可视化 workflow authoring：

- 会撞上仓库已有架构规则
- 也会把任务从 “可落地” 拖成 “平台化过度设计”

规避：

- 先做 runtime specialization
- 不在 Phase 1 引入新的通用 workflow DSL

---

## 9. 验收标准

Phase 1 的最低验收标准：

1. 用户可显式进入复杂任务模式
2. 系统可生成任务计划并展示
3. 系统可执行至少一轮研究 -> 反思 -> 汇总闭环
4. 系统可并行执行至少两个研究子任务
5. 所有工具调用仍走现有 tool execution /intervention 链路
6. 用户可取消任务，任务能正确结束
7. 中间态可通过同一 operation stream 渲染
8. 最终结果可回链到 evidence

Phase 2 的最低验收标准：

1. 任意一次 task run 可查询
2. 任意一步 task step 可定位
3. evidence 与 artifact 可持久化读取
4. tracing /replay 不需要重新发明主键体系

---

## 10. 最终建议

建议采纳以下结论：

1. **做原生 DeerFlow 风格 harness 是对的**
   - 这符合 LobeHub 从聊天产品向任务执行面的演进方向

2. **不要把它做进 model-runtime**
   - `model-runtime` 只该继续负责 provider 适配

3. **不要重起一套 workflow 平台**
   - 先把 harness 作为 `agent-runtime` 上层 specialization 落地

4. **Phase 1 先复用 operation /stream/tool intervention**
   - 这能把风险压到最低

5. **先把 task 语义跑通，再谈持久化与平台化**
   - 先求正确，再求抽象优雅

一句话结论：

> 推荐在 LobeHub 内部新增一层基于现有 `agent-runtime + group orchestration + tool execution + operation stream` 的 **Task Harness Runtime**，以原生实现 DeerFlow 风格的复杂任务执行语义，而不是引入外部 DeerFlow 实例或重建第二套 workflow 平台。
