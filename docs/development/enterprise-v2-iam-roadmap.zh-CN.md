# LobeHub 企业版二期工程文档（IAM + 多租户 + 审计）

> 版本：v1.1\
> 日期：2026-03-12\
> 目的：基于现有后端实现与《后端审计报告》进行核验与优化，形成可执行的企业版二期路线图。

## 1. 执行摘要

当前代码库已经具备企业化的 “身份接入基础”（Better Auth + OIDC + OpenAPI RBAC），但主业务链路仍以 “登录态” 驱动，未形成统一授权与租户隔离体系。

二期目标不是一步到位做 ABAC 大平台，而是完成以下三件事：

1. 把高风险安全缺口先封住（WebAPI 弱鉴权、文件代理未鉴权）。
2. 把权限能力从 OpenAPI 扩展到 TRPC/WebAPI 主路径。
3. 建立组织 / 工作区数据边界和审计日志，满足企业自托管最小可用闭环。

## 2. 对原报告的核验与修正

## 2.1 已确认结论

1. 单租户现状成立：当前无 `tenantId` / `organizationId` / `workspaceId` 业务字段。
2. RBAC 四表存在并可用：`rbac_roles`、`rbac_permissions`、`rbac_role_permissions`、`rbac_user_roles`。
3. OIDC 持久化模型完备：授权码、AccessToken、RefreshToken、Client、Consent 等表已存在。
4. TRPC 主业务路由未接入 RBAC 检查（以 `authedProcedure` + `userId` 为主）。
5. 文件代理 `/f/:id` 当前无认证与授权，存在 IDOR 风险。
6. Tool 执行统一入口为 `ToolExecutionService.executeTool`，可作为工具级权限治理注入点。

## 2.2 需要修正的点

1. 表数量不是 68。\
   当前迁移快照（`packages/database/migrations/meta/0090_snapshot.json`）为 **85 张表**。

2. OpenAPI RBAC 并非 “仅表存在未落地”。\
   `packages/openapi` 已全局启用 `userAuthMiddleware`，并在各资源路由使用 `requireAnyPermission(...)`。

3. “XOR 鉴权” 风险需要上调优先级。\
   不仅存在固定密钥 `SECRET_XOR_KEY = 'LobeHub · LobeHub'`，且 `checkAuthMethod` 当前无拒绝分支，导致 WebAPI 存在弱鉴权路径。

## 2.3 新增关键发现（高优先级）

1. WebAPI 鉴权逻辑过弱（P0）。\
   `src/app/(backend)/middleware/auth/utils.ts` 中 `checkAuthMethod` 无 `throw`，在无会话、无 API Key 的情况下也不会拒绝。

2. TRPC 存在多处 `publicProcedure` 兼容入口（P1）。\
   如 `plugin.getPlugins`、`mobile/topic.getTopics`、`session.getGroupedSessions` 等，虽大多对匿名返回空数据，但治理上应收敛为一致授权语义。

3. NoAuth/Debug 旁路需生产硬阻断（P0）。\
   `NOAUTH_MODE` / 开发旁路路径存在，必须在生产环境启动阶段 fail-fast。

## 2.4 证据锚点（代码位置）

1. TRPC 仅登录校验：`src/libs/trpc/lambda/index.ts`、`src/libs/trpc/middleware/userAuth.ts`。
2. WebAPI XOR 头解析：`src/app/(backend)/middleware/auth/index.ts`、`packages/utils/src/server/xor.ts`、`src/envs/auth.ts`。
3. WebAPI 弱鉴权函数：`src/app/(backend)/middleware/auth/utils.ts`。
4. 文件代理公开访问：`src/app/(backend)/f/[id]/route.ts`、`packages/database/src/models/file.ts`。
5. OpenAPI RBAC 已接入：`packages/openapi/src/middleware/auth.ts`、`packages/openapi/src/middleware/permission-check.ts`。
6. TRPC public 兼容入口样例：`src/server/routers/lambda/plugin.ts`、`src/server/routers/mobile/topic.ts`、`src/server/routers/lambda/session.ts`。
7. Tool 统一执行入口：`src/server/services/toolExecution/index.ts`。

