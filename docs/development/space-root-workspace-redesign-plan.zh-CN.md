# Space 作为工作区根的产品与信息架构重构方案

**状态**：当前 canonical 产品架构提案；截至 2026-04-05 已部分落地并继续收口 legacy route\
**日期**：2026-04-05\
**目标**：把 `space` 从 “隐式默认容器” 提升为产品一等根对象，重构 `docs / files / source set / team` 的前台语义与路由边界，让多 space /team space 的体验接近 Notion / 飞书式工作区。

---

## 〇、当前落地进展（截至 2026-04-05）

本方案对应的工程改造已经进入主链，但整体仍处于 **Phase 1 \~ Phase 3 之间**，还没有完成最终收口。

- **`/spaces/:spaceId/...` canonical routes 已建立**：`docs / files / memory / settings / members` 都已能以 space-scoped 路径直接访问。
- **Docs 侧已开始承认 Space 是根**：文档列表侧栏、Header、Breadcrumb、详情页跳转都已显式携带 `spaceId`。
- **Files 侧已基本成为 `space-first`**：空间列表、breadcrumb、文件树与 source set scope 都围绕当前 `spaceId` 工作。
- **Space 首页与切换器已可用**：`/spaces` 会重定向到用户可访问空间；Space 首页也已经把 `Docs / Files / Memory / Members / Settings` 暴露为工作区入口。
- **首页与设置侧入口开始显式表达当前 Workspace**：Home 左侧导航、Quick Actions、Recent Docs / Recent Files、Agent Sources，以及移动端资源入口、会话来源标签这些过去更依赖隐式默认空间的入口，已经开始显示或优先使用 “当前在哪个 Workspace 打开 / 管理资源” 的 route-aware 语义，避免用户只看到全局动作名词却不知道会落到哪个空间。
- **Source Set / 创建动作 / 消息动作 / 命令面板也开始变成 route-aware Workspace UX**：`Attach Source Set`、`Add Files to Source Set` 这类 modal 现在会显式提示 “当前优先浏览哪个 Workspace”，跨空间的 source set 也会在列表和详情入口上显示来源工作区；同时 `Add to Space Memory` 的消息动作、topic 下拉菜单、Agent Profile 里的 inline sources、首页 `new page` 创建动作，以及 command menu 里的 `Docs / Resources` 导航，也已优先采用当前 route 的 `spaceId`，不再默认为旧 workspace hint。
- **legacy `shared / trash` 入口已进一步退成 redirect**：`/spaces/shared` 与 `/spaces/trash` 现在已成为新的 canonical 入口；旧 `/content/shared`、`/content/trash` 仅保留 redirect 职责，router 的 error reset path 也已切到 `/spaces/*`，`MainMenu` 和移动端资源路由判断则已开始通过共享 helper 统一消费 canonical `/spaces/*` 语义。
- **`activeWorkspaceSpaceId` 已进一步退化为 URL-first hint**：helper 现在会优先从当前 pathname 解析 `/spaces/:spaceId/...`，只有在拿不到 canonical route spaceId 时才回退到内存 hint；同时 Docs CRUD、FileStore 里的 document slice，`agent / aiAgent / agentRuntime / cloudSandbox` 这批高频 service 调用点，`agent sources / chat topic` 的容器 key，`SourceSetModal / command menu / create menu / page list / source tree` 这些 UI 与 tree surface，以及 `home input / recent topics` 这类首页入口，都已统一改成 `explicit spaceId -> current route -> store/query fallback -> hint` 的 shared resolver。当前 `src/` 里已基本只剩 helper 自己与测试仍直接引用 `activeWorkspaceSpaceId`。

这意味着：

> `Space` 作为工作区根已经被前台大面积承认，\
> 但 “旧 `content` 兼容层完全退场” 和 “所有旧调用点都不再依赖 `activeWorkspaceSpaceId` hint” 这两件事还没完成。

---

## 一、执行摘要

当前系统最大的问题，不是缺少某个按钮，而是**顶层工作区模型没有被前端完整承认**。

用户今天的真实感受更像：

- 我在一个全局的 `Docs` 里写东西
- 我在一个脱离 `Space` 的 `Files` 模块里传文件
- `Source Set` 似乎是半个顶层导航
- `Space` 明明存在，却不像真正的工作区根

这会直接导致四类问题：

1. 多 space 是 “技术支持了，产品没承认”
2. 个人空间被前端默认成 “唯一真空间”
3. 团队空间与成员角色没有变成可感知的 UI 事实
4. `Docs / Files / Source Set` 的边界在语义和 UI 上长期互相污染

