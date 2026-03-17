# 默认模型解析审计：App vs Web

本文档全面审计 App 与 Web 在默认模型（default model）解析优先级上的差距，以及相应前端设置与用户体验的处理建议。

**审计范围**：

- **Web**：`src/store/user`、`src/store/agent`、`src/server/services/agent`、`packages/const`
- **App**：`apps/mobile/src/store/model.ts`、`chat.ts`、`ModelPickerScreen`、`userApi`

---

## 一、Web 端默认模型解析优先级

### 1.1 服务端 merge（agent.getAgentConfig/getAgentConfigById）

后端返回 agent config 时，按以下顺序合并（后者覆盖前者）：

| 优先级 | 来源                       | 说明                                                                                 |
| ------ | -------------------------- | ------------------------------------------------------------------------------------ |
| 1      | `DEFAULT_AGENT_CONFIG`     | 硬编码默认（`packages/const`，model=claude-sonnet-4-5-20250929, provider=anthropic） |
| 2      | `serverDefaultAgentConfig` | 环境变量 `DEFAULT_AGENT_CONFIG` 解析结果                                             |
| 3      | `userDefaultAgentConfig`   | 用户设置 `user.settings.defaultAgent.config`                                         |
| 4      | `agent`                    | 数据库中的实际 agent 配置                                                            |

### 1.2 Web 前端 defaultAgentConfig

```ts
// src/store/user/slices/settings/selectors/settings.ts
defaultAgent = merge(DEFAULT_AGENT, currentSettings(s).defaultAgent);
defaultAgentConfig = merge(DEFAULT_AGENT_CONFIG, defaultAgent(s).config);
```

- `currentSettings` = merge(defaultSettings, settings)
- `defaultSettings` 在 `getUserState` onSuccess 时合并 `serverConfig.defaultAgent`（来自 `config.getGlobalConfig`）
- 即：DEFAULT_AGENT_CONFIG → server default → user default

### 1.3 Web 设置入口

- **DefaultAgentForm**：`src/routes/(main)/settings/agent/features/DefaultAgentForm.tsx`
- 路径：Settings → Agent → 默认模型
- 使用 `ModelSelect`，变更时调用 `updateDefaultAgent({ config: { model, provider } })`

---

## 二、App 端当前解析逻辑

### 2.1 model.ts loadSelection

| 优先级 | 来源                 | 说明                                                           |
| ------ | -------------------- | -------------------------------------------------------------- |
| 1      | Backend agent config | `agentApi.getConfigBySession`（单 agent 会话）                 |
| 2      | Group supervisor     | `agentGroupApi.getGroupDetail` 中 supervisor 的 model/provider |
| 3      | Session meta         | `session.model` / `session.provider`                           |
| 4      | User default         | `userApi.getState().settings.defaultAgent.config`              |
| 5      | Runtime fallback     | 第一个启用的 provider/model，或当前 selected 若仍有效          |

### 2.2 chat.ts getSessionChatOptions

| 优先级 | 来源                         |
| ------ | ---------------------------- |
| 1      | Backend agent config         |
| 2      | Session meta                 |
| 3      | User default agent           |
| 4      | Memory settings（仅 memory） |

### 2.3 ModelPickerScreen 初始选中

- 有 sessionId：agent config 或 group supervisor 或 session
- 无 sessionId（全局默认）：`userState.settings.defaultAgent.config.model` → `loadSelection` fallback

---

## 三、差距归纳

### 3.1 缺失层级（已修复 ✅）

| 层级                 | Web | App | 状态                                     |
| -------------------- | --- | --- | ---------------------------------------- |
| DEFAULT_AGENT_CONFIG | ✅  | ✅  | 已引入 `constants/defaultModel.ts`       |
| Server default       | ✅  | ✅  | 已调用 `configApi.getDefaultAgentConfig` |
| User default         | ✅  | ✅  | 一致                                     |
| Runtime fallback     | ✅  | ✅  | 一致，含有效性校验                       |

### 3.2 具体问题

1. **无 server default**：App 未调用 `config.getDefaultAgentConfig` 或 `config.getGlobalConfig`。部署方通过 `DEFAULT_AGENT_CONFIG` 配置的默认模型，在 App 端无效。
2. **无 DEFAULT_AGENT_CONFIG 兜底**：用户 `settings.defaultAgent` 为空时，App 直接取「第一个启用的模型」，Web 会先使用 const 默认。
3. **部分 model 缺失 provider**：用户只设置了 model 未设置 provider 时，App 可能无法正确解析 provider（需确认 resolveProviderByModel 是否覆盖）。
4. **模型有效性校验**：用户默认模型已被禁用时，应回退到有效模型。App 的 `selectedModelStillEnabled` 仅用于「当前 selected」，未对 user default 做有效性校验。

---

## 四、对齐方案