## 3. 二期范围定义

## 3.1 In Scope（本期必须完成）

1. 统一认证与授权基线（TRPC + WebAPI + OpenAPI）。
2. 组织 / 工作区多租户基础模型与核心资源归属迁移。
3. 工具调用权限治理（至少到 workspace/role 级别）。
4. 安全审计日志（可检索、可导出、可追责）。

## 3.2 Out of Scope（本期不做）

1. 完整 ABAC 策略引擎（如 OPA/Cedar 全量落地）。
2. 全库 85 表一次性租户化改造。
3. 复杂跨区域合规（数据驻留、跨境策略自动编排）。

## 3.3 二期成功标准（DoD）

1. 安全：P0 鉴权缺口全部关闭，且新增高危路径必须有回归用例。
2. 一致性：TRPC/WebAPI/OpenAPI 对同一动作的授权结论一致。
3. 隔离：组织边界与工作区边界可被自动化测试验证。
4. 可运维：关键安全事件可查询、可导出、可追责（含 requestId）。

## 4. 目标架构（To-Be）

## 4.1 身份层（AuthN）

统一 `Principal` 抽象，支持三类主体：

1. `user`：Better Auth Session / OIDC JWT。
2. `service`：Service Account Token（新增）。
3. `api_key`：用户 Personal API Key（已存在，纳入统一校验器）。

要求：所有入口在网关层先解析为 `Principal`，禁止业务路由自行拼鉴权逻辑。

## 4.2 授权层（AuthZ）

统一 `authorize(principal, action, resource, context)` 接口，第一期策略为 RBAC + Scope：

1. Scope：`ALL` / `ORG` / `WORKSPACE` / `OWNER`。
2. 资源决策：先判动作权限，再判资源归属。
3. 结果写入审计日志（allow/deny + reason）。

## 4.3 租户层（Tenancy）

采用两层模型：

1. Organization（企业边界）。
2. Workspace（业务协作边界，资源默认归属 workspace）。

个人用户默认自动创建 Personal Workspace，保证兼容单人使用场景。

## 4.4 审计层（Audit）

新增不可变审计事件：

1. 身份事件：登录、登出、令牌失败、策略拒绝。
2. 管理事件：成员、角色、策略、密钥、集成配置变更。
3. 数据事件：导出、删除、分享、权限变更。

## 5. 分阶段实施计划

## Phase 0（2 周）：安全止血

目标：先堵住可被直接利用的缺口。

交付项：

1. 修复 WebAPI 弱鉴权：`checkAuthMethod` 必须显式拒绝无效身份。
2. `/f/:id` 强制鉴权 + 资源归属校验（或签名 URL + 一次性 token）。
3. 生产环境禁用 `NOAUTH_MODE` /debug bypass（启动即失败）。
4. 引入统一错误码：`AUTH_INVALID`、`AUTH_EXPIRED`、`PERMISSION_DENIED`。

验收标准：

1. 未登录与伪造头部无法访问 WebAPI 受保护接口。
2. 任意 fileId 不可跨用户读取。
3. 生产配置误开旁路会阻断启动。

## Phase 1（3-4 周）：统一授权基线

目标：把 OpenAPI 已有 RBAC 能力扩展到 TRPC/WebAPI 主链路。

交付项：

1. 新增通用中间件：`authedWithPolicyProcedure`（TRPC）。
2. WebAPI 引入 `requirePermission(...)` 语义，与 OpenAPI 对齐。
3. 建立权限矩阵清单（路由 -> action -> scope）。
4. 收敛 `publicProcedure` 兼容接口，逐步改为受控授权入口。

验收标准：

1. TRPC 高风险路由（用户、文件、会话、消息、知识库）覆盖率 >= 90%。
2. 所有拒绝返回结构化 reason，且写审计日志。

## Phase 2（4-6 周）：组织 / 工作区模型

目标：建立企业级隔离边界并完成首批数据迁移。

