# 设置页 Provider 模型列表更新流程审计

**审计日期**: 2025-03-23

**审计范围**: 设置页 Provider 详情下的模型列表（ModelList）如何获取、展示与刷新。

---

## 1. 数据流概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 前端 (Settings Provider Detail)                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ClientMode / ProviderDetail                                                 │
│    └─ useFetchAiProviderItem(id)  → activeAiProvider = id                    │
│    └─ ModelList id={id}                                                      │
│         └─ Content                                                           │
│              └─ useFetchAiProviderModels(id)  [SWR]                          │
│              └─ aiProviderModelList (store)  ← onSuccess 写入                 │
│              └─ EnabledModelList / DisabledModels 渲染                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 数据获取                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  useFetchAiProviderModels:                                                    │
│    key: [FETCH_AI_PROVIDER_MODELS, id]                                       │
│    fetcher: aiModelService.getAiProviderModelList(id)                          │
│    onSuccess: set({ aiProviderModelList, isAiModelListInit })                │
│                                                                              │
│  fetchRemoteModelList (手动「拉取」):                                         │
│    modelsService.getModels(providerId)  ← 调用 provider 的 models API        │
│    batchUpdateAiModels(data)  ← 写入后端                                      │
│    refreshAiModelList()  ← mutate SWR 触发重新拉取                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 后端 (tRPC)                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  aiModel.getAiProviderModelList({ id })                                      │
│    → AiInfraRepos.getAiProviderModelList(providerId)                          │
│    → aiModelModel.getModelListByProviderId  (用户配置的模型)                   │
│    → fetchBuiltinModels (model-bank + serverModelLists)                       │
│    → mergeArrayById(builtin, aiModels)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 更新触发点

| 触发方式     | 位置                    | 行为                                                                                         |
| ------------ | ----------------------- | -------------------------------------------------------------------------------------------- |
| **初始进入** | ModelList Content mount | `useFetchAiProviderModels(id)` 发起 SWR 请求，key=`[FETCH_AI_PROVIDER_MODELS, id]`           |
| **手动拉取** | ModelTitle 「拉取」按钮 | `fetchRemoteModelList(provider)` → models API → `batchUpdateAiModels` → `refreshAiModelList` |
| **清除远程** | ModelTitle 「清除」图标 | `clearRemoteModels(provider)` → 后端清除 → `refreshAiModelList`                              |
| **全部重置** | ModelTitle 下拉「重置」 | `clearModelsByProvider(provider)` → 后端重置 → `refreshAiModelList`                          |
| **开关模型** | ModelItem 开关          | `toggleModelEnabled` → 后端 → `refreshAiModelList`                                           |
| **批量开关** | SortModelModal 等       | `batchToggleAiModels` → `refreshAiModelList`                                                 |
| **新增模型** | CreateNewModelModal     | `createNewAiModel` → `refreshAiModelList`                                                    |
| **删除模型** | ModelItem 删除          | `removeAiModel` → `refreshAiModelList`                                                       |
| **更新模型** | ModelConfigModal        | `updateAiModelsConfig` → `refreshAiModelList`                                                |
| **排序**     | SortModelModal          | `updateAiModelsSort` → `refreshAiModelList`                                                  |

---

## 3. refreshAiModelList 实现

```ts
// src/store/aiInfra/slices/aiModel/action.ts
refreshAiModelList = async (): Promise<void> => {
  await mutate([FETCH_AI_PROVIDER_MODEL_LIST_KEY, this.#get().activeAiProvider]);
  this.#get().refreshAiProviderRuntimeState();
};
```

- **mutate**：使 SWR 缓存失效并重新请求，key 为 `[FETCH_AI_PROVIDER_MODEL_LIST_KEY, activeAiProvider]`
- **依赖**：依赖 `activeAiProvider`，由 `useFetchAiProviderItem(id)` 的 `onSuccess` 设置

---

## 4. 潜在问题

### 4.1 activeAiProvider 与当前查看 provider 可能不一致

