---
description: LobeHub 中文架构基线、迁移路线与实施细则
globs:
  - 'src/**/*'
  - 'packages/**/*'
  - 'apps/**/*'
alwaysApply: false
---

# LobeHub 架构规则

> 面向自托管、企业治理、可审计执行的中文架构基线与落地手册。

---

## 1. 文档定位

这份文档只做三件事：

1. 说明 **当前代码库里真实存在的架构事实**
2. 说明 **目标架构应该往哪里走**
3. 说明 **每一个阶段应该怎么落地**

阅读规则：

- 如果文档与代码冲突，以代码为准
- 如果目标态与现状不一致，必须写清楚 “迁移路径”，不能直接把目标态伪装成现状
- 如果要加新表、新服务、新路由，必须先判断是否能复用现有能力

适用场景：

- 新功能方案设计
- RFC / 技术设计评审
- 中长期路线图拆解
- 团队对齐 “哪些是现状，哪些只是提案”

快照时间：**2026-03-26**

---

## 2. 产品方向

### 2.1 产品本质

LobeHub 要逐步从 “AI 对话产品” 演进为：

- 一个 **自托管 AI 工作空间**
- 一个 **多模型执行与编排层**
- 一个 **受治理的工具运行时**
- 一个 **记忆与知识感知的协作面**
- 一个 **可审计、可回放、可治理的 AI 操作层**

### 2.2 不要把产品做成什么

不要把核心架构优先级放在下面这些方向上：

- 模型陈列馆
- Prompt 玩具箱
- 角色形象市场
- 以截图 / 桌面演示为核心的 “秀肌肉” 壳子
- 单纯模仿消费级聊天产品

### 2.3 长期第一性对象

长期看，系统应该围绕 5 个第一性对象收敛：

1. **Workspace**
   - 租户边界
   - 成员关系
   - 策略作用域
2. **Identity**
   - 认证
   - SSO
   - RBAC
   - 审计归因
3. **Knowledge**
   - 文件接入
   - 解析与检索
   - ACL 感知上下文注入
4. **Tooling**
   - Builtin Tool
   - Plugin
   - MCP
   - 审批、审计、策略
5. **Run**
   - 统一执行记录
   - 状态机
   - 成本与延迟
   - 回放与调试上下文

---

## 3. 当前架构事实

这一章只写现在仓库里已经成立的事实。

### 3.1 技术栈

| 层               | 当前实现                                        |
| ---------------- | ----------------------------------------------- |
| 前端框架         | Next.js 16 + React 19 + TypeScript              |
| SPA 路由         | Next.js 内嵌 `react-router-dom`                 |
| UI               | `@lobehub/ui` + antd                            |
| 样式             | `antd-style`                                    |
| 客户端状态       | Zustand，且大量使用 flatten slice actions       |
| 数据获取         | tRPC + SWR 混合                                 |
| 后端入口         | App Router Route + tRPC + WebAPI + OpenAPI      |
| 数据库           | PostgreSQL + Drizzle ORM                        |
| 鉴权             | Better Auth + OIDC + Better Auth SSO Providers  |
| Agent Runtime    | `@lobechat/agent-runtime` + 服务端 Runtime 服务 |
| Context Pipeline | `@lobechat/context-engine`                      |
| 向量存储         | PostgreSQL `pgvector`，1024 维                  |
| 文件存储         | S3 兼容对象存储                                 |

### 3.2 当前存在多个 API 面

当前仓库不是 “只有 tRPC”。

真实情况是：

- **tRPC**
  - 目录：`src/server/routers/*`
  - 作用：站内主业务 RPC
- **Next.js App Router 后端路由**
  - 目录：`src/app/(backend)/*`
  - 作用：流式响应、协议适配、回调、OIDC/WebAPI
- **OpenAPI**
  - 目录：`packages/openapi/src/*`
  - 作用：对外程序化集成

结论：

- 多 API 面是当前真实架构，不是 “技术债噪音”
- 新功能要先选对 API 面，再写代码
- 不能靠一句 “统一都走 tRPC” 来掩盖现有协议差异

### 3.3 代码库分层地图

```text
lobehub/
├── apps/
│   └── desktop/                     # Electron
├── packages/
│   ├── database/                    # schema / model / migration
│   ├── agent-runtime/               # agent runtime package
│   ├── context-engine/              # context injector / provider
│   ├── builtin-tool-*/              # 内建工具包
│   ├── openapi/                     # OpenAPI 对外面
│   └── ...
├── src/
│   ├── app/(backend)/               # App Router 后端入口
│   ├── spa/                         # SPA entry 与启动
│   ├── routes/                      # SPA 路由入口与布局
│   ├── features/                    # 业务 UI / 业务组件
│   ├── store/                       # Zustand store
│   ├── services/                    # 客户端 service
│   ├── server/services/             # 服务端 service
│   ├── server/routers/              # tRPC routers
│   └── ...
```

### 3.4 当前数据归属模型不是纯 Workspace Native

这一点必须说清楚，否则后面所有治理方案都会建立在错误假设上。

#### 3.4.1 当前以 `userId` 为主的会话核心

这些核心表目前是 **用户归属**，不是 `spaceId` 归属：

- `sessions`
- `topics`
- `threads`
- `messages`
- `agents`

也就是说：

- 现在的对话主链路，核心拥有者仍然是 user
- 不是所有聊天数据都已经天然挂在 workspace 下面

#### 3.4.2 当前以 `spaceId` 为主的治理与资源层

这些表已经是 **空间治理模型**：

- `spaces`
- `space_members`
- `resource_registry`
- `resource_permissions`
- `resource_share_links`
- `resource_audit_logs`
- `resource_access_events`

#### 3.4.3 当前资源内容层

这些内容已经和资源治理层绑定得更紧：

- `files`
- `documents`
- `knowledge_bases`

它们已经具备：

- ACL
- share link
- inheritance
- audit/event

#### 3.4.4 这意味着什么

这意味着当前系统是 **混合作用域模型**：

- 会话核心还是偏 user-scoped
- 资源治理已经是 space-scoped

所以：

- 任何新功能如果默认 “所有聊天数据都已经是 workspace native”，那就是错的
- 任何治理能力如果想落在对话链路上，都必须先写清楚 “过渡设计”

### 3.5 身份与权限现状

当前已经存在的能力：

- Better Auth 作为主认证框架
- magic link
- passkey / WebAuthn
- email OTP
- Better Auth SSO provider
- OIDC 认证上下文
- `NOAUTH_MODE` 某些面向自托管 / 开发的场景

当前已经存在的权限治理基础：

- roles / permissions / userRoles
- `spaces`
- `space_members`
- `resource_permissions`
- `authzEpoch`

当前还没有真正一等公民化的企业能力：

- SCIM
- IP allowlist / denylist
- 会话并发与超时策略
- space 之上的 org/grouping

### 3.6 Knowledge / RAG 现状

当前已经具备：

- 文件上传
- 文档解析
- chunking
- 1024 维 embedding
- knowledge base 挂到 agent
- retrieval 结果进入消息上下文
- 资源 ACL 参与知识访问

当前还要注意的一点：

- 仓库里已经有 `rag_eval_*`
- 仓库里也已经有 `agent_eval_*`

所以 eval 不是空白地带，不能随便再起一套新的通用评测系统。

### 3.7 Tool 与执行链路现状

当前工具体系已经包含：