新增核心表：

1. `organizations`
2. `organization_members`
3. `workspaces`
4. `workspace_members`
5. `workspace_roles`（或映射表）

首批改造资源表（优先）：

1. `sessions`、`topics`、`messages`
2. `files`、`knowledge_bases`
3. `user_installed_plugins`、`api_keys`

迁移策略：

1. 先加 nullable 字段 + 双写。
2. 批量回填默认 personal workspace。
3. 校验后切换为 not null + 新索引。
4. 保留回滚开关与只读降级方案。

验收标准：

1. 组织间数据不可见。
2. 工作区内权限生效。
3. 存量用户零数据丢失迁移完成。

## Phase 3（3-4 周）：工具权限与凭据治理

目标：避免 “工具能力越权读取”。

交付项：

1. 新增 `tool_policies`（workspace/role 维度 allow/deny）。
2. 在 `ToolExecutionService.executeTool` 增加前置授权钩子。
3. 凭据所有权模型：`user` / `workspace` / `system`。
4. 高风险工具（外部写操作）支持审批或二次确认策略。

验收标准：

1. 未授权用户无法调用受限工具。
2. system 凭据调用有审计留痕与可追责主体。

## Phase 4（2-3 周）：审计与运维闭环

目标：满足企业审计和运维最小要求。

交付项：

1. `audit_logs` 表 + 查询 API + 导出 API。
2. 风险告警规则：权限提升、批量删除、登录异常。
3. 管理员最小控制台（成员、角色、审计、会话）。

验收标准：

1. 关键操作 100% 可追踪。
2. 审计查询支持时间、主体、资源、动作过滤。
3. 导出满足企业取证需求。

## 6. 关键工程设计

## 6.1 统一策略接口

建议在 server 层新增统一策略服务：

```ts
interface AuthorizationRequest {
  principal: Principal;
  action: string;
  resource: { type: string; id?: string; ownerId?: string; workspaceId?: string };
  context?: { ip?: string; userAgent?: string; requestId?: string };
}

interface AuthorizationDecision {
  allow: boolean;
  reason: string;
  matchedPolicy?: string;
}
```

所有入口（TRPC/WebAPI/OpenAPI）只调用该接口，不直接操作 RbacModel。

## 6.2 数据迁移原则

1. 先扩展字段，再迁移流量，再收紧约束。
2. 每一步必须可回滚。
3. 迁移期间保障读兼容（老字段 + 新字段并存）。

## 6.3 兼容策略

1. 对旧客户端保留短期兼容接口（带 sunset 计划）。
2. 对 `publicProcedure` 兼容路由加监控与访问审计。
3. 对自托管升级提供 SQL + 校验脚本 + 回滚脚本。

## 6.4 数据模型最小草案（新增）

1. `organizations`：`id`、`name`、`owner_user_id`、`created_at`、`updated_at`。
2. `organization_members`：`organization_id`、`user_id`、`status`、`joined_at`，唯一索引 `(organization_id, user_id)`。
3. `workspaces`：`id`、`organization_id`、`name`、`type(personal|team)`、`created_by`。
4. `workspace_members`：`workspace_id`、`user_id`、`role_id`、`invited_by`、`joined_at`。
5. `audit_logs`：`id`、`organization_id`、`workspace_id`、`actor_type`、`actor_id`、`action`、`resource_type`、`resource_id`、`decision`、`reason`、`request_id`、`ip`、`user_agent`、`created_at`。
6. `tool_policies`：`workspace_id`、`subject_type(user|role)`、`subject_id`、`tool_identifier`、`effect(allow|deny)`、`constraints(jsonb)`。

约束与索引要求：

1. 所有二期核心资源表补充 `(organization_id, workspace_id)` 复合索引。
2. 审计表按 `created_at` 分区或冷热分层（按自托管规模配置）。
3. `audit_logs` 与业务主链路解耦，写入失败不阻断主请求（异步补偿）。

## 6.5 路由治理基线（统一模板）

