# Session / Topic / Chat 语义审计（现状版）

> 审计日期：2026-03-18\
> 范围：移动端术语语义、UI 呈现层级、重命名对象边界、默认标题判定

**相关文档**：

- [chatlist-smart-rename-audit.zh-CN.md](./chatlist-smart-rename-audit.zh-CN.md)
- [settings-semantic-audit.zh-CN.md](./settings-semantic-audit.zh-CN.md)
- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md)

---

## 一、语义基线（统一定义）

| 术语                 | 正确定义                                    | 数据对象                  |
| -------------------- | ------------------------------------------- | ------------------------- |
| Session（会话）      | 与 Agent/Group 的会话容器，可包含多个 Topic | `sessions`                |
| Topic（话题 / 对话） | 会话内一次对话线程                          | `topics`                  |
| Message（消息）      | 具体消息项                                  | `messages`                |
| Chat（聊天）         | 产品功能名（入口 / 频道）                   | UI 名称，不是精确数据对象 |

---

## 二、当前 App 现状（已落地）

### 2.1 ChatList 已从 “单一会话列表” 升级为双视图

1. 顶部存在 `会话 | 话题` 视图切换。
2. 话题视图展示跨 Session 的 `recentTopics`，并以「最近」徽标强化心智。
3. 会话视图每行支持 “最近话题标题 + 时间” 弱预览（降低 “看不到对话历史” 的落差）。

### 2.2 重命名对象已拆分

1. **Session 级**：`ChatListScreen.handleSmartRename -> session.generateSessionTitle`。
2. **Topic 级**：`TopicListScreen` 与 `ChatDetailScreen` 均可触发 `topic.generateTopicTitle`。

这让 “改会话名” 和 “改单次对话名” 在操作入口上已经分层。

### 2.3 搜索语义已明显改善

1. 搜索文案已改为 “搜索会话与消息”。
2. 搜索结果支持 `session/topic/message` 匹配类型标识。

---

## 三、仍存在的语义边界问题

### 3.1 默认标题判定仍有交叉

- `isDefaultTopicTitle` 仍会接受 `t.chatListNewConversation`。
- Session 与 Topic 默认标题集合仍有重叠（包含 legacy 值是兼容需要，但会增加判定复杂度）。

### 3.2 服务端与 App 的默认 Session 标题集合未完全一致

- App 侧包含 `New Session/新会话`。
- 服务端 `session.ts` 默认集合不完全一致。

影响：某些标题在一端被视为默认、另一端被视为自定义，可能导致重命名行为不一致。

### 3.3 内部命名仍有历史痕迹

如 `conversationExpanded` 等内部变量仍保留旧语义词。对用户不可见，但会增加后续维护理解成本。

---

## 四、与 Web 的关系（当前可接受状态）

| 维度             | Web                 | App                               | 结论                   |
| ---------------- | ------------------- | --------------------------------- | ---------------------- |
| 主列表结构       | Agent -> Topic 两级 | Session/Topic 双视图              | 可接受的移动端适配差异 |
| 智能重命名主入口 | Topic 级            | Session 级（并补充 Topic 级入口） | 语义已可解释           |
| 最近对话能力     | Home / 侧栏可见     | ChatList 话题视图可见             | 能力已补齐             |

---

## 五、建议（只保留仍必要的项）

### P0

1. 统一 Session 默认标题集合（App 与服务端一致）。
2. 为 Topic/Session 默认标题判定增加单测，覆盖三语与 legacy 值。

### P1

1. 将内部 `conversation*` 变量逐步重命名为 `session*` 或 `topic*`。
2. 在重命名失败提示中增加对象语义（“会话标题生成失败”/“话题标题生成失败”）。

### P2

1. 继续精炼 i18n 文案，减少 Chat/Conversation 在非功能名场景中的泛化使用。

---

## 六、PR 语义守则

1. 面向容器层数据对象时，必须使用 Session。
2. 面向单次对话线程时，使用 Topic 或 “对话”。
3. `Chat` 仅用于页面 / 功能名，不替代 Session/Topic 语义。
4. 涉及删除类文案必须明确影响范围（仅话题 or 会话及其话题）。

---

## 七、关键代码锚点

- `apps/mobile/src/screens/ChatListScreen.tsx`（双视图、最近话题、Session 智能重命名）
- `apps/mobile/src/screens/TopicListScreen.tsx`（Topic 智能重命名）
- `apps/mobile/src/screens/ChatDetailScreen.tsx`（Topic 智能重命名入口）
- `apps/mobile/src/store/chat.ts`（`DEFAULT_TOPIC_TITLES`、`DEFAULT_SESSION_TITLES`、判定逻辑）
- `apps/mobile/src/lib/i18n.ts`（三语 key 语义）
- `src/server/routers/lambda/session.ts`（服务端 Session 标题默认判定）

---

## 八、结论

该语义专项已从 “概念不清” 进入 “边界收敛” 阶段：\
核心产品层语义（会话 vs 话题）已在 UI 和入口上落地，但默认标题判定与内部命名仍需一轮收敛，才能彻底消除跨端行为差异与维护歧义。
