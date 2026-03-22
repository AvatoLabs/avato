# 资源树与分享能力安全工程方案

> 复核时间：2026-03-21；**文档进展同步：2026-03-22（含 `S3_SET_ACL` 改为 opt-in 安全默认）**\
> 范围：Resource / Knowledge Base / Page / File 相关能力，从 “单用户私有资源管理” 演进到 “每用户独立文件树 + 可分享” 的安全工程方案
>
> 执行摘要：
>
> - 当前资源目录树已经存在于数据库中，S3 只保存对象，不应把 “用户文件树” 对齐到 S3 物理目录。
> - 当前最关键的风险不是 “目录没建在 S3”，而是 “访问控制没有收口”：`/f/:id` 按文件 ID 公开访问，`checkHash` 基于全局 `global_files` 跨用户去重，会泄露文件存在性，而且 parse /preview/search 也已经是实际 read surface。
> - 推荐方案是 `Personal Space / Team Space + DB 资源树 + ACL + Space Scoped Blob Store`。目录树、分享关系、下载授权都由数据库和服务端控制，S3 key 只负责对象寻址。
> - 如果目标是对齐飞书，不应该放弃 S3 作为对象存储，而应该放弃 “把 S3 当目录树、权限系统、分享系统” 的建模方式。
> - 不建议一步到位重写成统一 `resource_nodes` 超表。第一阶段应保留 `documents/files` 双表，但补一个薄 `resource_registry`，给 ACL /share/audit /revoke cache 一个稳定锚点。
> - Phase 0 不能只修 `/f/:id`，还要显式关闭私有资源的 public object /public domain 绕过路径，并把下载、预览、解析、检索统一收口到同一个 authorizer。
> - 如果只补三样最关键的基础设施，优先级应是：`resource_registry`、`authz_epoch`、带状态机且强制 private-object 的 `space_blobs`。

## 〇、落地进展（与下文 Phase 对照，截至 2026-03-22）

以下已在主干代码中**部分落地**，用于与正文路线图对齐；**不等于**某一 Phase 整段验收已全部完成。

### S3 与环境变量（第三轮审计对齐）

- **`S3_SET_ACL`**（`src/envs/file.ts`）：**默认 `false`**，仅 **`process.env.S3_SET_ACL === '1'`** 时为 true（opt-in）。应用侧 **`FileS3` PutObject 不写对象 ACL**；该变量保留给历史/外部脚本读取，避免「未设置 env 却等价于允许 public-read 语义」的默认值陷阱。
- **对象 ACL 代码路径**：`FileS3` / 基类 **已移除** `setAcl`、`public-read` 上传参数（与审计结论一致）。

### 客户端上传（`prepareResourceUpload` 收口）

- **`src/services/upload.ts`**：`uploadToServerS3` / `uploadFileToS3` 改为 **`prepareResourceUpload` → 客户端 PUT 预签名 URL（或 HTTPS 页对 HTTP 预签名时的同域回退）→ `completeResourceUpload`**，不再调用已废弃的 **`createS3PreSignedUrl`**。
- **同域回退**：`POST /api/file/upload-session`（`uploadSessionId` + `file`），服务端用 **`PrivateBlobS3.uploadBuffer`** 写入会话 **`storageKey`**，与预签名 PUT 同一私有桶契约。
- **遗留 pathname 同域上传**：`POST /api/file/upload`（`pathname` + `file`，供旧客户端 / 移动端等）已改为 **`getPrivateBlobS3().uploadBuffer`**，与私有 blob 桶一致；**Web 主路径**仍应以 **`upload-session` + 会话 key** 为主。
- **带进度上传**：`uploadWithProgress` 向 prepare 传入 **`knowledgeBaseId` / `parentId` / `spaceId` / `sha256`**，与写库 **`createFile`** 的空间上下文一致。
- **对象 key 不含展示文件名**：`lambda/upload` 的 **`generateStorageKey`** 为 **`uploads/{spaceId}/{sessionId}/{nanoid}`**；展示名仍在会话 **`metadata.filename`** 与 **`files.name`**。客户端 **`FileMetadata.filename`** 使用 **`File.name`**，避免 UI 误用路径末段。
- **OpenAPI 公开上传**（`packages/openapi/.../file.service.ts`）：直传改为 **`getPrivateBlobS3().uploadBuffer`**，**`HeadObject`** 校验 **`contentLength === file.size`** 后再 **`upsertSpaceBlob`**（并写入 **`etag`**）；**`generateFileMetadata`** 路径末段为 **`nanoid()`**，**`metadata.filename`** 为用户 **`file.name`**。

### 授权与能力模型

- **`preview_content`**：在 `ResourceAuthorizer` 中求值时，若请求能力为 `preview_content`，则具备 `preview_content` **或** `read_content` 即通过；单独请求 `read_content` 时仍只认 `read_content`（避免用「仅预览」顶替全文读）。
- **转授 / 继续分享**：成员分享与分享链接相关 API 经 `assertCanDelegateSharing`；space `owner`/`admin` 直接放行；**space `editor`（仅凭空间成员身份命中 `share_member`）** 仍须在目标资源上具备 **`owner` 或 `editor + can_reshare`（直接授权或继承）**，否则 `RESOURCE_RESHARE_DENIED`；`direct` / `inherited` 路径下 **`editor` 须授权行 `can_reshare`** 的规则不变。
- **分享链接**：viewer 能力集合包含 `preview_content`；与上述 `preview_content` OR `read_content` 规则一致。

### 读路径（预览 / 解析 / RAG）

- **Lambda `chunk` 路由**：创建嵌入任务、解析任务、按文件取 chunk、`getFileContents`、`retryParseFileTask` 等使用 **`preview_content`**。
- **Async `file` 路由**：`embeddingChunks`、`parseFileToChunks` 使用 **`preview_content`**。
- **`DocumentService`**：`parseDocument` / `parseFile` 通过 **`downloadFileToLocal(fileId, 'preview_content')`** 拉取对象。
- **Lambda `document` 路由**：`parseDocument` / `parseFileContent` 在入口 **`assertCapability('preview_content', kind: file)`**。
- **语义检索过滤**：`filterReadableFileIds`、`filterReadableKnowledgeBaseIds` 按 **`preview_content`** 过滤（与 §6.1「预览或全文读」一致）。