### 4.1 解析优先级对齐（建议实现顺序）

1. **引入 server default**
   - 在 App 启动或首次需要默认模型时，调用 `config.getDefaultAgentConfig` 或从 `config.getGlobalConfig` 取 `serverConfig.defaultAgent`
   - 可缓存，与 user 设置合并

2. **引入 DEFAULT_AGENT_CONFIG 兜底**
   - 在 `packages/const` 或 App 内定义 `DEFAULT_MODEL`、`DEFAULT_PROVIDER`
   - 合并顺序：DEFAULT_AGENT_CONFIG → serverDefault → userDefault → runtime fallback

3. **User default 有效性校验**
   - 在 loadSelection /getSessionChatOptions 中，若 user default 的 model 不在 `enabledChatAiModels` 内，则回退到 server default 或 runtime fallback

4. **Provider 解析**
   - 当有 model 无 provider 时，用 `resolveProviderByModel` 或从 providers 树中查找；若仍无，用 DEFAULT_PROVIDER

### 4.2 数据流建议

```
getResolvedDefaultModel():
  1. serverDefault = await configApi.getDefaultAgentConfig()  // 或 getGlobalConfig.serverConfig.defaultAgent
  2. userDefault = userState?.settings?.defaultAgent?.config
  3. merged = merge(DEFAULT_AGENT_CONFIG, serverDefault, userDefault)
  4. if (merged.model not in enabledModels) → use first enabled
  5. if (!merged.provider && merged.model) → resolveProviderByModel(merged.model)
  6. return { model, provider }
```

---

## 五、前端设置与 UX 建议

### 5.1 现有入口

- **App**：Me → WorkspaceOverviewCard → 点击 Model → ModelPickerScreen（sessionId 为空时为全局默认）
- **Web**：Settings → Agent → DefaultAgentForm（ModelSelect）

### 5.2 新增 / 调整能力

| 能力             | 说明                                         | UX 建议                                               |
| ---------------- | -------------------------------------------- | ----------------------------------------------------- |
| 显示「系统默认」 | 当用户未设置时，展示 server/default 的模型名 | 在 ModelPicker 顶部或选中项旁显示「系统默认：xxx」    |
| 重置为默认       | 清除用户自定义，恢复 server/default          | 在 ModelPicker 或设置页提供「恢复默认」按钮           |
| 无效模型提示     | 用户默认模型已禁用时                         | Toast 或行内提示「默认模型不可用，已切换为 xxx」      |
| 与 Web 同步      | 在 Web 修改默认模型后，App 能反映            | 依赖 fetchUser /getUserState 刷新，Me 页 focus 时拉取 |

### 5.3 设置页结构建议

1. **保持 ModelPicker 作为主入口**：Me → 默认模型，与 Web 的 DefaultAgentForm 等价。
2. **可选：Settings 内增加「默认模型」入口**：与 Web 的 Settings → Agent 对齐，便于高级用户查找。
3. **ModelPicker 标题区分**：有 sessionId 时「选择模型（本会话）」；无 sessionId 时「默认模型」或「选择默认模型」。
4. **空状态**：用户从未设置时，显示「使用系统默认（GPT-4o）」等，点击进入选择。

### 5.4 实现注意点

- **缓存**：server default 可缓存在内存或 AsyncStorage，避免每次解析都请求。
- **降级**：`getDefaultAgentConfig` 失败时，使用 `DEFAULT_AGENT_CONFIG` 或 runtime fallback。
- **i18n**：新增「系统默认」「恢复默认」「默认模型不可用」等 key。

---

## 六、相关文件索引

### Web

- `packages/const/src/settings/agent.ts`（DEFAULT_AGENT_CONFIG）
- `packages/const/src/settings/llm.ts`（DEFAULT_MODEL）
- `src/store/user/slices/settings/selectors/settings.ts`（defaultAgentConfig）
- `src/store/user/slices/common/action.ts`（defaultSettings 合并 serverConfig）
- `src/server/services/agent/index.ts`（mergeDefaultConfig）
- `src/server/globalConfig/index.ts`（getServerDefaultAgentConfig）
- `src/routes/(main)/settings/agent/features/DefaultAgentForm.tsx`

### App

- `apps/mobile/src/store/model.ts`（loadSelection）
- `apps/mobile/src/store/chat.ts`（getSessionChatOptions）
- `apps/mobile/src/screens/ModelPickerScreen.tsx`
- `apps/mobile/src/lib/api.ts`（configApi.getGlobalConfig、userApi.getState）
- `apps/mobile/src/components/ui/WorkspaceOverviewCard.tsx`

### 共享

- `packages/const`（DEFAULT_AGENT_CONFIG、DEFAULT_MODEL、DEFAULT_PROVIDER）
- `src/server/routers/lambda/config/index.ts`（getDefaultAgentConfig、getGlobalConfig）
