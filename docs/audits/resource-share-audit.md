# 资源页「分享资源」功能审计报告

**审计日期**: 2025-03-23

**审计范围**:

- 前端：`src/features/ResourceSharing/`、资源浏览器、库列表入口
- 后端：`src/server/routers/lambda/resourceShare.ts`、`ResourceAuthorizer`、`ResourceModel`
- 数据：`resource_share_links`、`resource_permissions`、`resource_registry`
- 公开访问：`/share/r/:token`、`/share/f/:token`

---

## 1. 架构概览

### 1.1 分享能力矩阵

| 能力         | 说明                                                     | viewer | editor              | owner |
| ------------ | -------------------------------------------------------- | ------ | ------------------- | ----- |
| share_link   | 创建 / 禁用分享链接                                      | ❌     | ✅                  | ✅    |
| share_member | 授权 / 撤销成员                                          | ❌     | ✅（需 canReshare） | ✅    |
| 继承         | 父资源的 permission 可继承到子资源（inheritsToChildren） | -      | -                   | -     |

Space owner/admin 拥有全部分享权限；Space editor 还需具备资源级 owner 或 editor+canReshare 才能委托分享。

### 1.2 前端入口与数据流

```
useResourceShareModal ──► createModal(ResourceShareModal)
       ▲
       │ openShareModal({ id, kind, name })
       │
  ┌────┴────┐
  │         │
useFileItemDropdown   LibraryList/Item (useDropdownMenu)
  (Explorer)          (KnowledgeBase 列表)
  id, kind: file/document   id, kind: knowledge_base
```

- **资源浏览器**：`useFileItemDropdown` 根据 `sourceType === 'document'` 传 `kind: 'document'` 或 `kind: 'file'`
- **库列表**：`LibraryList/Item` 传 `kind: 'knowledge_base'`

### 1.3 后端 tRPC 路由

| 过程                       | 说明                                               | 鉴权                                    |
| -------------------------- | -------------------------------------------------- | --------------------------------------- |
| `createResourceShareLink`  | 创建分享链接，返回 shareUrl + fileShareDownloadUrl | share_link + assertCanDelegateSharing   |
| `disableResourceShareLink` | 禁用链接                                           | share_link + assertCanDelegateSharing   |
| `listResourceShareLinks`   | 列出链接（不含 rawToken）                          | share_link                              |
| `listResourcePermissions`  | 列出成员                                           | share_member                            |
| `grantResourcePermission`  | 授权成员                                           | assertCanDelegateSharing                |
| `revokeResourcePermission` | 撤销成员                                           | share_member + assertCanDelegateSharing |
| `explainAccess`            | 解释当前用户访问来源                               | 需有 read 权限                          |
| `getSharedResourceByToken` | **公开**：凭 token + 密码获取资源摘要              | publicProcedure                         |

### 1.4 公开访问路由

| 路径              | 实现                    | 说明                                      |
| ----------------- | ----------------------- | ----------------------------------------- |
| `/share/r/:token` | SPA → `PublicSharePage` | 预览页，展示标题 / 描述 / 内容 / 下载按钮 |
| `/share/f/:token` | Next.js Route Handler   | 文件直链下载，可选 `?password=`           |

---

## 2. 关键实现细节

### 2.1 Token 安全

- **存储**：只存 `tokenHash = sha256(rawToken)`，不存 rawToken
- **返回**：rawToken 仅在 `createResourceShareLink` 创建时返回一次（`shareUrl`、`fileShareDownloadUrl`）
- **校验**：`resolveShareLinkByToken(token)` 用 `sha256(token)` 查库
- **过期 / 禁用**：`expiresAt > now`、`disabledAt IS NULL`

### 2.2 密码保护

- **创建**：`passwordHash = bcrypt.hash(password, 10)` 可选
- **校验**：`getSharedResourceByToken` 与 `/share/f/:token` 使用 `bcrypt.compare` 验证
- **错误策略**：无密码时 `UNAUTHORIZED / SHARE_PASSWORD_REQUIRED`；密码错误时 `NOT_FOUND`（防止枚举）

### 2.3 ResourceAuthorizer