### `authz_epoch` 与删除 / 移动

- **`ResourceModel.invalidateAuthzEpochsAfterRemoval`**：物理删除或同类变更后 bump 相关 **`resource_registry`** 与 **`spaces`** 的 epoch，便于下载缓存等依赖 `authz_epoch` 的路径失效。
- **已串联的典型入口**（非穷举）：`DocumentService.deleteDocuments`、文档 **`parentId` 变更**；lambda / async **file** 删除与存储 **`NoSuchKey`** 后的删行；lambda **notebook** 删文档等（以仓库内对 `invalidateAuthzEpochsAfterRemoval` 的调用为准）。

### `global_files`（CAS）按 hash 读字节与 ZIP URL

- **`FileModel.canAccessGlobalFileByHash`**：仅当满足以下之一才视为可读该 CAS：**`global_files.creator` 为当前用户**、当前用户有一条 **`files.fileHash` 命中**、或当前用户的 **`agent_skills`** 通过 **`zipFileHash`** 或 **`resources` JSON 内嵌的 `fileHash`** 引用该 hash。
- **`FileService.getFileContentByHash` / `getFileByteArrayByHash`**：先 **`canAccessGlobalFileByHash`**，不通过则与「不存在」统一为 **`NOT_FOUND`**（降低存在性侧信道）。
- **技能 ZIP 预签名 / `zipUrl`**：`agentSkills.getByIdWithZipUrl`、`routers/tools/market`（内置工具补 `zipUrl`）、`toolExecution/serverRuntimes/skills` 在取存储 `url` 并拼 **`getFullFileUrl`** 前同样先走 **`canAccessGlobalFileByHash`**。

### OpenAPI 公开上传去重（Space 作用域）

- **`packages/openapi/.../file.service.ts` `uploadFile`**：去重改为 **`findSpaceBlobByHash(spaceId, sha256)`**（同一 Space 内 **`status=ready`** 的 blob），**不再**预检全局 **`checkHash`**；新上传成功后 **`upsertSpaceBlob`**。`spaceId` 来自知识库或 **`getOrCreatePersonalSpace`**。
- 仍 **`create(..., true)`** 写 **`global_files`**（`onConflictDoNothing`）以满足 **`files.file_hash`** 外键；跨 Space / 跨用户**不再**通过「先全局 `checkHash` 再挂接他人存储 key」暴露存在性。

### 主站 `FileService.createFileRecord`

- **不再调用 `checkHash`** 决定 `insertToGlobalFiles`；**始终** `create(..., true)`，依赖 **`global_files` 主键冲突即跳过**，避免预检侧信道。
- **`space_blobs`**：未传 **`spaceId`** 时默认 **`getOrCreatePersonalSpace()`** 并写入文件行 **`spaceId`** + **`upsertSpaceBlob`**（`ready`）；显式 **`spaceId: null`** 则跳过个人空间解析与 blob 登记；传入具体 **`spaceId`** 时行为与 OpenAPI 一致。
- **`quarantined`（最小闭环）**：**`upload.completeResourceUpload`** 在 S3 **Head 404/NoSuchKey** 或 **实际 size ≠ 会话 expectedSize** 时，若会话含 **`expectedSha256`**，则 **`ResourceModel.quarantineSpaceBlobAfterFailedVerify`** 写入 **`space_blobs.status=quarantined`**（已有 **`ready`** 同 hash 不降级）。**OpenAPI `uploadFile`** 在 PUT 后 HEAD **大小不一致**时同样隔离。**`findSpaceBlobByHash`** 仍只认 **`ready`**。通用 **`upsertSpaceBlob`** 对 **`quarantined`** 将 **`verifiedAt`** 置 **`null`**。
- **沙盒 / Market 导出 / 服务端 Skills**：在能唯一解析时传入 **`spaceId`**——按话题关联 agent（含群聊多 agent）的**已启用知识库**推导单一 **`knowledge_bases.spaceId`**（`resolveSpaceIdForSandboxExport`）；**`tools.market.exportAndUploadFile`** 另支持可选 **`spaceId`**（须用户可访问）。**Web 客户端**：资源管理器 **`setSpaceId`** 同步 **`getActiveWorkspaceSpaceId`**（`src/helpers/activeWorkspaceSpace.ts`）。**`cloudSandboxService.exportAndUploadFile`**、**`agentRuntimeService.createOperation`**（`aiAgent.createOperation`）、**`aiAgentService.execAgentTask`** 在未显式传 **`spaceId` / `appContext.spaceId`** 时用其作为提示（服务端仍校验可访问性；KB 推导等为后备）。**`webapi/chat`**（`MobileChatPayload.spaceId`）在服务端工具循环里传入 **`ToolExecutionContext.spaceId`**。**CLI** `agent run` 支持 **`--space-id`** 或环境变量 **`LOBE_CLI_SPACE_ID`** 写入 **`execAgent.appContext.spaceId`**。**`execAgent` 的 `appContext.spaceId`** 与 **`createOperation` 的 `spaceId`** 进入 operation metadata，**`RuntimeExecutors`** 调用 **`executeTool`** 时注入 **`ToolExecutionContext.spaceId`**，与 Cloud Sandbox / Skills 的显式 Space 优先逻辑对齐。**`createGlobalFile`（技能 CAS）**仍走 **`checkHash`**，与用户上传路径分开迭代。

### Phase 4（`documents` 软删除与恢复，已部分落地）

