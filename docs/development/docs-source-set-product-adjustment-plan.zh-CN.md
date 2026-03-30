# 文档与 Source Set 产品调整方案

**状态**：提案  
**范围**：`/docs`、`source set` 内文档创建/归属/迁移、文档列表过滤与详情页归属表达  
**目标**：让文档的“创建位置”、“归属位置”和“浏览位置”三者语义一致，减少当前 space 根文档与 source set 文档之间的心智断裂

---

## 一、背景

当前代码已经支持 `Document.sourceSetId`，说明数据模型层面允许文档归属某个 source set。  
但产品入口并没有把这件事做完整：

- `/docs` 的默认新建只会创建到当前 `space` 根
- `sourceSetId` 在创建入口上没有稳定透传
- 文档列表没有明确表达“未归属 / 已归属哪个 source set”
- 用户无法在文档详情里自然地调整归属

结果是：

- “文档支持 source set” 在技术上成立，在产品上并不成立
- 用户必须先创建文档，再靠隐式后处理去理解它在哪里
- `/docs` 与 `source set` 的关系模糊，容易造成 “文档到底属于 space 还是属于知识集” 的困惑

---

## 二、结论

最优雅的设计不是让文档天然属于 source set，也不是让所有文档都永远先落在 space 根。  
最优雅的设计是：

**文档始终属于当前 space。`source set` 是文档的归属容器或组织上下文，默认跟随当前创建上下文，但可后续调整。**

换句话说：

- 在 `/docs` 根创建：默认创建为 `Unassigned` 文档
- 在某个 `source set` 内创建：默认创建到该 `source set`
- 文档详情中：始终允许改变归属
- `/docs` 中：必须能清楚看见文档当前归属

这套模型兼顾了：

- 文档作为 space 一级资源的独立性
- source set 作为知识组织容器的明确边界
- 用户在不同上下文中的“所见即所得”创建体验

---

## 三、现状问题

### 1. 创建上下文和归属结果不一致

用户在 `/docs` 中新建文档时，没有机会指定归属。  
用户在 `source set` 中也缺少稳定的“创建即归属”体验。  
最终文档落点和用户当前所在位置没有直接关系。

### 2. `/docs` 缺少归属表达

当前 `/docs` 更像“全部文档列表”，但用户看不出：

- 哪些文档未归属
- 哪些文档属于哪个 source set
- 当前列表是否只在看未归属文档

### 3. 文档迁移心智不存在

文档一旦创建，用户缺少一个明确入口把它：

- 从 `Unassigned` 移入某个 source set
- 从一个 source set 移到另一个 source set
- 从某个 source set 移回 `Unassigned`

### 4. 信息架构不够一致

现在用户会同时面对：

- `/docs`
- `/content/source-sets/:id`
- 文档详情页

但系统没有明确告诉用户：

- `/docs` 是“总库”
- `source set` 是“归属视图”
- 文档详情是“资源本体”

---

## 四、目标产品模型

### 1. 资源模型

文档资源包含两个层次：

- `spaceId`：文档所属工作空间，必填
- `sourceSetId`：文档所属知识集，可为空

语义解释：

- `sourceSetId = null`：文档属于当前 space，但未归属到任何 source set
- `sourceSetId = xxx`：文档属于当前 space，且归属到某个 source set

这意味着 source set 不是文档存在的前提，而是文档的组织归属。

### 2. 视图模型

需要明确三类视图：

- `All Docs`：当前 space 下所有文档
- `Unassigned`：当前 space 下未归属到任何 source set 的文档
- `Source Set Scoped`：某个 source set 下的文档

### 3. 创建模型

创建文档时默认跟随当前视图上下文：

- 在 `/docs` 根：创建为 `Unassigned`
- 在 `/docs?filter=unassigned`：创建为 `Unassigned`
- 在某个 source set 页面：创建到该 source set

同时保留一个轻量改归属能力，而不是每次都强制弹复杂配置。

---

## 五、推荐交互方案

### 方案 A：上下文默认归属 + 详情页可迁移

这是推荐方案。

#### `/docs`

- 顶部增加过滤维度：
  - `All`
  - `Unassigned`
  - `By Source Set`
