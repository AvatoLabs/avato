# 多 Space / Team Space UIUX 审计与完整工作流方案

**状态**：审计 + 重构方案  
**日期**：2026-03-31  
**范围**：`/docs`、`/content`、`source set`、文档创建/导入、资料集挂载、跨空间导航、team space 权限反馈  
**方法**：基于当前仓库静态代码审计，不做猜测；只记录代码已经直接体现出的结构问题和可落地方案

---

## 执行摘要

当前系统对多 space / team space 的支持，处于一种“后端已经支持、前端还在半隐式拼接”的状态。

最关键的判断不是“有几个 bug”，而是：

1. `content` 已经基本是 **space-first** 的路由模型。
2. `docs` 仍然不是 **space-first**，而是 **space-hidden + activeWorkspace 全局变量兜底**。
3. `source set` 作为跨 `docs` / `content` 的共用容器，正在被两套不一致的空间语义拉扯。
4. team space 的写权限已经在服务端严格执行，但前端没有把“可写 / 只读 / 当前所在空间”变成清晰的 UI 事实。

如果不继续收口，后面会持续出现这些问题：

- 用户能看到别的 space 的资料集，但不知道当前自己到底在哪个 space 工作。
- URL 不足以表达完整上下文，刷新、分享、回退和 deep link 都不稳定。
- 创建、导入、挂载、移动这些动作会继续依赖“当前激活 space”这种隐藏状态。
- team space 的只读成员会在最后一步才被服务端拒绝，前端没有前置预防。

一句话结论：

**当前最需要的不是再补一个按钮，而是把 `docs` 和 `content` 统一到同一套 workspace-first 工作流。**

---

## 一、当前代码已证明的事实

## 1. `content` 已经是显式的 space-first 路由

`content` 的主路径已经明确把 `spaceId` 放进 URL：

- `buildContentRootPath(spaceId)` -> `/content/spaces/:spaceId`
- `buildSourceSetPath(spaceId, sourceSetId)` -> `/content/spaces/:spaceId/source-sets/:sourceSetId`

证据：

- `src/features/ResourceSpaces/paths.ts`
- `src/routes/(main)/content/(home)/index.tsx`
- `src/routes/(main)/content/source-sets/index.tsx`
- `src/routes/(main)/content/features/store/action.ts`

这意味着 `content` 的基础心智已经接近正确：

- 我在哪个 space，一眼能从 URL 看出来
- 我在某个 source set，也能从 URL 看出来
- 返回路径可以按层级算，不需要靠历史栈猜

## 2. `docs` 还没有显式的 space 路由

当前 `docs` 仍然只有：

- `/docs`
- `/docs/table`
- `/docs/:id`
- `/docs/table/:id`

并没有：

- `/docs/spaces/:spaceId`

证据：

- `src/routes/(main)/docs/index.tsx`
- `src/routes/(main)/docs/table/index.tsx`
- `src/routes/(main)/docs/[id]/index.tsx`
- `src/routes/(main)/docs/table/[id]/index.tsx`

这意味着：

- `docs` 的 workspace 上下文不是 URL 一等公民
- deep link 无法完整表达“这是哪个 space 下的 docs”
- 当前 `docs` 的空间语义仍然需要靠别的隐式状态补齐

## 3. `docs` 当前主要依赖 `activeWorkspaceSpaceId`

`docs` 现在的数据抓取和部分导航逻辑仍然依赖 `getActiveWorkspaceSpaceId()`：

- 文档列表查询默认用 active workspace 过滤
- 创建乐观文档默认写 active workspace
- header 上的 space 名称也会回退到 active workspace
- 资料集范围切换时，还会主动 `setActiveWorkspaceSpaceId(...)`

证据：

- `src/store/docs/slices/list/action.ts`
- `src/store/docs/slices/crud/action.ts`
- `src/features/Pages/PageLayout/Body/index.tsx`
- `src/features/Pages/PageLayout/Body/ScopeNavigation.tsx`
- `src/features/Pages/PageLayout/Header/index.tsx`

这说明当前 `docs` 的真实模型不是 route-driven，而是：

**URL + sourceSet scope + 全局 active workspace 变量混合驱动。**

这不是稳定架构。

## 4. `docs` 已经能 scoped 到 source set，但空间语义仍是补丁式的