- **`DocumentModel`**：`delete` / `deleteManyAny` / `deleteAll` 为 **`deleted_at` 软删除**；列表与按 id/slug/fileId 读取默认 **`deleted_at IS NULL`**（含 **`findByIdAny` / `findManyBySlug`**）。
- **`DocumentService.deleteDocuments`**（含 PGLite 分支）、**notebook / KnowledgeRepo** 等与文档删除路径一致为软删除；检索、Topic 关联文档、Agent 按 fileId 拉正文、资源 **`requireDocument`** 等均排除软删行。
- **`ResourceAuthorizer.resolveByKind('document')`**：无 **`documentIncludeDeleted`** 时若文档行已软删则 **整链返回 `null`**，避免仅靠 registry 仍命中 **`getAccessMatch`** 的授权缝隙。
- **恢复**：**`DocumentService.restoreDocument`**（需 **`delete` 能力**；鉴权侧使用 **`documentIncludeDeleted: true`**）清空 **`deleted_at`**，并 **`invalidateAuthzEpochsAfterRemoval`** bump epoch；Lambda **`document.restoreDocument`** 已暴露。
- **列表（回收站）**：**`document.queryDocuments`** 支持 **`trash: true`**，可选 **`knowledgeBaseId`**（资料库内仅看该库已删文档；不传则当前用户全部已删文档）。
- **Web**：**`DocumentService`（客户端）** 含 **`restoreDocument`**、**`queryDocuments({ trash, knowledgeBaseId })`**；资源页 **`LibraryTrashButton`** + **`DocumentTrashModal`**（资料库头栏与资源首页侧栏）；恢复成功后 **`revalidateResources`**。
- **唯一约束（partial）**：**`documents_slug_space_id_unique`** → 迁移 **`0099_...`**（**`slug IS NOT NULL AND deleted_at IS NULL`**）；**`documents_client_id_space_id_unique`** → 迁移 **`0100_...`**（**`client_id IS NOT NULL AND deleted_at IS NULL`**），软删后可再占用同一 **client_id+space**（需跑迁移）。

### Phase 5（匿名链接与兼容，已部分落地）

- **Token-first 文件下载**：`GET /share/f/:token`（可选 `?password=`）；**`GET /f/:id?token=…` 一律 307 重定向到 `/share/f/:token`**（仅保留 `password` query），避免在 URL 主路径暴露 `fileId`。单测见 `src/app/(backend)/f/[id]/route.test.ts`、`src/app/(backend)/share/f/[token]/route.test.ts`。
- **统一失败形态**：带 **`shareToken`** 的下载在 **`serveAuthorizedFileDownload`** 鉴权失败时返回 **404**（与错误/撤销 token 一致），**不**再返回 **403**（减少与「资源不存在」的区分）。单测见 `src/server/modules/file-proxy/serveAuthorizedFileDownload.test.ts`。
- **公开页**：资源分享页仍为 **`/share/r/:token`**（SPA）；文件直链为 **`/share/f/:token`**（与 `createResourceShareLink` 返回的 `fileShareDownloadUrl` 一致）。
- **`knowledge_bases.isPublic`**：schema 上已标 **`@deprecated`**，**不得**再作为授权依据；完全收敛到 ACL / 分享链接需后续删字段或迁移。

### 仍待办（与 §3.1、Phase 0～5 一致）

- **`FileService.createFileRecord`**：默认已挂**个人空间** + **`space_blobs`**；若某类文件必须**不**绑定空间，可显式传 **`spaceId: null`**（慎用）。
- **其余按原文推进**：Phase 3 **`v2/spaces/...` 存储 key**、Phase 4 **硬删除与 blob 延迟 GC**（Web 资料库/资源首页回收站与 **`0100` client_id 部分唯一**已落地；Notebook 侧仅提示至资源回收站）、**下线用户资源对 `global_files` 的依赖**、**`isPublic` 数据迁移**、异步 worker **执行时**对 **`authz_epoch`** 的强制复验等。

## 一、现状审计

### 1.1 当前已经成立的事实

| 维度     | 当前实现                                            | 结论                                      |
| -------- | --------------------------------------------------- | ----------------------------------------- |
| 资源树   | `documents.parentId`、`files.parentId` 维护目录层级 | 当前已经是 “逻辑文件树”，不是平铺对象存储 |
| 文件夹   | `custom/folder` 只存在于 `documents` 表             | “新建文件夹” 是业务节点，不是 S3 目录     |
| 对象存储 | 上传 key 默认是 `files/<按小时分桶>/<uuid>.<ext>`   | 当前 S3 key 不表达用户树结构              |
| 资源查询 | `FileModel` / `KnowledgeRepo` 大多按 `userId` 过滤  | 列表和写入路径具备单用户逻辑隔离          |
| 分享     | 仅 `topicShares` 覆盖会话分享                       | 资源树、文件、知识库没有通用 ACL 模型     |

### 1.2 当前安全缺口

| 风险点                  | 当前实现                                                                 | 风险说明                                                      |
| ----------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- |
| 文件代理公开访问        | `GET /f/:id` 通过 `FileModel.getFileById` 直接查文件，不按 `userId` 过滤 | 只要拿到文件 ID，就能尝试读取文件                             |
| 预签名 URL 缓存过早命中 | `/f/:id` 先查 Redis，再查 DB                                             | 如果未来改成鉴权下载，缓存键不能只按 `fileId` 维度            |
| 私有对象可被存储层绕过  | 部分部署允许 `public-read` ACL / `S3_PUBLIC_DOMAIN` 直链模式             | 即使应用层补 ACL，public object /public domain 仍可能绕过授权 |
| 跨用户去重              | `file.checkHash` 查询全局 `global_files`                                 | 能泄露 “某文件内容是否已存在于系统中”                         |
| ACL 缺失                | 资源树没有 `viewer/editor/owner` 统一权限模型                            | 无法安全支持 “分享给某人 / 分享给团队 / 链接分享”             |
| 共享模型割裂            | Topic 有 `topicShares`，资源没有对应模型                                 | 无法复用出 “像飞书一样” 的资源分享心智                        |
| 派生读路径未统一收口    | parse /preview/chunk /semantic search 已经读到资源内容                   | 如果只修下载，仍会通过解析结果、预览、检索泄露内容            |

### 1.3 当前代码锚点

