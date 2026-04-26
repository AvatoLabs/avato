# Web 端 Markdown 资源打开模式审计与改造方案

## 1. 背景

当前 Web 端对 “从本地导入的 Markdown 资源” 的处理存在明显不一致：

- 在资源列表中点击，有时会进入 Doc 编辑器
- 在 source set 页面左侧树中点击，同一个资源又会进入 Markdown 预览器
- 从不同入口打开同一个资源，URL、打开目标、缓存命中对象也可能不同

这类问题已经不只是一个 “点击行为不统一” 的前端细节，而是资源模型、路由语义、预览与编辑边界、隐式数据派生策略混在一起造成的系统性设计问题。

本文档目标是：

- 解释当前行为为什么会发生
- 明确 Markdown 资源是否会隐式生成新的 doc
- 判断是否会造成重复、分叉和脏状态
- 给出短期修复方案与长期推荐方案

---

## 2. 结论摘要

### 2.1 用户观察到的现象是成立的

同一个 Markdown 资源在不同入口确实会走不同打开路径：

- 资源列表 / 瀑布流：倾向进入 Doc 编辑器
- source set 树节点：倾向进入 Markdown 预览器

### 2.2 当前实现中，“打开 Markdown” 本身就是一次写操作

只要某个入口决定把 Markdown 当作 Doc 打开，系统就会调用 `ensureFileDocument`：

- 如果该文件还没有派生 document，会立即创建一条 `documents` 记录
- 这一步发生在 “打开” 阶段，不是等到用户真正编辑时才发生

### 2.3 这个派生出来的 doc 默认不会在资源列表里显示成第二条，但会进入 document/page 体系

因此：

- 在资源区通常不会直接看到两条重复记录
- 但在 Pages /doc 列表或其他 document 相关视图中，可能会看到它
- 用户感知上仍然会觉得 “从资源里点开一个 Markdown，系统多出了一个 doc”

### 2.4 当前最严重的问题不是 “会不会多一条”，而是 “两个真相源并存”

一旦 Markdown 被派生成 file-backed doc：

- Doc 编辑器读写的是 `documents.content`
- Markdown 预览器读取的仍然是原始文件 URL 对应的 blob 内容

这会导致：

- 编辑器中看到的是新内容
- 预览器中看到的可能还是旧文件内容

也就是说，系统现在允许 “原始 Markdown 文件” 和 “派生 doc” 长期分叉。

---

## 3. 当前行为审计

### 3.1 资源列表和瀑布流的行为

资源列表和瀑布流都会把 Markdown 资源作为 `preferPageEditor` 处理。

打开时的逻辑是：

1. 如果资源是 Markdown，则调用 `documentService.ensureFileDocument(fileId)`
2. 若已存在派生 document，则复用
3. 若不存在，则创建新的 `documents` 记录
4. 打开目标切换为 doc 模式，并把 URL 中的 `file` 参数改成该 document id

这意味着右侧资源列表中的 Markdown，本质上已经被产品定义为 “优先进入 doc 编辑器”。

换句话说，列表点击路径的默认策略是：

- 只要命中 `isMarkdownContentFile`
- 就优先尝试 “转成 doc 后打开”
- 而不是先按普通 file 预览

### 3.2 source set 左侧树的行为

source set 左侧树节点虽然也复用了 `useFileItemClick`，但没有传入：

- `preferPageEditor`
- `fileId`

因此树节点点击时不会把普通 Markdown 当作 doc 打开，而是按普通文件进入预览器。

结果就是：

- 同一个 Markdown，在 source set 树里点开是预览器
- 在右侧资源列表里点开是 doc 编辑器

这正是用户感知 “有时候预览，有时候编辑” 的直接原因。

### 3.3 URL 直达行为

`/content?file=...` 初始化时也会做一次判定：

- 如果目标已经是 document，则进入 doc 模式
- 如果目标是 Markdown file，则会再次 `ensureFileDocument`
- 然后把 URL 重写成 `?file=docs_xxx`

这说明 URL 直达也会触发隐式派生。

同时，这条路径还有一个与列表点击不同的重要细节：

- 如果 `ensureFileDocument` 失败，不会停留在错误态
- 而是继续降级到普通 file 打开路径
- 对 Markdown 而言，这通常会落到 `FileViewer -> MarkdownViewer`

