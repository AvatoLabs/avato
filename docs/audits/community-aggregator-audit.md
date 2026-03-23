# 社区聚合器功能审计报告

**审计日期**: 2025-03-23\
**修复完成**: 2025-03-23（所有问题已修复）

**审计范围**:

- MCP 聚合器 (`src/server/services/aggregator/`)
- Skill 聚合器 (`src/server/services/skillAggregator/`)
- 社区缓存 (`src/server/services/community/marketCache.ts`)
- 前端社区页 (`src/features/CommunityAggregator/`, `src/routes/(main)/community/`)

---

## 1. 架构概览

### 1.1 MCP 聚合器

- **数据源**: 4 个（Official、Higress、Smithery、Glama）
- **流程**: 拉取各源 → 去重合并 → 筛选 / 排序 / 分页 → 可选验证可安装性
- **安全**: 使用 `ssrfSafeFetch` 防止 SSRF
- **重试**: `retrySourceFetch` 支持 3 次重试，针对 5xx/408/429 等可重试错误
- **验证**: `getStreamableMcpServerManifest` 验证可安装 MCP（仅 HTTP HEAD / 轻量请求）

### 1.2 Skill 聚合器

- **数据源**: 1 个（SkillHub / Lightmake）
- **流程**: 拉取列表 → **对当前页所有项做可安装性验证** → 返回
- **安全**: 使用 `ssrfSafeFetch`
- **验证**: 对每个技能的 `importUrl` 发起**完整下载**（zip 或 md），解析并校验格式

### 1.3 缓存

- **Redis**: 主缓存，TTL 7 天
- **内存**: 回退 / 加速层，TTL 7 天
- **新鲜期**: 6 小时内视为新鲜，直接返回
- **查询缓存**: 按 `scope` + `params` 的 SHA1 做 key，不同 page/sort/q 分别缓存

---

## 2. 发现问题

### 2.1 高优先级

#### P1: MCP installable 模式下验证全部候选项

**位置**: `aggregator/index.ts` 第 1011–1036 行

**问题**: 当 `params.installable === true` 时：

1. 从 `collection.items` 中筛选出所有**初始**可安装项（`isAggregatorInstallable(item.installability)`）
2. 对**全部**候选调用 `verifyItems`，逐项请求 `getStreamableMcpServerManifest`
3. 验证完成后再分页

若全量有 200+ 项满足初始可安装，会验证 200+ 次再返回第一页，首屏延迟很高。

**建议**: 先分页再验证当前页，或引入验证结果缓存（按 installUrl 或 identifier 缓存）。

**已修复**: 改为先分页再验证当前页，仅对当前页项调用 `verifyItems`，显著降低 installable 模式首屏延迟。

---

#### P1: Skill 聚合器对每项完整下载验证

**位置**: `skillAggregator/index.ts` 第 166–236 行 `verifyInstallability`

**问题**: 对每个技能项会：

1. `fetch(item.importUrl)` 拉取完整响应
2. 对 zip：`Buffer.from(await response.arrayBuffer())` 读入整包（最大 10MB）
3. 对 md：`await response.text()` 读入全文
4. 再调用 `parser.parseZipPackage(buffer)` 或 `parser.parseSkillMd(content)` 校验

每页 21 项，相当于 21 次完整下载，流量和延迟都较大。

**建议**:

- 对 zip：用 `Range: bytes=0-1024` 只取前 1KB 做格式校验
- 或改为异步 / 后台验证，列表先展示，验证状态单独更新

**已修复**: zip 使用 `Range: bytes=0-1023` 请求，仅校验 PK 签名；获 ≤1KB 时跳过完整解析；并增加 `retryFetch` 重试逻辑。

---

### 2.2 中优先级

#### P2: 内存缓存无 LRU，可能无限增长

**位置**: `marketCache.ts` 第 20 行 `memoryCache = new Map<string, MemoryEntry>()`

**问题**: 不同 `scope` 和 `params` 会生成不同 key，无淘汰策略，长时间运行下 Map 可能持续变大。