- **assertCapability**：`getAccessMatch` 获取 space_member /direct/inherited /share_link 任一匹配，校验 capability
- **assertCanDelegateSharing**：Space owner/admin 直接放行；Space editor 需资源级 owner 或 editor+canReshare（直接或继承）

### 2.4 文件下载

- `/share/f/:token` 先 `resolveShareLinkByToken` + 密码校验，再解析 `resource_registry` 得到 `fileId`
- 调用 `serveAuthorizedFileDownload`，`downloadVia: 'share_path'`，`shareToken` 传入 `ResourceAuthorizer.getAccessMatch` 做 share_link 权限校验
- 支持预签名 URL 缓存、HTTP→HTTPS 代理等

### 2.5 资源解析

- `resolveTargetResource`：支持 `resourceUid` 或 `id + kind` 解析到 `resource_registry`
- `findRegistryByLocalId(kind, localId)` 按 `kind` 查 `resource_registry` 得到 `resourceUid`、`spaceId`

---

## 3. 数据模型

### resource_share_links

| 字段         | 类型         | 说明                 |
| ------------ | ------------ | -------------------- |
| id           | text         | 主键                 |
| spaceId      | text         | FK spaces            |
| resourceUid  | text         | FK resource_registry |
| tokenHash    | varchar(128) | sha256(rawToken)     |
| role         | 'viewer'     | 固定 viewer          |
| expiresAt    | timestamptz  | 过期时间             |
| passwordHash | text         | bcrypt 可选          |
| disabledAt   | timestamptz  | 禁用时间             |
| createdBy    | text         | FK users             |

### resource_permissions

用于成员授权：subjectType=user、subjectId、role、canReshare、inheritsToChildren、expiresAt 等。

---

## 4. 潜在问题与建议

### 4.1 已识别风险

| 等级 | 问题                                                      | 位置                                       | 状态                                               |
| ---- | --------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------- |
| 低   | `listResourceShareLinks` 返回完整 DB 行，包含 `tokenHash` | resourceShare.ts                           | ✅ 已修复：API 层 omit `tokenHash`、`passwordHash` |
| 低   | 分享页密码通过 URL query 传递                             | PublicSharePage → getSharedResourceByToken | 依赖 HTTPS，暂不修改                               |
| 低   | 链接列表展示 `link.id`（内部 UUID）                       | ResourceShareModal                         | ✅ 已修复：改为展示「创建于 {{date}}」             |

### 4.2 功能边界

- **知识库分享**：`getSharedResourceByToken` 对 knowledge_base 返回 summary + avatar + description，无文件列表，符合预期
- **文档分享**：返回 content、title、fileType、metadata，支持 Markdown 预览
- **文件分享**：返回 summary，预览页提供直链下载按钮

### 4.3 审计日志与访问事件

- `createResourceShareLink`、`disableResourceShareLink`、`grantResourcePermission`、`revokeResourcePermission` 均写入 `resource_audit_logs`
- `serveAuthorizedFileDownload` 可写入 `resource_access_events`（需确认 `createAccessEvent` 调用点）

---

## 5. 文件索引

| 路径                                                           | 职责                                       |
| -------------------------------------------------------------- | ------------------------------------------ |
| `src/features/ResourceSharing/ResourceShareModal.tsx`          | 分享弹窗 UI（成员 + 链接）                 |
| `src/features/ResourceSharing/useResourceShareModal.tsx`       | 弹窗打开逻辑                               |
| `src/features/ResourceSharing/PublicSharePage.tsx`             | 公开预览页                                 |
| `src/server/routers/lambda/resourceShare.ts`                   | tRPC 分享路由                              |
| `src/server/services/resource/index.ts`                        | ResourceAuthorizer                         |
| `packages/database/src/models/resource.ts`                     | ResourceModel（share/permission/registry） |
| `packages/database/src/schemas/resource.ts`                    | resource_share_links 等 schema             |
| `src/app/(backend)/share/f/[token]/route.ts`                   | 文件直链下载                               |
| `src/server/modules/file-proxy/serveAuthorizedFileDownload.ts` | 鉴权下载实现                               |
| `src/features/ResourceManager/.../useFileItemDropdown.tsx`     | 资源浏览器分享入口                         |
| `src/routes/(main)/resource/.../LibraryList/Item/`             | 库列表分享入口                             |