1. 每个接口必须声明 `action` 与 `resourceType`。
2. 进入业务逻辑前必须完成 `authorize(...)`。
3. 产生 side effect 的请求必须写 `audit_logs`。
4. `publicProcedure` 只允许健康检查、显式公开分享、市场公开资源三类场景。

## 7. 测试与发布策略

## 7.1 测试矩阵

1. 单元测试：鉴权解析、权限决策、策略命中。
2. 集成测试：TRPC/WebAPI/OpenAPI 三入口一致性。
3. 安全测试：IDOR、越权、伪造头、重放、旁路开关。
4. 迁移测试：大样本回填、索引影响、回滚演练。

## 7.2 发布方式

1. Feature Flag 分段发布（按入口与路由组）。
2. Canaries 先开只读审计，再开强制拦截。
3. 关键错误码看板：401/403 比例、拒绝原因 TopN。

## 7.3 NFR / SLO（企业自托管最小要求）

1. 授权决策 P95 延迟 < 20ms（缓存命中场景）。
2. 审计日志丢失率 < 0.01%（按 24h 对账）。
3. 权限变更传播时延 < 60s（含缓存失效）。
4. 默认限流：写接口按用户 / 工作区双维度限流，可配置。

## 8. 风险清单与缓解

1. 迁移跨度大导致回归风险高。\
   缓解：先核心表、双写阶段拉长、灰度切流。

2. 权限收紧可能误伤历史功能。\
   缓解：Shadow decision（先记录不拦截）2 周。

3. 自托管环境差异大。\
   缓解：提供环境体检脚本与升级前置检查。

## 9. 里程碑与人力建议

建议节奏：14-19 周（按 4-6 名后端 + 1-2 名前端 + 1 名测试）。

1. M0-M1（5-6 周）：安全止血 + 统一授权。
2. M2（4-6 周）：组织 / 工作区模型与迁移。
3. M3-M4（5-7 周）：工具治理 + 审计闭环。

## 10. 企业自托管必备能力清单（本期落地）

1. 企业身份接入：OIDC 已有，补齐 SAML（若当前版本无）与 JIT 用户映射策略。
2. 用户生命周期：邀请、禁用、离职回收、强制登出、会话吊销。
3. 角色治理：预置角色模板（Owner/Admin/Member/Viewer）+ 自定义角色。
4. API 安全：个人 API Key 生命周期管理（到期、轮换、审计）。
5. 密钥治理：workspace/system 凭据分层托管、可轮换、可追踪使用记录。
6. 合规取证：审计日志导出（JSONL/CSV）、时间范围签名校验。
7. 运维能力：配置体检、升级前检查、迁移 dry-run、失败回滚手册。

## 11. 分工建议（Epic 视角）

1. Epic A - 安全止血：WebAPI 鉴权、文件代理、NoAuth 生产阻断。
2. Epic B - 统一授权：策略接口、TRPC/WebAPI 接入、权限矩阵。
3. Epic C - 多租户核心：组织 / 工作区表、核心资源迁移、双写切流。
4. Epic D - Tool 治理：tool policy、凭据 owner 模型、高风险审批。
5. Epic E - 审计闭环：审计事件模型、查询导出、风险告警规则。

依赖关系：

1. Epic A 完成后才能推进外部自托管试点。
2. Epic B 是 Epic C/D 的前置依赖。
3. Epic E 需随 Epic B 同步接入埋点，避免后补全量返工。

## 12. 本文档对应的立即行动项（下周可开工）

1. 立刻修复 `checkAuthMethod` 的拒绝逻辑并补安全回归测试。
2. 为 `/f/:id` 增加鉴权与 owner 校验。
3. 冻结新增 `publicProcedure`（除健康检查 / 显式公开资源）。
4. 输出路由权限矩阵 v1（覆盖 TRPC/WebAPI/OpenAPI）。
5. 建立 `audit_logs` 最小 schema 并接入拒绝事件写入。
6. 起草组织 / 工作区迁移 SQL（先 `sessions` / `files` 两张表做 POC）。
