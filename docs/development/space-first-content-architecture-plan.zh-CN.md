# Space First 内容架构重构方案（Breaking Cutover，历史探索稿）

> 状态：**Superseded / 历史探索稿**\
> 复核时间：2026-03-28\
> 范围：围绕 `Space / Docs / Files / Agent / AI Sources` 的产品模型、数据模型、运行时模型与一次性切换方案。\
> 本文档记录的是一版 **激进 breaking-cutover 探索**：主张统一 `resource_nodes`、一步移除旧模型、完全不做后向兼容。\
> **它不再是当前 canonical 执行方案。**
>
> 当前应以以下文档为准：
>
> - [space-root-workspace-redesign-plan.zh-CN.md](/Users/arthur/RustroverProjects/lobehub/docs/development/space-root-workspace-redesign-plan.zh-CN.md)
> - [enterprise-local-cloud-blob-control-plane-plan.zh-CN.md](/Users/arthur/RustroverProjects/lobehub/docs/development/enterprise-local-cloud-blob-control-plane-plan.zh-CN.md)
>
> 本文档仍保留的价值主要是：
>
> - `Knowledge Base -> Source Set` 的问题拆解
> - `Agent Source Ref` 的演进思路
> - 对旧 `KB / Resource / Page` 模型的批判性分析
>
> 执行摘要：
>
> - 当前 LobeHub 的 `Knowledge Base` 同时承担产品容器、RAG 检索范围和 docs/files 兼容层三种职责，导致 `Space / Resource / Page / KB` 的边界不稳定。
> - 如果目标是做出接近飞书的体验，不应该继续在现有 `Page + Resource + KB` 三套模型上叠加兼容层，而应该直接切换到 `Space-first` 的单一内容架构。
> - 本方案不保留 `/page`、不保留 `/resource/library`、不保留 KB 作为产品概念，也不保留 “Agent 绑定 KB + 文件” 这一旧语义。
> - 新架构的唯一顶层容器是 `Space`；统一的存储骨架是 `resource_nodes`；统一的领域对象是 `Resource`；产品对象只暴露为 `Doc / File / Folder`。AI 是 Resource 的能力，不是新的内容层级。
> - Agent 不归属 Space，但可引用一个或多个 Space 下的内容来源；运行时不再围绕 `knowledgeBaseIds` 构建，而围绕通用 `Source Ref` 与 `resource_id` 构建。

## 一、历史前提

本方案以以下要求为前提，不再以兼容现有模型为目标：

1. **不做后向兼容**
2. **不保留旧路由作为长期 alias**
3. **不做双写**
4. **不做双读**
5. **不保留 KB 作为产品概念**
6. **不把 Agent 归属给 Space**
7. **产品体验优先于迁移复杂度**

这意味着：

- `/page` 将被删除。
- `/resource/library/:id` 将被删除。
- `knowledge_bases` 不再是用户可见内容容器。
- `searchSourceSet / readSourceFiles` 这类基于 KB 命名的工具与运行时语义将被替换。
- 当前围绕 `knowledgeBaseIds + fileIds` 的 Agent 来源模型将被整体替换。

## 二、当前系统的真实问题

### 2.1 KB 不是一个干净的概念

当前代码中，KB 同时是：

- 数据层实体
- 资源侧产品容器
- Agent 的检索范围
- docs 与 files 的桥接层

具体现状：

- `knowledge_bases` 是独立表，并带 `spaceId`
- `documents` 带 `knowledgeBaseId`
- `files` 通过 `knowledge_base_files` 进入 KB
- doc 加入 KB 时还会被解析成 mirror file，再写入 KB 文件关系
- Agent 当前只绑定 `knowledgeBases` 和 `files`
- RAG 当前按 `knowledgeBaseIds` 解析检索范围

这直接导致两个问题：

- 用户不知道 KB 是工作区、文件夹、AI 开关，还是检索范围
- 工程层也无法把 “内容结构” 和 “AI 配置” 干净分离

当前代码锚点：

- `packages/database/src/schemas/file.ts`
- `packages/database/src/models/knowledgeBase.ts`
- `src/server/services/document/index.ts`
- `src/server/routers/lambda/knowledgeBase.ts`
- `src/server/routers/lambda/agent.ts`
- `src/server/services/rag/index.ts`

### 2.2 Space 已经存在，但 Docs 不是 space-first

当前底层其实已经具备 `Space` 主容器的基础：

- `documents`、`files`、`knowledge_bases` 都有 `spaceId`
- `KnowledgeRepo` 已能按 `spaceId` 混合查 docs/files
- `file.getKnowledgeItems` 已能按 `spaceId` 返回统一列表

但产品入口被拆裂了：

- `/resource` 是 `space-first`
- `/page` 是独立入口
- `document.queryDocuments` 没有 `spaceId`
- `Page` UI 不是基于当前 Space 的主内容视图

结果是：

- 数据上 docs 属于 space
- 体验上 docs 却像独立系统

当前代码锚点：