- builtin tool packages
- plugin gateway
- remote MCP
- desktop local MCP / STDIO
- `ToolExecutionService`
- context-engine 的 tool manifest 与 tools resolution

当前已经存在但容易被忽略的能力：

- tool manifest 支持 `humanIntervention`
- conversation runtime 已经有 approve /reject/continue 的干预流

所以正确表述应该是：

- 现在 **不是没有 human-in-the-loop**
- 真正缺的是：
  - durable 的策略模型
  - admin 视角的审批记录
  - 统一 tool audit
  - policy ownership

### 3.8 Workflow / Automation 现状

当前已经存在：

- thread type /status 作为部分执行状态基础
- Workflow Studio DSL
- Workflow Studio preview
- Workflow Studio 在用户设置里的持久化
- MCP oriented workflow authoring helpers

当前还不存在的，是下面这些真正 “平台化” 的工作流能力：

- 可查询、可版本化的 workflow definition 表
- workflow execution ledger
- 与 approval /run/cost /replay 对齐的统一工作流运行模型

所以：

- 后续要做工作流，必须和 Workflow Studio 对齐
- 不能假装仓库里还没有任何 workflow layer

### 3.9 Observability / Audit 现状

当前已有：

- `resource_audit_logs`
- `resource_access_events`
- thread 状态与 stream event
- tRPC OpenTelemetry middleware

当前缺失：

- 面向常规执行链路的 canonical `runs`
- per-run token usage
- per-run cost
- per-run latency
- replay snapshot

### 3.10 Admin Control Plane 现状

这一点也必须说清楚。

当前 repo 里已经有一些 “管理员相关基础”，但它们不是一个完整的平台管理员控制台。

当前已经存在：

- space 级 settings 页面
- space owner/admin 的成员管理
- Better Auth 的 admin plugin
- OpenAPI 里的部分 user /role/permission 管理接口
- 若干全局配置解析逻辑
- MCP 依赖检查、技能导入、provider 配置等零散能力

当前还没有的，是一个真正的平台级控制面：

- 没有统一的 `/admin` Web 控制台
- 没有全局 dashboard
- 没有 “环境变量注册表 -> 表单渲染” 的只读配置面板
- 没有全局技能安装中心
- 没有全局 MCP 安装 / 部署中心
- 没有统一的运维日志中心
- 没有部署初始化时清晰的一次性 admin bootstrap 机制

结论：

- 现在有的是 “局部管理能力”
- 还没有 “平台治理控制面”

---

## 4. 不可违反的工程规则

这一章不是愿景，而是现在就应该遵守的规则。

### 4.1 Route 必须保持薄

`src/routes/*` 的职责是：

- 组合布局
- 处理 loading /route-level glue
- 承接导航状态

不要在 route 里做这些事：

- 大块业务状态编排
- 复杂 domain workflow
- 重复拼接数据层逻辑

允许 route 依赖这些目录：

- `src/features/*`
- `src/store/*`
- `src/layout/*`
- `src/hooks/*`
- `src/components/*`

结论：

- “route 只能 import features” 这种规则在当前仓库太死
- 正确规则是 “route 不要承载业务核心”

### 4.2 客户端状态与数据流规则

默认遵循现有模式：

- Zustand 管客户端状态
- 用 flatten slice action 组织复杂 store
- tRPC 负责主业务 RPC
- SWR 负责 cache/provider 级别同步

只有在下面场景才考虑偏离：

- 现有 store 颗粒度完全不合适
- 需要协议级 stream 行为
- 需要跨 API 面共享但 tRPC 不适合

### 4.3 API 面选择规则

做功能前先判断入口：

1. **站内主业务读写**
   - 优先 tRPC
2. **流式响应 /provider callback /protocol adapter**
   - 优先 App Router 后端 route
3. **外部集成**
   - 优先 OpenAPI

不要做的事：

- 同一个能力在三套 API 面重复实现
- 只是因为熟悉某个框架就强行放错层

### 4.4 数据库与迁移规则

本仓库数据库规则非常明确：

- 用 PostgreSQL 思维设计
- 用 Drizzle PG API 实现
- 用 Postgres migration 落地

具体要求：

- 使用 `pgTable`
- 不要在方案文档里写 `sqliteTable`
- 不要在方案文档里写 SQLite 风格 API，比如 `insertOrReplace`
- 优先 additive migration
- schema、model、migration 三者都要一起考虑

### 4.5 权限规则

如果一个功能涉及 governed resource：

- 必须经过现有 auth middleware
- 必须尊重 `authzEpoch`
- 必须复用资源权限模型
- retrieval /file access /tool-side resource usage 都不能绕过 ACL

要牢记一个现实：

- chat core 现在仍然主要是 user-scoped
- governed resource 现在是 space/resource-scoped

不能把这两件事粗暴揉成一句 “全系统都已经是 workspace scoped”。

### 4.6 权限继承规则

当前权限继承不是空白能力。

现状：

- read-time inheritance 已经存在
- 父链遍历和 `inheritsToChildren` 已经在资源服务里发挥作用

后续可以增强的方向：

- write-time propagation
- admin UX
- effective permission inspection
- diagnose tooling

但是不能做的事：

- 重新发明第二套平行继承引擎

### 4.7 Tool Governance 规则

未来所有 tool 审批 /tool policy /tool audit 都必须建立在现有执行链路之上。

必须遵守：

- 复用 `humanIntervention`
- 复用现有 approve /reject/continue 语义
- policy /request/audit 要能回链到 tool identity 与 message/run
- builtin /plugin/ MCP 必须统一纳入

不能做的事：

- 绕开现有 `ToolExecutionService`
- 做一套只服务某一类工具的 “半截审批系统”

### 4.8 Workflow 规则

后续所有 workflow runtime 设计必须先回答一个问题：

- Workflow Studio 到底是不是 authoring source of truth？

允许的答案只有两种：

1. Workflow Studio 继续存在，并编译到 canonical runtime
2. Workflow Studio 被替换，但必须有明确迁移计划

不能做的事：

- 新起一套互不兼容的 workflow DSL /workflow runtime

### 4.9 Eval 规则

当前 repo 已经有 eval 体系。

后续原则：

- 优先扩展 `rag_eval_*`
- 或扩展 `agent_eval_*`
- 只有在确实无法复用时，才允许新增评测体系

新增前必须回答：

- 为什么现有两套评测不能扩展？
- 新体系的最小边界是什么？
- 如何与 `run` 对齐？

### 4.10 架构文档写法规则

以后写架构文档，不允许再出现以下问题：

- 把目标态写成现状
- 用 SQLite 伪代码指导 PostgreSQL 仓库
- 假装没有 Workflow Studio
- 假装没有 tool human intervention
- 假装 eval 是空白地带

### 4.11 平台控制面规则

后续如果做平台级 Admin Console，必须遵守下面这些规则：

1. **平台管理员不等于空间管理员**
   - `platform admin / site admin` 是全局作用域
   - `space owner / admin` 是 workspace 作用域
   - 两者不能混成一个概念

2. **环境变量面板第一版只能 “可见”，不应该直接 “可写”**
   - env 的 source of truth 仍然是部署环境、secret manager、容器编排系统
   - UI 第一版先做只读、校验、提示、复制 key、显示缺失状态
   - 不要第一版就做 “在线改 env 并热更新”

3. **敏感配置必须默认脱敏**
   - secret、token、password、private key 不能在 UI 全量明文展示
   - 最多显示掩码、长度、是否已配置、最后更新时间、来源

