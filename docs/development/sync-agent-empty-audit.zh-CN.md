# 同步、会话历史、助手与水印审计

## 1. 同步与会话历史（chats 被清空）

### 现状

- **会话列表来源**：`sessionApi.list()` → `session.getGroupedSessions`，按用户 ID 查询，无助手配置依赖
- **清空触发点**：`clearTransientAppState()` 会重置 chat、session、user store
  - 登出：`LoginScreen`、`ProfileScreen`
  - 登录：`LoginScreen`（登录前清空）
  - 数据管理：`DataManagementScreen` 清除数据
  - 切换服务器：`ServerConfigScreen`

### 可能原因

1. **无助手时创建会话**：`sessionApi.create` 使用 `sessionOnly: true`，不依赖 Agent 实体；model/provider 有 `DEFAULT_AGENT_CONFIG` 兜底
2. **鉴权失败**：`getGroupedSessions` 为 `publicProcedure`，若 `ctx.userId` 为空则返回 `[]`（session.ts 第 168 行）
3. **网络 / 后端错误**：`fetchSessions` 失败时返回 `[]`，并展示 `sessionErrorMessage`
4. **登录时序**：`clearTransientAppState()` 会先清空 `sessions`，随后 `syncAfterMobileLogin()` 才执行 `fetchSessions`；若 token 未及时写入请求头，可能返回空

### 建议

- 排查 `ctx.userId` 为空场景（未登录、token 失效）
- 排查 `classifyError` 对 auth 的判定，确认 `navigateToLogin` 是否触发
- 增加会话列表加载失败时的重试与错误提示
- 在 `syncAfterMobileLogin` 中确保 token 已写入后再调用 `fetchSessions`

---

## 2. 默认助手预设与删除策略

### 现状

- **默认助手**：无单独「默认助手」概念
  - 会话级：`model/provider` 来自 `configApi.getDefaultAgentConfig()` + `userApi.getState().settings.defaultAgent` + `DEFAULT_AGENT_CONFIG`
  - 助手列表：`agentApi.queryAgents` 返回所有用户助手，无「默认」标记
- **删除**：后端有 `agent.removeAgent`，移动端 `agentApi` 未暴露 `removeAgent`

### 建议

1. **默认助手**：若需「默认助手」概念，需在服务端或前端定义（如 `isDefault`、或首个助手）
2. **不可删除**：若默认助手不可删，需在 UI 和 API 中判断并禁用删除
3. **其他助手可删**：在 `agentApi` 中增加 `removeAgent`，并在 `AgentListScreen` 提供删除入口

---

## 3. 助手设置入口（闪过的会话）

### 现状

- **AgentListScreen**：点击配置按钮时
  - 有会话：`navigation.navigate('AgentConfig', { sessionId })`
  - 无会话：`toast.show('info', t.meAgentConfigureFirst)`（「请先开始对话以配置此助手」）
- **ChatListScreen**：创建会话后 `navigation.navigate('AgentConfig', { sessionId })`
- **ChatSettingsScreen**：`navigation.navigate('AgentConfig', { sessionId })`

### 问题

用户需先创建会话才能进入配置，导致「先创建会话再配置」的体验

### 建议

- 支持「无会话配置」：`AgentConfigScreen` 增加 `agentId` 模式，直接进入 `AgentConfig` 编辑指定助手
- 或：`agentApi.create` 返回 `sessionId` 后，直接进入 `AgentConfig` 而非 `ChatDetail`，避免「先闪会话再配置」

---

## 4. 水印风格统一

### 已统一（EmptyState + iconVariant）

- ChatListScreen、ResourceScreen、StoreScreen、TopicListScreen、AgentListScreen、MemoryScreen、DiscoverScreen、AIProvidersScreen、ProviderListScreen、ModelListScreen、ModelPickerScreen、AppLogsScreen、ArtworkScreen（`iconVariant="artwork"`）

### 待统一

- **ChatDetailScreen**：已有主题色 MessageCircle，为自定义实现；可改为 EmptyState iconVariant="chat" + action（建议 chips）

---

## 5. 水印居中

### 现状

- **EmptyState**：`items-center justify-center`，`minHeight: 160`
- **FlatList ListEmptyComponent**：列表为空时，空态高度由内容决定，可能不占满屏幕

### 已居中

- ResourceScreen、TopicListScreen、AIProvidersScreen、ModelListScreen、AgentListScreen、MemoryScreen、ProviderListScreen、AppLogsScreen：`contentContainerStyle` 在空时含 `flexGrow: 1`、`justifyContent: 'center'`
- ArtworkScreen：ScrollView 空时 `flexGrow: 1`、`justifyContent: 'center'`、`alignItems: 'center'`

### 待居中

- StoreScreen（Explore / Installed 空态）、DiscoverScreen、ModelPickerScreen、ChatListScreen、ChatDetailScreen
