# Enterprise Space / Content / Memory UI 重构执行方案

**状态**：可排期  
**日期**：2026-04-06  
**关联审计**：[docs/audits/enterprise-space-content-memory-uiux-audit.zh-CN.md](../audits/enterprise-space-content-memory-uiux-audit.zh-CN.md)  
**关联方案审计**：[docs/audits/enterprise-space-content-memory-ui-plan-audit.zh-CN.md](../audits/enterprise-space-content-memory-ui-plan-audit.zh-CN.md)  
**目标**：把当前 `team space / files governance / space memory / resource share` 这套“功能闭环已成但体验未收束”的 UI，重构成一套真正可长期演进的企业级工作台。

> 本文中的 `enterprise` 不是指整站所有企业功能，而是特指 **space-first 的资源、治理、协作工作面**：
> `Space Home / Files / Governance / Space Memory / Resource Share / Mobile Resource Entry`

---

## 一、执行摘要

当前 enterprise 相关能力的问题，不在“功能缺失”，而在 **UI 结构没有收束**：

- 导航、状态、筛选、动作多处重复
- 治理页面全宽平铺，信息层级塌陷
- overlay、portal、双向状态同步让界面显得 `buggy`
- 文件治理、Space Memory、分享面板都更像“表单集合”，不像“企业工作台”

本方案的核心执行顺序只有三步：

1. **先砍重叠**
   - 去掉 sidebar/header/body 中重复表达的导航和状态
2. **再收布局**
   - 给治理页建立稳定的主次结构、宽度控制和摘要区
3. **最后统一控件语义**
   - 把按钮、tag、segmented、chip 的职责重新划清

本方案不讨论新的业务能力，不引入新的 enterprise 功能范围，只处理 **现有主链 UI/UX 的重构与收口**。

---

## 二、范围定义

### 1. 本方案覆盖的范围

- `SpaceHomePage`
- `Files surface`
- `Files governance`
- `Space Memory`
- `Resource Share`
- `resource sidebar / memory sidebar`
- 移动端 `resource header / workspace chooser / governance shortcut`

### 2. 本方案不覆盖的范围

- `chat / agent / community / settings` 的全面 UI 重做
- `Memory V2`
- 新的 enterprise 功能设计
- 权限模型和后端 schema 重构

### 3. 这不是“整站 enterprise redesign”

更准确的理解应该是：

> **这是一次 space-first 资源与治理工作面的 UI 收口与工作台化重构。**

---

## 三、收口目标

本轮重构完成后，UI 应达到以下状态：

### 1. 工作区结构清晰

- 左侧只承担导航与切换
- 页头只承担上下文和高频动作
- 正文区只承担当前任务

### 2. 治理页面有稳定层级

- 摘要区、筛选区、工作列表区明确分层
- Space Memory 不再是按钮墙
- Files governance 不再是横向控件堆叠

### 3. 行为一致，不再显得“拼接”

- 同一语义只在一个主要位置出现
- 不再依赖 overlay 伪切页制造“编辑模式”
- sidebar 导航方式一致，不再混用手动劫持

### 4. 视觉语言更克制

- 状态用状态组件表达
- 动作用动作组件表达
- 页面宽度、留白、分块有统一节奏

---

## 四、非目标

本方案明确 **不做** 以下事项：

- `Memory V2` 或记忆内核改造
- 新的 enterprise 功能设计
- 权限模型重写
- 数据模型、后端 schema 变更
- 整站品牌视觉换肤
- 社区页、聊天页、设置页的全面重构

如果需要做这些，应另开方案，不阻塞本次 UI 收口。

---

## 五、不得回退的现有能力

这次重构是 UI 收口，不是主链能力回退。以下能力必须显式保留：

### 1. Space Home 的治理入口不能消失

- team space 下的 memory governance 概览入口必须保留
- `pending governance -> deep link` 能力必须保留

对应现状：

- `src/features/ResourceSpaces/SpaceHomePage.tsx`
- `src/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries.ts`

