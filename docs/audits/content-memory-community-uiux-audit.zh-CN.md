# 内容 / 记忆 / 社区 UI/UX 审计

**范围**：`content` 内容工作区、文件上传与加载链路、`Pages / Docs` 子页、`memory` / `community` / `content` 侧栏导航，以及相关共享导航组件。\
**方法**：基于仓库静态代码阅读，结合 Vercel Web Interface Guidelines 的 `Navigation & State`、`Performance`、`Content Handling`、`Hover & Interactive States` 规则做二次核对。本文只记录代码已能直接证明的问题；需要运行环境或实机操作才能确认的项，会单独标注为 “需验证”。

---

## 如何阅读本文

- **已确认问题**：代码已经直接体现出错误或高风险语义，适合进入修复排期。
- **一致性债务**：当前未必每次都触发明显 bug，但会持续制造随机体验和实现分叉。
- **需验证项**：代码有明确信号，但影响范围还要靠浏览器 trace 或实机走查确认。

---

## 执行摘要

| 优先级 | 结论                                                                                                                    | 状态   |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ------ |
| **P1** | 共享 sidebar 返回按钮默认走浏览器历史，而不是父级路由，导致 `community / memory / pages` 经常回到 “上一个操作页”        | 已确认 |
| **P1** | `content` 列表在 SWR 成功后会整页覆盖 store，上传后文件可见性不稳定，容易出现 “刚出来又消失”                            | 已确认 |
| **P1** | 上传 dock、文件列表 skeleton、处理中轮询是三套互不协调的状态机，loading 反馈割裂                                        | 已确认 |
| **P1** | `ContentManager` 在子页打开后仍常驻渲染 explorer，并继续 URL 同步、列表计算和任务轮询                                   | 已确认 |
| **P1** | `DocsAgentProvider` 阻塞 `PageEditor` 首屏，文档内容可见性被 AI 初始化链路卡住                                          | 已确认 |
| **P2** | `content` 与 `pages` 列表都存在明显重复派生、重复排序和重复首屏请求后的回流计算                                         | 已确认 |
| **P2** | 返回语义已经在不同模块中分叉成多套实现，`content source-set` / `community detail` 是层级返回，其它 sidebar 仍是历史返回 | 已确认 |
| **P2** | 同一共享 sidebar 组件还影响 `settings / image / video / studio / eval`，问题范围大于当前用户感知范围                    | 已确认 |

---

## 一、已确认且应优先处理的问题

### 1. 共享 sidebar 返回按钮默认语义错误：回历史，不回父级（P1）

`SubSidebarTitleBar` 默认 `backUseHistory = true`，继续传给 `BackButton`；`BackButton` 默认 `useHistory = true`，最终只要浏览器 history index 大于 `0`，就直接 `navigate(-1)`。\
这意味着对于侧栏这种 “信息架构导航”，默认行为不是 “回上一级”，而是 “回上一条操作轨迹”。

**直接影响**：

- 用户从列表进入详情，再经过搜索、切 tab、打开弹层等操作后，点返回经常会回到 “上一步动作页”。
- 这种行为违反了左侧层级导航的常见心智，也违背了 URL 应反映 UI 状态、导航应可预测的原则。

**证据**：

- `src/features/NavPanel/components/SubSidebarTitleBar.tsx:20-24`
- `src/features/NavPanel/components/SubSidebarTitleBar.tsx:35`
- `src/features/NavPanel/components/BackButton.tsx:11-26`
- `src/utils/navigation.ts:21-29`

### 2. `memory / community / pages` 直接继承了这个错误默认值（P1）

`memory`、`community` 和 `Pages` 的侧栏 header 都是直接裸用 `SubSidebarTitleBar`，只传了 `title` / `titleTo`，没有传 `backUseHistory={false}` 或层级 `backTo`。\
所以它们现在不是 “偶尔有问题”，而是实现层面就被定义成 “优先回历史”。

**证据**：

- `src/routes/(main)/memory/_layout/Sidebar/Header/index.tsx:15`
- `src/routes/(main)/community/_layout/Sidebar/Header/index.tsx:15`
- `src/features/Pages/PageLayout/Header/index.tsx:31-35`

### 3. 返回逻辑已经在各模块分裂成多套实现，体验不一致（P2）

`content` 首页已经显式关掉 history；`source-set` 子页甚至根据 breadcrumb 计算父级路径；`community` 详情页也手写了 `handleGoBack()` 回列表页。\
说明团队已经在局部承认 “层级返回” 才是正确语义，但这个语义没有沉到共享抽象，导致不同模块体验像拼接出来的一样。

**证据**：

- `src/routes/(main)/content/(home)/_layout/Header/index.tsx:17-22`
- `src/routes/(main)/content/source-sets/_layout/Header/index.tsx:18-20`
- `src/routes/(main)/content/source-sets/features/useSourceSetBackPath.ts:13-42`
- `src/routes/(main)/community/(detail)/_layout/Header.tsx:20-39`

**结论**：