- `src/routes/(main)/resource/index.tsx`
- `src/routes/(main)/page/index.tsx`
- `src/server/routers/lambda/document.ts`
- `packages/database/src/models/document.ts`
- `packages/database/src/repositories/knowledge/index.ts`
- `src/server/routers/lambda/file.ts`

### 2.3 Agent 的来源模型过旧

当前 Agent 的问题不是 “不独立”，而是 “来源模型过窄且不带 Space 语义”。

现状：

- `agents` 没有 `spaceId`
- Agent 只能绑定 KB 或 file
- Agent 不能直接绑定 doc
- Agent 选源接口返回的是全用户范围的 KB 和 file

这不符合目标体验：

- Agent 应该能显式知道某个来源来自哪个 Space
- Agent 应该能引用整个 Space、某个文件夹、某篇文档、某个文件
- Agent 不应该要求用户先理解 KB 才能配置来源

当前代码锚点：

- `packages/database/src/schemas/agent.ts`
- `src/server/routers/lambda/agent.ts`
- `src/store/agent/selectors/selectors.ts`

## 三、术语约束

这一节是本方案必须补上的语义收口层，用来避免实现时再次把概念揉成新的泥团。

### 3.1 产品层术语

产品层只允许出现以下词：

- `Space`：唯一顶层工作区容器
- `Doc`：正文型内容
- `File`：附件或原始资料
- `Folder`：组织结构与浏览范围
- `Source Set`：可复用的来源集合
- `Agent Source`：Agent 当前启用的来源引用

产品层禁止直接暴露：

- `Node`
- `Knowledge Base`
- `Library`
- `Resource`（除非在开发者向 UI 或设置高级页中解释技术概念）

### 3.2 领域层术语

领域层允许使用以下词：

- `Resource`：统一领域对象，承载 identity、tree、ACL、trash、AI enrollment
- `AI Policy`：某个 Resource 是否启用 AI 的策略信息
- `Index State`：某个 Resource 当前的解析、分块、向量化状态
- `Source Ref`：Agent 对内容范围的引用
- `Source Set`：可复用的来源集合

领域层的关键约束：

- `Resource` 是统一领域对象，不等于统一产品对象。
- `Folder / Doc / File` 共享 Resource 身份骨架，但业务能力不完全同构。
- `Source Set` 不是内容容器，不参与内容树，也不承担浏览入口。

### 3.3 存储层术语

存储层允许使用以下词：

- `resource_nodes`
- `document_bodies`
- `file_objects`
- `resource_ai_policies`
- `resource_index_states`
- `source_sets`
- `source_set_members`
- `agent_source_refs`

这里允许 `node` 出现，但它只代表树结构与统一主键，不代表产品语义。

### 3.4 废弃词

以下词在重构切换完成后应视为废弃词：

- `KB`
- `Knowledge Base`
- `Library`
- `Page`
- `knowledgeBaseIds`
- `agents_files`
- `agents_knowledge_bases`
- `searchSourceSet`
- `readSourceFiles`

### 3.5 命名原则

命名必须遵守以下规则：

- 表和底层存储可以叫 `resource_nodes`
- 领域对象和 service 主语应优先使用 `Resource`
- 产品对象必须使用 `Doc / File / Folder`
- API 不应以 `node.*` 作为主语

正确示例：

- `space.listResources`
- `resource.move`
- `resource.trash`
- `doc.updateBody`
- `file.upload`
- `folder.create`

错误示例：

- `node.create`
- `node.update`
- `node.getContent`
- `node.attachToAgent`

## 四、最终产品模型

### 4.1 唯一顶层：Space

最终产品模型中，`Space` 是唯一顶层工作区容器。

所有内容都必须先归属某个 Space：

- Doc
- File
- Folder
- Source Set

用户心智必须稳定为：

```text
先进入 Space
再在 Space 中创建/浏览内容
再决定哪些内容给 AI 用
再让 Agent 去引用这些内容
```

### 4.2 统一领域对象：Resource

最终内容系统不再并列维护 “Page 系统” 和 “Resource 系统”，而是统一为：

- 存储层：`resource_nodes`
- 领域层：`Resource`
- 产品层：`Doc / File / Folder`

`Resource` 只负责统一以下能力：

- identity
- tree
- ACL
- trash
- AI enrollment
- share / audit / search scope

这不意味着 `Folder / Doc / File` 在业务能力上完全同构。

更准确的说法是：

- `Folder` 是组织对象与范围解析对象
- `Doc` 是正文型内容对象
- `File` 是 blob 型内容对象

统一的是骨架，不是语义。

### 4.3 Resource Kind 能力矩阵

| 能力                    | Folder       | Doc | File |
| ----------------------- | ------------ | --- | ---- |
| 有 tree identity        | ✓            | ✓   | ✓    |
| 可被移动 / 回收站       | ✓            | ✓   | ✓    |
| 有正文 body             | ✗            | ✓   | ✗    |
| 有 blob/object          | ✗            | ✗   | ✓    |
| 可显示 AI 状态          | 作为子树范围 | ✓   | ✓    |
| 可直接加入 AI           | 作为子树范围 | ✓   | ✓    |
| 可被 Agent 单独引用     | 作为 scope   | ✓   | ✓    |
| 运行时作为 content unit | ✗            | ✓   | ✓    |