当前 `docs` 已支持：

- `scope=source-set:<id>`

并且在切换到资料集 scope 时，会尝试读取 source set 的 `spaceId`，再把它写回 `activeWorkspaceSpaceId`。

证据：

- `src/features/Pages/usePageScope.ts`
- `src/features/Pages/PageLayout/Body/ScopeNavigation.tsx`
- `src/features/Pages/PageLayout/Body/index.tsx`

这说明前端已经意识到：

- source set 自己有独立的 `spaceId`
- docs 不能总盲信“当前全局 active space”

但这仍然只是补丁，不是完整模型。因为：

- URL 里还是没有 `spaceId`
- scope 只表达“在哪个资料集”，不表达“在哪个 workspace”
- 当前空间要靠额外副作用同步

## 5. 服务端的空间与权限模型其实更严格

`DocumentService.createDocument` 会通过 `resolveWriteSpaceId` 做三件事：

1. 如果带了 `sourceSetId`，以 source set 所在空间为准
2. 如果显式传了 `spaceId`，校验是否可访问
3. 如果成员角色是 `viewer`，直接拒绝写入

证据：

- `src/server/services/document/index.ts`

这说明后端的真实模型是合理的：

- source set 归属空间是强约束
- team space 的写权限不是随便猜的
- 不能随意跨空间写

所以当前真正的问题不在服务端，而在前端没有把这套约束表达成清晰工作流。

## 6. 资料集挂载 / 选取流程仍然过度依赖 active workspace

当前 source set 相关 modal 里，资料集列表仍默认按 `getActiveWorkspaceSpaceId()` 拉取：

- Attach Source Set
- Add Files To Source Set

证据：

- `src/features/SourceSetModal/AttachSourceSet/List.tsx`
- `src/features/SourceSetModal/AddFilesToSourceSet/SelectForm.tsx`

这意味着：

- 这些流程默认只看当前 active workspace
- 不是按“当前对象真正所属空间”或“用户显式选中的 workspace”来驱动
- 当用户拥有多个 space，尤其是 team space 时，行为会变得不可预测

## 7. 首页和快捷创建链路仍然没有明确 workspace 语义

比如首页创建 page：

- 直接 `createNewPage(untitledTitle)`
- 然后 `navigate(/docs/:id)`

证据：

- `src/routes/(main)/home/_layout/hooks/useCreateMenuItems.tsx`

这个流程没有显式告诉系统：

- 创建到哪个 space
- 进入哪个 docs workspace
- 是否继承当前 source set / 当前工作区

这在单空间还能混过去，多空间时一定会制造迷惑。

---

## 二、已确认的高优先级问题

## [P1] `/docs` 没有 route-level `spaceId`，所以它不是可分享、可预测的 workspace 页面

这是最核心的问题。

只要 `docs` 还停留在 `/docs` 而不是 `/docs/spaces/:spaceId`，它就永远有这些结构缺陷：

- 页面地址不完整
- 刷新后需要靠隐式全局状态补上下文
- 分享链接无法稳定复现同一个 workspace
- “我现在在哪个 space” 对用户和代码都不是一等事实

**结论**：

`docs` 当前不是成熟的 workspace 页面，只是一个全局 docs 外壳。

## [P1] `docs` 正在把“切换 workspace”偷渡成副作用

当前的实现路径是：

1. 用户点击某个 source set scope
2. 组件先 `setActiveWorkspaceSpaceId(sourceSet.spaceId)`
3. 然后再更新 docs scope

证据：

- `src/features/Pages/PageLayout/Body/ScopeNavigation.tsx`
- `src/features/Pages/PageLayout/Body/index.tsx`

这意味着“workspace 切换”不是一个显式产品动作，而是一个组件内部副作用。

这会带来两个后果：

- 用户没有明确感知自己切了 workspace
- 其它依赖 active workspace 的模块会被顺手一起带偏

**结论**：

workspace 不应该靠 sidebar item click 的副作用偷偷变化。

## [P1] `docs` sidebar 当前把跨 space source set 直接平铺出来，默认模型仍然不对

当前 sidebar 已经开始能显示跨 space source set，并用小 tag 区分空间。

但这只是“视觉补丁”，不是正确 IA。

问题在于：

