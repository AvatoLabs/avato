# 内容 Sidebar 与 Space-Scoped Conversation 方案

> 更新时间：2026-03-28\
> 目标：先收敛内容页 sidebar 的信息架构，再为后续 `content / conversation / source set` 模型统一提供一个增量方案。\
> 策略：**本轮只改 UI 信息架构，不改底层数据语义；后续按阶段收口。**

## 一、已实施的 Sidebar 调整

桌面端内容页 sidebar 先收口到一个更清晰的职责边界：

- sidebar 只承担 **scope-first navigation**
- 类型分类不再放在 desktop sidebar
- 类型分类移到 explorer header，作为当前范围内的 **secondary filter**

当前这轮改动只影响桌面端内容页：

- Home sidebar 顶部只保留 `Content` 标题，不再放 `Home / Docs / Images / Audios / Videos`
- 内容类型筛选放到 explorer header
- source set sidebar 继续保持 `返回 / source set / tree / trash` 的结构

这样做的原因：

1. `space / source set` 是导航轴线
2. `type` 是筛选轴线
3. 不应该在左侧同时维护两棵导航树

## 二、当前仍未收口的两个问题

### 2.1 content 和 conversation 还不是一套统一协作模型

当前更合理的目标，不是让两者强行共用一张表，而是统一以下规则：

- 所有内容对象和会话对象都必须有明确的 `space` 作用域
- 读取、搜索、最近访问、创建动作都先按 `spaceId` 收口
- 容器语义由各自领域承担
  - 内容域：`source set`
  - 会话域：`agent / chatGroup`

目标状态：

- `topic.spaceId` 必填
- `topic.agentId` / `topic.groupId` 二选一
- `thread / message` 主要挂 `topicId`，继承 `space` 和容器语义

前端展示规则：

- Agent 页面继续按 `agent -> topics` 展示
- 但查询条件必须带当前 `spaceId`
- 跨空间入口（搜索、最近访问、回链）才显式展示 `space`

### 2.2 source set 对 file 和 document 的成员关系仍是双轨表达

当前同时存在：

- `source_set_files`
- `documents.sourceSetId`

这会带来两个问题：

1. `file` 和 `document` 的归属规则不一致
2. source set 既有 folder tree，又有双轨 membership，模型不够自洽

建议目标模型先做一个明确取舍：

#### 推荐：单归属、单轨表达

如果 source set 被定义成 “有树结构的资料库”，那一个内容项就应该只属于一个 source set。

建议收口为：

- `file.sourceSetId`
- `document.sourceSetId`
- 逐步退役 `source_set_files`

优点：

- 与 folder tree 一致
- 查询更简单
- UI 心智稳定

#### 备选：多归属、membership 挂树位置

如果产品坚持 “同一文件能属于多个 source set”，那就不能只保留 membership join。

必须把以下信息也挂到 membership 上：

- parent
- sort order
- possibly local visibility / pin state

这会是另一套更重的模型，不适合与当前内容页 sidebar 改造同一阶段推进。

## 三、Topic 列表规则

未来 topic 列表不应该简单改成 “按 space 取代 agent”。

正确规则是：

- **作用域按 `spaceId`**
- **呈现按 `agent`**

也就是：

- agent 页面：`spaceId + agentId -> topics`
- groupchat 页面：`spaceId + groupId -> topics`
- 全局入口：允许 `space` 维度显式展示

用户心智保持：

- topic 属于当前 agent
- 当前 agent 位于当前 space

而不是让用户直接感知 “topic 同时属于 agent 和 space”。

## 四、Source Set 文件夹逻辑

### 4.1 结论

source set 完全可以支持 “资料库内文件夹树” 的逻辑，而且当前代码已经有一部分基础：

- source set 详情页已经有独立 tree sidebar
- folder 节点已经能在 source set 视图下展开、导航和重命名
- 在 source set 内创建 folder 时，当前实现已经把 folder 作为 `document(fileType='custom/folder')` 来承载

对应实现锚点：

- [SourceSetTree](/Users/arthur/RustroverProjects/lobehub/src/features/ContentManager/components/SourceSetTree/index.tsx)
- [HierarchyNode](/Users/arthur/RustroverProjects/lobehub/src/features/ContentManager/components/SourceSetTree/HierarchyNode.tsx)
- [DocumentService.createDocument](/Users/arthur/RustroverProjects/lobehub/src/server/services/document/index.ts)

