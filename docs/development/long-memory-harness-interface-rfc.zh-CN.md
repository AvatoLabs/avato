# Long Memory Harness Interface RFC

**状态**：Draft；截至 2026-04-05 已完成 intake 入口、共享 harness payload/normalize contract，以及 webhook/async 接入  
**日期**：2026-04-05  
**目标**：为未来自研长记忆 harness 定义稳定接口与责任边界，确保 harness 可替换、可演进，但不破坏 LobeHub 的 `Memory V2` canonical schema 与 `Space Memory` 产品模型。

---

## 〇、当前落地进展（截至 2026-04-05）

和本 RFC 对应的代码目前只完成了最前面的接入壳层，还远未到“稳定接口已经定型”的阶段。

- **`harness` 已成为正式 intake origin**：`Space Memory` intake 现在已经支持 `manual / automation / harness` 三种来源。
- **共享 harness contract 已落类型与 normalize 层**：仓库里现在已经有正式的 `SpaceMemoryHarnessCandidateDraft / SourceRef / DecisionDraft / RecallDraft / IngestPayload` 共享类型，并新增统一 normalize，把 richer harness payload 折叠进当前 `Space Memory` candidate schema。
- **内部 webhook 已接 harness normalize**：`/api/webhooks/space-memory-ingest` 现在不再只接受 ad-hoc draft 数组，而是先走共享 harness payload schema，再统一落入 candidate intake。
- **异步触发封装已补 dedicated harness path**：`SpaceMemoryTriggerService` 与 `SpaceMemoryAsyncService` 现在除了 generic intake 以外，也有专门的 harness contract 入口，`trpc/async.spaceMemory.ingestHarnessCandidates` 已经和 webhook 共用 normalize。
- **仍然缺失的核心内容**：仓库里仍然没有 active harness 切换、真正的 adapter registry、可执行的 merge decision engine、recall candidate rerank contract，以及更细粒度的 source attribution projection。

这意味着：

> 当前代码已经证明 harness 可以“按正式 contract 把候选送进来”，  
> 但还没有证明 harness 已经成为一个可替换、可并存、可配置的正式编排层。

---

## 一、为什么需要这份 RFC

LobeHub 未来很可能会引入自己的长记忆 harness。

这本身不是问题。真正的风险是：

- harness 直接定义记忆对象模型
- harness 直接写入 canonical memory
- harness 内部 decision 泄漏成产品层概念
- 更换 harness 时，整套 UI、RBAC、history 和 recall 都被迫重做

所以必须先把边界定死：

> harness 是编排层，不是真相层。  
> harness 是策略引擎，不是产品模型。  
> harness 可以被替换，但 canonical memory 和用户心智不能漂移。

---

## 二、和现有文档的关系

三份文档的分工是：

- [memory-v2-migration-blueprint.zh-CN.md](./memory-v2-migration-blueprint.zh-CN.md)
  - 定义 `candidate / published / history / recall` 的系统真相
- [space-first-team-memory-plan.zh-CN.md](./space-first-team-memory-plan.zh-CN.md)
  - 定义 `Personal Memory / Space Memory` 的产品与治理方案
- **本 RFC**
  - 定义 harness 应该如何接入、能做什么、不能做什么

一句话：

> `Memory V2` 定义数据真相，  
> `Space Memory` 定义产品真相，  
> `Harness RFC` 定义自动化真相。

---

## 三、Harness 的唯一职责

Harness 只负责 5 件事：

1. `Extract`
   - 从 chat / docs / files / meetings / tasks 中抽取候选记忆
2. `Normalize`
   - 输出统一的 kind、summary、normalized key、source attribution
3. `Match`
   - 找到可能相关的旧 memory entry / candidate
4. `Decide`
   - 给出 `ADD / UPDATE / MERGE / ARCHIVE / IGNORE / REVIEW` 建议
5. `Package`
   - 根据 query、scope、policy 组装 recall candidates 供服务端继续过滤