- 资源树与父子关系：`packages/database/src/schemas/file.ts`
- 文件上传 key 生成：`src/services/upload.ts`
- S3 桶与对象写入：`src/server/modules/S3/index.ts`
- 文件代理路由：`src/app/(backend)/f/[id]/route.ts`
- 资源统一查询：`packages/database/src/repositories/knowledge/index.ts`
- 会话分享模型：`packages/database/src/models/topicShare.ts`
- **统一资源授权（capability、`preview_content`、转授、`filterReadable*`）**：`src/server/services/resource/index.ts`
- **删除/移动后 bump epoch**：`packages/database/src/models/resource.ts`（`invalidateAuthzEpochsAfterRemoval`）
- **全局 CAS 按 hash 访问控制**：`packages/database/src/models/file.ts`（`canAccessGlobalFileByHash`）
- **按 hash 读字节（服务端）**：`src/server/services/file/index.ts`（`getFileContentByHash` / `getFileByteArrayByHash`）

## 二、方案审计与取舍

### 2.1 不推荐方案：把用户文件树直接映射到 S3 路径

示例：`s3://bucket/userA/folderB/folderC/file.pdf`

不推荐原因：

- 重命名或移动文件夹会变成对象复制 + 删除，成本高且容易失败。
- 分享能力会被错误地绑定到路径，而不是绑定到资源权限。
- S3 key 会暴露文件名和目录结构，增加信息泄露面。
- 文件夹分享、撤销分享、审计访问都无法单靠对象路径完成。
- 当前系统已经有 DB 树模型，再把真实目录树放到 S3 会形成双写和一致性问题。

结论：**用户独立文件树应该是数据库中的逻辑树，不应该是 S3 的物理目录树。**

### 2.2 推荐方案：DB 资源树 + Space + ACL + Blob 分层

核心原则：

- `Tree` 负责组织结构。
- `ACL` 负责授权。
- `Blob` 负责内容存储。
- `S3 key` 只负责定位对象，不表达权限和目录语义。

这套分层可以同时满足：

- 每个用户拥有独立的 Personal Space 根目录。
- 后续可以增加 Team Space，而不用改对象存储模型。
- “分享给我” 是权限投影，不需要复制文件。
- 重命名、移动、授权、撤权主要改数据库，不改对象本身。

### 2.3 延后方案：统一 `resource_nodes` 超表

统一资源表长期看更干净，但第一阶段不建议这样做。

原因：

- 当前 `documents/files` 双表已经承载目录树、文件镜像、知识库映射和大量既有查询。
- 一步重构为统一超表，会把权限改造、下载改造、迁移改造和 UI 改造绑死在一个大项目里。
- 对 “先把下载和分享做安全” 这个目标来说，收益不如 “保留双表 + 增加 ACL 层” 来得直接。

结论：**第一阶段保留双表，第二阶段再评估是否抽象成统一资源节点。**

### 2.4 补充建议：引入薄 `resource_registry`

不建议大爆炸上统一超表，但建议尽早补一个薄 registry。

原因：

- 纯多态 `resource_permissions(resource_type, resource_id)` 缺少强外键与 cascade，容易留下 orphan row。
- ACL、分享链接、审计日志、访问事件都需要一个稳定的资源锚点，不能长期依赖多态二元组。
- 资源删除、恢复、迁移、撤权都会牵动缓存；统一 registry 更适合承载 `authz_epoch`。

建议 registry 尽量保持 “薄”：

- 不接管正文、文件元数据、业务字段
- 只承载稳定身份、所属 `space_id`、软删除态、授权版本
- 给 ACL /share/audit /explain-access 提供统一目标

结论：**不做完整 `resource_nodes` 超表，但建议引入薄 `resource_registry`。**

### 2.5 关于是否应该放弃 S3 模型

这个问题需要拆成两个层次：

1. 是否放弃 S3 作为对象存储
2. 是否放弃 “基于 S3 路径表达业务” 的模型

结论是：

- **不应该放弃 S3 本身**
- **应该放弃把 S3 当业务主模型**

S3 仍然非常适合承载：

- 原始附件
- 缩略图、封面、转码结果
- 导出包、归档包
- 其他不可变大对象

但 S3 不适合直接承载：

- 目录树
- 权限继承
- 分享关系
- 回收站
- 审计日志
- 版本历史
- 协同编辑状态
- 检索授权边界

如果要对齐飞书，正确做法不是 “弃用 S3”，而是把系统拆成分层架构：

| 层                      | 职责                                    | 是否适合 S3 |
| ----------------------- | --------------------------------------- | ----------- |
| Blob Storage            | 原始二进制对象、缩略图、导出产物        | ✅          |
| Resource Tree           | 文件夹、页面、附件的组织关系            | ❌          |
| ACL / Share             | owner/editor/viewer、链接分享、成员分享 | ❌          |
| Search / Index          | chunk、embedding、全文索引              | ❌          |
| Audit / Trash / Version | 审计、回收站、版本元数据                | ❌          |
| Editor / Collaboration  | 页面正文、协同状态、锁定信息            | ❌          |

因此，和飞书一致的方向应该理解为：

- 页面正文和业务元数据主要在 DB
- 二进制附件放 S3
- 所有访问都经由服务端授权
- S3 key 不表达资源树和权限语义

换句话说，应该放弃的是：

- `S3 = 文件系统`
- `S3 = 权限系统`
- `S3 = 分享系统`

而不应该放弃的是：

- `S3 = Blob Store`

这也是本文推荐 `Space + Resource Tree + ACL + Blob Store` 的根本原因。

## 三、安全目标

### 3.1 目标

- 默认私有，未授权用户不能读取任何资源内容或元数据。
- 文件 ID、文档 ID、知识库 ID 本身不应成为访问凭证。
- 资源树独立于对象存储路径，移动和改名不触发对象复制。
- 分享必须可撤销、可审计、可设置过期时间。
- 资源下载、预览、搜索、RAG 检索都走同一套授权边界。
- 撤权必须是 “可失效” 的，而不是 “改了数据库但缓存继续放行”；关键缓存键必须纳入 `authz_epoch`。
- 上传去重不能泄露其他用户或其他 Space 的文件存在性。

