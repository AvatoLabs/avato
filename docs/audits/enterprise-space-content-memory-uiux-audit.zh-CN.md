# 企业级 Space / Content / Memory UI/UX 全量审计

> 审计日期：2026-04-06
> 审计方式：代码审计 + 交互结构审计 + Web Interface Guidelines 对照
> 审计范围：`team space`、`files/governance`、`space memory`、`resource share`、`sidebar/nav panel`、移动端对应入口
> 说明：本次结论基于代码实态，不包含浏览器录屏和像素级视觉走查，因此对“动画抖动 / 滚动卡顿 / 视觉细节偏差”的判断以结构风险为主

---

## 一、结论摘要

当前这套“企业级功能 UI”已经具备功能闭环，但 UI/UX 完成度明显没有达到可交付的企业产品水位。

问题不是单个页面丑，而是三类结构性问题同时存在：

1. **信息架构没有收束**
   - 导航、状态、筛选、操作在多个页面里被混成同一层级。
   - 同一语义在 sidebar、header、正文区重复出现。

2. **页面布局缺乏阅读宽度与视觉层级**
   - 关键治理页面仍以“全宽平铺 + 按钮矩阵”为主。
   - 缺少主列 / 次列、摘要 / 操作、状态 / 动作之间的视觉分工。

3. **交互实现有“能跑但不稳”的痕迹**
   - 多处依赖 overlay、portal、URL/store 双向同步、手动导航劫持。
   - 这会直接转化成你感知里的 `buggy`、不够 refined、行为重叠。

如果只给一句总体判断：

> 这套 UI 目前更像“功能成功拼接后的内部工具”，还不是“经过设计收束的企业级工作台”。

---

## 二、评分卡

| 维度 | 评分 | 结论 |
| --- | --- | --- |
| 视觉层级 | 4/10 | 过多同层级按钮、卡片和 outlined block，主次不清 |
| 元素统一性 | 5/10 | 组件本身来自同一设计系统，但用法不统一，语义漂移严重 |
| 页面精致度 | 4/10 | 缺少宽度控制、留白节奏、摘要区与工作区分层 |
| 交互一致性 | 5/10 | sidebar/header/body 对同一状态提供重复入口 |
| 稳定性感知 | 4/10 | overlay + 双向同步 + 手动 navigate 让 UI 容易显得不稳 |
| 移动端适配 | 5/10 | 功能可用，但 header 和 workspace 入口过于拥挤 |
| 企业治理表达 | 5/10 | 能做治理，但不像“治理工作台”，更像“筛选器 + 表单集合” |

**综合评分：4.6 / 10**

---

## 三、审计范围

本次重点审计了以下文件和交互面：

- `src/features/ResourceSpaces/SpaceHomePage.tsx`
- `src/features/ResourceSpaces/SpaceMemoryPage.tsx`
- `src/features/ResourceSpaces/MemorySidebarPortal.tsx`
- `src/features/ResourceSpaces/QuickAccessSection.tsx`
- `src/features/ResourceSpaces/SpaceSection.tsx`
- `src/features/NavPanel/index.tsx`
- `src/features/NavPanel/SideBarLayout.tsx`
- `src/features/NavPanel/components/NavPanelDraggable.tsx`
- `src/routes/(main)/content/(home)/_layout/Sidebar.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/index.tsx`
- `src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx`
- `src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx`
- `src/features/ContentManager/index.tsx`
- `src/features/ContentManager/components/Explorer/Header/index.tsx`
- `src/routes/(main)/content/features/FileDetail.tsx`
- `src/features/ResourceSharing/ResourceShareModal.tsx`

---

## 四、最高优先级问题

### P1. Space Memory 页面结构过宽、过平、过重复

**证据**

- 页面容器只有 padding，没有任何阅读宽度上限：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:121`
- 页面正文整体是全宽 `Flexbox className={styles.page}`：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2138`
- 同一页连续出现 4 组近似控制：
  - workspace recall 概览按钮：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2201`
  - section segmented：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2225`
  - 按 section 的 recall summary 卡片矩阵：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2237`
  - 当前 section 的 recall filter + batch toolbar：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2385`、`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2425`

**为什么这是核心问题**

- 这不是简单“内容多”，而是**同一种治理信息被重复编码**。
- `Button` 同时承担：
  - section 导航
  - 状态统计
  - recall filter
  - 批量操作
- 结果就是页面看起来像“按钮墙”，而不是一个有秩序的治理工作台。

**用户体感**