关键约束：

- `Folder` 可以被 Agent 引用，但它是 scope resolver，不是 content unit。
- `Doc` 和 `File` 才是运行时最终可消费的内容对象。
- 不允许在运行时抽象出 `getNodeContent()` 这类抹平差异的接口。

### 4.4 AI 不是容器，而是能力

最终产品中不再出现 `Knowledge Base` 这一主概念。

用户只会看到：

- `加入 AI`
- `移出 AI`
- `AI 可检索`
- `索引中`
- `固定给 Agent`

AI 的本质是 Resource 的能力与来源引用，不是新的内容树。

### 4.5 Source Set 的唯一职责

`Source Set` 只承担一件事：定义一组可复用的来源引用。

它明确不承担以下职责：

- 不是内容容器
- 不参与内容树
- 不作为主浏览入口
- 不作为 Space 的替代层级
- 不承载 KB 式的产品心智

如果需要默认来源集合：

- 每个 Space 可以有一个 `default` Source Set
- 但它仍然只是来源视图，不是新的内容空间

### 4.6 Agent 是跨 Space 的消费者

Agent 保持独立对象，不归属任何单一 Space。

但 Agent 的来源必须显式带 Space 语义。

Agent 可引用的来源类型：

- 整个 Space
- 某个 Folder
- 某个 Doc
- 某个 File
- 某个 Source Set

补充约束：

- Notebook 中出现的文档，本质上仍然必须是某个 Space 内的 `Doc`
- Topic 只能组织和引用 Space 内资源，不能绕开 Space 产生一套平行内容模型

## 五、最终 UX 设计

本节是 **产品界面契约**，不是视觉建议。

目标只有一个：用户进入系统后，始终感知到自己在某个 `Space` 内组织 `Doc / File / Folder`，而不是在多个历史概念之间跳转。

### 5.1 顶层导航

唯一推荐导航：

- 全局左上：`Space Switcher`
- Space 顶栏：`Space 名称 / 搜索 / 新建`
- Space 内主导航：`Home / Docs / Files / Trash / Settings`

顶栏 `新建` 菜单只允许：

- `新建文档`
- `新建文件夹`
- `上传文件`

不允许再出现：

- `新建 KB`
- `新建 Library`
- `新建 Resource`

不再保留：

- `Page`
- `Resource`
- `Library`
- `Knowledge Base`

硬约束：

- Space 是唯一一级工作上下文
- `Docs / Files / Trash / Settings` 全部是当前 Space 的子视图
- 不允许出现 “离开 Space 再进入 Page/Resource” 的平行主入口

### 5.1.1 全局壳与 Space 壳

界面必须明确区分：

- 全局壳：Space 切换、全局搜索、用户菜单
- Space 壳：当前 Space 的导航、内容区、上下文动作

这意味着：

- Space 切换是全局动作
- 文档树、文件列表、回收站、AI 管理都是当前 Space 的内容动作
- Topic、Notebook、Agent 来源选择都必须显式带出当前 Space

### 5.1.2 搜索与全局命令

全局搜索应支持跨 Space 查找，但展示结果时必须明确显示：

- 所属 Space
- 资源类型
- 所在路径

全局命令面板允许跨 Space 跳转，但不允许把 Space 语义隐藏掉。

### 5.2 Space Home

`Home` 应该成为进入 Space 后的统一首页，包含：

- 最近编辑 Docs
- 最近上传 Files
- 最近使用的 Folder
- AI 状态概览
- 待处理内容
- 最近被 Agent 使用的来源
- 最近使用的 Source Set

推荐布局：

- 左列：最近编辑 Docs、最近上传 Files
- 中列：当前 Space 的内容概览与快速入口
- 右列：AI 队列、索引失败、Agent 来源使用情况

`Home` 不是欢迎页，也不是 marketing 页面，而是当前 Space 的工作台。

Home 的目标不是提供新概念，而是把这个 Space 当前最重要的内容直接呈现给用户。

### 5.3 Docs

`Docs` 是当前 Space 的文档树与文档列表视图。

必须具备：

- 树形导航
- 列表 / 表格切换
- 所属文件夹显示
- AI 状态显示
- 最近更新时间
- 直接的 `加入 AI / 移出 AI` 操作

推荐布局：

- 左侧：文件夹树
- 中间：当前文件夹下的文档列表或表格
- 右侧：详情侧板或进入编辑器

默认排序优先级：

- 最近编辑
- 手动固定
- 标题

文档列表至少显示：

- 标题
- 所在文件夹
- 所属 Space
- AI 状态
- 最近编辑时间
- 被哪些 Agent 引用

文档详情页或头部信息必须统一显示：