- 这不是单点路由 bug，而是共享导航组件的默认策略设计错了。
- `settings / image / video / studio / eval` 这些 sidebar 也在复用同一个默认值，属于尚未完全暴露出来的一致性债务。

### 4. `ContentManager` 在打开子页后仍保持 explorer 常驻运行（P1）

`ContentManager` 无条件渲染 `<Explorer />`，只是再叠一层 editor/doc overlay。\
这会让用户已经进入文件或文档子页时，背后的 explorer 仍继续进行：

- URL 状态同步
- 列表查询
- 空态判定
- 列表派生与排序
- 处理中任务轮询

这不仅拉高后台 CPU 和请求活跃度，也让 “子页应该是独立上下文” 的交互边界变得模糊。

**证据**：

- `src/features/ContentManager/index.tsx:198-227`
- `src/features/ContentManager/components/Explorer/index.tsx:31-99`
- `src/features/ContentManager/components/Explorer/useCheckTaskStatus.ts:17-28`

### 5. 文件列表在 SWR 成功后会整页覆盖 store，导致 “loaded 后又丢失”（P1）

`useFetchResources()` 固定请求 `offset: 0`；一旦成功，`syncResourceStore()` 会把 `resourceList`、`resourceMap`、`offset` 无条件重置为当前首屏结果。\
这会直接冲掉：

- 刚 append 的分页结果
- 刚上传但尚未进入首屏排序窗口的数据
- 本地乐观更新项

所以 “文件要刷新几次才出来”“loaded 后偶发又消失” 是当前数据回写策略的自然结果。

**证据**：

- `src/store/file/slices/content/hooks.ts:26-55`
- `src/store/file/slices/content/hooks.ts:72-90`
- `src/store/file/slices/content/action.ts:491-518`

### 6. 上传完成后列表没有即时并入逻辑，只能赌统一 refresh 成功（P1）

上传链路当前是：

1. 先把文件放进 dock。
2. 并发上传。
3. 全部上传完后统一 `refreshFileList()`。
4. 再触发 parse /embed 后续刷新。

问题在于 explorer 列表本身没有 “立即出现一条待处理文件” 的乐观并入逻辑；如果当时 `queryParams` 还没初始化，`revalidateResources()` 直接 no-op，新文件就不会立刻进内容页。

**证据**：

- `src/store/file/slices/fileManager/action.ts:173-255`
- `src/store/file/slices/fileManager/action.ts:294-311`
- `src/store/file/slices/content/hooks.ts:62-67`

### 7. loading 动画、上传 dock、列表真实状态完全脱节（P1）

当前至少存在三套互不协调的状态机：

- explorer skeleton 由 `useVisibleResources` 的 `isLoading / hasResolvedData` 决定
- 上传进度与处理中状态只在 `UploadDock` 显示
- 列表刷新时又故意不清 cache，以免重新触发 skeleton

结果就是：

- dock 还在 “上传中 / 处理中”，列表区却可能仍显示旧数据
- 用户看不到 “新文件正在进入列表” 的 inline 反馈
- loading 动画与真实业务状态脱节，产生 “界面像卡住了” 的错觉

**证据**：

- `src/features/ContentManager/components/Explorer/index.tsx:75-123`
- `src/features/ContentManager/components/Explorer/ListView/index.tsx:364-379`
- `src/store/file/slices/fileManager/action.ts:294-305`
- `src/features/ContentManager/components/UploadDock/index.tsx:54-139`

### 8. UploadDock 聚合状态本身就不准确（P2）

`overviewUploadingStatus()` 只会返回 `pending / uploading / success`，不会返回 `error`；而且把 `processing` 也归进 `uploading`。\
这会导致：

- 文件已失败，dock 仍可能只表现成 “上传完成”
- 文件已上传完但还在解析，dock 文案仍像 “上传中”
- UI 顶层反馈无法准确解释为什么文件还没进列表

**证据**：

- `src/store/file/slices/fileManager/selectors.ts:4-5`
- `src/store/file/slices/fileManager/selectors.ts:39-46`
- `src/features/ContentManager/components/UploadDock/index.tsx:67-82`

### 9. `PageEditor` 首屏被 Docs Agent 初始化链路阻塞（P1）

`PageEditor` 整体被 `DocsAgentProvider` 包裹，而 provider 在 docs agent 未准备好或还需同步默认模型时，会直接返回 loading。\
这意味着文档内容本身的可见性，被串到了 AI 侧初始化链路上。与此同时，`Copilot` 也默认一起挂载。

**用户层面的坏处**：

- 打开文档详情时，先被 AI 初始化 loading 卡住，而不是先看到文档内容
- 冷启动和首次打开页面详情会显著更慢
- “阅读内容” 与 “启用 Copilot” 这两条意图被错误耦合

**证据**：

- `src/features/PageEditor/PageEditor.tsx:166-170`
- `src/features/PageEditor/PageEditor.tsx:205-227`
- `src/features/PageEditor/DocsAgentProvider.tsx:45-61`
- `src/features/PageEditor/DocsAgentProvider.tsx:89-102`

