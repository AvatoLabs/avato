# Skill / MCP 分类审计：App vs Web

本文档审计商店（Store）中 Skill 与 MCP 分类在移动端 App 与 Web 端的实现差距，分析 App 分类「总是处理不好」的根因。

**审计范围**：

- **App**：`apps/mobile/src/screens/StoreScreen.tsx`、`api.ts` 中的 `marketSkillApi`
- **Web**：`src/hooks/useSkillCategory.tsx`、`useMCPCategory.tsx`，`src/routes/(main)/community/(list)/skill`、`mcp` 的 Category 组件

---

## 一、架构概览

### 1.1 数据流对比

| 维度         | Web                                                  | App                                                 |
| ------------ | ---------------------------------------------------- | --------------------------------------------------- |
| **分类来源** | 固定 hooks（useSkillCategory /useMCPCategory）+ i18n | API（getCategories / getMcpCategories）             |
| **分类数量** | 来自 useSkillCategories /useMcpCategories（SWR）     | 来自 marketCategories（fetchCategories）            |
| **分类标签** | i18n `discover` 命名空间                             | 本地 `CATEGORY_LABELS` + `humanizeCategoryKey` 兜底 |
| **总数**     | items.reduce 或 API 返回                             | getMcpList / getSkillList(pageSize:1).totalCount    |

### 1.2 分类集合差异

**Web**：

- **Skill**：`SkillCategory` 枚举（all, coding-agents-ides, web-frontend-development, devops-cloud, ...）— 约 30 个
- **MCP**：`McpCategory` 枚举（discover, all, developer, productivity, tools, ...）— 约 17 个
- 两套分类**完全独立**，来自 `@/types/discover` 与 i18n

**App**：

- **Skill / MCP**：共用同一套 `CATEGORY_LABELS`（约 40+ key）
- 分类列表来自 API，MCP 与 Skill 分别调用 `getMcpCategories` / `getCategories`
- API 返回的 `category` key 可能与 Web 的枚举、或与 `CATEGORY_LABELS` 的 key 不一致

---

## 二、核心差距

### 2.1 分类来源：固定 vs 动态

| 端  | 行为                                                                      | 影响                               |
| --- | ------------------------------------------------------------------------- | ---------------------------------- |
| Web | 使用固定 `useSkillCategory()` / `useCategory()`，分类顺序、key、i18n 一致 | 分类稳定，与后端约定一致           |
| App | 完全依赖 API 返回，失败时 `marketCategories = []`，仅显示「全部」         | API 失败或返回空时，分类栏几乎为空 |

**根因**：App 没有「固定分类兜底」。Web 的固定列表保证至少有一套可用的分类；App 一旦 API 失败，只能依赖 `deriveCategoriesFromItems`（见下）。

### 2.2 API 失败与兜底逻辑

**App 的 fetchCategories**：

```ts
const fetchCategories = useCallback(async (source: ExploreSource) => {
  try {
    const list =
      source === 'mcp'
        ? await marketSkillApi.getMcpCategories()
        : await marketSkillApi.getCategories();
    setMarketCategories(Array.isArray(list) ? list : []);
  } catch {
    // 静默失败，保留上一次的 marketCategories
  }
}, []);
```

- 首次进入且 API 失败时，`marketCategories` 保持 `[]`
- `buildCategoryOptions` 只生成 `[{ key: 'all', label: '全部' }]`
- 用户只能看到「全部」，无法按分类筛选

**fetchMarket 的兜底**：

```ts
if (!append && page === 1 && !categoryParam && remoteItems.length > 0) {
  setMarketCategories((prev) =>
    prev.length === 0 ? deriveCategoriesFromItems(remoteItems) : prev,
  );
}
```

- 仅在「无分类、第一页、有数据」时，从 `remoteItems` 推导分类
- `deriveCategoriesFromItems` 用 `item.category` 统计，依赖列表接口返回的 `category` 字段
- 若列表接口的 `category` 与分类接口的 key 不一致，或缺失，推导结果会不完整