**建议**: 使用带 LRU 的 cache（如 `lru-cache`），或限制 key 数量上限。

**已修复**: 增加 `MEMORY_CACHE_MAX_SIZE=500`，超出时按 LRU 淘汰；`getMemoryCache` 命中时通过 delete+set 将 key 移至最新。

---

#### P2: Higress 解析依赖 HTML 正则

**位置**: `aggregator/index.ts` 第 468–476、619–625 行

**问题**: 从 Higress 市场页用正则提取数据，例如：

```ts
HIGRESS_SERVER_NAME_PATTERN = /serverName\\":\\"([^"]+)\\"/;
HIGRESS_DESCRIPTION_PATTERN = /text-sm text-muted-foreground\\",\\"children\\":\\"([^"]+)\\"/;
```

页面结构一旦调整，解析会失败且难以发现。

**建议**: 若 Higress 提供官方 API，优先迁移；否则至少增加监控 / 告警，检测解析失败率。

---

#### P2: Skill 聚合器无重试

**位置**: `skillAggregator/index.ts` 第 139–151 行 `fetchJson`

**问题**: 与 MCP 不同，Skill 的 `fetchJson` 不包含重试逻辑，网络波动会导致直接失败。

**建议**: 复用或参考 MCP 的 `retrySourceFetch`，对可重试错误进行重试。

**已修复**: 新增 `retryFetch` 和 `isRetryableFetchError`，`fetchJson` 与 `verifyInstallability` 均支持最多 3 次重试。

---

### 2.3 低优先级

#### P3: includesQuery 为子串匹配

**位置**: `aggregator/index.ts` 第 172–187 行

**问题**: `haystack.includes(searchValue)` 为子串匹配，短关键词（如 `"a"`）可能命中大量无关项。

**建议**: 可考虑按词分词、或要求最小长度 / 词边界，减少误匹配。

**已修复**: 增加 `MIN_QUERY_LENGTH=2`，搜索词少于 2 字符时不进行过滤。

---

#### P3: 错误与告警展示不完整

**位置**: `CommunityAggregator` 各 List 组件

**问题**: `warnings` 存在于响应中，但前端未统一展示各源失败或告警信息，用户难以感知部分源异常。

**建议**: 在列表顶部或空状态旁展示 `warnings`，提示 “部分数据源加载失败” 等。

---

## 3. 已较好实现的部分

| 项目          | 说明                                                        |
| ------------- | ----------------------------------------------------------- |
| SSRF 防护     | MCP 与 Skill 均使用 `ssrfSafeFetch`                         |
| 源失败隔离    | MCP 用 `Promise.allSettled`，单源失败不影响其他源           |
| MCP 重试      | 对可重试错误自动重试最多 3 次                               |
| 验证并发控制  | MCP 与 Skill 均限制并发（4 个 worker）                      |
| MCP 验证超时  | 8s 超时，避免单点阻塞                                       |
| 分页 URL 同步 | Pagination 使用 `useQuery` 同步 `page` 到 URL               |
| 缓存降级      | Redis 不可用时回退到内存 cache，不阻塞请求                  |
| 请求去重      | `fetchAndCache` 中 `inflight` Map 避免同一 key 并发重复请求 |

---

## 4. 修复优先级建议

1. **P1**: 优先处理 MCP installable 验证策略和 Skill 完整下载验证
2. **P2**: 增加 LRU、Higress 解析健壮性、Skill 重试
3. **P3**: 优化 `includesQuery`、完善 warnings 展示

---

## 5. 相关文件索引

| 功能           | 路径                                                         |
| -------------- | ------------------------------------------------------------ |
| MCP 聚合服务   | `src/server/services/aggregator/index.ts`                    |
| Skill 聚合服务 | `src/server/services/skillAggregator/index.ts`               |
| 市场缓存       | `src/server/services/community/marketCache.ts`               |
| MCP 路由       | `src/server/routers/lambda/aggregator.ts`                    |
| 前端 List      | `src/features/CommunityAggregator/List/`                     |
| 分页           | `src/routes/(main)/community/(list)/features/Pagination.tsx` |