4. **全局技能 / MCP 管理必须可审计**
   - 谁安装的
   - 从哪安装的
   - 安装了什么版本
   - 作用到哪些 workspace /users
   - 失败原因是什么

5. **运维日志必须分层**
   - 平台日志
   - 安全日志
   - 管理员操作审计
   - workspace 治理日志
   - run/tool/workflow 执行日志
   - provider / MCP /skill 集成日志

6. **平台控制面优先读现有系统，不要先造新真相源**
   - env 信息优先从 `src/envs/*` 和 `src/server/globalConfig/*` 派生
   - skill 信息优先复用现有 skill importer /aggregator
   - MCP 信息优先复用现有 dependency check /deployment option 逻辑
   - 审计优先复用现有 audit / OTel /structured logging 基础

---

## 5. 目标架构

### 5.1 最终方向

最终希望把 LobeHub 收敛成：

> 一个安全、自托管、多模型、工具可治理、知识可控、执行可审计、工作流可编排的企业级 AI 工作空间

### 5.2 目标架构的核心原则

目标态里需要形成下面这三条主线：

1. **Identity 线**
   - user 是身份主体
   - auth /sso/admin policy 都围绕身份与组织关系展开

2. **Workspace 线**
   - workspace 是治理边界
   - policy、membership、resource ACL 都围绕 workspace

3. **Run 线**
   - run 是执行边界
   - 成本、延迟、审批、回放、工作流状态都围绕 run

### 5.3 未来必须一等公民化的能力

#### Workspace

- 更清晰的对话归属
- 成员与策略边界
- 管理员视角的审批与审计

#### Identity

- 企业 SSO
- 生命周期管理
- 审计归因
- 管理策略

#### Knowledge

- ACL-aware retrieval
- citation / provenance
- 检索评测
- 配置能力

#### Tooling

- durable policy
- human approval
- audit logging
- secret isolation
- timeout / retry governance

#### Platform Control Plane

- platform admin console
- deployment config explorer
- 全局技能 / MCP 安装中心
- 运维日志中心
- support bundle / health overview

#### Run

- canonical execution record
- cost / latency / replay
- workflow linkage
- debugging context

---

## 6. 分阶段实施路线图

这一章是 “保姆级” 落地手册。

建议按照下面顺序推进，不要跳着做。

---

## 前置阶段（阶段 -1）：全局管理控制面与部署引导

这是建议新增在所有治理型能力之前的第一阶段。

如果不先做这一层，后面的 run、tool governance、workflow、workspace native 化都会缺一个统一控制面，只能靠零散页面和脚本推进，最终很难运维。

### 6.P.1 这一阶段的目标

先建立一个 **平台级 Admin Console / Control Plane**，回答下面这些问题：

- 这个部署实例现在健康吗？
- 谁是平台管理员？
- 哪些环境变量已经配置，哪些缺失？
- 哪些 provider、skill、MCP 在全局可用？
- 最近有哪些关键错误、审批堆积、执行失败？
- 如果线上出问题，管理员应该去哪里看？

### 6.P.2 为什么必须放在最前面

后面的所有企业化能力，本质都需要 “控制面” 承接：

- tool policy 需要管理页
- workflow execution 需要状态面板
- workspace governance 需要管理员入口
- provider / MCP /skill 安装需要统一运维面
- 日志与审计需要统一查询入口

如果没有这个阶段，后面功能会变成：

- 能力做出来了
- 但没人知道怎么配、怎么查、怎么救火

### 6.P.3 先把 3 个作用域分清楚

这一阶段必须把三个 scope 明确拆开：

1. **Platform / Site Scope**
   - 整个部署实例级别
   - 例如：环境变量、全局 provider、全局 skill、全局 MCP、平台管理员、运维日志

2. **Workspace Scope**
   - 单个团队空间
   - 例如：space 成员、space 策略、资源 ACL

3. **User Scope**
   - 单个用户
   - 例如：个人设置、个人 agent、个人偏好

注意：

- `/admin` 是 platform scope
- `/resource/space/:spaceId/settings` 是 workspace scope
- 不能把现有 space settings 误认为平台后台

### 6.P.4 第一版信息架构建议

建议新增一套独立的 Web 平台控制台路由：

- `/admin`
- `/admin/overview`
- `/admin/deployment`
- `/admin/env`
- `/admin/providers`
- `/admin/extensions/skills`
- `/admin/extensions/mcp`
- `/admin/workspaces`
- `/admin/auth`
- `/admin/logs`
- `/admin/audit`
- `/admin/support`

推荐目录：

- route：`src/routes/(main)/admin/*`
- feature：`src/features/AdminConsole/*`
- server router：`src/server/routers/lambda/admin.ts` 或 `src/server/routers/lambda/admin/*`
- backend streaming / download：`src/app/(backend)/api/admin/*`

为什么不要挂在普通 settings 下面：

- settings 更像 user preferences
- admin console 是平台运维与治理入口
- 这两者的信息密度、权限要求、导航结构都不一样

### 6.P.5 第一版 Dashboard 应该有什么

建议首页做成真正的 control plane，而不是一堆链接列表。

第一屏建议至少有这些模块：

1. **系统健康总览**
   - 当前版本、构建信息、启动时间
   - DB / Redis / Storage / Queue / OIDC / SMTP 健康状态
   - 最近 24h 错误率、慢请求、run 失败数

2. **治理状态总览**
   - 待审批 tool request 数
   - 失败 workflow 数
   - 最近新增 workspace 数
   - 当前 platform admin 数量

3. **配置完整度总览**
   - 关键 env 已配置 / 未配置数
   - provider 可用数
   - MCP 可用数
   - skill 已安装数

4. **告警与异常摘要**
   - 启动失败检查项
   - 缺失必填配置
   - 最近安装失败的 MCP /skill
   - provider 认证失效

5. **快捷入口**
   - 去环境变量页
   - 去日志页
   - 去技能安装中心
   - 去 MCP 中心
   - 去 support bundle 导出

### 6.P.6 环境变量注册表与表单渲染设计

这一块按你的要求，第一版先做 “显示和渲染”，先不提供在线修改功能。

#### 设计原则

- env 的 source of truth 仍然是部署环境
- UI 负责 “发现、校验、解释、提示”
- 不负责 “直接写回 process env”

#### 推荐做法

1. 从 `src/envs/*.ts` 提取基础 env schema
2. 从 `src/server/globalConfig/*.ts` 提取 “全局配置组” 语义
3. 允许补一层手写 descriptor，补充：
   - 标签
   - 分类
   - 描述
   - 示例值
   - 是否 secret
   - 是否重启生效
   - 是否与某个 provider / 功能相关

#### 第一版 UI 表单字段建议

每一个 env 表单项至少显示：

- Key
- 分组
- 类型
- 是否必填
- 是否已配置
- 当前状态
  - missing
  - configured
  - invalid
  - deprecated
- 默认值
- 是否 secret
- 是否需要重启
- 来源文件
- 关联功能

#### Secret 显示规则

- 默认不显示原值
- 显示掩码
- 显示 “已配置 / 未配置”
- 允许 copy key，不允许 copy raw secret

#### 推荐分组

- App
- Auth
- Provider / LLM
- Email
- Redis
- File Storage
- Image / Knowledge
- Tools / Gateway / Python
- Observability / Langfuse / Analytics

#### 推荐落点

- `src/server/services/adminConsole/EnvRegistryService.ts`
- `src/server/services/adminConsole/env-descriptors/*`
- `src/features/AdminConsole/EnvRegistry/*`