- 过宽
- 不精致
- 读不出哪里是摘要、哪里是主要动作、哪里是背景信息
- 进入页面后认知负担过大

**建议**

- 收成两层结构：
  - 顶部：一个 compact overview strip
  - 主体：单一 section workspace
- 页面内容增加 `max-width`，建议主工作列控制在 `1120px ~ 1280px`
- 状态统计从 `Button` 改成 `metric chip / tag / inline stat`
- 只保留一处 recall filter 主入口，其他位置改成只读摘要

---

### P1. ContentManager 通过 overlay 叠文件编辑器，底层 Explorer 仍然常驻

**证据**

- `Explorer` 永久渲染：`src/features/ContentManager/index.tsx:206`
- `editor` 模式只是在上层加绝对定位 overlay：`src/features/ContentManager/index.tsx:210`
- `doc` 模式同样是 overlay：`src/features/ContentManager/index.tsx:217`

**为什么危险**

- 底层列表、header、搜索结果、chunk drawer 的状态都还活着。
- 这类实现非常容易导致：
  - 焦点错位
  - 键盘行为残留
  - 关闭编辑器后状态“瞬间跳回”
  - 用户主观感知为“页面在叠层，不够稳”

**用户体感**

- buggy
- 像 modal 化的临时方案，不像完整工作区切换

**建议**

- `Explorer / File Editor / Doc Editor` 改成真正的 route-level or mode-level scene switch
- 如果必须保留常驻 Explorer，也要给底层加明确的 `inert / aria-hidden / pointer-events` 隔离
- 不要继续让“保状态”成为 overlay 化的理由

---

## 五、高优先级问题

### P2. Memory sidebar 存在重复导航语义

**证据**

- 标题栏已指向 `/memory`：`src/features/ResourceSpaces/MemorySidebarPortal.tsx:129`
- 下面又放了一个 `home -> /memory`：`src/features/ResourceSpaces/MemorySidebarPortal.tsx:61`

**问题**

- 同一语义给了两套入口，但没有新增价值。
- 这会让 sidebar 像“同一层信息重复出现”，不是精炼的信息架构。

**建议**

- 标题栏和 Home 二选一
- 更合理的做法是：
  - 标题栏负责回到 memory root
  - body 只保留 scope / space list，不再单独再放一个 Home item

---

### P2. Memory sidebar 还在手动劫持 Link 行为

**证据**

- `Link` 内部 `preventDefault + navigate()`：`src/features/ResourceSpaces/MemorySidebarPortal.tsx:82`
- 第二处相同逻辑：`src/features/ResourceSpaces/MemorySidebarPortal.tsx:103`

**问题**

- 代码意图不够直接。
- 导航语义与项目其它 sidebar 不一致。
- 一旦 modifier click、history 行为、active 态计算有变化，这里比普通 `Link` 更脆弱。

**建议**

- 除非有非常明确的特殊需求，否则回到声明式导航
- 只在确实需要时处理 modifier-click 特殊逻辑，避免整个组件自己接管路由行为

---

### P2. Files surface 的空间身份被重复展示

**证据**

- 左侧 sidebar header 已经显示 `SpaceSurfaceTitle`：`src/routes/(main)/content/(home)/_layout/Header/index.tsx:17`
- 主内容 header 根态再次显示 `SpaceSurfaceTitle`：`src/features/ContentManager/components/Explorer/Header/index.tsx:144`

**问题**

- 这不是“强化定位”，而是信息重复。
- 视觉上会把页面头部变成两层标题系统：
  - sidebar 一层
  - content header 一层

**建议**

- sidebar 保留空间身份
- content header 只显示当前层级上下文：
  - folder breadcrumb
  - source set breadcrumb
  - selection state

---

### P2. Files governance header 横向铺得太满，像 filter 台而不是工作台

**证据**

- header 同时承载：
  - category segmented
  - governance opener
  - active filter chips
  - search
  - sort
  - batch actions
  - view switch
  - add button
  - 见 `src/features/ContentManager/components/Explorer/Header/index.tsx:157`
- `CategoryMenu` 又额外把 active governance filters 渲染成整排 chip：`src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx:940`

**问题**

- 横向带宽被控件吃满。
- 所有交互几乎都长得一样，导致“视觉噪声 > 信息密度”。
- 用户难以分辨：
  - 当前筛选状态
  - 当前上下文
  - 高优先级操作

**建议**

- 收敛成两层：
  - 第一层：上下文 + 搜索 + primary action
  - 第二层：筛选与视图设置