### 3.2 非目标

- 第一阶段不做多人实时协同编辑。
- 第一阶段不做跨 Space 的物理对象去重。
- 第一阶段不追求将历史对象一次性全部搬迁到新 key 结构。

## 四、目标架构

### 4.1 Space 模型

引入 `spaces`，作为资源树的顶层安全边界。

推荐语义：

- 每个用户默认拥有一个 `personal` space。
- 后续可增加 `team` space。
- 知识库、文档、文件都必须归属于某个 `space_id`。
- “每个用户都有自己的独立文件树” 的实现方式，是 “每个用户都有自己的 Personal Space 根目录”，而不是 “每个用户一套 S3 路径规则”。

### 4.2 资源模型

第一阶段保留现有双表：

- `documents`：文件夹、页面、文档节点
- `files`：二进制文件叶子节点

建议新增：

- `documents.space_id`
- `files.space_id`
- `knowledge_bases.space_id`
- 薄 `resource_registry`

保留现有关系：

- 文件夹仍用 `documents.file_type = 'custom/folder'`
- `files.parent_id -> documents.id`
- `documents.parent_id -> documents.id`

推荐新增 `resource_registry`：

| 字段           | 含义                                           |
| -------------- | ---------------------------------------------- |
| `resource_uid` | 统一资源主键，供 ACL /share/audit 作为外键目标 |
| `kind`         | `document` / `file` / `knowledge_base`         |
| `local_id`     | 原表中的资源 ID                                |
| `space_id`     | 所属 Space                                     |
| `deleted_at`   | 软删除时间                                     |
| `authz_epoch`  | 资源级授权版本号                               |

补充约束建议：

- `UNIQUE(kind, local_id)`
- `documents/files/knowledge_bases.resource_uid` 与 registry 一一映射
- 相关唯一键从 `userId` 作用域切换到 `space_id` 作用域
- 第一阶段禁止 cross-space `parentId` 赋值与 cross-space move

这样可以最小代价保住：

- 现有 ResourceManager
- 现有 Page / Document 编辑器
- 现有 Knowledge Base 归档关系
- 同时为 ACL /share/audit /revoke cache 提供稳定锚点

### 4.3 权限模型

引入 `resource_permissions`。

建议字段：

| 字段                   | 含义                                    |
| ---------------------- | --------------------------------------- |
| `space_id`             | 权限所属 Space                          |
| `resource_uid`         | 来自 `resource_registry` 的统一资源主键 |
| `subject_type`         | `user` / `space_member_group`           |
| `subject_id`           | 被授权主体                              |
| `role`                 | `owner` / `editor` / `viewer`           |
| `inherits_to_children` | 是否对子孙节点生效                      |
| `can_reshare`          | 是否允许继续分享                        |
| `created_by`           | 授权发起人                              |

产品层继续使用 `owner / editor / viewer`，但 `ResourceAuthorizer` 内部应编译为 capability 集合，例如：

- `read_metadata`
- `read_content`
- `preview_content`
- `download_blob`
- `create_child`
- `move`
- `delete`
- `share_member`
- `share_link`
- `reshare`

这样可以给未来这些差异留余地：

- 可预览不可下载
- 可编辑不可转授
- 可检索不可导出

此外建议在 `spaces` 和 `resource_registry` 两层同时维护 `authz_epoch`：

- `spaces.authz_epoch`
- `resource_registry.authz_epoch`

触发时机：

- 分享
- 撤权
- 移动
- 删除
- 恢复
- 关键可见性变更

关键缓存必须纳入版本：

- 下载重定向缓存
- 分享链接缓存
- 搜索结果缓存
- 预览缓存
- 客户端资源树快照缓存

权限求值顺序建议：

1. 资源自身的直接授权
2. 父文件夹继承授权
3. Space 级成员角色
4. 默认拒绝

补充规则：

- 文件夹增加 `inherit_mode = inherit | explicit_only`
- `explicit_only` 作为 “继承停止边界”，用来支持 “共享父目录，但不共享这个子树”
- 第一阶段仍坚持 “显式授权叠加，不做 deny”
- `knowledge_bases.isPublic` 最终收敛到统一 ACL /share link 语义，不再保留并行公开规则

“分享给我” 视图不复制资源，而是查询：

- 我被直接授权的资源
- 我因父文件夹继承而可见的资源
- 我作为 Space 成员可见的资源

同时建议预留 `ExplainAccess` 能力，用于回答：

- 为什么这个用户能看见它
- 来自哪条直接授权或哪一层继承
- 当前命中的 `authz_epoch` 是多少

### 4.4 Blob 模型

不建议继续让用户资源依赖全局 `global_files`。

推荐新增 `space_blobs`：

| 字段          | 含义                                            |
| ------------- | ----------------------------------------------- |
| `id`          | blob 主键                                       |
| `space_id`    | blob 所属 Space                                 |
| `sha256`      | 原始文件 hash                                   |
| `storage_key` | S3 对象 key                                     |
| `status`      | `staging` / `ready` / `quarantined` / `deleted` |
| `size`        | 大小                                            |
| `file_type`   | MIME                                            |
| `etag`        | 存储对象 ETag                                   |
| `verified_at` | 最近一次 HEAD 校验时间                          |
| `created_by`  | 上传人                                          |

唯一约束建议：

- `UNIQUE(space_id, sha256)`

推荐 S3 key：

```text
v2/spaces/<spaceId>/blobs/<blobId>
```

规则：

- key 不包含用户文件名、目录名、知识库名
- key 一经生成不可变
- 展示文件名只存数据库
- Personal / Team 资源对象必须始终是 private bucket /private object
- 用户资源禁用 `public-read` 与 `S3_PUBLIC_DOMAIN` 直链回退
- blob 只有在 finalize 阶段通过 HEAD 校验后才允许进入 `ready`
- 缺对象或校验异常的 blob 进入 `quarantined`，不能被复用

`global_files` 建议保留给：

- Skill 资源
- Market 导入产物
- 系统级只读资源

