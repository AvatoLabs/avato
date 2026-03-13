# LobeHub 用户管理系统审计与企业级 Self-Hosted 建设方案

> 审计日期：2026-03-12\
> 范围：Web App / Mobile App / Server（tRPC + WebAPI + OpenAPI + DB Schema）

## 1. 审计范围与方法

本次审计覆盖以下模块：

- App 端用户状态与认证交互（Web + Mobile）
- Server 端认证鉴权链路（Better Auth、OIDC、API Key、NoAuth）
- 用户数据模型（`users`、`user_settings`、`api_keys`、`rbac_*`）
- 用户管理 API（lambda 路由与 OpenAPI 管理面）
- 企业自托管相关配置能力（环境变量、会话、SSO）

## 2. 当前实现现状（As-Is）

### 2.1 认证与登录能力

已具备较完整的认证入口与扩展能力：

- Better Auth 主配置与插件化：
  - `src/libs/better-auth/define-config.ts`
  - 支持邮箱密码、Magic Link、Email OTP、Passkey、OAuth/OIDC、admin 插件
- 鉴权环境变量丰富：
  - `src/envs/auth.ts`
  - 支持 `AUTH_SSO_PROVIDERS`、`AUTH_ALLOWED_EMAILS`、`AUTH_DISABLE_EMAIL_PASSWORD`、`ENABLE_OIDC` 等
- 认证入口：
  - `src/auth.ts`
  - `src/app/(backend)/api/auth/[...all]/route.ts`

结论：认证 “接入能力” 较强，适合多 IdP 场景。

### 2.2 会话、API Key 与请求鉴权

- lambda /webapi 支持 Better Auth Session + API Key + OIDC 混合鉴权：
  - `src/app/(backend)/middleware/auth/index.ts`
  - `src/libs/trpc/lambda/context.ts`
- API Key 已有用户级模型与路由：
  - `packages/database/src/schemas/apiKey.ts`
  - `src/server/routers/lambda/apiKey.ts`

但存在明显治理缺口：

- `checkAuthMethod` 校验较弱（有 session 或 apiKey 即通过）：
  - `src/app/(backend)/middleware/auth/utils.ts`
- `authedProcedure` 本质只检查 `ctx.userId` 是否存在：
  - `src/libs/trpc/lambda/index.ts`
  - `src/libs/trpc/middleware/userAuth.ts`

结论：当前偏 “身份已登录” 模型，不是 “权限已授权” 模型。

### 2.3 用户域模型与自助能力

- 用户基础模型：
  - `packages/database/src/schemas/user.ts`
  - 包含基本资料、`role`、`banned`、`twoFactorEnabled`、`lastActiveAt`
- 用户自助接口：
  - `src/server/routers/lambda/user.ts`
  - 支持 avatar/fullName/username/interests/preference/settings 等更新
- App 端用户状态管理：
  - Web: `src/services/user/index.ts`、`src/store/user/slices/auth/action.ts`
  - Mobile: `apps/mobile/src/store/user.ts`、`apps/mobile/src/lib/api.ts`

结论：用户 “个人中心” 闭环基本具备，但以单用户域能力为主。

### 2.4 RBAC 能力现状

- 已有 RBAC 数据结构与权限常量：
  - `packages/database/src/schemas/rbac.ts`
  - `packages/const/src/rbac.ts`
- OpenAPI 管理面已落地 RBAC 权限检查：
  - `packages/openapi/src/routes/users.route.ts`
  - `packages/openapi/src/services/user.service.ts`
  - `packages/openapi/src/common/base.service.ts`
  - `packages/openapi/src/middleware/permission-check.ts`

核心问题：

- 主业务路径（lambda/webapi）与 RBAC 强制绑定不足；
- RBAC 更像 “管理 API 能力”，尚未成为 “全局访问控制中枢”。

结论：RBAC 基础可用，但 “横向接入主业务流” 尚未完成。

### 2.5 Self-Hosted 现有基础

- 文档与环境变量层面对自托管已支持：
  - `docs/self-hosting/auth.zh-CN.mdx`
  - `docs/self-hosting/environment-variables/auth.zh-CN.mdx`
- Redis 会话二级存储支持：
  - `src/libs/better-auth/define-config.ts`