- 面包屑路径
- `Doc` 类型标签
- AI 状态 pill
- 所属 Space
- 快速动作：`加入 AI`、`移出 AI`、`添加到来源集`、`固定给智能体`

不允许用户在 `Docs` 视图里感知到 KB。

### 5.4 Files

`Files` 是当前 Space 的附件与资料视图。

必须具备：

- 文件列表
- 文件预览
- 解析 / 分块 / 向量化状态
- AI 状态显示
- 所属文件夹
- 直接的 `加入 AI / 移出 AI` 操作

推荐布局：

- 默认是表格视图
- 图片、音频、视频、PDF 等类型筛选只作为二级 filter chip
- 不再使用 MIME 类型导航取代 Space 内容导航

文件列表至少显示：

- 名称
- 所在文件夹
- 文件类型
- 文件大小
- AI 状态
- 最近更新时间
- 被哪些 Agent 引用

文件详情页或头部信息必须统一显示：

- 面包屑路径
- `File` 类型标签
- AI 状态 pill
- 解析流水线状态
- 所属 Space
- 快速动作：`加入 AI`、`移出 AI`、`添加到来源集`、`固定给智能体`

图片、音频、视频、Markdown、PDF 等文件的具体预览方式可以不同，但顶部语义必须一致。

### 5.5 AI 体验

AI 不应作为一级导航概念暴露成 “新的库”。

推荐设计：

- 在 Docs/Files 列表中，用统一的 AI 状态标签表达是否可被检索
- 在 `Space Settings > AI` 中提供集中管理页
- 在 Agent 来源选择器中提供来源选择，而不是暴露 KB 列表

推荐状态：

- 未加入 AI
- 索引排队中
- 解析中
- 向量化中
- 可检索
- 失败

补充约束：

- `Folder` 不显示 “可检索” 这种内容级状态
- `Folder` 只显示范围级动作，例如 `子项加入 AI`、`子项移出 AI`
- `Doc / File` 才显示内容级索引状态

### 5.5.1 Space Settings > AI

`Space Settings > AI` 应作为集中管理入口，负责：

- 查看当前 Space 的 AI 策略
- 查看 Source Set
- 查看索引队列、失败项、重试入口
- 查看哪些 Agent 正在引用当前 Space 或其子范围

它是管理页，不是内容页。

### 5.6 Agent 来源选择器

Agent 配置页中，来源选择器是这个方案成败的关键。

推荐交互：

1. 先选 Space
2. 再选范围：
   - 整个 Space
   - 某个 Folder
   - 某个 Doc
   - 某个 File
   - 某个 Source Set
3. 预览可用内容数、AI 可用状态与预计上下文规模
4. 保存为 Agent 的来源引用

来源芯片必须直观显示：

- 来源名称
- 来源类型
- 所属 Space
- 是否启用

补充约束：

- 来源类型必须显式区分 `Space / Folder / Doc / File / Source Set`
- 不允许在 Agent UI 中出现 `KB`、`Library`、`Resource` 作为主要来源标签
- 不允许用过宽的 `Node` / `Resource` 词汇替代具体来源类型

推荐卡片信息：

- 名称
- 类型
- 所属 Space
- AI 可用状态
- 内容规模预估
- 末次更新时间

Agent 来源选择器应始终使用 “先选 Space，再选范围” 的流程，而不是先扔给用户一张全局 KB / 文件清单。

### 5.7 Notebook 与 Topic 视图

`Notebook` 不应继续作为独立内容系统存在，而应收敛为：

- Topic 下的一组 `Doc` 资源视图
- 这些 `Doc` 仍然归属某个 `Space`
- Topic 只是组织和回溯上下文，不是新的内容容器

这意味着：

- 用户在 Notebook 中看到的是 “这个 Topic 关联的文档”
- 而不是 “一套脱离 Space 的 notebook 文档系统”

产品约束：

- Notebook 只能显示 `Doc`
- Notebook 中新建文档时，必须明确落到当前 Topic 所属的 `Space`
- Notebook 不应再默认落到 Personal Space

推荐 UI：

- 将 `Notebook` 重新表述为 Topic 下的文档视图
- 默认分区为：
  - `Plan`
  - `Notes`
  - `Saved from Web`
- 每个分区中的条目，本质上都只是当前 Topic 关联的 `Doc`

Topic 视图中必须显示：

- 当前 Topic 所属 Space
- 关联文档数量
- 最近更新的文档
- 来自 Web Browsing / GTD 的自动产出文档

不允许 Topic/Notebook 再生成一套脱离 Space 的平行文档树。

### 5.8 统一详情壳

`Doc / File / Folder` 虽然是不同类型，但详情页必须使用统一信息壳：

- 面包屑
- 类型标签
- 所属 Space
- 所在文件夹
- AI 状态或范围状态
- 分享 / 权限入口
- Agent 引用情况

统一的是外壳，不统一的是内容区：

- `Doc` 内容区是编辑器或正文预览
- `File` 内容区是文件预览与元信息
- `Folder` 内容区是子项列表与范围操作

### 5.9 Mobile 交互

