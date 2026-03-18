# Explore（商店）分类加载审计（现状版）

> **审计日期**：2026-03-18\
> **审计范围**：`apps/mobile` StoreScreen 的 Explore（MCP / Skills 分类筛选）\
> **核心现象**：`全部` 基本稳定；切分类时偶发空列表或结果错位，用户体感为「看运气」

**相关文档**：

- [skill-mcp-category-app-web-audit.zh-CN.md](./skill-mcp-category-app-web-audit.zh-CN.md)
- [mobile-app-issues-audit.zh-CN.md](./mobile-app-issues-audit.zh-CN.md)

---

## 一、结论（TL;DR）

当前问题已不是 “没有兜底分类”，而是 “**并发竞态 + 错误语义不透明 + 分类契约漂移**” 叠加：

1. 前端已具备 fallback 分类和非法分类回退，但 `fetchMarket` 仍无请求序列保护，快速切分类时会被过时响应覆盖。
2. 服务端 `getMcpList/getSkillList` 失败时返回空结构，App 无法区分 “真空数据” 和 “请求失败”。
3. category key 仍由多方约定（App fallback、市场接口、上游数据），存在语义漂移风险。
4. 缓存并非单一 6h TTL，而是 “6h 新鲜 + 7 天陈旧兜底”，会放大 “某些分类好像一直正常、某些一直空” 的体感差异。

---

## 二、现状快照（已落地 / 未落地）

| 项目                             | 状态        | 说明                                              |
| -------------------------------- | ----------- | ------------------------------------------------- |
| 固定分类 fallback（MCP / Skill） | ✅ 已落地   | `fetchCategories` 先写 fallback，再请求 API       |
| category 归一化映射              | ✅ 已落地   | `normalizeCategoryKey` + `NORMALIZE_CATEGORY_MAP` |
| builtin 默认分类补全             | ✅ 已落地   | `BUILTIN_DEFAULT_CATEGORY`                        |
| 非法分类自动回退 `all`           | ✅ 已落地   | `categoryOptions` 不包含当前 key 时回退           |
| 请求取消 / 序列保护              | ❌ 未落地   | `fetchMarket` 无 `AbortController` / requestId    |
| 失败与空结果语义区分             | ❌ 未落地   | 列表接口失败时返回空结构                          |
| 分类契约统一（App/Web/Server）   | ⚠️ 部分落地 | 仍依赖多源 key，未形成单一契约                    |

---

## 三、调用链与风险点

### 3.1 前端调用链

```
进入 Explore
  -> fetchCategories(source)
  -> fetchExploreTotals()
  -> fetchMarket(source, page=1, append=false)

点击分类 / 切换 MCP|Skill / 修改搜索词
  -> 更新 activeExploreCategory | activeExploreSource | debouncedQuery
  -> useEffect 触发 fetchMarket(source, 1, false)
```

### 3.2 仍在生效的主要风险

1. **并发竞态**\
   快速点击分类会并发发起多个 `fetchMarket`，后返回的旧请求可能覆盖新分类结果。

2. **错误被 “伪装成空”**\
   服务端列表接口 catch 后返回 `items: []`，App 只能显示空态，无法提示 “请求失败可重试”。

3. **分类语义漂移**\
   分类 key 来源包括 fallback、分类接口、列表接口 item.category、builtin manifest，任一侧变更都可能造成 “有分类但点进去空”。

4. **缓存体感偏差**\
   相同分类在不同时间 / 节点可能命中新鲜缓存、陈旧缓存或实时请求失败，用户感知为 “时有时无”。

---

## 四、证据链（代码现状）

### 4.1 已落地能力

- fallback 分类先写入：`apps/mobile/src/screens/StoreScreen.tsx` `fetchCategories`
- 非法分类回退 `all`：`apps/mobile/src/screens/StoreScreen.tsx` 分类校验 effect
- 分类归一化与标签：`apps/mobile/src/constants/storeCategories.ts`
- builtin 分类补全与过滤：`apps/mobile/src/screens/StoreScreen.tsx` `getSkillCategoryForFilter`

### 4.2 关键问题仍在

- `fetchMarket` 无请求取消 / 序列保护：`apps/mobile/src/screens/StoreScreen.tsx`
- `market.getMcpList` 失败返回空结构：`src/server/routers/lambda/market/index.ts`
- `market.skill.getSkillList` 失败返回空结构：`src/server/routers/lambda/market/skill.ts`
- 分类接口行为不一致：`getMcpCategories` 抛错、`getSkillCategories` 返回 `[]`
- MCP `all/discover` 会被省略 category（视为 “全部”）：`src/server/services/discover/index.ts`

### 4.3 缓存语义（需在文档中明确）

`communityMarketCacheService` 不是 “只缓存 6 小时”：

1. **新鲜期**：6 小时内直接返回缓存
2. **陈旧期**：缓存可保留到 7 天
3. **刷新失败兜底**：若刷新失败且有陈旧缓存，返回陈旧缓存

这会导致 “有的分类看起来稳定，有的分类经常空” 的非一致体验。

---

## 五、最佳修复方案（移动端体验优先）

### P0（本周应完成）

1. **前端加请求序列保护（必做）**\
   为 `fetchMarket` 增加 requestId/abort 机制，只允许最新请求落地 `setMarketItems`。

2. **区分失败与空结果（必做）**\
   列表接口失败时返回可识别错误语义（状态码或结构字段），App 按 “失败态” 展示重试，不再误判为空分类。

3. **可观测性补齐（必做）**\
   在 App 和服务端日志统一打印：`source/category/query/page/requestId/resultCount/errorType/cacheHit`。

### P1（下个迭代）

1. **统一 category 契约**\
   明确 `getCategories/getMcpCategories` 与 `getSkillList/getMcpList` 的 key 集合和映射规则，输出契约文档。

2. **分类来源收敛**\
   减少 “fallback key /upstream key /manifest key” 并存，建立单一 canonical key。

### P2（体验增强）

1. **空态细分**：`暂无内容` / `加载失败` / `筛选条件过窄`
2. **重试入口前置**：空态提供显式重试按钮
3. **分类健康监控**：按分类统计失败率与空结果率

---

## 六、验收清单（回归标准）

1. 快速点击分类（A -> B -> A）30 次，列表不出现错位回跳。
2. 弱网 / 高延迟下，分类切换不会把旧分类结果覆盖到当前分类。
3. 上游故障时展示 “加载失败可重试”，而不是静默空列表。
4. MCP 与 Skill 切换后，分类栏与列表语义一致。
5. 在缓存命中与未命中场景下，行为可解释且日志可追踪。

---

## 七、相关文件索引

### App

- `apps/mobile/src/screens/StoreScreen.tsx`
- `apps/mobile/src/constants/storeCategories.ts`
- `apps/mobile/src/lib/api.ts`

### Server

- `src/server/routers/lambda/market/index.ts`
- `src/server/routers/lambda/market/skill.ts`
- `src/server/services/discover/index.ts`
- `src/server/services/community/marketCache.ts`
- `src/server/services/market/index.ts`

---

## 八、与 DiscoverScreen 的区分

| 屏幕           | 入口                       | 分类能力                                          | 是否本问题范围 |
| -------------- | -------------------------- | ------------------------------------------------- | -------------- |
| StoreScreen    | 底部 Tab「商店」-> Explore | MCP / Skill 分类筛选                              | 是             |
| DiscoverScreen | Profile「发现」            | Agents / Models / Providers Tab（无同构分类筛选） | 否             |