结论：当前 self-hosted 更偏 “部署可用”，尚未达到 “企业治理可用”。

## 3. 关键差距（Gap）与优先级

## P0（必须优先，阻断企业可用）

1. 多租户 / 组织模型缺失

- 现状：核心资源主要按 `userId` 隔离。
- 风险：无法支撑企业的组织级权限、配额、审计边界。

2. 鉴权链路未全面 RBAC 化

- 现状：lambda/webapi 主要依赖 “已登录” 判定。
- 风险：接口越多，越容易出现越权与灰色访问。

3. NoAuth/Debug 路径治理不足

- 现状：存在 `NOAUTH_MODE`、`local-user`、`DEV_USER` 回退路径。
- 风险：误配置导致生产环境弱认证。

4. 审计日志体系缺失

- 现状：缺少标准化 “谁在何时对谁做了什么” 的不可抵赖日志。
- 风险：合规与事件追溯不可用。

## P1（企业化必需）

1. 企业身份生命周期闭环不足

- 缺 SCIM 入离转调、自动建号 / 停用、组同步映射角色。

2. 会话与设备安全策略不足

- 缺全局会话列表、强制下线、并发会话限制、设备 / IP 风险策略。

3. 管理员控制台不足

- 缺组织管理员可视化能力（用户、角色、策略、审计、密钥治理）。

4. 企业级 API 身份类型不足

- 仅用户 API Key，缺 service account /robot identity /token policy。

## P2（规模化增强）

1. 合规能力增强

- 数据保留策略、日志归档、导出与审计检索。

2. 配额与成本治理

- 组织维度限额、预算阈值、超额策略。

3. 细粒度策略引擎

- ABAC（基于标签、部门、环境）与策略调试能力。

## 4. 企业级 Self-Hosted 目标能力矩阵（To-Be）

| 能力域   | 当前                  | 目标                                         |
| -------- | --------------------- | -------------------------------------------- |
| 认证接入 | 强（多 SSO/OIDC）     | 保持强 + 增加企业生命周期接入（SCIM / 目录） |
| 访问控制 | 中（OpenAPI 有 RBAC） | 强（全链路统一 AuthZ 中间件）                |
| 资源隔离 | 以用户为中心          | 组织 / 项目 / 用户多级隔离                   |
| 管理面   | 部分接口              | 完整 Admin Console + Admin API               |
| 安全策略 | 基础                  | MFA / 会话 / IP / 密码策略中心               |
| 审计合规 | 弱                    | 完整审计日志、检索、导出、留存策略           |
| 运维治理 | 基础部署可用          | 企业 SLA、可观测、告警、容量治理             |

## 5. 分阶段实施路线图（建议 4 个里程碑）

### 里程碑 M1：身份与授权基线（2-4 周）

目标：从 “登录态” 升级为 “授权态”。

实施项：

1. 统一 AuthZ 中间件

- 在 lambda/webapi 侧引入统一 `requirePermission(...)`
- 将关键路由（用户、文件、会话、模型、Provider）逐步接入权限检查

2. 生产安全开关治理

- 对 `NOAUTH_MODE` /debug bypass 增加启动期阻断（生产环境禁用）
- 增加配置健康检查与告警

3. 审计事件基础表

- 新增 `audit_logs`：actor、action、resource、before/after、result、ip、ua、traceId

验收标准：

- 主业务高风险接口 100% 接入权限中间件
- 生产配置下无法启用 NoAuth/Debug bypass
- 用户 / 角色变更可追溯

### 里程碑 M2：组织与租户模型（4-6 周）

目标：支撑企业级组织治理边界。

实施项：

1. 新增多租户核心模型

- `organizations`、`organization_members`、`projects`（可选）
- 资源表引入 `organizationId`（分批迁移）

2. 组织级 RBAC

- 新增组织角色模板（OrgOwner/OrgAdmin/SecurityAdmin/Auditor/Member）
- 角色作用域从 `ALL/OWNER` 扩展到 `ORG/PROJECT/OWNER`

3. 迁移策略

- 单用户存量数据映射到默认组织
- 提供幂等迁移脚本与回滚策略

验收标准：

- 组织内成员可协作，组织间数据隔离
- 组织管理员可完成成员与角色管理