这也是为什么用户可能观察到：

- 点击打开时进入 BlockSuite 编辑器
- 刷新、直达、时序异常或转换失败时又回到 Markdown 预览器

因此，从调研视角看，“两条主决策路径并行存在且错误处理不同” 这个判断是成立的；但需要补充的是，source set 树本身又构成了第三条入口路径，并且它天然绕开了 `preferPageEditor`。

---

## 4. 是否会生成新的 doc

### 4.1 会，但不是每次都生成

准确说法如下：

- 第一次以 doc 方式打开某个 Markdown file 时，会生成一条 file-backed document
- 后续再次打开时，理论上会复用 `findByFileId(fileId)` 找到的那条记录

因此：

- 正常单入口、单用户、单请求情况下，不会每次都新建
- 但 “第一次打开就写库” 这一点本身已经是很重的副作用

### 4.2 当前没有数据库层唯一约束

`documents.file_id` 只有普通索引，没有唯一索引。

而 `ensureFileDocument` 的实现是：

1. `findByFileId`
2. 如果没找到，则 `create`

这不是原子操作。

因此在以下情况下，真实重复是可能发生的：

- 双击 / 多标签页并发打开
- 两个客户端几乎同时触发 ensure
- 某些异步初始化路径重复调用

如果真的出现两条 document 绑定同一个 file：

- 资源查询的 `LEFT JOIN documents d ON f.id = d.file_id` 会返回多行
- 资源列表层面也可能出现真重复或非确定行为

结论：

- 正常情况下是 “隐式派生但复用”
- 并发情况下存在 “真实重复” 的结构性风险

---

## 5. 是否会造成重复

### 5.1 在资源列表内，通常不会显示成两条

这是因为当前资源聚合层做了一个折中处理：

- file 查询里会把 file 和它关联的 document 做 `LEFT JOIN`
- 并用 `COALESCE(d.id, f.id) as id`
- document 查询会排除 `source_type = 'file'` 的 document

这样做的效果是：

- 正常情况下，资源列表只显示 “一个资源项”
- 这个资源项可能长得像 file，也可能长得像 doc，但 UI 只看到一条

### 5.2 在 document/page 体系中，会形成 “隐式多一份” 的感知

page/doc 列表允许 `sourceType in ['editor', 'file', 'api']`。

这意味着 file-backed document 会被当成 page/document 进入 page 列表。

因此用户感知上会出现：

- 资源里有一个 Markdown
- Pages 里又出现一个 doc

这虽然不是同一列表里的双份，但已经是产品语义上的重复。

### 5.3 删除行为也会被这层混合语义影响

当前 file-backed document 与原 file 之间并不是完全独立：

- 删除 document 时，服务端会递归收集关联 file，一起删
- 这从数据一致性的角度说可以理解
- 但从 “用户是否意识到自己删的是文件还是派生 doc” 的角度看，语义并不清晰

---

## 6. 更深层的设计不合理

根因不在某一个 if 判断，而在模型层混了三种本应分开的对象。

当前系统把下面三种实体混在一起：

### 6.1 原始文件资源（Raw File）

特征：

- 来自上传
- 有真实 blob / URL
- 适合预览、embedding、chunking、共享
- 本应有稳定 file identity

### 6.2 由文件派生的可编辑文档（File-backed Document）

特征：

- 由 `ensureFileDocument` 隐式生成
- 内容保存在 `documents.content`
- 仍然挂着 `fileId`
- 在产品上既像 file，又像 doc

### 6.3 原生创建的文档（Native Editor Document）

特征：

- 由编辑器创建
- 没有底层 file blob
- 是真正意义上的 doc/page

---

## 7. 当前模型带来的直接问题

### 7.1 打开策略分散

当前至少有多套判断 Markdown 的方式：

- 资源列表 / 瀑布流：`isMarkdownContentFile` + `preferPageEditor`
- source set 树：只看 `isPage`
- FileViewer：自己维护一套 markdown 扩展名 / MIME 判断
- RecentResource：甚至直接用 `fileType === 'text/plain'` 判断 page

这意味着 “Markdown 到底算 file 还是 doc” 没有单一真相。

### 7.2 资源 ID 语义不稳定

当前资源聚合结果里，一个条目可能出现：