这份方案的最终结论是：

> **Space 是唯一的工作区根。**\
> **Docs（文档）是知识成果工作面，Files（文件）是原始资产工作面。**\
> **Source Set（资料集）是 Space 内的专题容器，也是 Docs 和 Files 共享的专题范围，不再成为第三套主页面。**
> **Content 退到实现层，作为统一资源注册表存在，不再是用户主语。**

---

## 二、当前问题的本质

### 1. 错的不是组件，而是顶层心智

当前产品实际上同时混用了两套模型：

- **正确模型**：`Files` 用户心智已经基本在往 `space-first` 收口，底层仍由 `content_registry / ContentAuthorizer` 支撑
- **旧模型**：`Docs` 仍然带有明显的全局模块心智

结果是：

- 一个用户在 A 空间浏览资料集，却可能在 B 空间里创建文档
- 用户能访问多个 team space，但 UI 没有稳定表达 “我现在在哪个空间”
- `Source Set` 被迫承担一部分本该由 `Space` 承担的组织职责

### 2. 现在真正的结构性缺口

#### 已有基础能力

- 数据层已经有 `spaces`、`space_members`、`content_registry`
- `ContentAuthorizer` 已经有空间角色和内容级授权能力
- `Files` 路由基本已是 `space-first`
- 团队空间、成员管理、角色更新、所有权转移的后端基础已经存在

#### 真正缺口

- `Docs` 仍然存在旧的全局入口语义
- 空间上下文仍然存在全局状态回退
- 团队角色没有转化成稳定的权限驱动 UI
- `Source Set` 在前台被抬得过高
- breadcrumb 没有统一承认 `Space` 是第一层
- `Memory / Community` 还没有被重新放回一个完整的信息架构里

### 3. 风险判断

最大的风险不是 “我们现在没有多 space”，而是：

> **系统底层已经进入多 space /team space 阶段，前台却还在用单空间时代的模块心智。**

如果继续在这个结构上补入口、补 sidebar、补 scope，只会不断加深局部修补和整体失真。

---

## 三、最终产品模型

### 1. 前台与后台必须分层命名

> **前台使用用户心智驱动的名词，后台使用架构驱动的名词。**

| 层级       | 用户看到的               | 开发者看到的                                         |
| ---------- | ------------------------ | ---------------------------------------------------- |
| 工作区根   | **Space**（空间）        | `spaces`                                             |
| 知识成果   | **Docs**（文档）         | `documents` + `content_registry.kind='document'`     |
| 原始资产   | **Files**（文件）        | `files` + `content_registry.kind='file'`             |
| 专题容器   | **Source Set**（资料集） | `source_sets` + `content_registry.kind='source_set'` |
| 统一资源层 | _用户不感知_             | `content_registry`                                   |

用户不需要知道 `content_registry`，也不需要知道 `content` 这个抽象名词。

### 2. 四个核心对象的职责

#### `Space`

`Space` 是唯一顶层工作区，负责：

- 承担文档、文件、资料集和成员的归属边界
- 承担默认搜索范围
- 承担默认分享和权限边界
- 承担个人协作与团队协作的主容器

#### `Docs`

`Docs` 是 `Space` 下的知识成果工作面，负责：

- 创建、编辑、阅读文档
- 在当前空间内按范围浏览文档
- 将文档整理进资料集

`Docs` 不是脱离空间的全局页面系统。

#### `Files`

`Files` 是 `Space` 下的原始资产工作面，负责：

- 上传文件
- 管理文件夹与原始资料
- 维护可供文档和资料集复用的素材基础

`Files` 不是知识视图，也不应该默认混入文档。

#### `Source Set`

`Source Set` 是 `Space` 内的专题容器，负责：

- 按主题组织 docs 和 files
- 作为 AI / RAG / 检索复用边界
- 提供 Docs / Files 共享的专题范围与过滤上下文

`Source Set` 不是工作区根，不是全局一级导航，也不是第三套主页面或伪文件系统根目录。

### 3. `Content` 的正确定位

`Content` 只应该保留在实现层：

- `content_registry` 统一注册内容
- 权限和分享通过 `contentUid` 统一校验
- 搜索、审计、跨类型能力基于统一资源层实现

对用户而言，前台应该是：

- 文档
- 文件
- 资料集

而不是 “内容”。

---

## 四、哪些模块属于 Space 内，哪些属于 Space 外

