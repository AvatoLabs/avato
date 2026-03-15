# 飞书文档接入设计文档

> **状态**: Draft\
> **目标**: 在 LobeHub 中支持按当前登录用户身份浏览飞书文档列表，并将选中文档纳入对话上下文\
> **范围**: Web / Server / MCP / Context Engine

---

## 1. 结论

飞书文档接入可以在当前仓库中实现，但不应直接做成 “聊天框里的飞书特判”。

推荐架构：

- `应用侧负责飞书 OAuth`
- `应用后端负责保存、刷新、选择当前用户的飞书 token`
- `MCP 或后端执行层负责列文档、读文档、搜索文档`
- `聊天侧复用现有 files / pageSelections / knowledge 注入链路`

这意味着：

- 如果只是共享一个服务账号的飞书文档，预配置 Bearer Token 的 MCP 就够做 MVP
- 如果要做到 “每个登录用户看到自己的飞书 docs”，则必须有用户级鉴权与请求级 token 注入

---

## 2. 当前代码库可复用的基础能力

### 2.1 对话上下文注入能力

当前聊天侧已经有两类可复用能力：

- 文本片段上下文：
  - `packages/types/src/message/ui/params.ts`
  - `packages/context-engine/src/providers/PageSelectionsInjector.ts`
- 文件 / 知识库上下文：
  - `packages/context-engine/src/providers/KnowledgeInjector.ts`
  - `packages/prompts/src/prompts/files/file.ts`
  - `packages/prompts/src/prompts/files/knowledgeBase.ts`

现状判断：

- 适合承接 “选中文档片段后加入对话”
- 也适合承接 “先导入资源库，再作为文件或知识库引用”
- 但当前 `ChatContextContent` 只有 `type: 'text'`，并不原生支持 “外部文档引用”

### 2.2 资源库与导入能力

资源侧已经有一套成熟的文件 / 文稿 / 知识库体系：

- 资源入口：
  - `src/features/ResourceManager/components/Header/AddButton.tsx`
- Notion 导入 precedent：
  - `src/features/ResourceManager/components/Header/hooks/useNotionImport.ts`
- 文件 / 文稿读写：
  - `src/services/file/index.ts`
  - `src/server/routers/lambda/file.ts`

现状判断：

- 当前最稳的做法是把飞书文档接入到 `resource` 体系，而不是绕开资源体系直接进 prompt

### 2.3 MCP 与外部集成能力

当前库已经支持：

- 手工配置 MCP
- Streamable HTTP MCP
- Bearer / OAuth2 形态的 MCP auth 字段
- Klavis 外部服务集成

关键位置：

- MCP auth 类型：
  - `packages/types/src/plugins/mcp.ts`
  - `src/libs/mcp/types.ts`
- MCP 执行传 auth：
  - `src/app/(backend)/webapi/chat/[provider]/route.ts`
- 自定义 MCP 拉 manifest 时携带 auth：
  - `src/store/tool/slices/customPlugin/action.ts`
- Klavis 集成：
  - `packages/const/src/klavis.ts`
  - `src/server/routers/lambda/klavis.ts`
  - `src/server/routers/tools/klavis.ts`

现状判断：

- 这个库已经具备 “把 auth 传给 MCP” 的基础能力
- 但缺的是 “按当前用户动态注入 token” 的用户级鉴权管理能力

---

## 3. 为什么不能只靠预配置 token 的 MCP

预配置 token 的 MCP 适合：

- 单租户内部使用
- 所有人共用一个飞书账号
- 只需要访问一个共享文档空间

不适合：

- 每个登录用户看到自己的飞书文档
- 需要权限隔离
- 需要按用户审计
- 需要支持 refresh token / 过期续期

原因很直接：

- 飞书文档的可见范围是 “用户身份相关” 的
- 如果 MCP 只拿一个固定 token，那么看到的是 “服务账号可见的文档”，而不是 “当前用户可见的文档”