### 2. Governance deep link 不能回退

- files governance 的 query-based deep link 必须保留：
  - `assetClassification`
  - `assetRightsOwner`
  - `assetReviewStatus`
  - `assetUsagePolicy`
- memory governance 的 deep link 必须保留：
  - `section`
  - `recallFilter`

对应现状：

- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx`
- `src/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries.ts`

### 3. Mobile discoverability 不能丢

- 移动端 workspace chooser 必须保留
- pending governance / open memory shortcut 必须保留，只允许换形态，不允许消失

对应现状：

- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx`

### 4. 现有 batch workflows 不能弱化

- files selection mode 的批量治理能力必须保留
- memory selection mode 的批量 publish / reject / revalidate / stale 必须保留

### 5. 现有测试保护网不能被绕开

至少要继续维护并更新这些现有测试：

- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.test.tsx`
- `src/features/ResourceSpaces/SpaceMemoryPage.test.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.test.tsx`
- `src/routes/(main)/content/(home)/_layout/Sidebar.test.tsx`

---

## 六、设计原则

### 1. 一层只做一件事

- `Sidebar`：导航
- `Header`：上下文 + 高频动作
- `Body`：当前任务

### 2. 一个语义只有一个主入口

同一条信息不要同时出现在：

- sidebar 标题
- header 标题
- 正文摘要卡

三处里最多保留一处主入口，一处辅助入口。

### 3. 状态与动作分离

- `Button` 只表达动作
- `Tag / metric chip / inline stat` 表达状态
- `Segmented` 只表达主视图切换，不承载多层治理语义

### 4. 治理页必须有阅读宽度

治理不是 dashboard 堆卡片，更不是表单墙。  
主工作列必须有 `max-width`，避免信息横向扩散。

### 5. 状态所有权必须单一

同一交互不要同时让：

- route
- search params
- zustand store
- local state

都参与决定 UI 真相。

### 6. 只收错误的重复，不收正确的 deep link

当前已经成立的 URL-first 能力不能因为“想统一状态”而被做坏：

- governance filters 继续保持 URL-owned
- memory recall section/filter 继续保持 deep-linkable
- 只清理错误的双向 effect 和 overlay 状态真相冲突

---

## 七、状态所有权矩阵

为避免执行时误伤当前正确能力，这里明确状态归属：

### 1. URL-owned state

- files governance filters
- files category / folder path
- memory section
- memory recallFilter
- pending governance deep link target

### 2. store-owned state

- selection state
- explorer transition state
- masonry readiness
- temporary panel open state

### 3. local state

- modal/drawer 草稿输入
- 尚未提交的表单中间态

### 4. 当前最需要收敛的不是 URL-first，而是这些边界

- `useContentManagerUrlSync` 的双向 effect
- `ContentManager` 的 overlay 场景切换
- `MemorySidebarPortal` 的手动导航劫持

---

## 八、隐藏依赖与共享基础设施

这次重构不是一组页面样式修补，而是建立在若干共享基础设施上的壳层重构。排期时必须把它们算进影响面：

### 1. Sidebar 基础设施

- `src/features/NavPanel/index.tsx`
- `src/features/NavPanel/SideBarLayout.tsx`
- `src/features/NavPanel/components/NavPanelDraggable.tsx`

### 2. ContentManager 相关共享依赖

- `src/routes/(main)/content/features/hooks/useFolderPath.ts`
- `src/features/ContentManager/components/Explorer/useContentExplorer.ts`
- `src/routes/(main)/content/features/hooks/useContentManagerUrlSync.ts`

### 3. Memory 概览与 deep link 依赖

- `src/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries.ts`

### 4. 共享依赖对实施顺序的含义

- sidebar 改造不是 memory/resource 两个页面局部改造
- `ContentManager` 改造不是只动 editor overlay
- memory 改造不是只改 `SpaceMemoryPage` 视觉块布局

---

## 九、工作流拆分

本次重构拆为 5 条工作流，按顺序推进。

### 工作流 A：Sidebar / Workspace 语义收束

目标：

- 清掉重复导航
- 统一 sidebar header/body 的职责
- 让 memory / resource 两套侧栏语言更接近

涉及文件：

- `src/features/ResourceSpaces/MemorySidebarPortal.tsx`
- `src/routes/(main)/content/(home)/_layout/Sidebar.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/index.tsx`
- `src/features/ResourceSpaces/QuickAccessSection.tsx`
- `src/features/ResourceSpaces/SpaceSection.tsx`
- `src/features/NavPanel/SideBarLayout.tsx`
- `src/features/NavPanel/components/NavPanelDraggable.tsx`

核心动作：

- 移除 memory sidebar 中重复的 `/memory` Home item
- 去掉手动 `preventDefault + navigate()` 导航劫持
- 确认 resource sidebar header 只表达当前 surface 身份
- 让 `Quick Access / Spaces / File Scope / Source Sets` 的层级更稳定
- 限制全局 `user-select: none` 的作用范围，不再污染整个 sidebar 内容树

完成标准：

- Memory sidebar 与 Resource sidebar 不再出现重复首页入口
- sidebar 内的标题、分组、列表项的语义边界明确
- sidebar 的文本与交互手感不再显得机械和粗糙
- 不影响现有 `SpaceHomePage -> Files / Memory` 导航 discoverability

---

### 工作流 B：Files Surface 与 Governance Header 重构

目标：

- 把 files surface 从“控件横铺”改成“上下文 + 筛选 + 列表”的工作台

涉及文件：

- `src/features/ContentManager/components/Explorer/Header/index.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/index.tsx`

核心动作：

- 去掉 content header 与 sidebar 的重复 `SpaceSurfaceTitle`
- 将 header 收成两层：
  - 主层：breadcrumb / search / primary action
  - 次层：category / governance / sort / view
- 将 active governance filters 改成紧凑摘要，不再成为一整排主按钮
- selection mode 单独接管 toolbar，不再与普通态工具栏共处
- mobile 顶区把 `workspace switch / memory shortcut / category filter` 分层

完成标准：

- 文件治理页进入后，用户能立即分清：
  - 我在哪
  - 我看的是哪一组内容
  - 我当前有哪些筛选
  - 下一步主要动作是什么
- governance filter 的 URL deep link 与回退行为不变

---

### 工作流 C：Space Memory 工作台重构

目标：

- 把 `SpaceMemoryPage` 从“全宽堆块 + 多套按钮区”收成真正的治理工作台

涉及文件：

- `src/features/ResourceSpaces/SpaceMemoryPage.tsx`
- 如有必要：`src/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries.ts`

核心动作：

- 给主内容区增加 `max-width`
- 顶部只保留一个 compact overview
- section 切换与 recall filter 合并为单一主控区
- 删除重复的 workspace recall summary / section recall summary / current recall summary
- 把 batch action bar 抽成统一 schema 驱动的组件
- 将 `inbox / published / playbooks / policies` 的差异收敛到：
  - 列表内容
  - 可用动作
  - 详情面板

完成标准：

- Space Memory 首屏不再出现大面积重复按钮
- reviewer 和 viewer 的页面复杂度显著下降
- 列表、筛选、批量操作之间形成明确主次
- pending governance deep link 仍可直达正确 section/filter

---

### 工作流 D：File Detail / Share Modal 治理语言升级

目标：

- 让单资源治理和分享体验更像企业工作面，而不是设置表单

涉及文件：

- `src/routes/(main)/content/features/FileDetail.tsx`
- `src/features/ResourceSharing/ResourceShareModal.tsx`

核心动作：

- File Detail 顶部增加 compact governance summary
- 将 metadata、review status、actions 做明显分区
- `save / approve / archive` 不再只是挤在一排小按钮里
- Share Modal 拆成：
  - `Internal Access`
  - `Public Share Link`
- 高级项如 `password / canReshare / inheritsToChildren / expiry` 进入次级设置层

完成标准：

- 打开文件治理详情时，能先看到“当前状态”，再看到“可编辑字段”
- 分享弹窗打开后，用户不需要先读完整页才能理解怎么授权或发外链

---

### 工作流 E：ContentManager 交互稳定性重构

目标：

- 清掉造成 `buggy` 体感的 overlay / 双向同步边界

涉及文件：

- `src/features/ContentManager/index.tsx`
- `src/routes/(main)/content/features/hooks/useContentManagerUrlSync.ts`
- `src/features/ContentManager/components/Editor/index.tsx`

核心动作：

- 评估并收敛 `Explorer / FileEditor / PageEditor` 的 scene 切换模型
- 若短期不改 scene 结构，至少为底层 Explorer 增加显式 inert 隔离
- 梳理 URL 与 store 的状态真相来源
- 收掉明显的无 label icon、临时 modal 化 detail 等做工问题

完成标准：

- 文件编辑和返回列表的交互不再显得“底层页面还活着”
- back / open / edit / convert 的状态切换更线性

---

## 十、执行阶段

### Phase 0：冻结交互原则

目标：

- 在改代码前先冻结 5 条 UI 规则，避免边改边发散

产出：

- 统一 sidebar / header / body 的职责定义
- 统一 `Button / Tag / Segmented / summary chip` 的语义规范
- 冻结“不回退能力清单”

建议时长：`0.5d ~ 1d`

---

### Phase 1：先止血，砍重叠

范围：

- 工作流 A
- 工作流 B 的重复标题和 selection toolbar 问题
- 工作流 C 的重复 recall 控件

目标：

- 先把最影响体感的重复表达清掉

建议时长：`2d ~ 3d`

---

### Phase 2：重做治理布局

范围：

- 工作流 B
- 工作流 C
- 工作流 D

目标：

- 建立真正的治理页结构与宽度控制

建议时长：`3d ~ 5d`

---

### Phase 3：收交互稳定性

范围：

- 工作流 E
- mobile header 收口

目标：

- 消除 overlay、状态同步、移动端顶区拥挤带来的 `buggy` 感

建议时长：`2d ~ 3d`

---

### Phase 4：细节打磨与一致性回归

范围：

- aria-label / title / icon semantics
- spacing / width / chip / button variants
- QA walkthrough

建议时长：`1d ~ 2d`

### 工时说明

以上估算默认包含：

- 代码修改
- 现有测试更新
- 一轮主链手测

但 **不包含**：

- 大规模视觉方案反复
- 新产品决策
- 大范围跨团队评审反复

---

## 十一、验证计划

这次重构不能只靠“看起来顺眼了”验收，必须明确验证方式。

### 1. 单测与现有测试基线

以下测试应继续保持通过，必要时同步重写断言：

- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.test.tsx`
- `src/features/ResourceSpaces/SpaceMemoryPage.test.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.test.tsx`
- `src/routes/(main)/content/(home)/_layout/Sidebar.test.tsx`