- active filter chip 只显示摘要，不要每个都像按钮一样抢注意力
- batch actions 进入 selection mode 后单独替换工具栏，而不是和常规工具栏共处

---

### P2. Space Memory 的批量工具条按 recall 状态复制了三套

**证据**

- inbox 选择操作条：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2447`
- stale 选择操作条：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2495`
- disabled/expired 选择操作条：`src/features/ResourceSpaces/SpaceMemoryPage.tsx:2558`

**问题**

- 同一模式下的选择态被拆成多段条件 UI。
- 这会让用户觉得规则很碎，也会让代码继续长出“这个 filter 一套按钮、那个 filter 一套按钮”的分支膨胀。

**建议**

- 抽成一个统一的 selection action bar
- 依据 `section + recallFilter + capability` 动态产出 action schema，而不是复制三套 block

---

### P2. ResourceShareModal 承载了过多职责，缺少 progressive disclosure

**证据**

- 顶层状态已经很重：`src/features/ResourceSharing/ResourceShareModal.tsx:72`
- 同一组件同时处理：
  - member permission grant：`src/features/ResourceSharing/ResourceShareModal.tsx:200`
  - share link create：`src/features/ResourceSharing/ResourceShareModal.tsx:234`
  - link 表单 + latest link 展示：`src/features/ResourceSharing/ResourceShareModal.tsx:640`

**问题**

- 权限管理、外链创建、成员搜索、访问解释全塞在一个 modal 中。
- 功能上是完整的，但 UI 上更像“管理后台表单集合”，不是一个高级的 sharing experience。

**建议**

- 分成两个层级：
  - `Internal Access`
  - `Public Share Link`
- 默认只露出最常用路径
- 高级项如 `password / canReshare / inheritsToChildren / expiry` 放进次级配置区

---

### P2. Mobile header 把 workspace chooser、memory shortcut、category filter 叠在同一个顶区

**证据**

- 顶部左侧可点击区域同时承担 workspace chooser：`src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx:68`
- 同一区域还插入 memory pending/open 按钮：`src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx:80`
- header 下方又直接叠一层 `CategoryMenu`：`src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx:126`

**问题**

- 移动端顶部承担太多语义。
- 用户很容易把“切空间”“看待治理”“切 category”混在一起。

**建议**

- 顶栏只保留：
  - 当前空间
  - 一个次级入口按钮
- memory pending 作为独立 banner 或 compact pill，不要混入标题点击区
- category filter 改成 sheet 或 sticky secondary bar，但要和 workspace 入口分层

---

## 六、中优先级问题

### P3. 文件治理详情页仍然是“表单 + 操作按钮”思路，治理感弱

**证据**

- 保存、审批、归档按钮与“脏状态 tag”直接并排：`src/routes/(main)/content/features/FileDetail.tsx:715`

**问题**

- 功能完整，但不够像企业治理面板。
- 缺少：
  - current status summary
  - last reviewed / owner / policy snapshot
  - primary next action

**建议**

- 顶部增加 compact governance summary
- secondary metadata 与 destructive/approval actions 分区
- 不要让所有操作都挤在一排小按钮里

---

### P3. sidebar 拖拽容器对整棵树施加 `user-select: none`

**证据**

- `panel` 根节点 `user-select: none`：`src/features/NavPanel/components/NavPanelDraggable.tsx:106`
- 并对子元素 `*` 全量禁用选择：`src/features/NavPanel/components/NavPanelDraggable.tsx:116`

**问题**

- 这是典型“为了拖拽方便，扩大到整个容器”的做法。
- 结果会让 sidebar 的文本交互显得生硬，尤其是：
  - 长标题
  - 调试场景
  - 复制名称

**建议**

- 只在真正可拖拽的 handle 或拖拽进行时关闭文本选择
- 不要对整个 sidebar 内容树施加全局 `user-select: none`

---

### P3. 移动端 workspace opener 使用可点击 `Flexbox`，不是语义化按钮

**证据**

- `Flexbox` 直接绑定 `onClick`：`src/routes/(main)/content/(home)/_layout/ResourceMobileHeader.tsx:68`

**问题**

- 不利于可访问性和交互一致性。
- 也会让用户感知成“某个区域能点，但不像正规控件”。

**建议**

- 改成真正的 button-like trigger
- 让 title、chevron、pending 状态都落在一个明确的交互容器内

---

### P3. 文件编辑页右上角 info icon 缺失可读标签

**证据**

- info `ActionIcon` 没有 `title/aria-label`：`src/features/ContentManager/components/Editor/index.tsx:114`