这一点必须定义清楚，否则导航永远会混乱。

### 1. Space 内模块

这些模块属于某个明确的 `space`：

- 概览
- 文档
- 文件
- 资料集
- 成员
- 设置
- 未来可能新增的记录、流程、档案等 OA 工作面

### 2. Space 外模块

这些模块默认不属于某个具体 `space`：

- `Community`：发现、市场、公共内容生态
- `Account / Profile`：个人账户与全局偏好
- `Global Search`：显式跨空间搜索

### 3. `Memory` 的定位

`Memory` 不应该直接并入 `space`，也不应该被隐式当成 team 能力。

建议分两层理解：

- **当前 `Memory`**：默认是用户个人层能力，属于 `space` 外
- **未来如需团队记忆**：应作为新的 `Space` 内能力单独设计，例如 `Space Memory`

不要把现有个人记忆直接包装成团队空间模块，否则会把隐私边界和协作边界搅乱。

团队记忆的详细方案，单独见：

- `/Users/arthur/RustroverProjects/lobehub/docs/development/space-first-team-memory-plan.zh-CN.md`
- `/Users/arthur/RustroverProjects/lobehub/docs/development/long-memory-harness-interface-rfc.zh-CN.md`

### 4. `Chat / Agent` 的定位

`Chat / Agent` 会话是 LobeHub 的核心功能，但**当前阶段不应被草率并入 `space` 内**。

建议明确分成两步：

- **当前 `Chat / Agent`**：保持为 `space` 外的独立顶层模块
- **未来如需团队 Agent 工作流**：再单独设计 `space` 内会话模型，例如团队共享 Agent、团队上下文、团队会话权限

这意味着当前方案里：

- `/chat` 仍可保留为顶层模块
- 不默认绑定到某个 `space`
- 不把今天的个人对话历史误包装成团队协作资产

必须先明确这一点，否则后面在 `space` 根方案推进时，`chat` 会变成一个悬空模块。

### 5. 结论

最终顶层应该区分成两类：

#### 工作区内

- 当前 Space
- Space 内工作面

#### 工作区外

- Chat / Agent
- Community
- Personal Memory
- Account / Global Settings

这会比今天 “所有模块并排在同一层” 更清楚。

---

## 五、最终信息架构

### 1. 顶层结构

顶层不应该再是：

- Docs
- Content
- Memory
- Community

而应该是：

- Space Switcher
- 当前 Space
- Space 外全局模块

### 2. 当前 Space 内的导航

进入一个 Space 后，主导航建议为：

- `概览`
- `文档`
- `文件`
- `资料集`
- `成员`
- `设置`

### 3. 全局壳层建议

#### 左上固定区域

- 当前空间名称
- Space Switcher
- 新建空间
- 受邀 / 加入空间入口

#### Space 内导航

- 当前工作面的一级切换

#### Space 外导航

- Chat / Agent
- Community
- Personal Memory
- Account

### 4. 这与 Notion / 飞书的关系

这里借鉴的是它们的**工作区根心智**，而不是照抄视觉：

- 先确定当前 `space`
- 再进入该 `space` 内的文档、资料、成员和设置
- 权限与分享先落在 `space`

LobeHub 不需要变成页面树产品，但必须承认：

> **Space 比内容分类更高一级。**

---

## 六、最终路由架构

### 1. 最终的规范化路由

如果 `Space` 真的是根，URL 也必须承认这一点。

最终规范建议为：

```text
/spaces/:spaceId
/spaces/:spaceId/docs
/spaces/:spaceId/docs/:docId
/spaces/:spaceId/docs/table
/spaces/:spaceId/docs/table/:docId
/spaces/:spaceId/files
/spaces/:spaceId/files/:fileId
/spaces/:spaceId/source-sets
/spaces/:spaceId/source-sets/:sourceSetId
/spaces/:spaceId/source-sets/:sourceSetId/docs
/spaces/:spaceId/source-sets/:sourceSetId/files
/spaces/:spaceId/members
/spaces/:spaceId/settings
```

### 2. 为什么不能停在 `/:module/spaces/:spaceId`

像下面这种形式：

```text
/docs/spaces/:spaceId
/content/spaces/:spaceId
```

虽然比旧的全局路由好，但它本质上仍然是 **module-first**。

这会带来一个长期问题：

- 文案说 `space` 是根
- URL 却还在说 `docs/content` 是根

这会让产品心智和架构语义长期不一致。