- `id = docs_xxx`
- `sourceType = 'file'`
- `fileId = files_xxx`

这会引发：

- 路由参数 `?file=` 其实不一定是 file id
- 复制出来的资源链接语义不清
- 依赖 id 前缀做行为分支的地方越来越多

### 7.3 预览与编辑没有共享单一内容源

这是当前最危险的问题：

- 预览器读原始 file URL
- 编辑器读派生 document content

如果两边不强同步，就必然会分叉。

### 7.4 “打开” 触发隐式转换，产品边界不清晰

用户现在没有明确经历过：

- “这是原始 Markdown 文件”
- “我要把它转换成 doc 才能编辑”

系统替用户做了转换决策，这就是认知不一致的根源。

### 7.5 缺少显式的 “打开意图 / 展示模式” 表达

调研里提出 “缺少显式展示模式字段” 的判断有一定价值，但需要更精确地理解：

- 当前系统确实没有一个稳定字段明确表达 “这个资源默认该预览还是该编辑”
- 这导致不同入口只能依赖运行时推断
- 用户也无法表达自己的真实意图：只是阅读，还是要转成 doc 编辑

但这里不能简单理解成 “只要加一个 `displayMode` 字段就能解决问题”。

因为在当前实现里，更底层的问题是：

- 资源 identity 本身已经混乱
- file 与派生 document 的主标识被混写
- preview 与 edit 甚至不共享同一个内容源

所以更合理的判断是：

- “显式展示模式” 是值得引入的产品能力
- 但它应该建立在资源身份和打开目标已经收敛之后
- 不能作为第一步去掩盖更底层的建模问题

---

## 8. 产品决策建议

必须先在产品层选清楚下面两种路线中的一种。

### 8.1 路线 A：Markdown 默认是 File，编辑需要显式转换

产品规则：

- 上传的 `.md` 默认就是原始文件资源
- 点击默认进入 Markdown 预览器
- 用户点击 “Edit as Doc / Convert to Doc” 后才生成派生 doc
- 可选增强：首次编辑时弹出选择，并支持记住用户偏好
- 派生 doc 与原始文件的关系在 UI 中明确展示

优点：

- 语义清楚
- 用户知道自己在做转换
- 不再有 “打开即写库” 的副作用

缺点：

- 产品流程多一步
- 要设计 file -> doc 转换关系展示

### 8.2 路线 B：Markdown 默认就是可编辑 Doc

产品规则：

- 导入 `.md` 后立即 canonicalize 为 doc
- 资源区和编辑区都围绕同一 document 展示
- 原始 file 只作为导入来源，不再作为长期独立资源参与预览

优点：

- 打开行为统一
- 不会出现 preview/doc 分叉
- 产品心智更简单

缺点：

- 需要调整导入链路
- 会影响现有 file 体系与 chunking / 权限 / 分享的实现边界

---

## 9. 推荐路线

推荐采用 **路线 A：Markdown 默认是 File，编辑时显式转换**。

原因：

1. 当前系统已经有完善的 file 资源体系
2. Markdown 文件天然有 “原文文件” 心智
3. 最小代价下，可以先修正打开一致性与隐式副作用
4. 不需要一次性推翻 file /source set /chunking/preview 基础设施

对应产品原则：

- “预览” 与 “编辑” 是两个不同动作
- “文件” 与 “文档” 是两个不同实体
- “转换” 必须显式，不应发生在点击打开时

---

## 10. 推荐改造方案

### 10.1 立即修复项（短期）

#### 方案 1：统一所有入口的打开策略

抽出单一的 `resolveOpenTarget(resource)` 逻辑，统一用于：

- Explorer List
- Explorer Masonry
- SourceSetTree
- Recent Resources
- Search / Command Menu
- Shared with Me
- Agent Sources

目标：

- 同一个资源，无论从哪里打开，都得到同一种结果

#### 方案 2：禁止 “打开即派生”

移除以下路径中的隐式 `ensureFileDocument`：

- 点击 Markdown 资源时
- `?file=` 初始化恢复时

改为：

- 默认走 Markdown 预览器
- 在预览器顶部提供 “Edit as Doc” 显式入口
- 首次转换时允许用户选择 “总是这样打开” 作为偏好能力，但这应建立在统一 open-target 之后

#### 方案 3：先不混写 `id`