移动端不应直接压缩桌面三栏布局，而应重新组织为：

- Space 导航折叠为顶部切换器与抽屉
- 文件夹树折叠为抽屉
- Agent 来源选择器使用全屏选择页
- 资源详情页优先显示关键状态与主要动作

移动端仍需保持相同的语义约束：

- 先看到 Space
- 再看到 Doc / File / Folder
- 最后才看到 AI 状态与 Agent 引用

### 5.10 术语迁移与文案约束

主界面与默认文案必须完成以下迁移：

- `Page` -> `Doc`
- `Pages` -> `Docs`
- `Resource` -> 不作为一级产品词暴露
- `Library` -> `Source Set`
- `Knowledge Base` -> 不作为主界面词汇出现

仅在高级设置、开发者说明或迁移文档中，允许解释历史名词与底层实现名词。

## 六、最终技术架构

### 6.1 路由

最终路由应收敛为：

- `/space/:spaceId`
- `/space/:spaceId/docs`
- `/space/:spaceId/files`
- `/space/:spaceId/trash`
- `/space/:spaceId/settings`
- `/space/:spaceId/resource/:resourceId`

明确删除：

- `/page`
- `/page/table`
- `/resource`
- `/resource/library/:id`

这是一条 **breaking route cutover**，不保留长期 alias。

### 6.2 语义分层与 API 约束

技术实现必须严格区分三层：

- 产品层：`Doc / File / Folder / Source Set`
- 领域层：`Resource / AI Policy / Index State / Source Ref`
- 存储层：`resource_nodes / document_bodies / file_objects / ...`

API 约束：

- 通用行为走 `resource.*`
- 专有行为走 `doc.* / file.* / folder.*`
- 不允许新增 `node.*` 风格 API

运行时约束：

- `Folder` 在运行时只做 scope 解析
- `Doc / File` 才能成为最终的 content unit
- `Source Set` 只返回一组来源引用，不直接承担内容树职责

### 6.3 数据模型

推荐直接重构为统一骨架加分表模型。

#### 6.3.1 `resource_nodes`

字段建议：

- `id`
- `space_id`
- `parent_id`
- `kind`：`folder | doc | file`
- `title`
- `slug`
- `resource_uid`
- `created_by`
- `updated_by`
- `deleted_at`
- `created_at`
- `updated_at`

职责：

- 作为统一内容树的存储骨架
- 承载列表、树、搜索、回收站、ACL 的统一主键
- 不直接承担产品语义

#### 6.3.2 `document_bodies`

字段建议：

- `resource_id`
- `editor_data`
- `plain_text`
- `total_char_count`
- `total_line_count`
- `metadata`
- `created_at`
- `updated_at`

职责：

- 仅保存 doc 的正文和编辑器数据
- 不再让 `folder` 混在文档正文表中

#### 6.3.3 `file_objects`

字段建议：

- `resource_id`
- `blob_id`
- `mime_type`
- `size`
- `hash`
- `source`
- `metadata`
- `created_at`
- `updated_at`

职责：

- 仅保存 file 的对象存储信息与元数据

#### 6.3.4 `resource_ai_policies`

字段建议：

- `resource_id`
- `enabled`
- `created_at`
- `updated_at`

职责：

- 表达某个 Resource 是否启用 AI
- 这是 policy/config，不承载流水线状态
- 仅适用于 `doc | file`
- `folder` 的 “加入 AI” 是范围动作，不生成内容级 AI policy

#### 6.3.5 `resource_index_states`

字段建议：

- `resource_id`
- `parse_status`
- `chunk_status`
- `embedding_status`
- `last_indexed_at`
- `last_error`
- `created_at`
- `updated_at`

职责：

- 表达索引流水线当前状态
- 与 AI policy 分离，避免演化为状态垃圾抽屉
- 必要时可继续拆出 `resource_index_jobs`
- 仅适用于 `doc | file`

#### 6.3.6 `source_sets`

字段建议：

- `id`
- `space_id`
- `name`
- `description`
- `system_kind`：`default | custom`
- `created_by`
- `created_at`
- `updated_at`

#### 6.3.7 `source_set_members`

字段建议：

- `source_set_id`
- `resource_id`

职责：

- 提供可复用的来源集合
- 替代当前 KB 的 “命名集合” 职责
- `default` source set 可以作为 Space 的默认 AI 内容集合
- 但不参与内容树、不承担浏览入口、不替代工作区层级

#### 6.3.8 `topics`

`topics` 必须补 `space_id`。

原因：

- 当前 topic 没有 `spaceId`
- 当前 notebook 创建文档时只能 fallback 到 Personal Space
- 这与 `Space-first` 是直接冲突的

重构后的原则：

- Topic 必须显式归属某个 Space
- Topic 内引用的 Resource 必须与 Topic 属于同一 Space

#### 6.3.9 `topic_resources`

当前 `topic_documents` 应重构为 `topic_resources`。

字段建议：

- `topic_id`
- `resource_id`
- `user_id`
- `created_at`

职责：