**场景**：快速切换 provider（A → B）时，`useFetchAiProviderItem(B)` 可能尚未完成，`activeAiProvider` 仍为 A。此时若在 B 的详情页触发 `toggleModelEnabled` 等操作，`refreshAiModelList` 会 mutate `[..., A]`，导致刷新的是 A 的模型列表，B 的列表不会更新。

**原因**：`toggleModelEnabled`、`batchToggleAiModels` 等使用 `activeAiProvider`，而操作可能是针对当前路由对应的 provider（由参数传入），两者可能不同步。

**建议**：在需要刷新时，优先使用当前页面 provider id（例如 `params.providerId` 或 `ModelList` 的 `id`），而不是 `activeAiProvider`，或在 refresh 时显式传入 providerId。

---

### 4.2 全局 store 与多 tab 竞争

**问题**：`aiProviderModelList` 是全局状态，同一时刻只能保存一个 provider 的列表。若用户同时打开多个 provider 设置 tab（多窗口 / 多 tab），后加载的会覆盖先加载的，切回时可能看到错误 provider 的列表。

**建议**：按 providerId 拆分，例如 `aiProviderModelListMap: Record<string, AiProviderModelListItem[]>`，或每个 provider 使用独立 SWR key（当前已按 id 区分，但 store 仍为单一 list，需与 key 对应）。

---

### 4.3 DisabledModels 的无限滚动与 store 不同源

**实现**：`DisabledModels` 用 `useSWRInfinite` 直接调 `aiModelService.getAiProviderModelList` 做分页，首屏用 store 的 `disabledModels`（来自 `aiProviderModelList`），后续页用 SWR 结果。

**问题**：store 更新（例如 `refreshAiModelList`）后，SWRInfinite 的 key 未变，不会自动重拉，可能导致「加载更多」的结果与 store 不一致。

**建议**：`refreshAiModelList` 时同时 invalidate DisabledModels 的 SWR key（如 `[FETCH_DISABLED_MODELS_PAGE_KEY, providerId, ...]`），或在 store 更新后通知 DisabledModels 重置分页并重新请求。

---

### 4.4 useFetchAiProviderModels 与 useFetchAiProviderItem 调用时序

**流程**：`ClientMode` 先调 `useFetchAiProviderItem(id)`，再渲染 `ModelList id={id}`；`ModelList` 内调 `useFetchAiProviderModels(id)`。

- `useFetchAiProviderItem` 成功后才设置 `activeAiProvider`
- `useFetchAiProviderModels` 用 `id` 作为 SWR 参数，不依赖 `activeAiProvider`

因此模型列表的拉取和展示不依赖 `activeAiProvider`，只有 `refreshAiModelList` 依赖它。

---

## 5. 数据来源层次

1. **model-bank**：内置模型定义
2. **serverModelLists**：服务端配置的模型列表（`providerConfigs[providerId]?.serverModelLists`）
3. **aiModelModel.getModelListByProviderId**：用户侧已配置 / 启用的模型（数据库）
4. **fetchRemoteModelList → modelsService.getModels**：从 provider 的 models API 拉取并写入 `batchUpdateAiModels`

合并顺序：`mergeArrayById(defaultModels, aiModels)`，即用户配置覆盖内置默认。

---

## 6. 相关文件索引

| 模块         | 路径                                                                        |
| ------------ | --------------------------------------------------------------------------- |
| 模型列表组件 | `src/routes/(main)/settings/provider/features/ModelList/index.tsx`          |
| SWR 拉取     | `src/store/aiInfra/slices/aiModel/action.ts` (useFetchAiProviderModels)     |
| 刷新入口     | `src/store/aiInfra/slices/aiModel/action.ts` (refreshAiModelList)           |
| 远程拉取     | `src/store/aiInfra/slices/aiModel/action.ts` (fetchRemoteModelList)         |
| 前端服务     | `src/services/aiModel/index.ts`                                             |
| 远程模型 API | `src/services/models.ts` (getModels)                                        |
| 后端路由     | `src/server/routers/lambda/aiModel.ts`                                      |
| 后端仓库     | `packages/database/src/repositories/aiInfra/index.ts`                       |
| 禁用模型分页 | `src/routes/(main)/settings/provider/features/ModelList/DisabledModels.tsx` |