### 2. 必须新增或补强的测试方向

- sidebar 导航去重后 active 态与跳转行为
- governance deep link 与 back/forward
- memory section/filter deep link
- `ContentManager` explorer/editor/doc 切换隔离

### 3. 必须手测的场景

- `team reviewer` 打开 `SpaceMemoryPage`
- `team viewer` 打开 `SpaceMemoryPage`
- `SpaceHomePage -> pending governance -> memory deep link`
- `Files -> governance filter -> refresh/back/forward`
- `Files explorer -> file editor -> back`
- `mobile workspace chooser -> pending governance shortcut`
- `ResourceShareModal` 内部授权与外链创建

### 4. 视觉验收关注点

- 页面是否还有大面积同层级按钮矩阵
- 宽屏下是否仍然失控扩展
- 顶区信息是否仍然重复表达

---

## 十二、开放决策冻结

以下问题在开工前应冻结，避免实现中来回摇摆。

| 主题 | 冻结结论 | 原因 |
| --- | --- | --- |
| `ContentManager` 场景切换 | **Phase 1-2 不做 route-level scene 重构，先保留 overlay 架构，但必须补底层 inert/interaction isolation；Phase 3 再评估是否升级成更彻底的 scene switch** | 这样能先控制风险，不会在第一刀就把 content 主链打散 |
| mobile memory shortcut 形态 | **保留在 resource 顶区的可见入口，但从标题点击区内联按钮调整为独立 secondary affordance** | 既不丢 discoverability，也避免标题区语义过载 |
| `ResourceShareModal` 拆分方式 | **保留单 modal，但内部稳定拆成 `Internal Access` 和 `Public Share Link` 两个主分区，不改成多步 flow** | 降低交互学习成本，减少重构风险 |
| files governance header 形态 | **采用双层 header：主层上下文，次层筛选与视图，不做右侧抽屉化桌面方案** | 当前问题是层级与拥挤，不是入口缺失 |
| memory 顶部 overview 形态 | **保留单个 compact overview strip，不保留多块 recall summary card matrix** | 防止重新长回按钮墙 |