- 让 Topic 关联统一的 Resource 主键
- Notebook 视图只展示其中 `kind = doc` 的资源
- 未来若 Topic 需要引用 File，也无需再新增平行关联表

### 6.4 Agent 来源模型

新增统一的 `agent_source_refs`。

字段建议：

- `agent_id`
- `ref_kind`：`space | folder | doc | file | source_set`
- `ref_id`
- `mode`：`search | inject`
- `enabled`
- `created_at`
- `updated_at`

语义：

- `space`：引用整个 Space
- `folder`：引用某个 Folder 子树范围
- `doc`：引用单个 Doc
- `file`：引用单个 File
- `source_set`：引用命名来源集合

这会直接替代：

- `agents_knowledge_bases`
- `agents_files`

补充约束：

- 对外 contract 不使用泛化的 `resource` 或 `node` 作为 ref kind
- 底层实现仍可把 `folder/doc/file` 统一解析到 `resource_id`
- `folder` 是 scope 引用，不是 content unit
- `doc/file` 是具体内容引用

### 6.5 RAG / Context 运行时

运行时不再围绕 `knowledgeBaseIds` 构建，而围绕 `source refs -> resource ids` 构建。

最终流程：

1. Agent 读取自己的 `agent_source_refs`
2. 将来源引用解析为一组 `resource_ids`
3. 根据 `resource_ai_policies` 和 `resource_index_states` 过滤出可检索 Resource
4. 对对应正文或文件内容进行 chunk 检索
5. 根据 `mode` 决定是做语义搜索还是全文注入

推荐改动：

- `KnowledgeInjector` 改成 `SourceInjector`
- `searchSourceSet` 改成 `searchSources`
- `readSourceFiles` 改成 `readSources`
- Chunk / Embedding / Search 全部围绕 `resource_id` 建立索引

实现约束：

- 运行时不直接消费 `Folder`
- `Folder` 只能在来源解析阶段展开为一组子资源
- `Doc` 和 `File` 才是检索与注入的最终输入单元

联动改造范围：

- `ChunkModel` 现阶段仍然围绕 `fileId` 与 `fileChunks` 建模
- `ServerRagService` 现阶段仍然把 `knowledgeIds` 解析成 `fileIds`
- 这次重构必须把 chunk /embedding/semantic search 的主键切到 `resource_id`
- `Doc` 不应再依赖 mirror file 才能进入检索链路

目标：

- Doc 与 File 共享统一的检索入口
- RAG 不再区分 “这是 KB 来的 file” 和 “这是 doc 的 mirror file”
- search /read tool 只面向 Source Ref 和 Resource

### 6.6 S3 与 Blob Storage

这里不做激进改动。

保持原则：

- S3 继续仅作为 blob storage
- `space_blobs` 继续作为对象登记层
- 工作区、目录树、权限、索引状态都留在 DB

也就是说：

- 这是 breaking cutover，但 **不是** 存储模型推翻
- 不应该把 S3 key 改造成 “工作区目录树”

### 6.7 Notebook / GTD / Web Browsing 联动改造

这次重构不是只改主内容页，还必须同步改以下内置链路：

- `packages/builtin-tool-notebook/*`
- `src/server/routers/lambda/notebook.ts`
- `src/server/services/notebook/*`
- `src/store/notebook/*`
- `src/features/Portal/Notebook/*`
- `packages/builtin-tool-gtd/*`
- `src/services/chat/mecha/contextEngineering.ts`
- `src/store/tool/slices/builtin/executors/lobe-web-browsing.ts`

原因：

- Notebook 当前是本仓内置 builtin tool，不是云端黑盒
- 它直接写 `documents`，并通过 `topic_documents` 关联 topic
- GTD 通过 notebook 的 `agent/plan` 文档拿计划与 todos
- Web Browsing 会把抓取结果直接保存到 notebook 文档

重构要求：

- Notebook 改为 Topic 视图，不再是单独的文档系统
- GTD 的 plan 文档改为 Topic 关联的 `Doc` 资源
- Web Browsing 保存结果时必须创建 `Doc` 资源并关联 Topic 与 Space
- 所有 notebook 相关写入都必须显式带 `space_id`

## 七、一次性切换方案

### 7.1 切换原则

本方案采用一次性切换，不做长期兼容层。

明确原则：

- 不做旧路由 alias
- 不做旧新模型双写
- 不做旧新模型双读
- 不保留旧 KB UI
- 不保留旧 Agent 来源接口

允许：

- 一次性迁移窗口
- 写入冻结
- 迁移脚本
- 数据重建
- 搜索索引重建

### 7.2 回滚与校验协议

不做产品兼容层，不等于不需要运行级回滚协议。

必须预先定义：

- **数据库回滚方式**
  - 采用 cutover 前快照回滚，而不是旧新模型共存
- **索引失败降级方式**
  - 若 chunk /embedding 重建未完成，新内容系统只能以只读或无 AI 模式开放，不能半切到错误检索
- **校验 hard gates**
  - 任一关键校验不通过，cutover 不得放量