### 里程碑 M3：企业身份生命周期与安全策略（4-8 周）

目标：让企业 IT 可控。

实施项：

1. 身份生命周期

- SCIM（用户 / 组）同步入口
- JIT Provisioning 与组到角色映射
- 用户停用 / 离职自动回收权限与会话

2. 安全策略中心

- 强制 MFA（按角色 / 组织策略）
- 会话策略（TTL、并发、强制下线）
- 密码与登录策略（复杂度、锁定、IP 限制）

3. 企业 API 身份

- Service Account + Token Scope + 轮换与过期策略

验收标准：

- IdP 组变更可在系统内自动生效
- 安全管理员可统一下发并生效策略

### 里程碑 M4：管理控制台与合规运营（4-6 周）

目标：完成企业可运维与可审计闭环。

实施项：

1. Admin Console

- 用户、组织、角色、权限、会话、API 密钥、安全策略、审计日志页面

2. 审计与可观测

- 支持审计检索、过滤、导出
- 接入告警（异常登录、权限提升、批量删除）

3. 数据治理

- 留存策略、归档策略、合规导出接口

验收标准：

- 企业管理员无需 SQL 即可完成常规治理
- 安全审计事件可检索可导出

## 6. App 端与 Server 端改造清单

### 6.1 App 端（Web + Mobile）

需要新增：

1. 管理员入口与信息架构

- 增加 Admin 区域路由（用户、组织、角色、审计、安全策略）

2. 权限驱动 UI

- 基于权限点控制菜单、按钮、批量操作入口
- 对无权限操作做明确说明（非仅报错）

3. 会话与安全体验

- “我的设备 / 会话” 页面
- 一键下线其他设备、查看最近登录活动

4. 组织上下文切换

- 当前组织切换器
- 组织级资源过滤（模型、Provider、知识库）

### 6.2 Server 端

需要新增或重构：

1. 统一授权框架

- 抽象可复用的 `authorize(action, resource, context)` 层
- lambda、webapi、openapi 共用同一策略引擎

2. 多租户数据层

- schema 扩展 + query 默认附加组织过滤器
- 防止遗漏条件导致跨租户访问

3. 生命周期集成

- SCIM API、Webhook、IdP group mapping

4. 审计与策略执行器

- 关键变更强制写审计日志
- 策略命中结果入日志（便于审计和排障）

## 7. 与用户管理相关的硬编码审计（重点）

发现以下硬编码项建议收敛到配置：

1. NoAuth/Debug 默认身份

- `src/app/(backend)/middleware/auth/index.ts`：`local-user`、`DEV_USER`
- `src/libs/trpc/lambda/context.ts`：`local-user`
- `src/layout/AuthProvider/NoAuth/index.tsx`：`local-user`、`local@localhost`

2. 认证策略常量

- `src/libs/better-auth/define-config.ts`
  - `VERIFICATION_LINK_EXPIRES_IN = 3600`
  - `MAGIC_LINK_EXPIRES_IN = 900`
  - `OTP_EXPIRES_IN = 300`
  - `minPasswordLength = 8`、`maxPasswordLength = 64`
  - `allowedAttempts = 3`
  - `rpName = 'LobeHub'`

3. 默认角色常量

- `packages/const/src/rbac.ts`：仅 `super_admin` 系统默认角色

建议：

- 将以上值转为可配置策略（按组织覆盖），并提供安全默认值；
- 对生产环境保留最小必需默认值，禁止危险默认回退。

## 8. 推荐执行顺序（可直接进入排期）

1. 先做 M1（统一鉴权 + 禁止生产弱认证 + 审计基础）
2. 再做 M2（多租户与组织模型）
3. 再做 M3（SCIM / 策略中心 / Service Account）
4. 最后做 M4（管理控制台与合规运营）

## 9. 风险与前置条件

前置条件：

- 明确企业版与社区版边界（feature flags）
- 定义目标部署规模（用户数、组织数、日志留存要求）

主要风险：

- 存量数据迁移复杂度高（单用户 -> 组织模型）
- 权限系统接入不彻底会形成 “漏网接口”
- 审计日志量增长带来存储与检索成本

---

如果需要，我可以基于本文件继续输出第二份《实施任务分解（按周 + Owner + 工时估算）》markdown，直接用于研发排期。
