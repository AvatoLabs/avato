# App 相对 Web 端 Bug 全面审计

本文档整合各专项审计，汇总 App 相对 Web 的已知 bug 与差距，并标注修复状态。

**审计范围**：`apps/mobile` 相对 Web（`src/`、`packages/`）的功能、同步、解析、设置等差异。

**相关专项审计**：

- [chat-sync-app-web-audit.zh-CN.md](./chat-sync-app-web-audit.zh-CN.md) — 会话 / 消息 / 话题同步
- [group-chat-app-web-gap-audit.zh-CN.md](./group-chat-app-web-gap-audit.zh-CN.md) — 群聊功能差距
- [skill-mcp-category-app-web-audit.zh-CN.md](./skill-mcp-category-app-web-audit.zh-CN.md) — Store 分类
- [default-model-app-web-audit.zh-CN.md](./default-model-app-web-audit.zh-CN.md) — 默认模型解析

---

## 一、Bug 与差距总览

### 1.1 已修复 ✅

| 项目                        | 说明                                                                 | 修复位置                        |
| --------------------------- | -------------------------------------------------------------------- | ------------------------------- |
| ChatDetailScreen focus 刷新 | 切回时刷新 messages/topics                                           | useFocusEffect                  |
| Session 列表刷新范围        | ChatListScreen、ChatDetailScreen、StoreScreen focus 时 fetchSessions | 各 Screen                       |
| 网络重连刷新                | NetInfo 监听调用 syncMobileBootstrapState                            | App.tsx                         |
| 群聊 createMessage 参数     | groupId + sessionId:null 正确传参                                    | chat.ts、api.ts、后端           |
| Skill/MCP 分类              | 固定兜底、builtin 归一化、fetchCategories 先设 fallback              | storeCategories.ts、StoreScreen |
| Store Explore 分类          | 切换 MCP/Skill 时立即显示 fallback，不出现空分类                     | StoreScreen fetchCategories     |
| 助手管理入口                | Me 中增加「助手」入口，AgentListScreen 列表                          | ProfileScreen、AgentListScreen  |

### 1.2 待修复（Bug）

| 项目                    | 影响                                           | 优先级 | 状态      |
| ----------------------- | ---------------------------------------------- | ------ | --------- |
| **默认模型解析**        | 缺少 server default、DEFAULT_AGENT_CONFIG 兜底 | P0     | ✅ 已修复 |
| **User default 有效性** | 用户默认模型被禁用时未回退                     | P1     | ✅ 已修复 |
| **Provider 解析**       | 用户只设 model 未设 provider 时可能解析失败    | P1     | ✅ 已修复 |

### 1.3 待评估（非紧急）

| 项目               | 说明                                                                    |
| ------------------ | ----------------------------------------------------------------------- |
| 消息结构 parse ()  | App 未使用 conversation-flow parse，MessageGroup / 压缩组展示可能不完整 |
| 群聊 Thread        | 无 Thread 相关 UI                                                       |
| WebSocket/SSE 推送 | 长期方案，实现跨端近实时同步                                            |

### 1.4 功能差距（非 Bug，按产品规划）

| 类别     | 缺失能力                                               | 参考                         |
| -------- | ------------------------------------------------------ | ---------------------------- |
| 群聊     | Profile 页、成员管理、@ 提及、DM、Thread、创建时选成员 | group-chat-app-web-gap-audit |
| 群聊设置 | 主持人、allowDM、revealDM、Opening 等                  | 同上                         |

---

## 二、默认模型解析（P0 待修复）

### 2.1 当前问题

- App 未获取 server default（`config.getDefaultAgentConfig` / `getGlobalConfig.serverConfig.defaultAgent`）
- App 未使用 `DEFAULT_AGENT_CONFIG` 作为兜底
- 用户无设置时直接走 runtime fallback，与 Web 行为不一致

### 2.2 修复方案

1. 在 `configApi` 中增加 `getDefaultAgentConfig` 或从 `getGlobalConfig` 取 `serverConfig.defaultAgent`
2. 在 model store /chat 中合并：`DEFAULT_AGENT_CONFIG` → serverDefault → userDefault → runtime
3. 对 user default 做有效性校验（model 在 enabled 列表中）
4. 有 model 无 provider 时用 `resolveProviderByModel` 或 DEFAULT_PROVIDER

### 2.3 相关文件

- `apps/mobile/src/store/model.ts`
- `apps/mobile/src/store/chat.ts`
- `apps/mobile/src/screens/ModelPickerScreen.tsx`
- `apps/mobile/src/lib/api.ts`（configApi）
- `packages/const`（DEFAULT_AGENT_CONFIG、DEFAULT_MODEL、DEFAULT_PROVIDER）

---

## 三、修复状态汇总

| 类别        | 已修复 | 待修复 | 待评估 |
| ----------- | ------ | ------ | ------ |
| 同步 / 刷新 | 5      | 0      | 1      |
| 群聊        | 1      | 0      | 多     |
| Store       | 2      | 0      | 0      |
| 默认模型    | 3      | 0      | 0      |
| 入口 / UX   | 1      | 0      | 0      |

---

## 四、建议修复顺序

1. **P0**：默认模型解析（server default + DEFAULT_AGENT_CONFIG + 有效性校验）
2. **P1**：Provider 解析完善
3. **P2**：消息结构 parse 评估与实现
4. **P3**：群聊功能按产品优先级逐步补齐