建议的 hard gates：

1. `resource_nodes` 总数与旧 `documents + files` 迁移总数一致
2. `document_bodies` 数量与应迁移 doc 数量一致
3. `file_objects` 数量与应迁移 file 数量一致
4. `topic_resources` 数量与旧 `topic_documents` 映射数量一致
5. `agent_source_refs` 数量与旧 Agent 来源映射数量一致
6. `resource_id` 维度的 chunk /embedding 索引构建完成率达到 100%
7. Spot check 的 ACL、回收站、搜索、Notebook、GTD、Web Browsing 写入链路全部通过

建议的 rollback 触发条件：

- 资源树映射出现系统性 parent/space 错位
- topic 与 space 的关联校验失败
- Notebook/GTD/Web Browsing 任一核心链路不可用
- RAG 检索结果出现大面积空集或跨空间越权

建议的回滚形态：

- 回滚数据库快照
- 回滚新索引
- 恢复旧前端入口与旧 router 发布版本

这不是 “兼容运行”，而是 “切换失败后的整体验证式回退”。

### 7.3 迁移步骤

#### Step 1：冻结写入

在 cutover 窗口内冻结以下写入：

- Doc 创建 / 编辑
- File 上传 / 移动 / 删除
- KB 创建 / 修改
- Agent 来源修改
- Notebook 文档创建 / 编辑 / 删除
- GTD plan/todo 写入
- Web Browsing 自动落库

#### Step 2：创建新表

创建以下新表：

- `resource_nodes`
- `document_bodies`
- `file_objects`
- `resource_ai_policies`
- `resource_index_states`
- `source_sets`
- `source_set_members`
- `agent_source_refs`
- `topic_resources`

同时改造：

- `chunks`
- `embeddings`
- `topics`（补 `space_id`）

使其从 `file_id` 导向 `resource_id`。

如果底层为了迁移便利暂时保留 node 词，也只能停留在存储层，不得上浮到 API 和产品语义。

#### Step 3：迁移内容树

把当前数据迁移成统一 Resource 骨架：

- `documents.fileType = custom/folder` -> `resource_nodes.kind = folder`
- 其他真实文档 -> `resource_nodes.kind = doc`
- 所有文件 -> `resource_nodes.kind = file`

迁移规则：

- 原 `spaceId` 直接迁移到 `space_id`
- 原 `parentId` 映射为新的 `parent_id`
- 原 doc 标题、slug、删除状态直接映射
- folder 不再进入正文表

#### Step 4：迁移文档正文与文件对象

- 文档正文迁移到 `document_bodies`
- 文件对象信息迁移到 `file_objects`
- 旧的 mirror file 关系不再作为目标模型保留

这里的核心决定：

- 旧 `documents.fileId` 的镜像结构只用于迁移过程
- 迁移完成后，doc 和 file 都由统一 Resource 骨架驱动

#### Step 5：迁移 KB 为 Source Sets

不保留 KB 作为产品概念，但保留其 “命名来源集合” 的数据价值。

迁移规则：

- 每个旧 KB 迁移为一个 `source_set`
- 原 KB 的成员迁移到 `source_set_members`
- 对其中 `doc | file` 成员，把 `resource_ai_policies.enabled` 置为 `true`
- 若历史上存在 folder 级 AI 入口，只迁移为范围引用，不生成 folder 级内容状态

额外规则：

- 每个 Space 生成一个 `default` source set
- 若旧 KB 中存在默认 / 主集合语义，可合并到该 default source set
- 旧 KB ID 不再在任何产品层或 API 层暴露

#### Step 6：迁移 Topic / Notebook

迁移规则：

- 为所有 topic 回填 `space_id`
- 原 `topic_documents` -> `topic_resources`
- Notebook 入口仅展示 `topic_resources` 中的 `doc` 资源
- 所有 notebook builtin tool 和 portal 读写改成面向 `Resource + Topic`

额外校验：

- Topic 关联的 Resource 必须与 Topic 属于同一 Space
- 不允许 notebook 文档继续默认落到 Personal Space

#### Step 7：迁移 Agent 来源

迁移规则：

- 原 `agents_knowledge_bases` -> `agent_source_refs(ref_kind = source_set)`
- 原 `agents_files` -> `agent_source_refs(ref_kind = file)`

如果旧 Agent 曾依赖某个 KB：

- 迁移后它依赖的是同名 `source_set`
- 不再依赖 KB

#### Step 8：重建索引

必须重建：

- chunk 索引
- embedding 索引
- search 索引

新索引主键应统一为 `resource_id`。

#### Step 9：切换前端与 API

切换后只保留新入口：

- 新路由
- 新 API
- 新 store
- 新 Agent 来源 UI

所有旧页面、旧 router、旧 selector、旧 service 同步下线。

#### Step 10：移除旧模型

切换完成并验收后，删除以下旧路径与旧语义：