### 6.P.7 全局技能安装中心

这一块建议做得比 “技能市场页” 更偏运维。

目标不是给普通用户逛，而是给平台管理员做：

- 全局安装
- 全局禁用
- 版本检查
- 来源审计
- 作用域控制

#### 第一版能力建议

1. 列出 builtin skills
2. 列出已导入 skills
3. 支持从 marketplace / GitHub /archive/local source 导入
4. 记录安装来源、安装人、安装时间、版本
5. 支持标记：
   - available to all
   - hidden
   - internal only
6. 显示解析失败、脚本缺失、依赖缺失等健康状态

#### 数据模型建议

建议新增：

- `global_skill_installations`
- `global_skill_release_cache`

最小字段可以包括：

- `id`
- `identifier`
- `sourceType`
  - `builtin`
  - `market`
  - `github`
  - `archive`
  - `local`
- `sourceRef`
- `version`
- `status`
- `visibility`
- `installedBy`
- `installedAt`
- `metadata`

#### 复用现有能力

- `src/server/services/skill/*`
- `src/server/services/skillAggregator/*`
- `packages/builtin-tool-skills/*`
- `packages/context-engine/src/engine/skills/*`

### 6.P.8 全局 MCP 安装与部署中心

MCP 不能只做 “会不会连上”，要做成真正的平台集成中心。

#### 第一版能力建议

1. 列出现有 MCP server 定义
2. 显示 deployment option
3. 跑 dependency check
4. 显示需要哪些系统依赖
5. 支持 install task /dry-run check
6. 支持全局 enable /disable
7. 支持按 workspace 暴露或隐藏
8. 显示最近心跳、最近失败原因、最近一次部署状态

#### 推荐子页面

- `/admin/extensions/mcp`
- `/admin/extensions/mcp/:id`
- `/admin/extensions/mcp/install-tasks`

#### 数据模型建议

建议新增：

- `global_mcp_registries`
- `global_mcp_installations`
- `global_mcp_health_checks`

建议字段包括：

- server identifier
- display name
- transport type
- deployment type
- config schema
- health status
- last check result
- scope
- installedBy
- installedAt

#### 复用现有能力

- `src/server/services/mcp/index.ts`
- `src/server/services/mcp/deps/*`
- `src/server/routers/tools/mcp.ts`

### 6.P.9 Provider 与运行时健康中心

这一块建议不要藏在普通用户 settings/provider 里。

平台管理员更需要一个全局视角：

- 哪些 provider 已启用
- 哪些 provider 凭证缺失
- 哪些 provider 最近失败率高
- 哪些 provider 模型配置与 env 不一致

建议在 `/admin/providers` 里统一展示：

- provider 状态
- auth/config completeness
- 最近调用失败数
- 最近 token /cost 概览
- 关联 env 缺失项

### 6.P.10 运维日志中心

这个部分建议直接做成一个分层日志与事件中心，不要只做单一日志表。

#### 建议分成 6 层

1. **平台启动与部署日志**
   - 配置解析
   - migration
   - 依赖检查
   - bootstrap

2. **安全与认证日志**
   - 登录
   - 失败登录
   - 权限拒绝
   - SSO / OIDC 事件
   - admin bootstrap 消费

3. **管理员操作审计**
   - 安装 skill
   - 安装 MCP
   - 修改全局策略
   - 导出 support bundle

4. **workspace 治理日志**
   - member 变更
   - share link 操作
   - 资源权限变更

5. **执行日志**
   - run
   - tool call
   - workflow execution
   - provider failure

6. **集成与依赖日志**
   - MCP dependency check
   - skill import
   - provider auth failure
   - storage /redis/queue 异常

#### 展示能力建议

- 按层过滤
- 按时间过滤
- 按 workspace /user/runId /requestId 搜索
- 查看结构化 JSON
- 下载脱敏日志片段
- 从日志跳到 run /audit/workflow /resource

#### 存储策略建议

不要所有东西都塞进同一张表。

建议：

- 高价值安全 / 审计事件进数据库
- 高频运行日志优先 stdout / OTel / 外部 sink
- UI 读数据库事件 + 聚合摘要

### 6.P.11 Support Bundle 与运维工具箱

为了让管理员能 “救火”，建议第一版就放一个 support 工具箱。

建议包含：

- 当前版本与 commit SHA
- env 配置完整度摘要
- provider /storage/redis /db 健康摘要
- 最近错误摘要
- 最近失败 MCP /skill 安装记录
- 关键 feature flags
- 关键 global config 快照

注意：

- 导出内容必须默认脱敏
- private key、token、cookie、secret 绝不能原样打包

### 6.P.12 Platform Admin 账号与部署时 bootstrap 机制

这一块必须单独设计，不能含糊。

#### 第一原则

不要默认 “第一个注册用户就是平台管理员”，除非部署者显式开启这种模式。

原因：

- 自托管环境里，第一个登录的人不一定是运维者
- SSO 环境里，第一个登录的人可能只是普通成员
- 这个策略很难审计，也很难回滚

#### 建议引入单独的平台角色

建议平台级别使用独立角色概念：

- `platform_admin`
- 或 `site_admin`

它和下面这些角色不是一回事：

- `space owner`
- `space admin`
- `resource owner`

#### 推荐 bootstrap 方式

建议支持 3 种方式，优先级从高到低：

1. **SSO Group Mapping**
   - 企业部署优先
   - 通过 IdP group /claim 映射到 `platform_admin`

2. **Bootstrap Admin Emails**
   - 通过部署 env 指定一组 email
   - 首次匹配登录后授予 `platform_admin`

3. **一次性 Bootstrap Token**
   - 适合 air-gapped / 本地化部署
   - 管理员登录后输入一次性 token 完成平台管理员初始化

#### 推荐 env 设计

建议新增类似下面的部署变量：

- `ADMIN_BOOTSTRAP_MODE`
  - `sso_group`
  - `email_allowlist`
  - `one_time_token`
- `ADMIN_BOOTSTRAP_EMAILS`
- `ADMIN_BOOTSTRAP_TOKEN_HASH`
- `ADMIN_BOOTSTRAP_SSO_GROUPS`
- `ADMIN_BOOTSTRAP_LOCK_AFTER_INIT`

#### 推荐状态表

建议新增：

- `deployment_bootstrap_state`

记录：

- 当前实例是否已完成 bootstrap
- 采用了什么 bootstrap mode
- 第一次 admin 初始化时间
- 初始化人
- 是否已锁定再次 bootstrap

#### 第一版流程建议

1. 部署者设置 bootstrap env
2. 服务启动时读取 bootstrap config
3. 用户正常登录
4. 如果匹配 bootstrap 条件：
   - 授予 `platform_admin`
   - 记录审计日志
   - 更新 `deployment_bootstrap_state`
5. 如果 `LOCK_AFTER_INIT=1`：
   - 后续不再自动授予

#### UI 建议

第一版就应该有一个只对 platform admin 可见的页面：

- `/admin/auth/bootstrap`

显示：

- 当前 bootstrap 状态
- 当前 admin 列表
- bootstrap 是否已锁定
- 是否建议补第二个管理员

### 6.P.13 服务层建议

建议新增一组独立 service，不要把所有逻辑塞进一个大类：

- `AdminOverviewService`
- `EnvRegistryService`
- `GlobalSkillAdminService`
- `GlobalMCPAdminService`
- `OpsLogService`
- `AdminBootstrapService`
- `DeploymentHealthService`
- `SupportBundleService`