### 2.3 分类 key 与标签对齐

**Web**：

- 分类 key 来自 `SkillCategory` / `McpCategory` 枚举
- 标签来自 i18n：`t('skills.categories.xxx.name')`、`t('mcp.categories.xxx.name')`
- 列表接口的 `category` 与枚举对齐，由后端 / 市场约定保证

**App**：

- 分类 key 来自 API 或 `deriveCategoriesFromItems`
- 标签来自 `CATEGORY_LABELS[key]?.[locale]` 或 `humanizeCategoryKey(key)`
- `CATEGORY_LABELS` 与 Web 的 i18n 有重叠，但不完全一致
- API 可能返回 Web 枚举之外的 key（如 `productivity-tasks` vs `productivity`），导致：
  - 标签显示为 `humanizeCategoryKey` 的通用格式（如 "Productivity Tasks"）
  - 或 key 不在 `CATEGORY_LABELS` 中，显示不够友好

### 2.4 Builtin Skills 与分类过滤

**App 的 builtinMarketItems**：

```ts
const builtinMarketItems = useMemo(() => {
  return builtinSkillsCatalog
    .filter((skill) => {
      const category = getSkillCategory(skill);  // manifest?.meta?.category || manifest?.category
      const matchesCategory =
        activeExploreCategory === ALL_CATEGORY_KEY || category === activeExploreCategory;
      return matchesCategory && matchesStoreQuery(...);
    })
    .map(buildBuiltinMarketItem);
}, [activeExploreCategory, builtinSkillsCatalog, debouncedQuery]);
```

**潜在问题**：

1. **category 格式**：builtin 的 `manifest.meta.category` 可能与 API 分类 key 不一致（如 `coding` vs `coding-agents-ides`）
2. **缺失 category**：builtin 若无 `category`，在非「全部」分类下会被过滤掉，导致「只显示内建技能」或「切分类后内建消失」的错觉
3. **合并逻辑**：`fetchMarket` 中 `source === 'skill' && page === 1` 时合并 `builtinMarketItems`，但 builtin 与 remote 的 category 若不一致，分类筛选会表现混乱

### 2.5 总数与分类数量

**App**：

- `marketMcpTotal` / `marketSkillTotal`：来自 `getMcpList` / `getSkillList` 的 `totalCount`
- 分类数量：来自 `marketCategories[].count`，由 `getMcpCategories` / `getCategories` 返回

**可能问题**：

- 若分类 API 返回的 `count` 字段缺失或结构不同，`normalizeMarketCategoryItem` 会尝试 `count` / `totalCount` / `itemCount` / `total`
- 市场后端若使用不同字段名，App 可能拿不到 count，分类旁不显示数量
- 总数与各分类数量之和可能对不上（后端统计口径不同）

### 2.6 切换 MCP / Skill 时的分类状态

**App**：

- 切换 `activeExploreSource` 时调用 `fetchCategories(activeExploreSource)`
- `setActiveExploreCategory(ALL_CATEGORY_KEY)` 重置当前分类
- 若 MCP 与 Skill 的分类 API 返回结构不同，或某一方失败，会出现：
  - 从 MCP 切到 Skill 后分类变空
  - 或分类列表仍是 MCP 的，与 Skill 列表不匹配

---

## 三、根因归纳

| 问题                      | 根因                                                            |
| ------------------------- | --------------------------------------------------------------- |
| 分类经常为空或很少        | API 失败无兜底，无固定分类列表                                  |
| 分类与列表不匹配          | 分类 key 与列表 item.category、builtin manifest.category 不一致 |
| 数量显示错误              | 分类 API 的 count 字段与 App 预期结构不一致                     |
| 内建技能在分类下消失      | builtin manifest 的 category 缺失或与 API key 不一致            |
| 切换 MCP/Skill 后分类错乱 | 两套 API 返回结构不同，或失败时状态未正确重置                   |

