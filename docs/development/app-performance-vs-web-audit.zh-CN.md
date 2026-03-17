# App 性能审计：相对 Web 端的架构设计缺陷与修复

本文档全面审计 App 相对 Web 端性能较差的原因，聚焦由**架构设计缺陷**导致的问题及已实施的修复。

**审计范围**：

- **Web**：SWR 数据拉取、Service + Store 架构、`data-fetching` skill
- **App**：`apps/mobile/src/store/session.ts`、`chat.ts`、`topic.ts`，以及各 Screen 的 `useEffect` / `useFocusEffect` 调用

---

## 一、Web 端数据拉取架构

### 1.1 SWR 特性

Web 使用 SWR 做数据拉取，具备：

| 特性            | 说明                                           |
| --------------- | ---------------------------------------------- |
| 请求去重        | `dedupingInterval` 内相同 key 的请求合并为一次 |
| 缓存            | 先展示缓存，后台 revalidate                    |
| focus/reconnect | 窗口聚焦或网络恢复时重新校验                   |
| 避免重复请求    | 并发调用同一 key 时只发一次请求                |

### 1.2 架构分层

- **Service 层**：封装 API 调用
- **Store SWR hooks**：`useSWR(key, fetcher)` 或等价模式
- **禁止**：在 `useEffect` 中直接 fetch（见 `data-fetching` skill）

---

## 二、App 端原有问题

### 2.1 无请求去重

`fetchSessions` 被多处调用且无并发控制：

| 调用方                                                           | 触发时机                                                       |
| ---------------------------------------------------------------- | -------------------------------------------------------------- |
| ChatListScreen                                                   | `useEffect` + `useFocusEffect`                                 |
| ChatDetailScreen                                                 | `useFocusEffect`、`useEffect`（session 缺失时）、AppState 监听 |
| StoreScreen                                                      | `useFocusEffect`                                               |
| AgentListScreen                                                  | `useEffect`                                                    |
| App.tsx                                                          | `syncMobileBootstrapState`                                     |
| createSession / removeSession / renameSession / updateSessionTag | mutation 后                                                    |

多个组件同时 focus 或快速切换时，会产生多次并发请求。

### 2.2 无 in-flight 检查

- `session.ts` 的 `fetchSessions` 没有 in-flight 检查
- `chat.ts` 的 `fetchMessages` 按 `sessionId + topicId` 无去重
- `topic.ts` 的 `fetchTopics` 按 `sessionId` 无去重

### 2.3 无 stale-while-revalidate

Web 可先展示缓存再后台刷新；App 每次都要等请求完成才能渲染。

---

## 三、已实施修复

### 3.1 session.ts：fetchSessions 去重

- 使用模块级变量 `fetchSessionsInFlight` 跟踪进行中的 Promise
- 若已有 in-flight 请求，直接 `await` 该 Promise 并返回，不发起新请求
- `reset()` 时清空 `fetchSessionsInFlight`

### 3.2 chat.ts：fetchMessages 去重

- 使用 `Map<string, Promise<void>>` 按 `sessionId:topicId` 去重
- 相同 key 的并发调用复用同一 Promise
- `reset()` 时 `fetchMessagesInFlight.clear()`

### 3.3 topic.ts：fetchTopics 去重

- 使用 `Map<string, Promise<void>>` 按 `sessionId` 去重
- 相同 session 的并发调用复用同一 Promise

---

## 四、后续可选优化

| 优化项                | 说明                                                         |
| --------------------- | ------------------------------------------------------------ |
| 短时 TTL              | 为 sessions 增加 1–2 秒 TTL，避免 focus burst 时频繁重复拉取 |
| SWR 或 TanStack Query | 引入 React Query / SWR 以统一缓存与 revalidate 策略          |
| StoreScreen effect 链 | 已通过拆分 effect 避免循环依赖，保持现状即可                 |

---

## 五、相关文件

- `apps/mobile/src/store/session.ts`：`fetchSessions` 实现
- `apps/mobile/src/store/chat.ts`：`fetchMessages` 实现
- `apps/mobile/src/store/topic.ts`：`fetchTopics` 实现
- `src/libs/swr/index.ts`：Web 的 SWR 配置
- `.cursor/skills/data-fetching/SKILL.md`：数据拉取架构说明