### 6.P.14 API 面建议

建议这样分：

1. **tRPC**
   - admin UI 主数据读取
   - admin mutations

2. **App Router Backend Route**
   - 日志流
   - support bundle 下载
   - 大文件导出

3. **OpenAPI**
   - 第一版不急着开放
   - 等 platform admin 模型稳定后再考虑

### 6.P.15 权限与开关建议

第一版必须至少有两个开关：

1. `enableAdminConsole`
   - 控制平台管理界面是否暴露

2. `enableAdminDangerZone`
   - 控制安装、删除、重置类高风险操作

权限判断必须至少分成：

- 普通登录用户
- space admin
- platform admin

### 6.P.16 测试建议

这一阶段至少要覆盖：

- 非 platform admin 无法访问 `/admin`
- env registry 会正确按 secret/missing/invalid 渲染
- secret 不会明文泄漏到 UI 或日志
- bootstrap token 只能消费一次
- bootstrap email 只在匹配用户登录时生效
- SSO group mapping 不会误授予
- skill 安装与 MCP 安装都会产生审计记录
- 日志中心查询不会把高频 stdout 原样灌进数据库

### 6.P.17 推荐改动落点

- Route：`src/routes/(main)/admin/*`
- Feature：`src/features/AdminConsole/*`
- Router：`src/server/routers/lambda/admin/*`
- Backend route：`src/app/(backend)/api/admin/*`
- Env schema：`src/envs/*`
- Global config：`src/server/globalConfig/*`
- MCP：`src/server/services/mcp/*`
- Skill：`src/server/services/skill/*`, `src/server/services/skillAggregator/*`
- Observability：`packages/observability-otel/*`
- Auth：`src/libs/better-auth/*`

### 6.P.18 验收标准

做到下面这些，才算这个阶段完成：

- 部署者首次进入系统后，能明确知道 “谁是平台管理员”
- 平台管理员有独立 `/admin` 控制台
- 能在一个地方看到部署健康、关键配置、provider、skill、MCP 状态
- env 能被注册、分类、脱敏并渲染成只读表单
- skill / MCP 的全局安装行为可查、可审计
- 有统一日志中心，而不是只能看容器 stdout
- admin bootstrap 机制明确、可审计、不会误授权

---

### 6.A 所有阶段通用实施动作

无论做哪个阶段，都建议按下面顺序推进：

1. **先写边界说明**
   - 这次改动的 canonical scope 是什么
   - 是 `userId`、`spaceId`，还是双作用域过渡
   - 会不会引入新表、新 service、新路由

2. **再补数据模型**
   - schema 先落库
   - migration 要保持 additive
   - 提前想清楚老数据怎么回填、空值怎么兼容、索引怎么建

3. **然后做服务层**
   - 先把核心语义集中到 service
   - 不要一开始就在多个 router /route/component 里散改
   - 所有跨链路复用逻辑都优先收敛到 service

4. **最后接 API 面**
   - 站内业务优先 tRPC
   - 协议型接口优先 App Router backend route
   - 外部开放能力优先 OpenAPI

5. **UI 放在链路闭环之后**
   - 先保证数据库、服务、接口是对的
   - 再补最小可用 UI
   - 第一版 UI 只服务调试、治理、验收，不追求 “大而全”

6. **必须带 feature flag 或 rollout 开关**
   - 特别是涉及执行链路、审批链路、作用域迁移的功能
   - 没有开关的改造，回滚成本会非常高

7. **必须准备观测面**
   - 至少能看成功率、失败率、错误类型、慢请求
   - 涉及执行链路时，要能按 `runId` 回查

8. **最后再做灰度与回填**
   - 先灰度新写入
   - 再回填老数据
   - 最后再收紧读取条件

### 6.B 所有阶段的上线与回滚要求

每个阶段上线前，至少要准备下面这些东西：

1. **上线前检查**
   - migration 在测试环境跑过
   - 老数据兼容路径已验证
   - 新旧链路是否会双写、双读，已经说明白
   - 关键接口已经有最小测试

2. **灰度方式**
   - 先给 internal /admin/debug 场景
   - 再逐步扩大到普通用户
   - 不要直接对全量对话链路开启

3. **观测指标**
   - 错误率
   - 延迟
   - 审批堆积量
   - workflow 卡住数量
   - 数据回填成功率

4. **回滚策略**
   - 优先逻辑回滚，不做 destructive migration 回滚
   - 关闭 feature flag 后旧链路仍可工作
   - 新增表和新增列默认都要允许 “回滚后暂时闲置”

5. **事后复盘**
   - 是否引入了新的平行系统
   - 是否有数据模型命名失真
   - 是否出现 user scope /space scope 混用

---

## 阶段 0：基线对齐与铺路

### 6.0.1 这一阶段的目标

先把 “现状事实” 和 “改造边界” 对齐，不急着上大功能。

### 6.0.2 为什么必须先做

如果阶段 0 不做，后面最容易发生 3 种事故：

- 用错作用域，把 user-scoped 逻辑当成 space-scoped 来设计
- 用错数据库方言，在 PostgreSQL 仓库里写出 SQLite 风格实现
- 新功能绕开已有 workflow /tool intervention /eval 能力，造成平行系统

### 6.0.3 具体要做什么

1. **文档基线统一**
   - 保证这份文档和真实代码一致
   - 在后续 RFC 里引用本文件，而不是复制粘贴旧方案

2. **主链路实体盘点**
   - 列出 `session/topic/thread/message/agent` 当前作用域
   - 列出 `space/resource/*` 当前作用域
   - 标明哪些地方未来需要接 `spaceId`

3. **执行链路盘点**
   - 找出所有发起模型调用的位置
   - 找出所有 tool execution 的进入点
   - 找出所有已有 stream event /trace field

4. **工作流盘点**
   - 列清楚 Workflow Studio 的输入、输出、持久化位置
   - 明确哪些部分只是 preview，哪些是长期可复用能力

5. **评测盘点**
   - 区分 `rag_eval_*` 和 `agent_eval_*`
   - 明确哪一套接 retrieval，哪一套接 agent benchmark

### 6.0.4 推荐改动落点

- 文档：`docs/architecture/*`
- 数据模型盘点：`packages/database/src/schemas/*`
- 执行入口盘点：`src/server/services/agentRuntime/`, `src/server/services/mobileChat/`, `src/server/services/toolExecution/`
- 工作流盘点：`src/server/services/mcp/workflowStudio.ts`, `src/server/routers/lambda/workflowStudio.ts`

### 6.0.5 交付物

- 一份统一的中文架构基线文档
- 一份 conversation scope /resource scope 映射表
- 一份 run 候选接入点清单
- 一份 Workflow Studio 能力清单

### 6.0.6 验收标准

- 团队可以明确回答 “哪些表是 user-scoped，哪些表是 space-scoped”
- 新方案评审时不再出现 “现状已经是 workspace native” 的误判
- 后续阶段的表设计不再出现 SQLite 方言

---

## 阶段 1：建立 Canonical Run 记录

### 6.1.1 这一阶段的目标

为常规执行链路引入统一的 `run` 概念，先把 “执行发生过什么” 记录下来。

### 6.1.2 为什么优先做这个

后面这些能力都依赖 run：

- 成本统计
- 延迟统计
- tool audit
- workflow execution
- replay
- 企业审计