所以问题不是 “能不能支持文件夹”，而是 “要不要把 source set 真正定义成一个树根容器”。

### 4.2 推荐目标

如果 source set 被定义成 “有树结构的资料库”，建议采用以下规则：

- source set 是一个 **virtual root**
- source set 内的所有 `file / document / folder` 都必须有相同的 `sourceSetId`
- `parentId = null` 表示该资源位于 source set 根层
- `parentId` 非空时，仍然只指向 folder document
- folder 继续使用 `document(fileType='custom/folder')`

这样可以把 source set 视图稳定解释为：

- 一个 library root
- 根下可以有 folder /doc/file
- folder 下可以继续嵌套

### 4.3 为什么这要求 source set membership 收成单轨

当前 source set 成员关系是双轨：

- `documents.sourceSetId`
- `source_set_files`

这对纯 “收集器” 是可行的，但对 “有文件夹树的资料库” 并不干净。

因为树结构要求每个内容项都有稳定的：

- 所属 source set
- 在树中的 parent

如果未来继续保留 file 侧的多对多 membership，那么同一个 file 进入多个 source set 时，就会立刻遇到一个问题：

- 它在每个 source set 下的 `parent` 是什么？

因此有两个选择：

#### 推荐：source set 作为单归属库根

- `file.sourceSetId`
- `document.sourceSetId`
- `parentId` 承担树结构
- `source_set_files` 逐步退役

#### 不推荐但可行：source set 作为多归属库

如果产品坚持一个文件可在多个 source set 中出现，那么 membership 表必须升级为真正的 “树位置表”，至少补：

- `parentId`
- `sortOrder`
- optional local pin / visibility state

否则只靠 `source_set_files(fileId, sourceSetId)` 无法表达库内树位置。

### 4.4 推荐实施方式

对 source set 文件夹树，我建议按下面的顺序落地：

1. 先保留现有 UI tree 结构
2. 把 source set 明确成 “库根”
3. 收口成员关系到单轨归属模型
4. 再开放 source set 内局部类型筛选

不要反过来先做更多 filter 或更多 membership 兼容层。

## 五、协作分享模型与新模型的配合审计

### 5.1 现状优点

当前内容协作分享模型的基础是好的，核心能力已经具备：

- `space_members` 负责空间级角色
- `content_registry` 统一注册 `document / file / source_set`
- `content_permissions` 支持 direct grant
- `documents.parentId` + `inheritMode` 支持 folder 级继承
- `content_share_links` 支持公开分享
- `content_audit_logs` / `content_access_events` 支持审计

对应实现：

- [content schema](/Users/arthur/RustroverProjects/lobehub/packages/database/src/schemas/content.ts)
- [ContentModel](/Users/arthur/RustroverProjects/lobehub/packages/database/src/models/content.ts)
- [ContentAuthorizer](/Users/arthur/RustroverProjects/lobehub/src/server/services/content/index.ts)
- [contentShare router](/Users/arthur/RustroverProjects/lobehub/src/server/routers/lambda/contentShare.ts)

如果目标模型是 `space` 作为唯一协作边界，这套基础是匹配的。

### 5.2 当前和 “source set 作为库根” 不完全匹配的地方

当前 ACL 继承主要沿 `document.parentId` 走，也就是：

- folder -> child doc
- folder -> child file

但是它**不会自动沿 `source set -> contained content` 继承**。

这意味着：

- 共享一个 source set
- 不等于自动共享其中的 file /document

因为当前 `getKnowledgeItems` 在列 source set 内容时，还会继续对每个 file/document 做独立可见性过滤。

对应实现：

- [ContentAuthorizer.getParentChain](/Users/arthur/RustroverProjects/lobehub/src/server/services/content/index.ts)
- [file.getKnowledgeItems](/Users/arthur/RustroverProjects/lobehub/src/server/routers/lambda/file.ts)

所以现在的 source set 分享语义更像：

- “可以看到这个资料集对象本身”

而不是：

- “可以自动看到这个资料集里的全部内容”

