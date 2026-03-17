# Skill / MCP 社区页面缓存审计：App vs Web

本文档审计 Skill 市场与 MCP 社区页面在移动端 App 与 Web 端之间的实现差异，重点排查为何 Web 能显示而 App 不能。

**审计范围**：

- **Web**：`src/routes/(main)/community/`、`src/store/discover`、`src/services/discover.ts`
- **App**：`apps/mobile/src/screens/StoreScreen.tsx`、`apps/mobile/src/lib/api.ts`（marketSkillApi）
- **后端**：`src/server/services/community/marketCache.ts`、`src/server/routers/lambda/market/`

---

## 一、调用链对比

### 1.1 Web 端

```
Skill 页面: useFetchSkillList → discoverService.getSkillList
         → lambdaClient.market.skill.getSkillList.query(params)
         → GET /trpc/lambda/market.skill.getSkillList?input=...

MCP 页面:  useFetchMcpList → discoverService.getMcpList
         → lambdaClient.market.getMcpList.query(params)
         → GET /trpc/lambda/market.getMcpList?input=...
```

### 1.2 App 端

```
StoreScreen: fetchMarket → marketSkillApi.getSkillList / getMcpList
           → trpcQuery('market.skill.getSkillList' / 'market.getMcpList', input)
           → GET /trpc/mobile/market.skill.getSkillList?input=...
```

### 1.3 后端

- **Lambda**：`/trpc/lambda` → `lambdaRouter` → `marketRouter`
- **Mobile**：`/trpc/mobile` → `mobileRouter` → `marketRouter`（同一 marketRouter）
- 两者共用 `createLambdaContext`、同一进程，服务端缓存 `communityMarketCacheService` 为单例，**理论上共享**。

---

## 二、服务端缓存机制

**位置**：`src/server/services/community/marketCache.ts`

```ts
const getCacheKey = (scope: string, params?: unknown) => {
  const normalizedParams = params
    ? JSON.stringify(
        Object.fromEntries(
          Object.entries(params as Record<string, unknown>)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .sort(([left], [right]) => left.localeCompare(right)),
        ),
      )
    : '';
  const digest = createHash('sha1').update(`${scope}:${normalizedParams}`).digest('hex');
  return `${COMMUNITY_CACHE_PREFIX}:${scope}:${digest}`;
};
```

**结论**：缓存 key = `scope` + `hash(完整 params)`。**params 不同 → key 不同 → 无法命中同一缓存**。

---

## 三、请求参数对比（根因）

### 3.1 MCP 列表

| 参数              | Web（discoverService.getMcpList）                | App（marketSkillApi.getMcpList） |
| ----------------- | ------------------------------------------------ | -------------------------------- |
| locale            | `globalHelpers.getCurrentLanguage()`（如 zh-CN） | 固定 `'en-US'`                   |
| pageSize          | 20 或 21                                         | 50                               |
| connectionType    | 不传                                             | 固定 `'http'`                    |
| sort              | 来自 URL，默认 `McpSorts.Recommended`            | 固定 `'recommended'`             |
| category, page, q | 来自 URL                                         | 来自 StoreScreen                 |

### 3.2 Skill 列表

| 参数              | Web（discoverService.getSkillList）      | App（marketSkillApi.getSkillList） |
| ----------------- | ---------------------------------------- | ---------------------------------- |
| locale            | `globalHelpers.getCurrentLanguage()`     | 固定 `'en-US'`                     |
| pageSize          | 20 或 21                                 | 50                                 |
| sort              | 来自 URL，默认 `SkillSorts.InstallCount` | 固定 `'installCount'`              |
| category, page, q | 来自 URL                                 | 来自 StoreScreen                   |

### 3.3 影响

- Web 首次访问会写入缓存，key 为 `hash({ locale, pageSize: 21, sort, ... })`。
- App 请求的 key 为 `hash({ connectionType: 'http', locale: 'en-US', pageSize: 50, sort, ... })`。
- **两者 key 不同，App 永远无法命中 Web 已写入的缓存**。
- App 每次请求都是 cache miss → 必须请求上游市场 API。
- 若上游失败（网络、超时等），无缓存可回退 → App 返回空列表。

---

## 四、根因归纳

**App 无法复用服务端缓存，是因为请求参数与 Web 不一致，导致缓存 key 不同。**

- 服务端缓存本身是共享的（同一 `marketRouter`、同一 `communityMarketCacheService`）。
- 问题在于 App 的 params（connectionType、locale、pageSize、sort）与 Web 不同，生成的 cache key 不同。
- Web 的流量只填充 Web 的 key，App 的 key 从未被填充。
- App 首次请求 → cache miss → 调上游 → 上游失败 → 无 stale 可回退 → 空列表。

---

## 五、修复建议（服务端缓存对齐）

**目标**：让 App 能命中与 Web 相同或兼容的缓存 key，不增加客户端缓存。

### 5.1 方案 A：App 端对齐 Web 的默认参数（推荐）

在 `apps/mobile/src/lib/api.ts` 的 `marketSkillApi` 中，将请求参数改为与 Web 社区页默认一致：

- **locale**：使用与 Web 相同的逻辑（如 `getCurrentLanguage()` 或 i18n 当前语言），而非固定 `'en-US'`。
- **pageSize**：首屏与 Web 一致，如 21。
- **connectionType**：若上游支持「先取全量再按 connectionType 过滤」，可先不传，在 App 端过滤；若上游必须传，则需评估是否在服务端做 cache key 归一化（见方案 B）。
- **sort**：与 Web 默认一致（如 `McpSorts.Recommended`、`SkillSorts.InstallCount`）。

这样 App 与 Web 在「首屏、无筛选」场景下会使用相同 cache key，可复用 Web 已填充的缓存。

### 5.2 方案 B：服务端 cache key 归一化

在 `marketCache.getCacheKey` 或 `getMcpList` / `getSkillList` 的调用处，对 params 做归一化，使「逻辑等价」的请求共享同一 key，例如：

- 对 `mcp-list`：忽略 `connectionType`，或对 `connectionType: 'http'` 与不传做等价处理（若业务允许）。
- 对 `pageSize`：在首页场景下归一为同一值（如 21），或按区间归一（如 1–50 都视为同一 key）。

需结合上游 API 语义，避免返回不符合 App 需求的数据。

### 5.3 方案 C：预填充 App 常用 key

在服务启动或定时任务中，主动请求一次 App 常用参数组合（如 `{ connectionType: 'http', locale: 'en-US', page: 1, pageSize: 50, sort: 'recommended' }`），预填充缓存，使 App 首次请求即可命中。适合无法调整 App 参数的场景。

---

## 六、相关文件索引

### 服务端

- `src/server/services/community/marketCache.ts` — 缓存 key 生成
- `src/server/routers/lambda/market/index.ts` — getMcpList
- `src/server/routers/lambda/market/skill.ts` — getSkillList

### Web

- `src/services/discover.ts` — getMcpList、getSkillList 参数来源
- `src/store/discover/slices/mcp/action.ts` — useFetchMcpList
- `src/store/discover/slices/skill/action.ts` — useFetchSkillList

### App

- `apps/mobile/src/lib/api.ts` — marketSkillApi.getMcpList、getSkillList 的 input 构造