- `docs` 默认视图应该先服务当前 workspace
- 不是一上来就把所有可访问空间的资料集全倒出来
- 多 workspace 支持不等于“把所有空间混在一个列表里”

**更好的默认心智应该是**：

- 先看当前 workspace 的 docs / inbox / source sets
- 如果要看别的 workspace，先切 workspace
- 而不是把跨空间浏览变成默认模式

## [P1] `content` 虽然路线更对，但仍残留 active workspace 回退

`content` 主路径是 space-first 的，这是对的。  
但内部仍有残余 helper 默认回退到 `getActiveWorkspaceSpaceId()`，例如：

- source set tree 的 folder cache reload
- file document 相关动作
- 某些最近数据或快捷跳转

证据：

- `src/features/ContentManager/components/SourceSetTree/treeState.ts`
- `src/store/file/slices/document/action.ts`

这意味着 `content` 不是完全干净的 route-driven 系统，而是：

- 主路径 route-driven
- 局部实现还在吃全局 active workspace

如果不继续清理，这会在跨 space source set、回退、缓存刷新时留下隐性 bug。

## [P1] team space 的权限反馈仍然是“后端知道，前端不说”

服务端已经明确区分：

- 可访问
- 可写
- viewer 不可写

但前端没有把这些权限前置成 UI 事实，比如：

- viewer 看到“新建文档”按钮是否禁用
- viewer 在 source set 内是否还能点“添加到资料集”
- viewer 打开 docs 时是否能明确看见“只读空间”

这会导致：

- 用户把失败理解成 bug
- 权限模型只在报错时才显现

这不是成熟的 team space UX。

## [P2] source set 相关 modal 仍然是“当前 active workspace 的 modal”，不是“当前对象的 modal”

Attach / AddFiles 这类 modal 当前默认按 active workspace 拉列表。

这在多 space 下会导致：

- 当前对象明明在 A 空间，modal 却默认展示 B 空间资料集
- 用户看见的可选目标和当前上下文未必一致
- 操作后再跳去 source set 页面，还要再猜路由

**结论**：

所有 source set 选择器都应该先有明确的 workspace 上下文。

## [P2] 顶层快捷创建仍然没有 workspace-first 语义

首页“新建文档”这类动作当前直接进 `/docs/:id`，没有经过 workspace 路由，也没有显示选择空间。

这类入口短期看方便，长期看是污染源。

因为它把一个本应明确的工作区动作，做成了“先建了再说”。

---

## 三、对当前 UIUX 的批判性结论

## 1. 当前不是“多 space 未完成”，而是“单空间心智 + 多空间补丁”

这是本次审计最重要的结论。

系统当前不是从一开始就以 workspace 为一等对象设计，而是：

- 单空间时代先把功能做通
- 后续再在 `content` 上把 `spaceId` 放进 URL
- 再在 `docs` 上用 `scope` 和 `activeWorkspaceSpaceId` 拼接

所以现在的症状不是偶发 bug，而是架构阶段的自然结果。

## 2. `docs` 和 `content` 不应该继续各自发明自己的多空间策略

当前两边最大的问题不是功能差，而是：

- `content` 是 route-first
- `docs` 是 state-first

如果不统一，后面所有跨模块能力都会继续分裂，例如：

- 最近资源
- source set 入口
- 文档创建
- 从文件生成文档
- 移动到资料集

这些动作都会出现“在哪个 space 执行”的二义性。

## 3. “默认显示所有可访问资料集”不是用户友好，而是上下文泄露

从信息架构角度看，把多个 workspace 的 source set 默认平铺在 docs sidebar 里，并不是高级能力，而是上下文泄露。

正确方式应该是：

- 默认专注当前 workspace
- 跨 workspace 是显式动作
- 不是在默认视图里把所有东西摊开

## 4. team space 的核心不是“看得到团队内容”，而是“边界清楚”

成熟的 team space UX 必须让用户始终清楚：

- 我当前在哪个 workspace
- 我在这里是 owner / editor / viewer
- 我能不能新建、移动、挂载、删除
- 当前对象属于哪个 workspace

现在系统做到了“后端边界存在”，但没有做到“前端边界可见”。

---

## 四、完整 UIUX 工作流方案

下面这套方案不是局部 tweak，而是完整工作流。