### 5.3 与新模型配合时的正确语义

如果未来 source set 要成为真正的资料库根，我建议明确以下语义：

#### 语义 A：source set 只是组织容器

那么：

- share source set = 共享资料集元数据与入口
- 子内容是否可见，仍由每个内容项自身 ACL 决定

优点：

- 和当前实现最接近
- 风险小

缺点：

- 用户会觉得 “共享了资料集，但里面内容还不一定都能看”

#### 语义 B：source set 是库根容器

那么：

- share source set = 默认共享其库内内容
- source set 成为一个显式的 ACL 传播边界

这时必须补一条新的继承规则：

- `source set permission` 能向库内根节点和后代传播

否则用户心智和权限行为会冲突。

### 5.4 我的建议

我建议最终走 **语义 B**，但不要在 sidebar 重构这一轮就做。

原因：

- 用户对 “资料集” 的直觉更接近一整个可访问的 library
- 这和 source set 支持 folder tree 的产品方向一致
- 也和 `space -> source set -> content` 的层次更一致

但落地上要分阶段：

1. 本轮：只改 sidebar 和 IA
2. 下一轮：确定 source set 是否为单归属库根
3. 再下一轮：补 source set -> child content 的权限传播语义

### 5.5 conversation 分享模型目前不算对齐

如果把 “协作分享模型” 理解为内容域 + 会话域一起看，那么当前只有内容域比较接近目标模型。

`topic` 侧现在仍然是另一套逻辑：

- topic 仍然是 user-owned
- `topic_shares` 是独立的 link 分享表
- 它不复用 content registry /content permissions
- 它也不是基于 `space` 的统一协作模型

对应实现：

- [topics schema](/Users/arthur/RustroverProjects/lobehub/packages/database/src/schemas/topic.ts)

所以当前状态可以概括为：

- **content sharing：基础良好，但 source set 作为库根时还缺容器级继承**
- **conversation sharing：尚未纳入 space-first 协作模型**

这意味着后续如果要做真正的团队会话协作，应该单独推进：

- `topic.spaceId` 变成强约束
- `topic share` 语义与 space 协作边界统一
- 再决定是否需要把会话分享部分接入统一的 content-like ACL 模型

## 六、Sidebar 下一阶段建议

本轮只是先把 sidebar 从 “导航 + 类型树混用” 拉回到 “纯导航”。

下一阶段建议继续做三件事：

### 4.1 首页语义收口

现在首页如果仍然排除 source set 内内容，就不应继续叫 `Home`。

二选一：

- 改名为 `Ungrouped`
- 或真正做成 `Overview`

### 4.2 类型筛选继续停留在 header

类型筛选应保持为当前 scope 的 facet：

- space view：筛选当前 space 范围
- source set view：筛选当前 source set 范围

但不回到 sidebar 变成层级导航。

### 4.3 source set 视图以后可以支持局部类型筛选

这个属于 header/filter 设计，不属于 sidebar 重构的一部分。

可以后续增量开放：

- `All`
- `Docs`
- `Images`
- `Audios`
- `Videos`

但仍然是 filter，不是左侧树。

## 七、推荐实施顺序

### Phase 1：已开始

- 收敛 desktop content sidebar
- 把类型分类移出 sidebar

### Phase 2：内容域收口

- 明确首页到底是 `Overview` 还是 `Ungrouped`
- 决定 source set 采用单归属还是多归属模型
- 明确 source set 是否作为真正的库根容器

### Phase 3：会话域收口

- `topic.spaceId` 变成必填
- `topic.agentId / topic.groupId` 收成二选一容器关系
- 前端 topic 查询统一显式带 `spaceId`

### Phase 4：跨域统一

- Recent / Search / Jump Results 统一显示空间语义
- 内容产物（doc /notebook/attachment）与 topic 的 space 落点完全一致
- 若 source set 被定义成库根，补齐 source set -> child content 的权限传播语义

## 八、结论

这轮不应该同时做 sidebar 重构和数据模型大迁移。

正确节奏是：

1. 先把 sidebar 改成纯导航
2. 再把首页语义和 source set membership 定清
3. 最后把 topic/chat 收成真正的 space-scoped model

先把 UI 结构拉正，再收底层模型，风险最小。