用户上传资源逐步迁移到 `space_blobs`，不再走跨用户全局去重。

### 4.5 派生物与索引模型

派生物必须区分两类，不要一股脑做成 blob 级复用。

适合 blob 级缓存的派生物：

- MIME 识别
- 页数、尺寸等只读探测信息
- 缩略图、封面
- 不独立对外暴露的 OCR /page extraction 中间产物

必须绑定 `file_id`，更理想是 `file_revision_id` 的派生物：

- parsed document view
- chunk
- embedding
- semantic search row
- 会被独立检索、引用、导出的解析结果

原因：

- 同一个 blob 可能在同一 space 下挂到两个 ACL 不同的节点
- 如果把所有派生物都 blob 化，去重本身会变成泄露通道

异步 worker 的强制规则：

- 入队时记录 `resource_uid`、`space_id`、期望的 `authz_epoch`
- 执行时再次读取当前资源状态、当前 `authz_epoch`、当前 `space_blobs.status`
- 撤权、移动、删除、恢复后，队列中的旧任务必须自然失效

### 4.6 下载与预览模型

`/f/:id` 需要从 “公开 ID 代理” 改为 “授权后代理”。

目标行为：

- 请求进入后先鉴权，再查缓存，再签发预签名 URL。
- 缓存键不能只用 `fileId`，至少要包含 `principal` 或 `shareLinkId`，并带上 `authz_epoch`。
- 预签名 URL TTL 建议缩短到 `<= 60s`。
- 对匿名分享访问，不复用原始 `/f/:id` 语义，使用专门的分享下载路由。
- 对私有用户资源，不允许回落到 public object /public domain 直链。

推荐路由拆分：

- `GET /f/:id`
  - 仅登录态访问
  - 校验当前用户是否对 `fileId` 具备 `download_blob`（在 UI 语义上通常至少是 `viewer`）
- `GET /share/f/:token`
  - 校验分享 token 是否有效
  - 由 token 在服务端解析出 canonical resource
  - 仅允许 token 对应角色范围内访问

兼容期如果保留 `GET /share/f/:token/:id`：

- token 错误、id 错误、资源不存在都统一返回同一类 404
- 不暴露 “token 有效但资源猜错了” 这类侧信道

补充要求：

- Redis 缓存命中不得绕过权限判断。
- 对高敏感资源，允许回退为服务端流式代理，不做 302 跳转。

### 4.7 链接分享模型

引入 `resource_share_links`。

建议字段：

| 字段            | 含义                        |
| --------------- | --------------------------- |
| `id`            | 链接记录 ID                 |
| `space_id`      | 所属 Space                  |
| `resource_uid`  | 被分享的 canonical resource |
| `token_hash`    | 随机 token 的 hash          |
| `role`          | `viewer`，首期建议只读      |
| `expires_at`    | 过期时间                    |
| `password_hash` | 可选访问密码                |
| `disabled_at`   | 撤销时间                    |
| `created_by`    | 创建者                      |

建议：

- token 使用高熵随机值，数据库只存 hash。
- 对外链接使用 token-first 形态，不把资源 ID 暴露进 URL。
- 首期只支持只读链接分享。
- 链接缓存也要带 `authz_epoch`，并且不复用用户资源的原始对象直链。
- 文件夹和知识库的匿名链接分享建议放到第二阶段；首期优先支持文档和单文件。

## 五、推荐的数据演进路径

### 5.1 新增表

- `spaces`
- `space_members`
- `resource_registry`
- `space_blobs`
- `resource_permissions`
- `resource_share_links`
- `resource_audit_logs`
- `resource_access_events`

### 5.2 修改现有表

- `documents` 增加 `space_id`
- `documents` 增加 `resource_uid`
- `documents` 目录节点增加 `inherit_mode`
- `files` 增加 `space_id`
- `files` 增加 `resource_uid`
- `knowledge_bases` 增加 `space_id`
- `knowledge_bases` 增加 `resource_uid`
- `files` 增加 `blob_id`，迁移期保留旧 `url` / `fileHash`
- 现有按 `userId` 约束的唯一键改为按 `space_id` 约束
- `knowledge_bases.isPublic` 标记为待收敛语义，最终并入 ACL /share link

### 5.3 迁移策略

建议采用 “双读 + 渐进回填”，不要一次性硬切。

顺序：

1. 为每个用户创建一个 personal space，并初始化 `spaces.authz_epoch`
2. 回填现有 `documents/files/knowledge_bases.space_id`
3. 为现有资源补 `resource_registry` 与 `resource_uid`
4. 将相关唯一索引重做为 `space_id` 作用域，并先禁止 cross-space move /parent assignment
5. 为资源创建默认 `owner` 权限与初始 `authz_epoch`
6. 新上传资源写入 `space_blobs`，并通过 finalize + HEAD 校验进入 `ready`
7. 下载链路同时兼容：
   - 新资源走 `blob_id -> storage_key`
   - 老资源继续走旧 `url`，但必须先经授权
8. 后台任务逐步搬迁旧对象或在热路径惰性搬迁，并逐步下线 public URL / 全局 `checkHash`

## 六、核心授权规则

产品层继续展示 `owner / editor / viewer`，但后端只在 `ResourceAuthorizer` 内部判断 capability，不在业务代码里散落 `if role === 'editor'`。

### 6.1 读

- 查看文件、页面、文件夹：要求 `read_metadata`
- 访问 `/f/:id`：要求 `download_blob`
- 内容预览、parse、RAG 检索、semantic search：要求 `preview_content` 或 `read_content`
- Provider read path、异步 worker、导出任务都必须在执行时重新校验当前 `authz_epoch`

### 6.2 写

- 在文件夹下创建内容：要求父文件夹 `create_child`
- 修改文档、移动文件：要求资源自身 `move` / `editor`
- 移动到目标文件夹：额外要求目标文件夹 `create_child`
- 第一阶段禁止 cross-space move
- 删除资源：要求资源自身 `delete` 或 `owner`，并默认进入软删除

### 6.3 分享