Harness 不负责：

- 定义最终数据库 schema
- 直接写 `published`
- 跳过 RBAC
- 决定最终 UI 分类
- 把 `Source Set` 变成 memory 根

---

## 四、稳定接口

### 1. Candidate Extraction Contract

Harness 输入：

- source payload
  - chat turn
  - doc delta
  - file parse result
  - meeting note
  - task change
- scope context
  - `user`
  - `space`
  - 可选 `agent`
- policy context
  - memory enabled?
  - auto publish allowed?
  - sensitivity filters

Harness 输出：

```ts
interface MemoryCandidateDraft {
  confidence: number;
  content: string;
  kind: 'fact' | 'preference' | 'policy' | 'playbook' | 'persona' | 'context';
  normalizedKey?: string | null;
  proposedOwnerId?: string | null;
  proposedReviewerId?: string | null;
  scope: 'user' | 'space' | 'agent';
  sourceRefs: MemorySourceRef[];
  summary?: string | null;
  title?: string | null;
}
```

这份输出只能进入 `memory_v2_candidates`，不能直接进入 `memory_v2_entries`。

在 `Space Memory` 当前实现里，这对应一个统一的 candidate intake 层：

- `spaceMemory.createCandidate`
  - 单条手动入口
- `spaceMemory.ingestCandidates`
  - 批量 intake 入口，供 automation / harness 复用

其中批量 intake 必须带：

- `origin`
- `producer`
- `traceId`

以便后续审计和回溯。

当前还补了一条服务端自动 producer：

- `spaceMemory.ingestTopicCandidate`
  - 由服务端根据 `topicId` 自行生成 candidate draft
  - 内部使用 `origin='automation'`
  - 用于 topic/chat 侧的自动 intake，也为未来 harness 提供参考实现
  - 当前已接到 `topic.historySummary` 的持久化更新链路
  - 内部会对同一 `topic + summary` 做最小去重
  - 自动链路本身已经改成：`topic.updateTopic -> triggerHarnessIngest -> internal webhook -> intake`

并且已经有第二条“提取链接 intake”的参考实现：

- `userMemory extraction -> triggerHarnessIngest -> spaceMemory.ingestCandidates`
  - 当前接在 team-space topic 的 user-memory 提取成功链路之后
  - 只把 `context / experience` 映射成团队候选记忆
  - 显式跳过 `identity / preference / activity`
  - 目的是证明 harness / extractor 不需要拥有 canonical schema，也能把结果接入统一 intake
  - 这条链路现在也不再直接写本地 ingestion service，而是先走 trigger / webhook

另外，当前已经补了第一条面向未来 harness 的内部入口：

- `POST /api/webhooks/space-memory-ingest`
  - 走 internal service auth
  - 输入 `userId + spaceId + drafts + producer + traceId`
  - 服务端统一归一化为 `origin='harness'`
  - 最终仍然只进入 `Space Memory` candidate intake，不直接写 published
- `SpaceMemoryTriggerService.triggerHarnessIngest`
  - 为内部 workflow / harness 代码提供稳定触发器
  - 默认使用 `INTERNAL_APP_URL`
  - 自动附带 internal service auth
- `trpc/async.spaceMemory.ingestCandidates`
  - 为内部 worker / cron / workflow producer 提供更贴近现有异步基础设施的入口
  - internal producer 优先走 async TRPC；external harness 或跨进程 producer 再走 webhook

### 2. Merge Decision Contract

Harness 输入：

- candidate draft
- candidate 所属 scope 下的相关 entries
- candidate 所属 scope 下的相关 pending candidates

Harness 输出：

```ts
interface MemoryDecisionDraft {
  confidence: number;
  decision: 'ADD' | 'UPDATE' | 'MERGE' | 'ARCHIVE' | 'IGNORE' | 'REVIEW';
  reason: string;
  targetEntryId?: string | null;
  targetCandidateId?: string | null;
}
```

注意：

