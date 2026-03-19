# Mobile ChatListScreen 重构方案：助理 Tab + 可展开 Topic 列表

> 目标：将「会话 | 话题」双视图改为「助理」主视图，助理可展开显示附属 Topic 列表，与 Web 结构对齐。

---

## 一、Web vs App 现状对比

| 维度 | Web | App（当前） |
|------|-----|-------------|
| **主列表结构** | Agent → Topic 两级（侧栏 Agent 列表，点击进入后显示该 Agent 的 Topic 列表） | Session | Topic 双 Tab 切换 |
| **主列表展示** | Agent 列表（钉选、自定义分组、默认） | Session 列表（钉选、最近） |
| **Topic 展示** | 在 Agent 页面侧栏，按 Agent 归属展示 | 跨 Session 的「最近话题」扁平列表 |
| **层级关系** | Agent（Session）→ Topics（可展开/嵌套） | 会话 Tab 与话题 Tab 平级，无父子展开 |
| **语义** | 助理（Agent）= 会话容器 | 会话（Session）= 助理/群组 |
| **用户心智** | 「选助理 → 选对话」 | 「选会话 or 选最近话题」 |

---

## 二、Session 与 Topic 语义关系（对齐 topic-chat-conversation-semantic-audit）

| 术语 | 定义 | 数据对象 | 用户概念 |
|------|------|----------|----------|
| **Session（会话）** | 与 Agent/Group 的会话容器，可包含多个 Topic | `sessions` | **助理**（单 Agent 或群组） |
| **Topic（话题）** | 会话内一次对话线程，含消息序列 | `topics` | 对话 / 话题 |
| **Message（消息）** | 单条消息 | `messages` | - |

**关系**：`Session 1:N Topic`，一个 Session（助理）下有多个 Topic（对话）。

---

## 三、重构目标

1. **Tab 改名**：`会话` → `助理`
2. **主列表**：展示助理（Session）列表，与当前 Session 列表数据一致
3. **可展开**：助理行支持展开/收起，展开后显示该助理下的 Topic 列表
4. **移除话题 Tab**：不再保留独立的「话题」Tab，Topic 作为助理的附属列表展示
5. **语义统一**：UI 文案、i18n 与 Session/Topic 定义对齐

---

## 四、UI 结构设计

### 4.1 助理 Tab（主视图）

```
┌─────────────────────────────────────┐
│ [助理]  Tab（唯一主 Tab，可考虑保留「最近」快捷入口）│
├─────────────────────────────────────┤
│ [全部] [标签1] [标签2] ...           │  ← Tag 筛选（沿用）│
├─────────────────────────────────────┤
│ 📌 钉选                               │
│   ├ 助理 A  [▼]  ← 可展开            │
│   │   ├ 话题 1 · 2小时前             │
│   │   ├ 话题 2 · 昨天                 │
│   │   └ 话题 3 · 3天前                │
│   └ 助理 B  [▶]  ← 收起              │
├─────────────────────────────────────┤
│ 最近                                 │
│   ├ 助理 C  [▼]                      │
│   │   └ 话题 1 · 1小时前             │
│   └ 助理 D  [▶]                      │
└─────────────────────────────────────┘
```

### 4.2 交互

- **点击助理行**：进入 ChatDetail（该助理的最新/活跃 Topic，或新建 Topic）
- **点击展开图标**：展开/收起该助理的 Topic 列表
- **点击 Topic 行**：进入 ChatDetail(sessionId, topicId)
- **长按助理**：沿用现有操作（钉选、重命名、智能重命名、移动标签、删除）
- **长按 Topic**：可考虑后续支持（重命名、删除等）

### 4.3 「最近」能力保留

- 方案 A：在助理列表顶部增加「最近话题」折叠区块，展示跨 Session 的 recentTopics
- 方案 B：仅依赖助理展开后的 Topic 列表，不再单独展示「最近话题」
- **建议**：方案 A，保留「继续工作」心智，与当前话题视图能力对齐

---

## 五、实现要点

### 5.1 数据流

- `sessions`：沿用 `useSessionStore`，无需改动
- `topicsBySession`：沿用 `useTopicStore`，按 sessionId 拉取
- `recentTopics`：沿用 `topicApi.recentTopics()`，用于「最近话题」区块

### 5.2 新增状态

- `expandedSessionIds: Set<string>`：记录哪些助理已展开
- 展开时按需调用 `fetchTopics(sessionId)`，复用 `useTopicStore`

### 5.3 组件拆分建议

| 组件 | 职责 |
|------|------|
| `AssistantListSection` | 助理列表区块（钉选 / 最近） |
| `AssistantRow` | 单行助理，支持展开/收起 |
| `TopicSubList` | 展开后的 Topic 子列表 |
| `RecentTopicsBlock` | 可选的「最近话题」区块 |

### 5.4 i18n 变更

| 旧 Key | 新 Key / 新文案 |
|--------|-----------------|
| `chatListViewSession` | `chatListViewAssistant` → 助理 |
| `chatListViewTopic` | 移除或改为「最近」入口 |
| `chatListTopicRecent` | 保留，用于「最近话题」区块标题 |

---

## 六、与 Web 对齐检查清单

- [ ] 主列表以「助理」为主实体（= Session）
- [ ] 助理可展开显示其 Topic 列表
- [ ] 点击助理进入对话（等同于 Web 点击 Agent 进入）
- [ ] 点击 Topic 进入对应对话
- [ ] 删除/重命名等操作语义明确（会话 vs 话题）
- [ ] 文案与 topic-chat-conversation-semantic-audit 一致

---

## 七、相关文件

- `apps/mobile/src/screens/ChatListScreen.tsx` — 主重构目标
- `apps/mobile/src/store/session.ts` — Session 数据
- `apps/mobile/src/store/topic.ts` — Topic 数据，`fetchTopics`、`topicsBySession`
- `apps/mobile/src/lib/i18n.ts` — 文案
- `docs/development/topic-chat-conversation-semantic-audit.zh-CN.md` — 语义基线