### 10. 列表派生与排序存在重复 CPU pass，放大 revalidate 抖动（P2）

`Explorer` 已经先做了一次 `ContentItem -> FileListItem` 映射和排序；`MasonryView` 又重复做一遍；搜索浮层命中时还会再做一套单独映射。\
同类问题在 `pages` 侧栏也存在：`filterDocuments()` 每次都会 `filter + sort`，Header、列表、抽屉各自订阅自己的 selector，导致一次搜索或重命名会触发多次 O (n log n) 派生。

**证据**：

- `src/features/ContentManager/components/Explorer/index.tsx:78-96`
- `src/features/ContentManager/components/Explorer/MasonryView/index.tsx:78-106`
- `src/features/ContentManager/components/Explorer/SearchResultsOverlay.tsx:73-86`
- `src/store/docs/slices/list/selectors.ts:12-45`
- `src/store/docs/slices/list/selectors.ts:57-69`
- `src/store/docs/slices/list/selectors.ts:85-109`

---

## 二、一致性债务

### 1. 同一个 sidebar 标题栏组件正在污染更多模块

全仓库直接复用 `SubSidebarTitleBar` 但没有覆写 `backUseHistory` 的模块不止 `community / memory / pages`，还包括：

- `settings`
- `image`
- `video`
- `studio`
- `eval`

这意味着如果不修共享默认值，今后只会继续复制相同问题。

### 2. `content` 当前是 “双源数据” 心智

内容工作区同时存在：

- explorer 读的 `SWR_CONTENT_ITEMS + resourceList`
- file manager 维护的 `FETCH_ALL_KNOWLEDGE_KEY + fileList`

上传、刷新、乐观更新和列表渲染并不共享一个真正的单一真源。\
这类结构不一定每次都立即炸，但极易在并发上传、分页、排序切换和后台处理轮询中制造时序错位。

### 3. loading 文案与阶段定义不统一

从交互上看，当前 “上传中”“处理中”“已完成”“失败”“刚进入列表但还不可用” 这些状态没有统一的词汇和视觉表达。\
这会让用户无法区分：

- 文件还没上传完
- 文件已上传但正在解析
- 文件已解析但列表没刷新
- 文件实际失败了

---

## 三、需验证项

### 1. 子页 overlay 常驻 explorer 的真实性能成本

静态代码已能确认 explorer 常驻并继续轮询，但它在真实场景中的影响范围还需要：

1. React Profiler 看子页打开后的后台 render 次数。
2. Network 面板确认处理中轮询和 focus revalidate 的真实频率。
3. 大列表、大 source-set、频繁上传场景下测一次 CPU 占用与交互抖动。

### 2. 文件 “消失” 是否还叠加了排序窗口问题

当前已确认首屏覆盖会冲掉非首屏项，但是否还存在 “上传成功后因为排序规则被排到后面，看起来像消失”，需要结合当前默认排序和新文件 metadata 进一步实测。

### 3. `Pages` 首屏卡顿里，Copilot 的实际成本占比

代码已证明 `DocsAgentProvider` 会阻塞首屏，但 `Copilot` 自身挂载成本有多大，还需要 profiler 或火焰图验证，避免过度归因。

---

## 四、建议修复顺序

### 第一批：先收掉会直接伤害感知的问题

1. 把 `SubSidebarTitleBar` 默认值改成 “层级返回优先”，`history back` 改成显式 opt-in。
2. 统一为 `community / memory / pages / settings / image / video / studio / eval` 提供明确 `backTo`。
3. 修 `syncResourceStore()` 的覆盖策略，避免首屏 revalidate 覆盖 append /optimistic 项。
4. 上传后先把新文件乐观插入当前列表，再后台 revalidate。
5. 给 explorer 列表接入 inline pending /processing item，不再只依赖 dock。

### 第二批：处理结构性性能和一致性问题

1. 子页打开时暂停隐藏态 explorer 的请求、轮询和重派生，或直接按 mode 拆挂载。
2. 把 `Pages` 和 `content` 的重复 filter/sort 收敛到单一 memoized selector。
3. 将 `DocsAgentProvider` 和 `Copilot` 延后到文档内容首屏之后再初始化。

### 第三批：统一交互语言

1. 明确 `uploading / processing / success / error / unavailable` 的用户文案与视觉状态。
2. 让列表区和 dock 共享同一套状态定义，而不是各自解释 “现在发生了什么”。

---

## 五、结论

这批问题不是零散 bug，而是三个底层设计偏差叠在一起：

1. **导航默认值错了**：共享 sidebar 把 “历史返回” 当成默认语义。
2. **数据真源没收敛**：上传、SWR、store、分页和处理状态不是同一条链。
3. **loading 只做了视觉，没有做状态编排**：动画、dock、列表和子页没有统一的状态机。

如果只修某个页面上的现象，后面还会在别的模块继续复发。\
更合理的做法是先把共享返回语义、内容列表真源、上传状态编排这三层收敛，再做局部体验修补。