### 3. 过渡期兼容策略

为了降低迁移成本，可以分两层：

#### Canonical Route

- `/spaces/:spaceId/...`

#### Compatibility Route

- `/docs/spaces/:spaceId/...` → redirect 到 `/spaces/:spaceId/docs/...`
- `/content/spaces/:spaceId/...` → redirect 到 `/spaces/:spaceId/files/...`
- `/docs`、`/content` 等旧入口全部只保留 redirect 能力

注意：

- `/content/spaces/:spaceId` 已经是现网使用中的稳定路由
- 将其迁移到 `/spaces/:spaceId/files` 不只是代码重构，而是对已存在收藏、外链、分享引用的兼容迁移
- 因此 redirect 生命周期应按真实命中数据决定，而不是按理想时间表硬切

### 4. 路由迁移原则

1. 所有业务逻辑只消费 canonical route
2. 兼容路由只负责解析和跳转，不承担业务逻辑
3. 所有 deep link 最终都收敛到 `space-first` canonical URL

---

## 七、对象归属与操作规则

这部分必须变成稳定的产品规则，而不是前端猜。

### 1. 创建文档

默认归属：

- 当前 `space`

可选附加归属：

- 当前 `source set`

正确心智：

- 先属于某个空间
- 再决定要不要收进资料集

### 2. 上传文件

默认归属：

- 当前 `space`

可选附加归属：

- 当前 `source set`
- 当前文件夹

### 3. 新建资料集

默认归属：

- 当前 `space`

它不应该出现在 “无空间上下文” 的全局浮层里。

### 4. 移动对象

对象移动必须明确区分两类：

1. 在同一 `space` 内移动
2. 跨 `space` 移动

第二类必须：

- 有独立视觉层级
- 明确显示来源空间与目标空间
- 明确提醒权限会随目标空间重算
- 危险确认后才执行

### 5. 导入规则

入口决定对象形态：

- 在 `Docs` 中导入 `.md`：结果是文档
- 在 `Files` 中上传 `.md`：结果是文件

不要做 “同一动作自动猜两种后果” 的交互。

---

## 八、Docs / Files / Source Set 的正确关系

### 1. `Docs` 和 `Files` 是工作面，不是系统边界

在同一个 `space` 内：

- `Docs` 只展示文档
- `Files` 只展示文件、文件夹
- `Source Set` 负责跨类型关联

### 2. 为什么不把 Docs 和 Files 合成一个页面

因为它们服务的是不同任务：

| 维度         | Docs（文档）           | Files（文件）        |
| ------------ | ---------------------- | -------------------- |
| 主要动作     | 创建、编辑、阅读       | 上传、下载、整理     |
| 内容形态     | 富文本 / Block 编辑器  | 文件 + 元数据        |
| 默认组织方式 | 范围列表、时间、资料集 | 文件夹、资料集、类型 |
| 核心心智     | 知识成果               | 原始资产             |

把它们混成一个页面只会制造更多过滤和切换成本，不会让用户更清楚。

### 3. `Source Set` 是唯一允许跨类型联结的专题范围

进入一个资料集后，用户应该能在同一专题上下文中看到：

- 该资料集内的文档
- 该资料集内的文件

但这不代表 `Source Set` 应该升级成第三套独立页面系统，也不代表 `Docs` 页面应该出现 “文档 / 文件 switcher”。
`Docs` 页面默认只看文档。\
`Files` 页面默认只看文件。\
`Source Set` 负责通过同一专题范围把两者联结起来。

### 4. `Files` 的筛选是视图状态，不是导航动作

`Files` 中的类型筛选、资产分类、使用策略等都属于**当前工作面的视图状态**。

这意味着：

- 改变筛选时必须保留当前 `space`
- 改变筛选时必须保留当前 `source set` scope
- 如果用户当前在某个文件夹中，改变筛选时必须保留该文件夹上下文
- 如果用户当前在文件预览中，改变筛选时可以退出预览态，但必须回到当前文件所属文件夹，而不是静默跳回 `Files` 根目录

换句话说，`Files` 的筛选只应该改 query state，不应该把用户从当前浏览上下文中 “弹回根视图”。

实施前提：

- 当前 Source Set 相关读取链路如果仍然只返回 files，不返回 documents，则这套跨类型专题范围无法真正落地
- 因此前端改版前，必须先补齐 Source Set 的统一读取 API /overview 契约，使其能稳定返回 docs + files

### 4. 来源关系，不等于版本绑定