- `/page`
- `/resource/library`
- `knowledgeBaseRouter`
- `agents_knowledge_bases`
- `agents_files`
- `KnowledgeInjector`
- `searchSourceSet`
- `readSourceFiles`

以及一切以 KB 为主概念的 UI。

## 八、必须删除或重写的模块

### 8.1 路由与页面

必须删除或重写：

- `src/routes/(main)/page/*`
- `src/routes/(main)/resource/*`
- `src/features/Pages/*`
- 资源侧 `Library` 相关布局与 sidebar

### 8.2 后端 Router

必须删除或重写：

- `src/server/routers/lambda/knowledgeBase.ts`
- `src/server/routers/lambda/document.ts`
- `src/server/routers/lambda/file.ts`
- `src/server/routers/lambda/agent.ts`
- `src/server/routers/lambda/notebook.ts`

要求：

- 不再暴露 KB 语义
- 全部收敛到 `space + resource + source_set + agent_source_ref`

### 8.3 数据模型

必须删除或淘汰：

- `knowledge_bases`
- `knowledge_base_files`
- `agents_knowledge_bases`
- `agents_files`
- 旧 `documents` 作为 folder/doc 混合表的语义
- `topic_documents`

### 8.4 运行时

必须删除或重写：

- `KnowledgeInjector`
- 以 `knowledgeBaseIds` 为核心参数的执行路径
- KB 命名的 builtin tool
- notebook builtin tool 的旧 document/topic 直写路径

## 九、验收标准

### 9.1 产品体验

验收标准必须满足：

- 用户从任何入口进入内容系统时，只感知到 `Space`
- 用户在一个 Space 中同时管理 Docs 和 Files，不再感知 `Page` 或 `Resource` 的分裂
- 用户无需理解 KB 也能完成 “内容创建 -> 加入 AI -> Agent 引用”
- Agent 来源选择器中，所有来源都显式带所属 Space
- AI 状态在内容列表中可见、可操作、可解释

### 9.2 数据与接口

验收标准必须满足：

- 所有内容查询都以 `space_id + resource` 为核心模型
- 所有新建内容都必须显式归属 Space
- Agent 来源统一收敛到 `agent_source_refs`
- chunk /embedding/ 检索索引统一围绕 `resource_id`

### 9.3 运行时

验收标准必须满足：

- Agent 不再依赖 `knowledgeBaseIds`
- Doc 与 File 都能作为统一来源被检索或注入
- Source Set 仅作为来源集合，不再承担内容容器职责

## 十、主要风险

本方案是高收益、高风险的破坏式重构。

主要风险：

- 一次性迁移窗口长
- 索引重建成本高
- 旧数据质量问题会在迁移时集中暴露
- 前后端切换必须严格同步，不能容忍半切状态

但如果目标是：

- 不要概念负担
- 不要历史包袱
- 不要 “勉强兼容” 的交互

那么这条路线比在旧模型上修修补补更正确。

## 十一、建议结论

如果这次重构的唯一目标是 “产品体验绝佳”，那就不应该把时间花在兼容旧概念上，而应该直接做如下决定：

1. **删掉 KB 作为产品概念**
2. **删掉 `/page` 与 `/resource` 的双系统**
3. **统一为 `Space -> Resource` 的单模型**
4. **把 AI 变成内容能力，而不是容器**
5. **把 Agent 来源改成通用 `Source Ref`**

这会是一场真正意义上的架构切换，而不是现有模型上的修补。

## 十二、关键代码锚点

以下是本方案基于当前仓库状态复核过的关键代码：

- `packages/database/src/schemas/file.ts`
- `packages/database/src/schemas/topic.ts`
- `packages/database/src/models/document.ts`
- `packages/database/src/models/topicDocument.ts`
- `packages/database/src/models/knowledgeBase.ts`
- `packages/database/src/repositories/knowledge/index.ts`
- `packages/database/src/schemas/agent.ts`
- `packages/builtin-tool-notebook/src/ExecutionRuntime/index.ts`
- `packages/builtin-tool-gtd/src/executor/index.ts`
- `src/server/services/document/index.ts`
- `src/server/services/notebook/index.ts`
- `src/server/services/rag/index.ts`
- `src/server/routers/lambda/document.ts`
- `src/server/routers/lambda/file.ts`
- `src/server/routers/lambda/knowledgeBase.ts`
- `src/server/routers/lambda/agent.ts`
- `src/server/routers/lambda/notebook.ts`
- `src/routes/(main)/resource/index.tsx`
- `src/routes/(main)/page/index.tsx`
- `src/features/AgentSetting/AgentKnowledge/index.tsx`
- `src/features/Portal/Notebook/Body.tsx`
- `packages/context-engine/src/providers/KnowledgeInjector.ts`
- `src/server/modules/AgentRuntime/RuntimeExecutors.ts`
- `src/store/tool/slices/builtin/executors/lobe-web-browsing.ts`
- `src/services/chat/mecha/contextEngineering.ts`
- `docs/development/resource-tree-sharing-security-plan.zh-CN.md`
- `docs/development/rag-support-audit.zh-CN.md`
