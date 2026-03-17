# Memory、Notebook、Topic 实现差距审计：App vs Web

本文档审计记忆（Memory）、笔记本（Notebook）、话题（Topic）在移动端 App 与 Web 端之间的实现差距与差异。

**审计范围**：
- **App**：`apps/mobile`（React Native）
- **Web**：`src/routes/(main)` + `src/routes/(mobile)`（桌面与移动端 SPA）

---

## 一、概念与定位

| 功能 | 定义 | 数据范围 |
|------|------|----------|
| **Memory** | 用户记忆：从对话中提取的身份、偏好、上下文等，供 Agent 检索使用 | 用户级（跨会话） |
| **Notebook** | 话题级文档：笔记、报告、文章，与当前 Topic 关联 | Topic 级 |
| **Topic** | 对话分支：同一会话下的不同话题/子对话 | Session 级 |

---

## 二、Memory（记忆）

### 2.1 功能对比

| 能力 | Web | Mobile App |
|------|-----|-------------|
| 独立入口 | ✅ `/memory` | ✅ ProfileScreen → Memory |
| 主 Tab（Home / Persona） | ✅ Persona + Role 标签云 | ✅ memoryHome |
| Identity 列表 | ✅ `/memory/identities` | ✅ identity tab |
| Context 列表 | ✅ `/memory/contexts` | ✅ context tab |
| Activity 列表 | ✅ `/memory/activities` | ✅ activity tab |
| Experience 列表 | ✅ `/memory/experiences` | ✅ experience tab |
| Preference 列表 | ✅ `/memory/preferences` | ✅ preference tab |
| 记忆详情 | ✅ 右侧详情面板 | ✅ MemoryDetailScreen |
| 搜索 | ✅ 各层支持 | ✅ 各层支持 |
| 创建 Identity | ✅ | ✅ |
| 删除/编辑 | ✅ | ✅ |
| 从对话提取记忆 | ✅ requestMemoryFromChatTopic | ✅ requestMemoryFromChatTopic |
| 提取进度 | ✅ 进度展示 | ✅ 进度展示 |
| 会话内开关 | ✅ MemoryToolSheet / 开关 | ✅ MemoryToolSheet（群组禁用） |
| 会话内 effort 调节 | ✅ low/medium/high | ✅ low/medium/high |
| 设置页 Memory 配置 | ✅ enabled + effort | **❌ 无** |
| 时间线/网格视图 | ✅ TimelineView、GridView | **❌ 仅列表** |
| 来源链接 (SourceLink) | ✅ | **❌ 无** |
| 标签 (HashTags) | ✅ | **❌ 无** |
| 分类标签 (CateTag) | ✅ | **❌ 无** |

### 2.2 差距小结

- **共享**：五层结构、CRUD、提取、会话内开关与 effort 一致。
- **差异**：Web 有设置页 Memory 全局配置、时间线/网格视图、详情侧边栏（SourceLink、HashTags、CateTag 等）；Mobile 无设置页 Memory 配置、无时间线/网格、详情为独立全屏。

---

## 三、Notebook（笔记本）

### 3.1 功能对比

| 能力 | Web | Mobile App |
|------|-----|-------------|
| 入口 | ✅ 对话 Header NotebookButton | **❌ 仅 ProfileScreen** |
| 与当前 Topic 关联 | ✅ 自动绑定 activeTopicId | ✅ 可传 sessionId + topicId |
| 独立/个人笔记 | ✅ 无 topic 时显示空 | ✅ 有（standalone 模式，Personal Notes topic） |
| 文档列表 | ✅ Portal Notebook Body | ✅ NotebookScreen |
| 新建文档 | ✅ | ✅ |
| 编辑文档 | ✅ Portal Document | ✅ DocEditor 内嵌 |
| 删除文档 | ✅ | ✅ |
| 文档类型 | ✅ article, markdown, note, report 等 | ✅ 支持 |
| Markdown 预览 | ✅ | ✅ |
| 从对话内打开 | ✅ 一键切换 Portal | **❌ 无** |
| 文档详情 Portal | ✅ Document | 全屏编辑 |

### 3.2 差距小结

- **共享**：API、文档 CRUD、Markdown 编辑与预览一致。
- **差异**：Web 在对话 Header 有 NotebookButton，可一键打开当前 Topic 的 Notebook；Mobile 无对话内入口，只能从 Profile 进入，且默认用 standalone 个人笔记 topic，无法在对话中直接打开当前 Topic 的 Notebook。

---

## 四、Topic（话题）

### 4.1 功能对比