- 每条文档显示一个归属标识：
  - `Unassigned`
  - `Source Set Name`

#### `source set` 详情页

- 新建文档按钮文案明确为：
  - `新建到当前知识集`
- 上传文档也默认进入当前 source set

#### 文档详情页

- 在标题区或信息区展示当前归属
- 提供 `Move to Source Set` / `Remove from Source Set`
- 修改后列表与详情同步刷新

#### 优点

- 用户无需学习复杂规则
- 创建落点与当前上下文一致
- 文档可以在后续运营中再整理归属
- `/docs` 与 `source set` 的关系最清楚

---

## 六、不推荐的方案

### 方案 B：所有文档都必须属于某个 source set

不推荐。  
这会把 source set 变成文档创建前置条件，带来两个问题：

- 用户只是想记一篇文档，也得先选知识集
- 临时笔记、草稿、运营中间态没有自然容器

这会明显抬高创建门槛。

### 方案 C：所有文档统一先创建到 space 根，再让用户手动移动

也不推荐。  
这会导致：

- 从 source set 内创建文档时，结果不符合用户预期
- 用户频繁经历“先创建，再修正归属”的多一步流程
- 列表与详情的上下文感觉始终是错位的

---

## 七、建议落地形态

### Phase 1：把语义先做对

- `source set` 内创建/导入文档默认透传 `sourceSetId`
- `/docs` 根创建默认 `sourceSetId = null`
- 文档详情显示当前归属

### Phase 2：把组织能力做出来

- `/docs` 增加 `All / Unassigned / Source Set` 过滤
- 列表项显示 source set 标签
- 支持从详情页改归属

### Phase 3：把批量操作补齐

- 列表批量移入 source set
- 列表批量移出 source set
- source set 内批量移到其他 source set

---

## 八、URL 与状态建议

### `/docs`

建议支持以下查询状态：

- `?scope=all`
- `?scope=unassigned`
- `?scope=source-set&sourceSetId=ss_xxx`

不要只依赖本地 store 布尔值表达过滤状态。  
过滤条件应可深链、可刷新、可分享。

### `source set`

在 `source set` 详情页内部，不需要额外 query 才知道创建归属。  
当前 route context 本身就足够表达默认归属。

---

## 九、UI 建议

### 文档列表项

每个文档项增加一枚轻量归属标签：

- 灰色：`Unassigned`
- 品牌色或中性色：`Source Set Name`

### 文档详情头部

在标题附近展示：

- 所属 source set
- `Move` 操作入口

不要把归属编辑藏进二级下拉菜单深处。  
这是信息架构属性，不是次要元数据。

### 创建按钮

推荐文案：

- `/docs`：`新建文档`
- `source set`：`新建到当前知识集`

尽量让按钮文案就能解释落点。

---

## 十、实现建议

### 数据层

- 复用现有 `sourceSetId` 字段，不需要改 schema
- `createPage` / `createNewPage` / `createNewTable` 增加可选 `sourceSetId`
- `PageEntry` / `PageExplorerPlaceholder` 根据上下文透传

### 列表层

- `docs` 查询支持基于 `sourceSetId` 与 `unassigned` 的过滤
- selector 层保留 `snapshot` 模式，避免重复派生

### 详情层

- `PageEditor` 头部增加 source set 归属展示与修改入口
- 修改归属后同时刷新 `docs` 列表和当前 source set 列表

---

## 十一、验收标准

- 在 `/docs` 新建文档后，文档归属为 `Unassigned`
- 在某个 `source set` 内新建或上传文档后，文档自动归属到该 `source set`
- `/docs` 列表能明确看出文档归属
- 文档详情页可以修改归属
- 手动迁移归属后，列表与详情状态同步
- URL 能稳定表达当前列表过滤范围

---

## 十二、最终建议

如果只做一件事，优先做：

**让文档创建默认跟随当前上下文归属。**

如果做完整方案，建议依次做：

1. `source set` 内创建默认带 `sourceSetId`
2. `/docs` 显示 `Unassigned / Source Set` 归属标签
3. 文档详情支持迁移归属
4. `/docs` 增加基于归属的 URL 级过滤

这会让文档产品从“技术上支持 source set”升级成“用户真的能理解并自然使用 source set”。