## 1. 北极星原则

### 原则 A：Workspace 必须是一等上下文

任何页面都必须能明确回答：

- 当前在哪个 workspace
- 当前 URL 是否足以重建这个上下文

### 原则 B：`docs` 和 `content` 共用同一套 workspace 语义

不能一边靠 URL，一边靠全局变量。

### 原则 C：跨 workspace 必须是显式动作，不是默认混合

默认只服务当前 workspace。

### 原则 D：team 权限必须前置表达，不要等失败再告诉用户

viewer 不应一路点到最后再收到错误。

---

## 2. 目标路由模型

## `content`

保持并强化现有模型：

- `/content/spaces/:spaceId`
- `/content/spaces/:spaceId/source-sets/:sourceSetId`
- `/content/spaces/:spaceId/source-sets/:sourceSetId/:folderSlug`
- `/content/spaces/:spaceId/item/:fileId`

## `docs`

改成显式 workspace 路由：

- `/docs/spaces/:spaceId`
- `/docs/spaces/:spaceId/inbox`
- `/docs/spaces/:spaceId/source-sets/:sourceSetId`
- `/docs/spaces/:spaceId/pages/:pageId`
- `/docs/spaces/:spaceId/inbox/pages/:pageId`
- `/docs/spaces/:spaceId/source-sets/:sourceSetId/pages/:pageId`

表格同理：

- `/docs/spaces/:spaceId/tables`
- `/docs/spaces/:spaceId/source-sets/:sourceSetId/tables/:pageId`

**关键点**：

- `spaceId` 必须进入 path，不再隐藏在 active workspace
- detail route 要保留 scope 语义，不要打开文档后就丢掉自己从哪来

---

## 3. 顶层导航工作流

### 全局 App Shell

在主框架层提供一个明确的 workspace switcher：

- 个人空间
- 团队空间 A
- 团队空间 B

每项显示：

- 名称
- 类型（个人 / 团队）
- 角色（Owner / Editor / Viewer）

切 workspace 的结果应该是：

- 更新 URL 到对应 workspace 路由
- 更新页面数据上下文
- 而不是只改一个内存变量

### 切换逻辑

- 从 `docs` 切 workspace，进入对应 workspace 的 docs 根页
- 从 `content` 切 workspace，进入对应 workspace 的 content 根页
- 不保留跨空间 source set scope

原因很简单：

source set 是 workspace 内对象，不该跨空间残留。

---

## 4. `docs` 的完整工作流

## 4.1 默认页

默认进入：

- `/docs/spaces/:spaceId`

只展示当前 workspace 的文档。

sidebar 结构：

- 全部文档
- 待整理
- 当前 workspace 的资料集

**不要默认混入其它 workspace 的资料集。**

## 4.2 资料集 scoped 文档页

进入：

- `/docs/spaces/:spaceId/source-sets/:sourceSetId`

页面仍然是 **只看文档**。

这里不该再出现：

- `Docs / Files` switcher

文件视图属于 `content` / `source set files` 页面，不属于 docs。

## 4.3 待整理

进入：

- `/docs/spaces/:spaceId/inbox`

这个页面要明确鼓励用户整理：

- 标题：待整理
- 副文案：将文档分配到资料集，便于后续检索、协作和复用
- 行尾菜单第一优先级动作：添加到资料集
- 空态提供：创建资料集 / 批量整理入口

它应该是一个 inbox，不是永久分类。

## 4.4 打开文档

打开文档后，URL 仍保留来源范围：

- 来自全部文档
- 来自待整理
- 来自某个 source set

这样返回时不需要猜。

---

## 5. `content` / `source set` 的完整工作流

## 5.1 `content` 根页

当前 workspace 的文件资产工作区。

职责：

- 上传
- 浏览文件
- 文件夹组织
- 进入 source set

## 5.2 `source set` 页

当前 workspace 内某个 source set 的文件工作区。

默认是 **文件视图**，因为这本来就是 content 域。

页面提供一个明确入口：

- 查看该资料集的文档

点击后跳转到：

- `/docs/spaces/:spaceId/source-sets/:sourceSetId`

而不是在当前页上做切换器叠加。

**原则**：

- docs 看文档
- content 看文件
- source set 是两个域共享的容器，不是一个页面里混着切