所以正式方案必须满足两件事：

1. 应用侧维护用户级飞书 OAuth 凭证
2. 调用 MCP 时按请求注入当前用户 token

---

## 4. 推荐架构

### 4.1 总体原则

采用：

- `应用侧做飞书 OAuth`
- `应用后端做 token 管理`
- `MCP/后端执行飞书文档操作`
- `聊天侧复用现有 context-engine`

避免：

- 在前端直接保存飞书 access token
- 把 token 固化进 MCP 静态配置
- 把整篇文档直接硬塞到 prompt

### 4.2 请求流

```text
用户登录 LobeHub
  -> 用户点击 “连接飞书”
  -> LobeHub Server 完成 Feishu OAuth
  -> Server 保存 userId 对应的 access_token / refresh_token / expires_at

用户打开飞书文档选择器
  -> Web 调用 LobeHub Server
  -> Server 取出当前 userId 的飞书 token
  -> Server 调用 MCP 或 Feishu API 获取 doc 列表
  -> 返回可选文档给前端

用户选择文档并发送消息
  -> 前端提交 doc 引用或导入结果
  -> Server 拉取文档内容 / 摘要 / 片段
  -> 转成 files / pageSelections / knowledge 输入
  -> context-engine 注入
  -> 模型生成回复
```

---

## 5. 两种可行落地路径

## 5.1 路径 A：资源库优先，推荐

用户选择飞书文档后，不直接把 “远程 doc 引用” 塞入消息，而是：

- 拉取文档内容
- 转换为 `document` 或 `file`
- 写入 `resource` 体系
- 聊天时按现有文件 / 知识库能力使用

优点：

- 与当前架构最一致
- 可缓存、可检索、可重复引用
- 支持知识库与 RAG 扩展
- 降低每次发送消息时的外部网络依赖

缺点：

- 首次导入链路更长
- 需要处理飞书文档到本地文稿格式的映射

适用：

- 需要长期引用文档
- 需要知识库 / 搜索 / 文档管理能力

## 5.2 路径 B：临时上下文注入

用户选中文档后：

- 不入库
- 只在本次对话中读取文档正文或摘要
- 作为 `pageSelections` 风格或新 metadata 类型注入

优点：

- 上手快
- 交互上更接近 “选文档即聊”

缺点：

- 当前类型体系不原生支持 “外部文档引用”
- 大文档 token 成本高
- 历史重放、缓存、权限续期更复杂

适用：

- 先做验证型 MVP
- 只做少量文档、短内容引用

### 5.3 结论

建议：

- 第一阶段 UI 可以做成 “选择飞书文档后加入对话”
- 但底层优先走路径 A，即先导入资源库，再进入现有上下文体系

---

## 6. MCP 在这套方案里的角色

MCP 可以承担飞书文档能力执行层，但不应承担完整的用户身份系统。

推荐职责边界：

- 应用后端负责：
  - 用户 OAuth
  - token 保存
  - token refresh
  - 鉴权审计
  - 为当前请求注入用户 token
- MCP 负责：
  - 列出 doc 列表
  - 搜索文档
  - 获取文档内容
  - 返回结构化结果

也就是说，MCP 需要的不是 “自己全自动做 OAuth”，而是：

- 支持 `request-level auth injection`
- 能接收应用后端传入的 Bearer token 或 access token

这与当前库的 MCP 类型设计是一致的，但现有实现更偏静态配置，还缺一层 “按用户动态组装 auth”。

---

## 7. 建议的数据模型

建议新增用户级集成表，而不是把飞书 token 混入通用插件配置。

示例：

### 7.1 `user_integrations`

字段建议：

- `id`
- `userId`
- `provider`，固定为 `feishu`
- `externalUserId`
- `externalTenantKey`
- `status`
- `createdAt`
- `updatedAt`

### 7.2 `user_integration_tokens`