---

## 四、建议修复方向

### 4.1 短期（最小改动）

1. **固定分类兜底**：当 `getMcpCategories` / `getCategories` 失败或返回空时，使用与 Web 对齐的固定分类列表（可从 `useSkillCategory` / `useMCPCategory` 抽成共享常量或 API）
2. **统一 category key**：确认市场 API 返回的 category 与 Web 枚举、builtin manifest 一致；必要时在 App 做 key 映射
3. **builtin category 补全**：为 builtin skills 的 manifest 补全 `meta.category`，或建立 builtin identifier → category 的映射表

### 4.2 中期（结构对齐）

1. **复用 Web 的 discover store**：让 App 通过 tRPC 使用 `useSkillCategories` / `useMcpCategories` 的等价接口，保证分类与 Web 同源
2. **分类与 i18n 对齐**：App 的 `CATEGORY_LABELS` 与 `locales/default/discover.json` 的 skills/mcp categories 保持同步，或直接使用 i18n
3. **normalizeMarketCategoryItem 增强**：根据实际 API 响应结构，扩展对 `count`、`category` 等字段的解析

### 4.3 长期（架构统一）

1. **共享分类定义**：将 `SkillCategory`、`McpCategory` 及 i18n key 抽到 `packages/` 或 `src/constants/`，Web 与 App 共用
2. **市场 API 契约**：明确 getCategories /getMcpCategories 的返回格式（category key、count 字段），并在文档与类型中固化

---

## 五、已实施修复（2025-03）

1. **固定分类兜底**：新增 `apps/mobile/src/constants/storeCategories.ts`，包含 `FALLBACK_SKILL_CATEGORY_KEYS`、`FALLBACK_MCP_CATEGORY_KEYS`。当 `getMcpCategories` / `getCategories` 失败或返回空时，使用固定列表。
2. **分类 key 归一化**：`normalizeCategoryKey` + `NORMALIZE_CATEGORY_MAP` 将 manifest 中的 category 变体映射到 API 约定 key。
3. **Builtin 默认分类**：`BUILTIN_DEFAULT_CATEGORY` 为 lobe-\* 内建技能提供默认分类（无 manifest 时）。
4. **deriveCategoriesFromItems**：接受 `source` 参数，按 MCP/Skill 使用对应 validKeys 归一化 item.category。
5. **builtinMarketItems 过滤**：使用 `getSkillCategoryForFilter` 归一化 category，确保与 `activeExploreCategory` 正确匹配。

---

## 六、相关文件索引

### Web

- `src/hooks/useSkillCategory.tsx`
- `src/hooks/useMCPCategory.tsx`
- `src/routes/(main)/community/(list)/skill/features/Category/index.tsx`
- `src/routes/(main)/community/(list)/mcp/features/Category/index.tsx`
- `src/store/discover/slices/skill/action.ts`
- `src/store/discover/slices/mcp/action.ts`
- `packages/types/src/discover/`（SkillCategory、McpCategory 枚举）

### App

- `apps/mobile/src/screens/StoreScreen.tsx`（fetchCategories、buildCategoryOptions、builtinMarketItems、deriveCategoriesFromItems）
- `apps/mobile/src/constants/storeCategories.ts`（固定分类、归一化、标签）
- `apps/mobile/src/lib/api.ts`（marketSkillApi.getCategories、getMcpCategories、normalizeMarketCategoryItem）

### 共享 / 后端

- `src/server/routers/lambda/market/index.ts`（getMcpCategories）
- `src/server/routers/lambda/market/skill.ts`（getSkillCategories）
- `src/server/services/discover/index.ts`（getMcpCategories、getSkillCategories）
- `src/server/services/market/index.ts`（marketSkills.getCategories）
- 市场 / Klavis API：`market.plugins.getCategories`、`market.marketSkills.getCategories`