---

## 6. 创建 / 导入 / 挂载 / 移动工作流

## 6.1 在 docs 根页新建文档

目标：

- 创建到当前 workspace
- 不归属任何 source set

如果当前角色是 `viewer`：

- 按钮直接禁用
- tooltip 明确写“你在该空间只有查看权限”

## 6.2 在 source set scoped docs 中新建文档

目标：

- 创建到当前 `spaceId`
- 同时写入当前 `sourceSetId`

这条链不能再依赖 active workspace 推断。

## 6.3 在 docs 中导入 Markdown / PDF / DOCX

规则：

- 在 `docs` 导入 => 变成文档对象
- 归属当前 workspace
- 如果当前是某个 source set scoped docs，则直接归属该 source set

## 6.4 在 content 中上传文件

规则：

- 在 `content` 上传 => 保持文件对象
- 归属当前 workspace / 当前 source set

不要和 docs 导入混淆。

## 6.5 添加到资料集 / 移动到资料集

所有 source set 选择器都应该遵守：

1. 先有明确的当前 workspace
2. 默认只展示当前 workspace 的 source sets
3. 如果要跨 workspace，必须先切 workspace，而不是在 modal 里混选

理由：

- source set 是 workspace 内容器
- 跨 workspace 直接移动会让权限、链接、成员可见性都变复杂

**建议**：

第一阶段直接禁止跨 workspace 添加/移动。

---

## 7. Team Space 权限反馈方案

每个 workspace 需要有显式角色标签：

- Owner
- Editor
- Viewer

### Viewer 模式下：

- 禁用新建文档
- 禁用上传文件
- 禁用添加到资料集
- 禁用重命名 / 删除资料集

并且用统一文案解释：

- 你在该空间中只有查看权限

### Editor / Owner 模式下：

- 正常可操作

### 删除类动作

team space 中所有 destructive action 都应带空间上下文确认，例如：

- 删除“资料集 X（团队空间：Design Ops）”

避免多空间时删错对象。

---

## 8. 我建议的最终信息架构

## App Shell

- Workspace Switcher
- Docs
- Content

## Docs（workspace 内）

- 全部文档
- 待整理
- 资料集列表

## Content（workspace 内）

- 全部文件
- 分类
- 资料集列表

## Source Set

它不是独立入口层，而是 workspace 内的共享容器对象：

- 在 docs 中表现为文档范围
- 在 content 中表现为文件容器

这才是最稳的模型。

---

## 五、分阶段落地计划

## Phase 1：把 `docs` 改成真正的 workspace-first

目标：

- 引入 `/docs/spaces/:spaceId`
- 文档列表、header、创建动作全部显式吃 `spaceId`
- 移除 `docs` 对 active workspace 的主依赖

这是必须先做的，不然后面全是补丁。

## Phase 2：整理 `docs` sidebar 的范围模型

目标：

- 默认只显示当前 workspace 的 source sets
- 不再默认平铺所有可访问空间的资料集
- 待整理做成真正 inbox

## Phase 3：统一 source set 选择器

目标：

- Attach Source Set
- Add Files To Source Set
- Add To Source Set
- Move To Source Set

全部改成 workspace-aware，并且默认不支持跨 workspace 混选。

## Phase 4：补齐 team space 权限前置反馈

目标：

- viewer 禁用态
- role 可见
- destructive action 带空间上下文

## Phase 5：清理 `content` 内部的 active workspace 回退

目标：

- tree cache
- file document actions
- 最近数据入口
- 快捷跳转

全部改成 route-driven `spaceId`

---

## 六、最终结论

当前系统最危险的地方，不是“有没有多 space 功能”，而是：

**`docs` 和 `content` 仍然处在两套不同的空间心智里。**

`content` 已经接近 workspace-first。  
`docs` 还停留在 global docs + hidden active workspace 的时代。

如果继续在这个基础上补功能，只会越来越乱。

我建议的最终方向非常明确：

1. `docs` 彻底 route 化 workspace
2. `content` 继续去除内部 active workspace 依赖
3. 默认只服务当前 workspace，不把跨空间浏览做成默认 UI
4. team space 的权限边界必须前置可见

这不是“优化体验”，而是把系统从单空间补丁状态，升级到真正可规模化的多 workspace 产品。