- 创建成员分享：要求 `owner`，或 `editor + can_reshare`
- **Space 成员维度**：space `owner` / `admin` 可在空间内代为发起成员分享/链接管理；**space `editor`（仅成员身份）** 不能仅凭成员资格转授，仍须在目标资源上满足上一条（资源 `owner` 或资源级 `editor + can_reshare`，含继承）。
- 创建链接分享：要求 `owner`，且在匿名分享阶段之前不下放给普通 `editor`
- 撤销分享：同一授权链上的 `owner` 可撤销，并 bump 相关 `authz_epoch`

### 6.4 继承与停止边界

- 文件夹授权默认对子孙资源生效
- 文件夹可设置 `inherit_mode = explicit_only` 作为继承停止边界
- 文件直接授权优先于继承授权
- 如存在冲突，采用最小可行原则：
  - 第一阶段只做 “显式授权叠加”
  - 不做复杂 deny 规则

## 七、实施步骤

### Phase 0：收口所有 read surface

目标：先让 “私有资源真的私有”，把下载、预览、解析、检索统一收口。

实施项：

1. 将 `/f/:id` 改为登录态下载，并按当前主体校验资源权限。
2. 把 Redis 缓存命中移动到权限判断之后，缓存键改为 `principal/shareLink + fileId + authz_epoch`。
3. 强制用户资源对象走 private bucket /private object，禁用 `public-read` 与 `S3_PUBLIC_DOMAIN` 直链回退。
4. 停止用户资源使用跨用户 `checkHash` 快速路径。（**进展**：按 hash 读字节与技能 ZIP 预签名已要求 `canAccessGlobalFileByHash`；**OpenAPI `uploadFile`** 为 Space 内 `space_blobs` 去重；**`FileService.createFileRecord`** 已取消全局 `checkHash` 预检并支持 **`spaceId` → `upsertSpaceBlob`**，见 **§〇**。）
5. 把 preview /parse/chunk /semantic search /provider read path 接到同一个 authorizer 入口。（**进展**：chunk、async file、document 解析与语义检索过滤已统一使用 **`preview_content`** 及 OR 规则，见 **§〇**；其余 provider / 导出等路径仍按清单收口。）
6. 为 `/f/:id`、`checkHash`、preview、parse、search 补集成测试。

验收标准：

- 未登录用户无法直接访问私有 `/f/:id`
- 其他用户拿到 `fileId` 无法下载文件
- 私有用户资源不存在 public object /public domain 绕过路径
- 上传同一文件时，不再能观察到 “系统中是否已有其他用户上传过该文件”
- 权限一旦收紧，下载、预览、解析、搜索同时失效

### Phase 1：引入 Space 边界与薄 registry

目标：把 “用户独立文件树” 从 `userId` 过滤提升为 `space_id` 边界，并建立 canonical resource identity。

实施项：

1. 新增 `spaces`、`space_members`、`resource_registry`
2. 为每个用户创建 personal space
3. 回填 `documents/files/knowledge_bases.space_id`
4. 为资源回填 `resource_uid`
5. 将相关唯一索引切到 `space_id` 作用域
6. 禁止 cross-space move /parent assignment
7. ResourceManager、列表查询、创建接口增加 `spaceId`
8. 引入 `TreeGuard`，统一校验祖先关系、循环移动、目标父节点权限

验收标准：

- 所有资源都明确归属某个 space，且能定位到唯一 `resource_uid`
- Personal Space 下的资源列表不再依赖隐式 `userId == owner`
- cross-space parent 赋值与循环移动都会被服务端拒绝

### Phase 2：把 Authorizer 做成基础设施

目标：让授权、撤权、审计、缓存失效成为统一基础设施，而不是散落在功能代码里的胶水。

实施项：

1. 新增 `resource_permissions`
2. 在 `spaces` 与 `resource_registry` 上启用 `authz_epoch`
3. 实现 `ResourceAuthorizer`、`AuthorizedResourceResolver`、`ExplainAccess`
4. 将以下入口统一接入授权：
   - Resource 列表与详情
   - 文件下载 `/f/:id`
   - 文档读取与更新
   - 知识库内文件查询与检索
   - preview / parse / export / provider read path
5. 新增 `resource_audit_logs`、`resource_access_events`
6. 先支持成员间显式分享，不开放匿名链接

验收标准：

- 共享资源能在 “Shared with me” 中出现
- 被撤销后，列表、详情、下载、搜索、预览都在短 TTL 内失效
- 能解释 “为什么这个用户能看到它”

### Phase 3：引入有状态 `space_blobs`

目标：把用户资源从 `global_files` 迁移到 `space_blobs`，并让 blob 复用具备可验证生命周期。

实施项：

1. 新增 `space_blobs`
2. 新上传文件走 `space_blobs + v2 key`
3. `files` 增加 `blob_id`
4. blob 写入先进入 `staging`，HEAD 校验后转 `ready`
5. 缺对象、ETag 不符或校验异常时转 `quarantined`
6. 下载链路支持新旧双读
7. 将派生物明确拆为 blob 级缓存与 file /file revision 级索引
8. 异步 worker 执行时重新校验 `authz_epoch` 与 `space_blobs.status`

验收标准：

- 新上传文件不再依赖 `global_files`
- 同 Space 内可去重，不同 Space 不共享去重结果
- 缺失对象不会继续被当成可复用 blob

### Phase 4：先软删除，再开放成员分享

目标：先把恢复、撤权、审计做成 “稳定且无聊” 的基础能力，再开放多人依赖同一子树。

实施顺序：

1. 资源软删除、回收站、恢复
2. 恢复时保留原 ACL
3. blob 延迟 GC
4. 成员分享
   - 文件夹
   - 页面
   - 文件
   - 知识库
5. “分享给我” 视图

验收标准：

- 误删共享资源后可恢复，且 ACL 不丢
- 分享链路有完整审计记录
- 撤销分享后，访问在短 TTL 内彻底失效

### Phase 5：匿名只读链接与兼容清理

目标：最后再开放风险最高的外链能力，并收敛历史兼容路径。