- `decision` 是建议，不是最终数据库操作
- 最终写入仍然经过服务端 policy 与 review 规则
- 当前 `Space Memory` reviewer UI 已经落了最小护栏：
  - 基于 `space + category + summary` 命中已发布记忆时，提示“可能与已发布记忆重复”
  - 这让 harness 在还没产出复杂 merge/diff 前，reviewer 也能先避开最常见的重复发布

### 3. Recall Candidate Contract

Harness 输入：

- 当前 query
- 当前 scope
- 当前 agent / task context
- 当前 policy
- 已发布的 canonical memory

Harness 输出：

```ts
interface MemoryRecallDraft {
  entryId: string;
  reason: string;
  relevance: number;
  slots?: string[];
}
```

服务端再根据：

- `published` 状态
- RBAC
- expiresAt / archived / hidden
- prompt budget

决定最终注入。

### 4. Source Attribution Contract

每个 harness 输出必须自带来源引用：

```ts
interface MemorySourceRef {
  objectId: string;
  objectType: 'chat' | 'doc' | 'file' | 'source_set' | 'task' | 'meeting';
  snippet?: string | null;
  version?: string | null;
}
```

如果没有来源引用，candidate 不能被视为企业级可治理记忆。

---

## 五、非功能性约束

### 1. Harness 不拥有 canonical schema

canonical schema 由 LobeHub 定义，至少包括：

- `memory_v2_entries`
- `memory_v2_candidates`
- `memory_v2_entry_history`
- `memory_v2_recall_usage_logs`

Harness 只能通过 service interface 读写这些表，不能自己扩成另一套真相库。

### 2. Harness 不能直接写 Published

允许：

- `candidate`
- `auto_accepted candidate`
- `merge suggestion`

不允许：

- 绕过 review / policy 直接写 `published`

### 3. Harness 不能定义产品 taxonomy

产品层对用户展示的是：

- `Personal Memory`
- `Space Memory`
- `Inbox`
- `Published`
- `Playbooks`
- `Policies`

Harness 内部如果用别的 taxonomy，只能停留在内部。

### 4. Harness 必须可替换

接口必须做到：

- `mem0-style merge harness` 可以接
- `langmem-style background harness` 可以接
- 未来自研 rule-based / graph-based harness 也可以接

替换 harness 时，不应触发：

- schema 重写
- UI 重写
- route 重写

---

## 六、和 Space-First 的一致性约束

### 1. Scope 统一为 `user / space / agent`

不要再在新系统里引入：

- `workspace`
- `source-set memory`
- `tenant-only memory`

作为产品层新的一级 scope。

`tenant` 可以是内部治理维度，但不应成为用户主心智。

### 2. Source Set 不是 Memory 根

`sourceSetId` 只能作为：

- 来源
- 标签
- 过滤条件
- 证据聚合器

不能变成第三个长期记忆根。

### 3. Space Memory 是团队唯一长期共享根

团队 agent 默认只读 `Space Memory.published`。

如果 harness 在多个 source set 中提取出同一事实，应当 merge 到同一个 `Space Memory entry`，而不是创建多份。

---

## 七、推荐实施顺序

### Phase 1

- 固定 `candidate / decision / recall / sourceRef` 4 个 contract
- 在 `memory-v2` service 层加 adapter interface

### Phase 2

- 让现有 user-memory extraction 先通过 harness adapter 输出 candidate
- 不改 UI，只改编排层

### Phase 3

- 为 `Space Memory` 引入 candidate pipeline
- 默认仍不自动 publish

### Phase 4

- 支持多种 harness 实现共存
- 在配置层选择 active harness

---

## 八、最终原则

> `Harness` 负责“发现什么值得记”。  
> `Memory V2` 负责“系统最终认为什么是真的”。  
> `Space Memory` 负责“团队如何使用、治理和审计这些真相”。

只要这三层边界不乱，未来无论你换成什么长记忆 harness，企业记忆能力都不会被架空。