如果没有 canonical run，后面的能力都会各自记一套 “半成品执行记录”。

### 6.1.3 这一阶段不要做什么

不要一上来就：

- 把所有会话核心表整体迁到 `spaceId`
- 把 workflow 也一起做完
- 追求一步到位的 replay snapshot

阶段 1 只做一件事：

- 给主执行链路补一条统一 run 账本

### 6.1.4 数据库建议

建议新增最小可用的 `runs` 表。

最小字段建议：

- `id`
- `userId`
- `spaceId`：先允许为空
- `topicId`
- `threadId`
- `messageId`
- `parentRunId`
- `status`
- `executionKind`
  - `chat`
  - `tool_loop`
  - `workflow_step`
  - `eval`
- `triggerType`
  - `manual`
  - `scheduled`
  - `api`
  - `workflow`
- `model`
- `provider`
- `inputTokens`
- `outputTokens`
- `totalCost`
- `firstTokenMs`
- `totalDurationMs`
- `metadata`
- `error`
- `createdAt`
- `updatedAt`

第一版不要急着建太多子表。

建议顺序：

1. 先有 `runs`
2. 再视需要补 `run_events`
3. 最后再补 `run_snapshots`

### 6.1.5 服务层建议

建议新增：

- `src/server/services/run/RunService.ts`

职责只做这些：

- `createRun`
- `markRunning`
- `markCompleted`
- `markFailed`
- `attachUsage`
- `attachLatency`
- `appendMetadata`

不要把业务逻辑塞到 `RunService` 里。

`RunService` 的职责是：

- 维护执行记录
- 不负责执行本身

### 6.1.6 接入点建议

优先接这些入口：

1. `src/server/services/agentRuntime/`
   - 作为主 agent 执行链路的 run 发起入口
2. `src/server/services/mobileChat/`
   - 保证 webapi/mobile 类流式执行也能创建 run
3. `src/server/modules/AgentRuntime/`
   - 在 step/tool 执行层补充 run 关联

建议做法：

- 在 “准备开始一次模型执行” 时创建 run
- 在真正进入模型调用前把状态改成 `running`
- 在拿到 usage /completion 时回填 token、cost、latency
- 失败时统一打到 `failed`

### 6.1.7 与现有 Thread 的关系

要明确：

- `thread` 不是 `run`
- `thread` 是会话内的一种执行分支 / 组织结构
- `run` 是一次执行账本

第一版允许：

- 一个 thread 对应多个 run
- 一个 run 挂到某个 thread

不要把二者强行做成一一对应。

### 6.1.8 tRPC / API 面建议

阶段 1 先做最小管理面：

- `src/server/routers/lambda/run.ts`

建议只提供：

- `get`
- `list`
- `cancel`（如果当前链路已支持）

第一版先给内部 UI / 调试用，不急着暴露 OpenAPI。

### 6.1.9 前端建议

第一版 UI 不要做大而全控制台。

优先级：

1. 内部调试视图
2. topic/thread 详情里的 run 摘要
3. admin 视角列表

第一版只需要能看到：

- run 状态
- model/provider
- token
- duration
- error

### 6.1.10 测试建议

必须覆盖：

- 正常完成
- tool loop 中间失败
- provider 返回 usage
- provider 不返回 usage
- stream 提前中断
- 同一 thread 多次 run

### 6.1.11 验收标准

- 能查询任意一次主要执行的 run
- 失败执行能定位到 run
- 后续 tool audit 能拿到 `runId`
- workflow /replay 设计不需要重新发明执行主键

---

## 阶段 2：Tool 审批、策略与审计

### 6.2.1 这一阶段的目标

把现有的 tool human intervention 升级成真正可治理、可审计、可配置的企业能力。

### 6.2.2 先认清现状

当前已经有：

- tool manifest 的 `humanIntervention`
- conversation runtime 的 approve /reject/continue

当前缺的是：

- 持久化策略
- 持久化审批请求
- 统一 audit log
- 管理员视角配置

### 6.2.3 推荐拆成 3 个子能力

这一阶段不要一锅端。

建议拆成：

1. **2A - Tool Audit**
2. **2B - Tool Policy**
3. **2C - Tool Approval Request**

原因：

- audit 最容易落地，也最少争议
- policy 需要 scope 设计
- approval request 需要和 UI / 通知 /resume 流程联动

### 6.2.4 2A：先做 Tool Audit

建议新增：

- `tool_audit_logs`

建议字段：

- `id`
- `userId`
- `spaceId`
- `topicId`
- `threadId`
- `messageId`
- `runId`
- `toolType`
- `toolIdentifier`
- `toolName`
- `request`
- `response`
- `status`
- `startedAt`
- `completedAt`

服务层建议：

- `src/server/services/toolAudit/ToolAuditService.ts`

职责：

- `startAudit`
- `finishAudit`
- `failAudit`

接入位置：

- `src/server/services/toolExecution/`

原则：

- 不改掉当前执行语义
- 只在开始 / 结束 / 失败时插入审计记录

### 6.2.5 2B：再做 Tool Policy

建议新增：

- `tool_approval_policies`

作用域建议先支持：

- `global`
- `user`
- `space`

不要第一版就做太复杂的多级覆盖。

第一版策略决策顺序建议：

1. 精确 `space + tool`
2. 精确 `user + tool`
3. `global + tool`
4. fallback 到 manifest 自带 humanIntervention

服务层建议：

- `src/server/services/toolGovernance/ToolPolicyResolver.ts`

职责：

- 根据当前执行上下文算出最终 policy

### 6.2.6 2C：最后做 Approval Request

建议新增：

- `tool_approval_requests`

建议字段：

- `id`
- `userId`
- `spaceId`
- `topicId`
- `threadId`
- `messageId`
- `runId`
- `toolIdentifier`
- `toolName`
- `request`
- `status`
  - `pending`
  - `approved`
  - `rejected`
  - `expired`
- `requestedBy`
- `decidedBy`
- `decision`
- `createdAt`
- `decidedAt`

### 6.2.7 服务拆分建议

这一阶段建议拆成 3 个 service：

- `ToolPolicyResolver`
- `ToolApprovalService`
- `ToolAuditService`

不要把全部逻辑塞进 `ToolExecutionService`。

`ToolExecutionService` 应该只负责：

- 调用执行器
- 在合适的点接 governance service

### 6.2.8 接入执行链路的建议顺序

顺序建议：

1. 进入 `ToolExecutionService`
2. 创建 audit start
3. 解析 policy
4. 如果需要审批：
   - 创建 approval request
   - 返回等待态
5. 如果不需要审批：
   - 直接执行
6. 更新 audit end/fail

### 6.2.9 路由建议

建议新增 tRPC 路由：

- `src/server/routers/lambda/toolAudit.ts`
- `src/server/routers/lambda/toolApproval.ts`
- `src/server/routers/lambda/toolPolicy.ts`

第一版功能建议：

- `toolAudit.list`
- `toolAudit.get`
- `toolApproval.listPending`
- `toolApproval.approve`
- `toolApproval.reject`
- `toolPolicy.get`
- `toolPolicy.upsert`

### 6.2.10 UI 建议

UI 不要从聊天界面开始做全量复杂体验。

建议顺序：

1. 聊天侧显示 “等待审批”
2. 一个简单的 admin pending approvals 列表
3. 一个 tool policy 设置页
4. 一个 tool audit 查询页

### 6.2.11 测试建议

至少覆盖：