文档和文件可以存在来源关系，但不应默认做成版本同步：

- 文件可以生成文档
- 文档可以关联来源文件
- 但文档编辑不应自动覆盖原始文件

这是 provenance，不是 live sync。

---

## 九、团队协作与 RBAC

### 1. 当前系统的真实状态

当前系统不是没有团队能力，但远不能说 “完备支持团队协作”。

已经有的基础：

- `personal / team` 空间模型
- `owner / admin / editor / viewer` 空间角色
- 成员管理的后端接口
- 内容级 ACL 和分享链接
- 服务端写操作校验

还不完备的地方：

- 成员管理入口过深
- 邀请流仍然过于原始
- 前端没有稳定的角色反馈
- 权限 UI 仍然依赖服务端最后一步拒绝
- 用户无法稳定感知 “我在这个空间里是谁”

### 2. 空间协作是第一边界

第一阶段必须坚持：

- 先把 `space` 做成协作边界
- 再讨论 `source set` 是否需要更细粒度分享

不要在工作区根还没稳定前，就把 `source set` 做成第二套主要权限系统。

### 3. RBAC 必须成为正式能力

后续必须升级为正式 RBAC，而不是继续堆散落的权限判断。

#### 主体

- user
- space member
- share link visitor
- 后续可扩展 group /service account

#### 资源

- space
- doc
- file
- folder
- source set
- share link

#### 动作

- read
- comment
- create
- update
- move
- delete
- share
- manage_members
- manage_settings
- transfer_ownership

#### 策略来源

- 继承自 space
- 显式内容授权
- 分享链接授权
- 后续群组授权

### 4. 权限驱动 UI 原则

不可做的动作：

- 默认不出现，或
- 出现但明确禁用，并解释原因

具体要求：

- `viewer` 不应一路点到提交才 403
- `admin` 与 `owner` 的差异必须在成员和设置管理中可见
- 分享动作必须区分 “分享整个空间” 和 “分享某个内容”

---

## 十、Breadcrumb 与层级语言

如果 `Space` 是根，breadcrumb 也必须承认这一点。

### 1. 统一语法

#### Docs

```text
当前 Space / 文档 / 当前资料集（可选） / 父文档或目录（可选） / 当前文档
```

#### Files

```text
当前 Space / 文件 / 当前资料集（可选） / 文件夹（可选） / 当前文件（可选）
```

#### Source Set

```text
当前 Space / 资料集 / 当前资料集 / 文档
当前 Space / 资料集 / 当前资料集 / 文件
```

### 2. 为什么 Docs 里不能再叫 “文件夹”

如果 `Docs` 页面展示的是文档层级，就应该使用文档语义：

- 父文档
- 目录
- 集合

而不是继续借用 `Files` 的 “文件夹” 语言。

否则前面刚拆清的 `Docs / Files` 心智，又会在 breadcrumb 里重新糊掉。

### 3. 交互规则

1. 第一层永远是 `Space`
2. 第二层永远是当前工作面：文档、文件或资料集
3. 当前项永远不可点击
4. 前置层级必须可点击回退
5. 层级过深时折叠中间层
6. 移动端退化为返回按钮 + 当前页名称

---

## 十一、搜索、空态与关键工作流

### 1. 搜索

默认规则：

- 普通搜索：只搜当前 `space`
- 全局搜索：用户显式切换到 “所有空间”

不要默认跨所有 `space` 搜索。

### 2. 空工作区 Empty State

空空间应该明确告诉用户：

- 这是一个新的工作区
- 可以从新建文档、上传文件、创建资料集开始
- 如果是 team space，可以邀请成员

Personal space 和 Team space 的 empty state 应有所区分。

### 3. 关键工作流

#### 新建空间

- 用户可创建个人空间或团队空间
- 创建完成后直接进入该空间的概览页

#### 在空间内创作

- 进入 `文档`
- 创建文档
- 可选加入当前资料集

#### 在空间内沉淀资料

- 进入 `文件`
- 上传文件或创建文件夹
- 可选加入当前资料集

#### 围绕专题组织内容

- 进入 `资料集`
- 在该资料集下同时消费文档和文件

#### 跨空间转移

- 明确区分普通移动与跨空间移动
- 后者需要单独确认和权限提示

---

## 十二、与 OA 扩展的兼容性

这套方案不会阻碍未来 OA 扩展，反而更利于扩展。

原则是：

> **底层用 `content_registry` 统一承载，前台按业务语义增加新的工作面。**