### 说明

- 以上是本轮执行冻结的默认结论。
- 如需推翻，必须在进入对应工作流前完成单独评审，而不是边改边改方向。

---

## 十三、PR 切片与写集

以下切片用于降低多人协作时的冲突面，也方便单线程按块推进。

### PR1：Sidebar 语义收束

写集：

- `src/features/ResourceSpaces/MemorySidebarPortal.tsx`
- `src/routes/(main)/content/(home)/_layout/Sidebar.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/index.tsx`
- `src/features/ResourceSpaces/QuickAccessSection.tsx`
- `src/features/ResourceSpaces/SpaceSection.tsx`
- `src/features/NavPanel/SideBarLayout.tsx`
- `src/features/NavPanel/components/NavPanelDraggable.tsx`

测试/验证：

- `src/routes/(main)/content/(home)/_layout/Sidebar.test.tsx`
- sidebar active state 与 navigation 手测

说明：

- 这是后续 PR 的壳层前提，建议最先合入。

### PR2：Files Header 与 Governance Shell

写集：

- `src/features/ContentManager/components/Explorer/Header/index.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx`

测试/验证：

- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.test.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.test.tsx`
- governance deep link / back-forward 手测

说明：

- PR1 合入后做，避免 header/sidebar 语义冲突。

### PR3：Space Memory Shell

写集：

- `src/features/ResourceSpaces/SpaceMemoryPage.tsx`
- `src/features/ResourceSpaces/useTeamSpaceMemoryScopeSummaries.ts`
- 如有必要：`src/features/ResourceSpaces/SpaceHomePage.tsx`

测试/验证：

- `src/features/ResourceSpaces/SpaceMemoryPage.test.tsx`
- reviewer/viewer 双视角手测
- `SpaceHomePage -> pending governance -> deep link` 手测

说明：

- 如果 `SpaceHomePage` 的治理入口形态需要同步调整，应并入本 PR，而不是另起一刀。

### PR4：Governance Detail 与 Share

写集：

- `src/routes/(main)/content/features/FileDetail.tsx`
- `src/features/ResourceSharing/ResourceShareModal.tsx`
- 如有必要：`src/features/ResourceSharing/useResourceShareModal.tsx`

测试/验证：

- file governance detail 手测
- share modal 内部授权 / 外链创建 / 最新链接复制手测

说明：

- 这个 PR 与 PR3 可并行，但不要与 PR2 在同一时间改 `ResourceMobileHeader` 或 files header 壳层。

### PR5：ContentManager 稳定性

写集：

- `src/features/ContentManager/index.tsx`
- `src/routes/(main)/content/features/hooks/useContentManagerUrlSync.ts`
- `src/features/ContentManager/components/Editor/index.tsx`
- 如有必要：`src/routes/(main)/content/features/hooks/useFolderPath.ts`
- 如有必要：`src/features/ContentManager/components/Explorer/useContentExplorer.ts`

测试/验证：

- explorer -> editor -> back
- explorer -> doc -> back
- view/sort/query sync

说明：

- 这是结构风险最高的 PR，建议最后做。

### 并行规则

- `PR1` 必须先于 `PR2`
- `PR2` 与 `PR3` 可以顺序或轻度并行，但不能同时改同一 header 壳层
- `PR4` 可与 `PR3` 并行
- `PR5` 最好最后做

---

## 十四、责任人与签收机制

以下不是组织架构要求，而是这份方案进入排期后建议采用的最小责任模型。

### 1. 建议责任角色

| 角色 | 责任范围 | 默认对应 PR |
| --- | --- | --- |
| `UI owner` | 负责信息架构、视觉层级、交互一致性决策 | `PR1` `PR2` `PR3` |
| `surface owner` | 负责 files / memory / share 页面实现与回归 | `PR2` `PR3` `PR4` |
| `state owner` | 负责 URL/store/local state 边界与稳定性 | `PR5` |
| `QA owner` | 负责手测路径、回归记录、上线前签收 | 全部 |

### 2. 建议签收规则

- `PR1` 必须由 `UI owner` 签收
- `PR2` 必须由 `UI owner + surface owner` 共同签收
- `PR3` 必须由 `UI owner + surface owner` 共同签收
- `PR4` 必须由 `surface owner` 签收
- `PR5` 必须由 `state owner + QA owner` 共同签收

### 3. 合并前最低条件

- 对应工作流测试全部通过
- 对应手测脚本全部记录结果
- 与“不回退能力清单”逐项对照无回退
- 设计与实现没有留下新的开放决策

---

## 十五、建议排期与里程碑

以下为 **若从 `2026-04-07` 开始推进** 的建议排期；如实际资源不同，可整体平移，但顺序不建议改变。

| 日期 | 里程碑 | 产出 |
| --- | --- | --- |
| `2026-04-07` | Kickoff / freeze | 冻结开放决策、确认 owner、确认写集 |
| `2026-04-08` ~ `2026-04-10` | `PR1` | sidebar 语义收束完成 |
| `2026-04-10` ~ `2026-04-14` | `PR2` | files header / governance shell 完成 |
| `2026-04-11` ~ `2026-04-15` | `PR3` | Space Memory shell 完成 |
| `2026-04-15` ~ `2026-04-17` | `PR4` | detail / share 治理语言升级 |
| `2026-04-17` ~ `2026-04-20` | `PR5` | ContentManager 稳定性收口 |
| `2026-04-21` | QA walkthrough | reviewer / viewer / mobile / deep-link 全路径验证 |
| `2026-04-22` | Go / No-Go | 决定是否进入主分支合并窗口 |

### 说明

- `PR2` 与 `PR3` 可以部分并行，但必须遵守前文写集边界。
- `PR5` 不应抢在前面，因为它的结构风险最高。
- 若 `PR3` 触发 `SpaceHomePage` 入口调整，则应在 `2026-04-15` 前完成连带回归。

---

## 十六、回滚触发条件

以下任一条件出现，都应停止继续推进下一 PR，优先修正或回滚到上一个稳定点。

### 1. 导航与 discoverability 回退

- `SpaceHomePage -> Files / Memory` 入口消失或明显降级
- mobile 顶区无法稳定发现 workspace chooser 或 governance shortcut
- sidebar active state 或页面跳转出现错误高亮/错误落点

### 2. Deep link / URL contract 回退

- files governance query 参数失效或 back/forward 行为错误
- memory `section / recallFilter` 无法刷新恢复
- pending governance deep link 无法落到正确 section/filter

### 3. 批量治理工作流回退

- files selection mode 无法稳定进入/退出
- memory batch action bar 丢失、错位或动作范围错误
- 普通态 toolbar 与 selection toolbar 再次叠加

### 4. 交互稳定性恶化

- explorer 被 editor 覆盖后仍可点击、滚动或抢焦点
- back / open / edit / convert 产生明显闪烁、错位或状态残留
- 新增了手动导航劫持或新的双向状态同步补丁

### 5. 视觉层级失控

- 页面重新长回大面积同层级按钮矩阵
- 宽屏下治理页再次失去 `max-width`
- header/sidebar/body 又开始重复表达同一语义

---

## 十七、文件级改造建议

### 1. `src/features/ResourceSpaces/SpaceMemoryPage.tsx`

必须处理：

- 增加内容宽度约束
- 重组顶部 overview
- 删除重复 recall 区块
- 提炼统一 selection action bar

### 2. `src/features/ContentManager/components/Explorer/Header/index.tsx`

必须处理：

- 去掉与 sidebar 重复的空间身份
- 压缩右侧工具集
- 明确 normal mode 与 selection mode 的差异

### 3. `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx`

必须处理：

- 降低 chip 侵略性
- 收敛 active filters 的展现
- 清理 query param 逻辑中的补丁式重复

### 4. `src/features/ResourceSpaces/MemorySidebarPortal.tsx`

必须处理：

- 去掉重复 Home
- 回归声明式路由
- 让标题与 body 的角色分工更明确

### 5. `src/features/ContentManager/index.tsx`

必须处理：

- 审视 overlay 方案
- 若保留 overlay，至少对底层 Explorer 做隔离

### 6. `src/features/ResourceSharing/ResourceShareModal.tsx`

必须处理：

- 分层 internal access 与 public link
- 减少首屏需要阅读的选项量

---

## 十八、验收标准

### 视觉与结构

- 关键治理页都有明确 `max-width`
- 页面不再出现大面积同层级按钮矩阵
- 状态与动作在视觉上能一眼区分

### 交互与行为

- 同一语义不再在 sidebar/header/body 三处重复
- sidebar 导航逻辑统一
- 文件编辑切换不再显得像“叠着一层临时页”

### 移动端

- 顶区不再同时承担过多职责
- workspace 切换、治理提醒、筛选切换分层明确

### 代码质量

- 不新增新的手动导航劫持
- 不再扩大 overlay / local state / query param 的重复控制面
- 删除已确认的补丁式重复逻辑
- 不破坏现有 URL-first deep link 能力

---

## 十九、风险与依赖

### 风险 1：边改边继续加功能

如果在重构期间继续往这些页面塞新入口，结构会再次失控。

**要求**：

- 重构阶段冻结 enterprise UI 新增入口

### 风险 2：只改样式，不改信息架构

如果只调 padding、圆角、颜色，这次重构不会成功。

**要求**：

- 必须先处理信息层级和行为重叠

### 风险 3：为了保状态继续保留 overlay

这会让表面变好看，但底层问题不消失。

**要求**：

- 至少收掉底层 scene 干扰

### 风险 4：误伤现有正确能力

如果执行时把“减少重复”误解成“删除已有入口”，会直接造成能力回退。

**要求**：

- 所有入口收敛都必须对照“不回退能力清单”

---

## 二十、推荐执行顺序

建议严格按以下顺序推进：

1. `MemorySidebarPortal`
2. `content/_layout/Header`
3. `Explorer/Header`
4. `CategoryMenu`
5. `SpaceMemoryPage`
6. `FileDetail`
7. `ResourceShareModal`
8. `ContentManager`
9. `ResourceMobileHeader`

这个顺序的原因很简单：

- 先把重复语义砍掉
- 再重做治理壳层
- 最后处理底层稳定性

---

## 二十一、最终判断

这次重构不应该被理解成“页面美化”，而应该被理解成：

> **把 enterprise 相关主链，从功能拼接态，升级成可长期扩展的工作台形态。**

如果本方案按顺序执行完成，结果应当是：

- Space 更像 workspace
- Files 更像治理面
- Memory 更像 review workbench
- Share 更像企业协作入口
- UI 不再给人“功能是对的，但页面很乱、很宽、很不高级”的感觉