- builtin /plugin/ MCP 三类工具都能打 audit
- policy fallback 顺序正确
- 被要求审批时不会直接执行
- approve 后可恢复执行
- reject 后状态一致
- 没有 `spaceId` 的 user-scoped 执行也能工作

### 6.2.12 验收标准

- 可以查询某次 tool call 的 request/response/status
- 可以通过策略让工具进入审批流
- approval request 与现有 approve/reject 语义一致
- tool audit 能挂到 `runId`

---

## 阶段 3：Workflow Studio 对齐，建立 Canonical Workflow Runtime

### 6.3.1 这一阶段的目标

把现有 Workflow Studio 从 “草稿 / 预览能力” 逐步对齐到可持久化、可执行、可审计的 workflow runtime。

### 6.3.2 第一原则

不要新起第二套互不兼容的 workflow DSL。

先决定：

- Workflow Studio draft 是不是 source of truth
- runtime 是直接执行 draft，还是执行编译后的 normalized form

### 6.3.3 数据模型建议

建议先加两张表：

- `workflow_definitions`
- `workflow_executions`

`workflow_definitions` 最小字段：

- `id`
- `userId`
- `spaceId`
- `source`
  - 建议第一版固定为 `workflow_studio`
- `name`
- `draft`
- `compiled`
- `version`
- `createdAt`
- `updatedAt`

`workflow_executions` 最小字段：

- `id`
- `workflowDefinitionId`
- `userId`
- `spaceId`
- `runId`
- `status`
- `input`
- `output`
- `currentNodeId`
- `stepStates`
- `error`
- `startedAt`
- `completedAt`

### 6.3.4 服务层建议

建议新增：

- `src/server/services/workflow/WorkflowDefinitionService.ts`
- `src/server/services/workflow/WorkflowCompiler.ts`
- `src/server/services/workflow/WorkflowExecutionService.ts`

职责划分：

`WorkflowDefinitionService`

- 保存定义
- 读取定义
- 版本管理

`WorkflowCompiler`

- Workflow Studio draft -> normalized executable graph
- 校验边合法性
- 处理默认 policy /timeout/retry

`WorkflowExecutionService`

- 启动执行
- 推进状态
- 记录 step state
- 绑定 run

### 6.3.5 与现有 Workflow Studio 的衔接建议

推荐做法：

1. 保留现有 Workflow Studio UI
2. 保存时从 user settings 迁移到 `workflow_definitions`
3. preview 仍可走当前 preview service
4. 真正执行走新的 execution service

不要一上来就把 preview 和 execution 混成同一条链路。

### 6.3.6 执行模型建议

第一版 workflow node 类型不要太多。

先收敛到：

- input
- tool
- agent
- transform
- chat-output

高级节点以后再加。

### 6.3.7 与 Run 的关系

一定要绑定 `run`。

推荐方式：

- workflow execution 自己有一条 execution 记录
- 关键 step 或整次执行对应到一条或多条 `run`

不要做成 workflow execution 完全脱离 run。

### 6.3.8 审批节点建议

审批不要另起一套语义。

建议：

- workflow 里的 approval checkpoint 最终落到统一审批模型
- 能复用 tool approval 的地方尽量复用
- 不能复用时，也要共享 decision/audit 结构

### 6.3.9 路由建议

建议新增：

- `src/server/routers/lambda/workflow.ts`

最小接口：

- `create`
- `update`
- `get`
- `list`
- `execute`
- `getExecution`
- `resume`
- `cancel`

### 6.3.10 UI 建议

分两步：

1. 先做 “保存 + 执行 + 查看 execution”
2. 再做更复杂的 studio 管理与审批视图

第一版 UI 不追求可视化大屏，先保证链路闭环。

### 6.3.11 测试建议

至少覆盖：

- 保存 draft -> 编译 -> 执行
- invalid edge /invalid node 被拒绝
- tool node 正常执行
- agent node 正常执行
- transform node 正常产出
- execution status 正确推进
- workflow 与 run 关联正确

### 6.3.12 验收标准

- Workflow Studio 不再只是 user settings 的孤立草稿
- workflow execution 可查询
- execution 和 run 可以关联
- 后续审批、成本、回放能挂上 workflow execution

---

## 阶段 4：对话执行逐步 Workspace Native 化

### 6.4.1 这一阶段的目标

逐步把 “对话执行链路” 从纯 user-scoped，过渡到可被 workspace 治理。

### 6.4.2 这是高风险阶段

这是整个路线里风险最高的一段。

因为它会碰：

- `sessions`
- `topics`
- `threads`
- `messages`
- `agents`

所以阶段 4 必须在前面这些能力已经稳定之后再做：

- canonical runs
- tool governance
- workflow runtime

### 6.4.3 第一版迁移建议

不要直接 “大迁移”。

建议分 4 步：

1. **加 nullable `spaceId`**
   - 给会话核心表逐步补 `spaceId`
2. **补默认 personal space 映射**
   - 为现有用户数据推导 personal space
3. **双读双写过渡**
   - 新链路优先写 `spaceId`
   - 老链路仍保留 `userId`
4. **收敛查询入口**
   - 新的治理逻辑优先走 `spaceId + userId`

### 6.4.4 数据库建议

优先级建议：

1. `agents`
2. `topics`
3. `threads`
4. `messages`
5. `sessions`

原因：

- `agent` 和 `topic/thread/message` 更直接参与治理与执行
- `session` 作为组织层可以稍后收束

### 6.4.5 服务层建议

这一阶段不要散改。

建议先收敛几个 “总入口”：

- `topic` 读写服务
- `message` 读写服务
- `agent` 读写服务
- 创建对话的入口

把对 `spaceId` 的补齐逻辑优先集中在入口层，而不是在几十个调用点分散判断。

### 6.4.6 权限建议

第一版不要试图让 workspace 权限全面接管聊天可见性。

建议先实现：

- 新建对象时带上 `spaceId`
- 管理态 / 审计态 /run/tool policy 读取时用 `spaceId`
- 聊天内容可见性先维持现有 user 主导逻辑

等数据归属稳定后，再考虑更细的 workspace content access model。

### 6.4.7 迁移顺序建议

顺序建议：

1. schema 加列
2. 写入链路补 `spaceId`
3. 后台脚本回填老数据
4. 查询链路逐步补 filter
5. audit /run/workflow 逐步改成优先按 `spaceId` 聚合

### 6.4.8 风险点

最大风险：

- 数据混到错误 space
- 老数据没有 personal space fallback
- 查询逻辑漏 filter
- 旧接口还只按 `userId` 查，导致治理面和业务面结果不一致

### 6.4.9 测试建议

必须覆盖：

- personal space 用户
- team space 用户
- 老数据无 `spaceId`
- 新数据有 `spaceId`
- `userId + spaceId` 联合查询
- run /audit/workflow 聚合按 space 读取

### 6.4.10 验收标准

- 新建执行链路都能带 `spaceId`
- 老数据不丢失、不串空间
- governance 面能按 workspace 聚合查询
- 没有明显的 user/space scope 混乱

---

## 阶段 5：企业治理能力补齐

### 6.5.1 这一阶段的目标

把企业常见控制面补齐：

- SCIM
- IP 策略
- 会话策略
- 合规导出 / 删除

### 6.5.2 推荐拆分顺序

不要并行一口气全做。

建议顺序：

1. SCIM
2. IP allowlist / denylist
3. session policy
4. compliance export / deletion

### 6.5.3 5A：SCIM