未来可能的扩展：

| OA 类型  | 底层 kind     | 前台工作面                        |
| -------- | ------------- | --------------------------------- |
| 审批文档 | `document`    | Docs                              |
| 审批附件 | `file`        | Files                             |
| 表单记录 | `form_record` | Records（新增）                   |
| 流程归档 | `archive`     | Files 或 Archives（按复杂度决定） |

不要为了 “以后可能会有更多类型”，就提前把今天的 `Files` 改叫成抽象的 `Resources`。

---

## 十三、实施顺序

不要一上来全量重构。按依赖关系分阶段推进。

### Phase 0：方案定稿

本文档本身就是 Phase 0 的产出，不应继续停留在 “待确认” 状态。

目标：

- 锁定 `Space` 是唯一工作区根
- 锁定 `Docs / Files / Source Set / Chat / Community / Memory` 的归属边界
- 锁定 canonical URL 语法为 `/spaces/:spaceId/...`
- 将本文件作为后续产品与工程实现的共同依据

### Phase 1：路由规范化

目标：

- 引入 `/spaces/:spaceId/...` canonical routes
- 所有旧路由仅保留 redirect
- 所有 docs/files 深链都显式带 `spaceId`

验收标准：

- 刷新页面后空间上下文不丢失
- 任一深链可直接打开目标空间中的目标内容
- 业务代码不再依赖全局空间回退

### Phase 2：Space 可见性 UI

目标：

- Space Switcher 永远可见
- docs/files/source sets 全部体现当前空间
- breadcrumb 第一层统一为空间名

验收标准：

- 用户在任意页面都知道 “我现在在哪个空间”
- 切换空间时保留当前工作面

### Phase 3：Docs / Files / Source Set 前台分层

目标：

- 文档页只看文档
- 文件页只看文件
- 资料集范围成为唯一跨类型联结入口

验收标准：

- docs 页面没有文件噪音
- files 页面没有文档噪音
- source set 的统一读取链路能同时消费两类内容

### Phase 4：团队与 RBAC UI

目标：

- 成员页、邀请流、角色表达、禁用态、只读态收口
- 权限前置，而不是提交时才失败

### Phase 5：OA 与高级协作扩展

目标：

- 新工作面按 `space` 内扩展
- 更细粒度内容分享在此阶段评估

---

## 十四、迁移策略

### 1. 旧的默认空间如何迁移

当前所谓 “默认空间” 不应该继续隐藏存在，而应该显式迁移为：

- `个人空间`

迁移规则：

1. 每个用户现有默认空间保留原 `spaceId`
2. UI 上第一次明确把它显示成 “个人空间”
3. 该空间下原有 docs/files/source sets 原地保留
4. 之后允许继续新建更多 personal/team spaces

### 2. 旧 URL 如何迁移

- `/docs` → redirect 到当前活动空间的 canonical docs route
- `/content` → redirect 到当前活动空间的 canonical files route
- `/docs/spaces/:spaceId`、`/content/spaces/:spaceId` 作为中间兼容层逐步移除

### 3. 旧心智如何迁移

不要一次把所有 UI 文案打碎重来，而是按顺序：

1. 先让用户看到 “空间”
2. 再让用户看到 “文档 / 文件 / 资料集” 的边界
3. 最后再彻底淡化 `content`

---

## 十五、明确不再继续做的事情

以下方向应该停止：

1. 不要继续把 `Source Set` 往顶层抬
2. 不要继续默认跨 space 混合展示资料集
3. 不要继续依赖 `activeWorkspaceSpaceId` 作为主要业务语义
4. 不要继续把 `Docs / Files` 当成脱离空间的全局模块强化
5. 不要继续让 `Memory` 的个人边界和团队边界混在一起
6. 不要继续用 `Content` 作为面向用户的主名词

---

## 十六、最终定义

最终产品模型应该被定义成：

> **Space 是唯一的工作区根。**\
> **Docs（文档）是知识成果工作面，Files（文件）是原始资产工作面。**\
> **Source Set（资料集）是 Space 内的专题容器，也是 Docs 和 Files 共享的专题范围，不再成为第三套主页面。**
> **Chat / Agent、Community、Personal Memory、Account 属于 Space 外模块。**\
> **Content 退到实现层，作为统一资源注册表存在，不再作为用户主语。**

如果这一点不先收口，后面无论再补多少 sidebar、scope、source set 入口，都会继续在错误的顶层结构上修补，而不会得到一个真正可扩展的工作区产品。