实施项：

1. 上线 token-first 的只读分享链接
2. 链接支持短 TTL、可选密码、统一 404 响应形态
3. 知识库 `isPublic` 语义收敛到统一 ACL /share link
4. 下线用户资源对 `global_files` 的依赖
5. 删除旧 `checkHash` 行为或改为 `space` 作用域
6. 收敛旧 `url` 字段读取逻辑
7. 清理仅依赖 `userId` 的旧查询

验收标准：

- 匿名链接只能通过 token 访问，不复用用户资源原始对象直链
- token 错误、资源错误、已撤销都返回统一失败形态
- 历史公开语义与旧下载路径收敛到单一安全模型

## 八、测试与验收矩阵

### 8.1 必测场景

- 用户 A 无法通过用户 B 的 `fileId` 下载文件
- 私有用户资源无法通过 public object /public domain 直连绕过授权
- 用户 A 分享文件夹给用户 B 后，B 可读取其子文件
- 用户 A 撤销分享后，B 的列表、详情、下载同步失效
- 用户 A 撤销分享后，B 的预览、parse、search、队列中待执行任务也同步失效
- 用户 A 不能把资源移动到自己无权编辑的文件夹下
- 用户 A 不能把资源移动到其他 Space，也不能把父节点设为自己的子孙节点
- 不同 Space 上传相同文件，不会通过上传接口暴露 “另一方已上传”
- `space_blobs` 缺失对象时会进入 `quarantined`，而不是继续复用
- 链接分享过期后，匿名访问立即失败
- 链接 token 错误、资源错误、已撤销都返回统一 404 形态

### 8.2 建议测试层次

- 单元测试：权限求值、继承停止边界、`authz_epoch` bump、token 校验
- 集成测试：Resource 列表、下载、预览、搜索、移动、分享、撤销、恢复
- E2E：Personal Space、Shared with me、成员分享、回收站、链接分享
- 安全测试：ID 枚举、缓存绕过、public URL 绕过、旧预签名 URL 残留窗口、worker 执行时复权检查

## 九、明确不建议做的事

- 不要把 “用户文件树” 实现成 S3 目录树。
- 不要继续让 `/f/:id` 作为公开文件入口存在。
- 不要让 private resource 继续支持 `public-read` 或 `S3_PUBLIC_DOMAIN` 直链。
- 不要把 Redis 预签名缓存键只做成 `fileId`。
- 不要复用 `topicShares` 去承载资源分享。
- 不要把 share link 长期设计成 resource-id-first 的 URL。
- 不要继续保留跨用户 `checkHash -> global_files` 作为用户上传快路径。
- 不要把所有派生物都做成 blob 级复用索引。
- 不要只在任务入队时授权，而不在 worker 执行时重新校验。

## 十、推荐落地顺序

如果资源有限，推荐严格按下面顺序推进：

1. 先锁死所有 read surface，并强制私有对象模式
2. 再引入 `space_id + resource_registry`
3. 再把 `ResourceAuthorizer + authz_epoch` 做成基础设施
4. 再引入有状态 `space_blobs`
5. 先软删除和恢复，再开放成员分享
6. 最后才做匿名只读链接和历史兼容清理

原因：

- 这条路径能先把 “私有资源不私有” 的问题修掉
- 再把 “每个用户独立文件树” 从逻辑和数据约束上做正确
- 然后用 `authz_epoch` 解决撤权与缓存失效
- 等 blob 生命周期、恢复、审计都稳定后，再开放高风险分享能力

这样做的返工最小，且每一步都可以独立上线、独立回滚、独立验收。

## 十一、补充设计备注

### 11.1 权限性能与缓存失效

树权限真正难的地方往往不是模型，而是大规模求值与撤权失效。

建议预留：

- 直接授权表 + `authz_epoch`
- 祖先链字段 /closure table /materialized path 之一
- “大批量移动 / 撤权 / 恢复” 的后台重算任务
- `ExplainAccess` 与有效权限快照缓存

重点场景：

- “Shared with me” 首页
- 大目录树展开
- 检索前授权求值
- 批量移动和批量撤权

### 11.2 Knowledge Base 安全语义

建议主线保持一致：

- `Space` 是第一安全边界
- `Resource` 是第二安全边界
- `Knowledge Base` 是功能容器，而不是并行公开系统

这意味着：

- `knowledge_bases.isPublic` 最终应收敛到统一 ACL /share link
- 不应长期保留 “知识库公开，但其中某文件私有” 的并行模型

### 11.3 版本、所有权与长期协作

第一阶段可以不做实时协同，但需要在表结构和审计里留余地：

- 文档版本历史与恢复
- 锁定 / 只读保护
- owner 转移与 `space admin`
- 用户离职、注销、资源托管

### 11.4 move /duplicate/shortcut 语义分离

长期看需要尽早区分：

- `move`：主归属变化
- `duplicate`：新资源、新 revision /blob 引用策略
- `shortcut/reference`：只生成引用节点，不复制内容

这会影响：

- 配额
- 审计
- 分享后的二次组织

## 十二、最终结论

这套方案主方向保持不变，仍然是正确的：

- `Space + DB 资源树 + ACL + Blob Store` 是对的
- 不应该把 S3 当目录树、权限系统、分享系统
- 不建议第一阶段大爆炸重写成统一 `resource_nodes` 超表

本轮收紧后，最值得前移的三样基础设施是：

- 薄 `resource_registry`
- 基于 `authz_epoch` 的撤权与缓存失效
- 带状态机且强制 private-object 的 `space_blobs`

实施顺序也相应加严：

1. 先收口所有 read surface，并强制私有对象模式
2. 再引入 `space_id + resource_registry`
3. 再把 `ResourceAuthorizer + authz_epoch` 做成基础设施
4. 再引入有状态 `space_blobs`
5. 先软删除和恢复，再开放成员分享
6. 最后才做匿名只读链接和历史兼容清理

这样处理以后，这份方案不只是 “架构方向正确”，而是更接近 “上线后也不容易被打穿”。