推荐入口：

- App Router backend route，单独协议面

原因：

- SCIM 是标准协议，和站内 tRPC 不是一个层面的事

建议目录：

- `src/app/(backend)/api/scim/`
- `src/server/services/scim/`

第一版只做：

- user provisioning
- group / space mapping
- token auth

先不要做太复杂的扩展属性同步。

### 6.5.4 5B：IP 策略

建议模型：

- `ip_allowlist`
- `ip_deny_list`

建议中间件接入点：

- tRPC auth 后
- App Router 需要受保护的 backend route

先做的能力：

- allowlist
- denylist
- 审计记录

先不要做：

- 复杂地理位置策略
- 动态风险评分

### 6.5.5 5C：Session Policy

建议目标：

- 限制并发 session 数量
- idle timeout
- absolute timeout
- sensitive action re-auth

接入原则：

- 建立在 Better Auth 之上
- 不要搞第二套登录态系统

### 6.5.6 5D：合规导出与删除

建议先实现：

- 导出任务申请
- 导出文件生成
- 下载有效期
- 删除申请与审计记录

先不要做：

- 多地区合规差异自动化
- 复杂 retention orchestration

### 6.5.7 测试建议

这一阶段重点测：

- 协议正确性
- 管理员权限
- 审计可回溯
- 边界条件

### 6.5.8 验收标准

- 企业管理员可以配置并观察这些策略
- 所有敏感操作都有 audit
- 不会引入第二套身份主系统

---

## 阶段 6：回放、成本控制台与评测对齐

### 6.6.1 这一阶段的目标

把前面已经建立的 run /workflow/tool audit 进一步沉淀成调试与运营能力。

### 6.6.2 应该补什么

建议拆成 3 条线：

1. **Replay**
   - run snapshot
   - 重放输入
   - 对比结果
2. **成本 / 延迟控制台**
   - 按 model/provider/workspace 聚合
3. **Eval 对齐**
   - 让 eval 与 run 互相引用

### 6.6.3 Replay 建议

不要一开始捕获 “全量上下文所有细节”。

建议先捕获：

- 输入消息
- tool call 结果
- model/provider
- usage
- 关键上下文摘要

等稳定后再补更深的 snapshot。

### 6.6.4 Cost Dashboard 建议

先做后台统计视图，不要先做复杂 BI。

最小聚合维度：

- workspace
- user
- model
- provider
- 日期

### 6.6.5 Eval 对齐建议

目标不是重写 eval 系统，而是把它们挂到 run：

- `rag_eval_*` 可以引用 retrieval 相关 run
- `agent_eval_*` 可以引用 agent execution run

这样后续才能回答：

- 哪个 benchmark 用了哪种模型
- 哪次评测花了多少钱
- 哪次评测失败在哪个 step

### 6.6.6 验收标准

- 能从 run 点进 replay
- 能从 eval 点进 run
- 能按 workspace/model 看成本与延迟

---

## 7. 每个阶段统一实施模板

以后写阶段方案，统一按这个模板写。

### 7.1 必写内容

每个阶段都必须写清楚：

1. 目标
2. 为什么现在做
3. 不做什么
4. 数据模型
5. 服务层
6. 路由 / API 面
7. UI
8. 测试
9. 风险
10. 验收标准

### 7.2 必须回答的问题

每个阶段都必须回答：

- 作用域是 `userId`、`spaceId` 还是两者都有？
- 是复用现有能力，还是新增系统？
- 会不会引入平行 DSL / 平行账本 / 平行权限模型？
- schema 是否是 PostgreSQL 语义？
- 能不能回链到 `run`？

### 7.3 推荐 PR 拆分方式

如果一个阶段比较大，建议不要一个 PR 全塞完。

推荐拆法：

1. **PR 1：schema + migration**
   - 只做表、列、索引、类型
   - 不掺业务逻辑

2. **PR 2：service + repository/model**
   - 把核心读写语义收进 service
   - 补单测

3. **PR 3：router /backend route 接入**
   - 只把服务能力挂到入口
   - 不急着做复杂 UI

4. **PR 4：最小 UI / 管理面**
   - 先做 debug /admin/detail 面板
   - 验证链路闭环

5. **PR 5：灰度开关、回填脚本、观测**
   - 这是最容易被漏掉的一层
   - 但在执行链路改造里非常关键

### 7.4 上线前检查清单

每次阶段性合并前，至少逐项确认：

1. 有没有 feature flag
2. 有没有回填脚本或兼容方案
3. 有没有 admin/debug 可见性
4. 有没有最小集成测试
5. 有没有错误审计或运行日志
6. 有没有说明旧链路何时下线

---

## 8. 决策启发式

当出现多个技术方案时，优先选择更符合下面特性的方案：

- **可审计**
- **权限安全**
- **可回放**
- **可自托管**
- **可组合**
- **策略可感知**
- **运维可读**

拒绝这些方案：

- 看起来强大，但没有治理边界
- 能跑，但不可审计
- 很灵活，但与现有代码完全脱节
- 为了 “全新设计” 而强行绕开现有能力

---

## 9. 关键文件索引

| 领域                | 关键位置                                                                                                                                     |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth                | `src/auth.ts`, `src/libs/better-auth/`, `src/libs/trpc/lambda/`, `src/app/(backend)/oidc/`                                                   |
| Database            | `packages/database/src/schemas/`, `packages/database/src/models/`                                                                            |
| Resource Governance | `packages/database/src/schemas/resource.ts`, `src/server/services/resource/`                                                                 |
| tRPC                | `src/server/routers/`, `src/libs/trpc/lambda/`                                                                                               |
| App Router Backend  | `src/app/(backend)/`                                                                                                                         |
| OpenAPI             | `packages/openapi/src/`                                                                                                                      |
| Platform Config     | `src/envs/`, `src/server/globalConfig/`, `src/server/featureFlags/`                                                                          |
| Agent Runtime       | `packages/agent-runtime/`, `src/server/services/agentRuntime/`, `src/server/modules/AgentRuntime/`                                           |
| Context Pipeline    | `packages/context-engine/src/`                                                                                                               |
| Tool Execution      | `src/server/services/toolExecution/`, `packages/builtin-tool-*/`                                                                             |
| Skill System        | `src/server/services/skill/`, `src/server/services/skillAggregator/`, `packages/builtin-tool-skills/`                                        |
| Workflow Studio     | `src/server/services/mcp/workflowStudio.ts`, `src/server/routers/lambda/workflowStudio.ts`                                                   |
| MCP                 | `src/server/services/mcp/`, `src/server/routers/tools/mcp.ts`, `packages/types/src/plugins/mcp.ts`                                           |
| Knowledge / RAG     | `src/server/services/document/`, `src/server/services/rag/`, `packages/database/src/schemas/file.ts`, `packages/database/src/schemas/rag.ts` |
| Eval                | `packages/database/src/schemas/ragEvals.ts`, `packages/database/src/schemas/agentEvals.ts`                                                   |
| Observability       | `packages/observability-otel/`, `src/server/services/resource/`, `src/server/routers/lambda/space.ts`                                        |
| Frontend            | `src/routes/`, `src/features/`, `src/store/`                                                                                                 |

---

## 10. 最后一句话

后续所有架构决策，都要同时满足三件事：

1. 对得上当前代码库事实
2. 能通向 workspace /tooling/run 一等公民化
3. 不制造新的平行系统

---

_最后更新：2026-03-26_
_版本：3.0_