**问题**

- 这是小问题，但会直接暴露 UI 做工不扎实。

**建议**

- 补 `title` 和 `aria-label`

---

### P3. ContentManager 的 URL/store 双向同步仍然偏脆弱

**证据**

- URL -> Store effect：`src/routes/(main)/content/features/hooks/useContentManagerUrlSync.ts:18`
- Store -> URL effect：`src/routes/(main)/content/features/hooks/useContentManagerUrlSync.ts:35`

**问题**

- 当前虽然能工作，但状态所有权不干净。
- 后续继续加 query param、selection state、governance state 时，容易再出现回退/replace/history 的边界问题。

**建议**

- 尽量明确谁是 source of truth
- 如果 URL 要深链化更多状态，应统一为 URL-first，而不是 effect 双向拉扯

---

### P3. CategoryMenu 有代码层面的重复迹象，反映交互结构已开始失控

**证据**

- `getCategoryUrl` 里同一 key 删除了两次：`src/routes/(main)/content/(home)/_layout/Header/CategoryMenu.tsx:264`

**说明**

- 这不是决定性的 bug。
- 但它很像一个信号：当前治理 header 的状态流和参数流已经过于复杂，开始出现重复与补丁式处理。

---

## 七、根因归纳

### 1. 先做功能闭环，后做信息架构收束

目前看得很明显，团队优先把：

- multi-space
- file governance
- share
- space memory

这些功能拼成了主链，但 UI 层没有经历一次统一重构，所以每个功能都带着自己的局部结构进入同一工作区。

### 2. 组件统一，但语义不统一

你们已经有统一组件库，但没有统一“什么时候该用什么组件表达什么语义”的规则。

典型例子：

- `Button` 被同时拿来表达状态、筛选、导航、批量动作
- `Tag`、`Segmented`、`Block` 没有形成稳定分工

### 3. 过度依赖 portal / overlay / state sync 兜底

这些技术本身没错，但现在它们承担了太多“把不同页面硬并到一个 workspace 里”的责任。

结果就是：

- 行为重叠
- 状态重复
- 容易显得不稳

---

## 八、重构优先级建议

### 第一阶段：先止血

目标：先把最影响体感的问题收掉。

1. 给 `SpaceMemoryPage` 增加内容宽度上限，砍掉重复 recall 控件
2. 合并 Space Memory 的三套 batch action bar
3. 删掉 memory sidebar 的重复 Home 入口
4. 删掉 files surface 的重复 `SpaceSurfaceTitle`
5. 给 `ContentManager` 编辑 overlay 增加明确隔离，避免底层 Explorer 干扰

### 第二阶段：重做治理语言

目标：让治理页面看起来像治理工作台，而不是筛选表单。

1. 重新定义治理页的三层结构：
   - summary
   - filter
   - worklist
2. 把状态统计从 `Button` 迁出
3. 统一 `Tag / metric chip / action button / segmented` 的职责
4. 重做 `FileDetail` 和 `ResourceShareModal` 的信息层级

### 第三阶段：收 sidebar 和 mobile

目标：把 workspace 交互统一成一套稳定语言。

1. 统一 sidebar header/body 的身份表达
2. 清理手动导航劫持
3. 简化 mobile header 顶区职责
4. 让 workspace switch、governance shortcut、content filter 不再同层竞争

---

## 九、建议的目标状态

如果要把这一套做成真正“企业级”的体验，目标应该是：

- **左侧只解决导航**
  - workspace / scope / quick access
- **页头只解决上下文**
  - 当前 section、breadcrumb、搜索、一个 primary action
- **治理区只解决状态与动作**
  - summary strip
  - filter rail
  - worklist
- **正文区只解决当前任务**
  - 不再让多个摘要卡片和工具条挤在同一个阅读面里

换句话说：

> 现在的 UI 更像“多个功能模块并列摆放”。
> 目标应该是“一个工作台里，不同层各司其职”。

---

## 十、最终判断

这套 enterprise 相关 UI 目前**可用，但不成熟**。

它已经具备：

- 功能闭环
- 数据闭环
- 治理闭环

但还不具备：

- 统一的企业工作台层级
- 稳定、低噪声的交互秩序
- 高级、克制、可信赖的界面气质

如果要回答“为什么你现在会非常不满意”，最准确的原因是：

> 你看到的不是单点 bug，而是整套 enterprise UI 还停留在“功能正确”，没有进入“交互收束和设计升维”的阶段。