| 能力 | Web | Mobile App |
|------|-----|-------------|
| 展示位置 | ✅ 侧边栏 Topic 手风琴 | ✅ TopicListScreen（全屏） |
| 对话内入口 | ✅ 侧边栏常驻 | ✅ Header 图标 → TopicList |
| 话题列表 | ✅ TopicListContent | ✅ TopicListScreen |
| 话题搜索 | ✅ TopicSearchBar | ✅ 本地过滤 |
| 全局搜索 | ✅ topic.searchTopics | ✅ topicApi.search |
| 创建话题 | ✅ | ✅ |
| 切换话题 | ✅ | ✅ |
| 删除话题 | ✅ | ✅ |
| 重命名话题 | ✅ | ✅ |
| 收藏话题 | ✅ | ✅ |
| 时间线模式 | ✅ ByTimeMode | **❌ 无** |
| 扁平模式 | ✅ FlatMode | **❌ 无** |
| 搜索结果模式 | ✅ SearchResult | **❌ 无** |
| 线程/分支 | ✅ Thread 列表、分支 | **❌ 无** |
| AllTopicsDrawer | ✅ 群组 | **❌ 无** |
| 话题标题自动生成 | ✅ | ✅ |
| 工作目录 (WorkingDirectory) | ✅ Desktop 可选 | **❌ 无** |
| 群组 Topic | ✅ 支持 | ✅ 支持 |

### 4.2 Topic 标题自动生成实现说明

- **Web**：`conversationLifecycle.ts` 中 `summaryTopicTitle`，流式生成并实时更新。
- **Mobile**：`chat.ts` 中 `triggerTopicTitleGeneration(sessionId, topicId)`，调用 `topic.generateTopicTitle` 后端接口，成功后 `fetchTopics` 刷新。
- **触发时机**：单 Agent 在 streaming 完成、assistant 消息持久化后触发；群组在 `execGroupAgent` 完成、assistant 消息 settle 后触发（此前群组路径缺失，已补全）。

### 4.3 差距小结

- **共享**：CRUD、切换、收藏、标题生成、群组支持一致。
- **差异**：Web 有侧边栏、时间线/扁平/搜索三种模式、Thread 分支、AllTopicsDrawer、WorkingDirectory；Mobile 为全屏列表、仅本地过滤、无 Thread、无 WorkingDirectory。

---

## 五、三者关系

```
Session (会话)
  └── Topic (话题) ← 一个 Topic 下有多条消息
        └── Notebook (笔记本) ← 文档关联到 Topic
        └── Messages (消息)

User (用户)
  └── Memory (记忆) ← 跨会话、跨 Topic
```

- **Memory**：用户级，与 Agent 对话时注入。
- **Notebook**：Topic 级，依赖当前 Topic。
- **Topic**：Session 级，组织消息的会话分支。

---

## 六、建议优先级

| 优先级 | 能力 | 说明 |
|--------|------|------|
| P0 | 对话内 Notebook 入口 | 在 ChatDetailScreen 增加当前 Topic 的 Notebook 入口 |
| P1 | 设置页 Memory 配置 | 全局 enabled/effort 与 Web 对齐 |
| P1 | 话题时间线/扁平模式 | 视产品需求 |
| P2 | Memory 详情增强 | SourceLink、HashTags、CateTag 等 |
| P2 | 话题 Thread 分支 | 与群组审计中的 Thread 一致 |
| P3 | 话题 WorkingDirectory | Desktop 专属，Mobile 可不考虑 |

---

## 七、Page（页面）说明

**Page** 与 **Notebook** 不同：

- **Notebook**：话题级文档，与 Topic 绑定，Agent 可通过 lobe-notebook 工具读写。
- **Page**：独立页面/文档管理（`/page`、PageExplorer），用于富文本编辑与页面管理。

Mobile 当前**无** Page 功能；Web 有 `/page` 路由与 PageExplorer。本审计主要对比 Memory、Notebook、Topic。

---

## 八、相关文件索引

### Memory

- Web：`src/routes/(main)/memory/`、`src/routes/(main)/settings/features/componentMap.ts`（Memory）
- Mobile：`apps/mobile/src/screens/MemoryScreen.tsx`、`MemoryDetailScreen.tsx`、`MemoryToolSheet.tsx`
- API：`memoryApi`、`userMemory.*`、`userMemories.*`

### Notebook

- Web：`src/features/Portal/Notebook/`、`src/routes/(main)/agent/features/Conversation/Header/NotebookButton/`
- Mobile：`apps/mobile/src/screens/NotebookScreen.tsx`
- API：`notebookApi`、`notebook.*`

### Topic

- Web：`src/routes/(main)/agent/_layout/Sidebar/Topic/`、`src/routes/(main)/group/_layout/Sidebar/Topic/`
- Mobile：`apps/mobile/src/screens/TopicListScreen.tsx`、`apps/mobile/src/store/topic.ts`
- API：`topicApi`、`topic.*`