字段建议：

- `integrationId`
- `accessToken`
- `refreshToken`
- `expiresAt`
- `scope`
- `rawProfile`
- `createdAt`
- `updatedAt`

原则：

- token 不放前端
- token 不直接持久化到 `plugin.customParams.mcp.auth`
- token 应与 LobeHub 用户主身份绑定

---

## 8. Server 侧建议职责拆分

### 8.1 OAuth 服务

新增 `FeishuIntegrationService`：

- 发起授权
- 校验 callback
- 交换 token
- 刷新 token
- 获取当前用户 integration

### 8.2 文档访问服务

新增 `FeishuDocService`：

- `listDocs`
- `searchDocs`
- `getDocMeta`
- `getDocContent`

该服务内部可以有两种实现：

- 直接调飞书 Open API
- 或者调 MCP server，并在调用时注入 token

### 8.3 Chat / Resource 适配层

新增 `FeishuDocAdapterService`：

- 把飞书文档内容转换为 `document/file`
- 或转换为临时 `pageSelections`
- 控制摘要化、截断、缓存策略

---

## 9. Web 侧建议交互

### 9.1 入口

推荐增加两个入口：

- `Settings / Profile / Authorizations` 下的 “连接飞书”
- `Resource` 页中的 “导入飞书文档”

### 9.2 Doc Picker

建议新增一个统一的文档选择器，而不是把飞书选择器散落在聊天输入栏。

建议能力：

- 最近文档
- 按标题搜索
- 显示文档类型 / 更新时间
- 支持单选或多选
- 支持 “导入资源库” 与 “仅本次对话引用” 两种动作

### 9.3 聊天侧展示

加入对话后建议显示为一种特殊 context tag：

- 图标：飞书
- 文案：文档标题
- 状态：已导入 / 临时引用

不要直接显示飞书 URL 文本。

---

## 10. 对 context-engine 的影响

### 10.1 最小改动方案

优先复用现有注入体系：

- 导入资源库后走 `fileList` / `knowledge`
- 文本摘录走 `pageSelections`

这样可以避免给 `MessagesEngine` 再加一套飞书专属 provider。

### 10.2 如需临时外部文档引用

如果后续确认 “无需导入、直接选远程 doc 进入上下文” 是长期能力，则建议扩展一类新的 message metadata，例如：

- `externalSelections`
- `externalDocuments`

再新增对应 provider，而不是滥用 `ChatContextContent.type = text`

---

## 11. 安全与权限要求

必须满足：

- token 存储在服务端
- 所有飞书文档访问都基于当前 LobeHub 登录用户
- 后端对每次文档访问保留审计日志
- token 过期时自动 refresh
- refresh 失败时要求用户重新授权

不建议：

- 前端直接持有 refresh token
- 共享一个固定飞书 token 给所有用户
- 将用户 token 长期写入插件静态配置

---

## 12. MVP 建议

### Phase 1

- 应用侧完成飞书 OAuth
- 服务端保存用户级 token
- Web 增加 “连接飞书”
- 提供文档列表接口
- 支持 “选择后导入资源库”

### Phase 2

- 聊天中支持从飞书文档选择器直接加入对话
- 选择后自动导入为文稿或文件
- 支持最近使用的飞书文档

### Phase 3

- 支持临时上下文引用，不必先入库
- 支持飞书文档搜索
- 支持基于飞书文档建立知识库

---

## 13. 最终建议

对于这个仓库，最合理的实现不是：

- “加一个飞书按钮，把文档 URL 扔进 prompt”

而是：

- “增加飞书用户级集成”
- “用后端拿当前用户 token 调 MCP / 飞书 API”
- “将结果接入现有 resource 与 context-engine 体系”

一句话总结：

> UI 上可以表现为 “选择飞书文档后加入对话”，但架构上应实现为 “用户级 OAuth + 请求级 token 注入 + 资源 / 上下文复用”。