资源聚合结果中：

- `id` 应保持资源自身稳定 identity
- 新增 `derivedDocumentId`
- 新增 `openKind`
- 不再用 `COALESCE(d.id, f.id) as id`

这一步可以显著降低前端行为分叉。

### 10.2 中期修复项

#### 方案 4：为 file-backed doc 增加唯一约束

建议加唯一索引：

- `UNIQUE (file_id) WHERE file_id IS NOT NULL AND deleted_at IS NULL`

至少要保证一个活跃 file 只能绑定一个活跃派生 doc。

#### 方案 5：明确 file-backed doc 是否进入 Pages

需要产品决策：

- 如果允许进入 Pages，必须明确标记 “来源于文件”
- 如果不允许进入 Pages，则 page 列表应过滤 `sourceType='file'`

#### 方案 6：清理 scattered heuristics

统一 Markdown 判定逻辑，避免以下情况继续存在：

- 一处按扩展名
- 一处按 MIME
- 一处按 `text/plain`
- 一处按 `custom/document`

应该由统一工具函数输出：

- `resourceKind`
- `previewKind`
- `openTarget`
- `isEditableAsDoc`

#### 方案 7：在身份模型稳定后，再引入显式展示模式

如果产品希望支持 “预览优先 / 编辑优先 / 记住偏好”，建议在资源 identity 收敛后引入：

- `displayMode`
- `openPreference`
- 或等价的 viewer policy 字段

适合承载的语义包括：

- 默认预览
- 默认进入 doc
- 首次询问并记住偏好

不适合承载的语义包括：

- 替代 `fileId` / `documentId` 的关系建模
- 替代统一的 `resolveOpenTarget`
- 掩盖 preview 与 edit 内容源分叉

### 10.3 长期修复项

#### 方案 8：补齐实体关系模型

如果保留 file-backed doc，建议显式表达：

- `file` 是源对象
- `document` 是派生对象
- 二者通过稳定关系字段关联
- UI 可查看 “来源文件” 和 “派生文档”

不要再依赖：

- `id` 前缀猜类型
- `COALESCE` 改写主标识
- `sourceType='file'` 但 `id=docs_xxx`

---

## 11. 推荐实施顺序

### Phase 1：止血

- 统一所有打开入口
- 移除打开阶段的隐式 `ensureFileDocument`
- SourceSetTree 与 List/Masonry 行为对齐
- 修复 Recent Resources 的错误 page 判断

### Phase 2：收敛语义

- 资源聚合层不再混改 `id`
- 为资源项增加显式 `fileId` / `documentId` / `openTarget`
- 把 Markdown 打开策略收敛到单一 resolver
- 评估是否需要引入 `displayMode / openPreference` 作为产品层补充能力

### Phase 3：建立模型约束

- 给 `documents.file_id` 加唯一约束
- 统一 file-backed doc 的显示策略
- 明确 page 体系是否接纳 file-backed doc
- 如果提供 “记住打开方式”，在这一阶段落到稳定字段或用户偏好模型

---

## 12. 验收标准

完成后应满足以下条件：

### 行为一致性

- 同一个 Markdown 从任意入口打开，结果一致
- source set 树与右侧列表不再分叉

### 数据一致性

- 打开资源不会隐式写库
- 一个 file 最多对应一个活跃派生 doc

### 内容一致性

- 不再出现 “预览是旧内容、编辑器是新内容” 的分叉

### 产品一致性

- 用户能清楚知道自己看到的是：
  - 原始文件
  - 还是已转换的 doc

---

## 13. 最终建议

当前问题的本质不是一个按钮点错，而是系统缺失明确分野：

- File 是什么
- Doc 是什么
- Markdown 默认属于哪一类
- 转换何时发生
- 转换后谁是内容真相源

如果不先把这些界限画清，继续在各入口补 if 判断，只会让：

- 行为越来越碎
- URL 语义越来越脏
- 缓存与删除逻辑越来越难维护

建议按以下原则推进：

- 默认把本地导入 Markdown 视为 File
- 默认点击进入预览
- 编辑必须显式转换
- 转换后保持稳定的 file/document 双实体关系
- 所有入口共享统一 open-target 解析逻辑

这是当前成本最低、风险最可控、也最容易向用户解释的一条路径。
