# Explore（商店）分类体验审计（App vs Web，定稿）

> **日期**：2026-03-18\
> **范围**：`apps/mobile/src/screens/StoreScreen.tsx` 与 Web 社区商店（`/community/skill`、`/community/mcp`）\
> **目标**：基于当前代码事实，给出移动端与 Web 对齐且符合移动端交互习惯的最佳方案

---

## 一、TL;DR

当前移动端 Store 分类问题，已经从 “没有分类兜底” 升级为 “**状态一致性与语义一致性**问题”：

1. **并发竞态仍存在**：`fetchMarket` 没有请求序列保护，快速切分类时仍可能出现旧请求覆盖新结果。
2. **失败语义不透明**：Skill 列表在服务端异常时会返回空列表结构，前端无法区分 “真空数据” 与 “请求失败”。
3. **App/Web 分类契约仍双轨**：Web 使用 `useSkillCategory` / `useMCPCategory`，App 使用本地 `storeCategories.ts`，长期存在漂移风险。
4. **列表语义与 Web 不完全一致**：App 在 Skill 的第一页会合并 builtin 条目，导致 “分类计数、总数、结果语义” 与 Web 社区列表不一致。

**结论**：现状可用但不稳。最佳方向不是继续 patch 单点，而是 “契约统一 + 请求一致性 + 错误语义清晰化”。

---

## 二、现状对比（Mobile vs Web）

| 维度         | Mobile App（现状）                                   | Web（现状）                                                                   |
| ------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------- |
| 分类来源     | `fetchCategories` + fallback（`storeCategories.ts`） | 固定分类 hooks（`useSkillCategory` / `useMCPCategory`）+ categories API count |
| 列表请求模型 | `useEffect` 驱动 + 本地 `setState`                   | URL Query + SWR key 驱动                                                      |
| 并发安全     | 无 requestId /abort，旧请求可覆盖                    | 不同 query 对应不同 SWR key，天然弱化串线覆盖                                 |
| 错误语义     | 失败常被映射为空（尤其 Skill）                       | 也受后端 “空结构兜底” 影响，但页面层状态分离更清晰                            |
| 列表语义     | Skill page=1 合并 builtin + remote                   | 社区列表只展示社区数据                                                        |
| 分类 UI      | 移动端双横向 chips（source + category）              | 左侧固定分类菜单（含 icon + count）                                           |

---

## 三、关键证据（代码事实）

### 3.1 已改进（确认有效）

1. App 已有固定 fallback 分类、归一化映射、非法分类回退。
2. 切换 source 时会重置分类，基础流程可用。

对应：

- `apps/mobile/src/screens/StoreScreen.tsx`（`fetchCategories`、分类回退）
- `apps/mobile/src/constants/storeCategories.ts`

### 3.2 仍存在的核心问题

1. `fetchMarket` 缺少请求序列保护（竞态风险）。
2. Skill 列表接口失败语义在服务端被 “吞” 为空结构。
3. App 与 Web 分类定义存在重复维护。
4. App Skill 列表混入 builtin，造成与 Web 的 “社区商店” 语义不一致。

对应：

- `apps/mobile/src/screens/StoreScreen.tsx`（`fetchMarket`）
- `src/server/routers/lambda/market/skill.ts`（`getSkillList` catch 返回空结构）
- `src/hooks/useSkillCategory.tsx`、`src/hooks/useMCPCategory.tsx`
- `apps/mobile/src/constants/storeCategories.ts`

---

## 四、为什么 Web 体感更稳定

Web 并不是 “接口更强”，而是状态模型更稳：

1. 分类与筛选参数写入 URL，页面状态可回放、可分享、可重建。
2. SWR key 以 query 为维度，旧参数结果不会直接覆盖当前参数视图。
3. 分类菜单有稳定的 canonical 列表，categories API 更像 “count 补充”，不是唯一真源。

移动端当前仍偏 “命令式 setState + 异步回调覆盖”，在高频切换下更容易串线。

---

## 五、最佳方案（移动端体验优先，同时对齐 Web 语义）

### 5.1 方案原则

1. **分类契约单一真源**：Skill/MCP category key 与展示顺序在 App/Web 共用。
2. **请求结果只允许最新落地**：任何旧请求不得覆盖当前筛选状态。
3. **失败与空结果必须可区分**：UI 不再把失败伪装成空列表。
4. **社区列表语义统一**：Explore 仅社区数据，builtin 归入 Installed 或独立分区。

### 5.2 分阶段落地

#### P0（必须先做）

1. 给 `fetchMarket` 增加 requestId（或 abort）保护，仅最新请求可 `setMarketItems`。
2. 服务端列表接口改为可识别错误（至少返回错误类型，不再一律空结构）。
3. App 空态拆分为：`空结果` / `加载失败` / `筛选过窄`，并提供显式重试。

#### P1（与 Web 彻底对齐）

1. 将 Skill/MCP 分类定义提炼为共享契约（key/order/i18nKey）。
2. App 侧移除本地重复分类字典，改为消费共享定义 + 本地文案映射。
3. Skill Explore 列表移除 builtin 混入逻辑（保持与 Web 社区列表语义一致）。

#### P2（体验增强）

1. 增加分类级别健康指标（失败率、空结果率、平均加载时长）。
2. 支持 “最近使用分类” 与 “上次筛选恢复”。

---

## 六、移动端专属交互建议（不照抄 Web）

1. 保留移动端双层 chips（source + category），不强行做侧栏。
2. category chips 建议加 `count` 与可滚动定位反馈，降低 “切了没生效” 的不确定感。
3. 分类切换时提供轻量骨架占位，避免旧列表瞬闪造成 “错位” 体感。

---

## 七、验收标准

1. 快速切分类 30 次，列表不出现旧分类回跳。
2. 网络失败时出现失败态而非静默空列表。
3. App 与 Web 在同分类、同查询下返回集合语义一致（不含 builtin 干扰）。
4. 分类 key 在 App/Web/Server 三端只维护一套 canonical 定义。

---

## 八、最终结论

移动端 Store 分类问题的最佳解不是继续堆兜底，而是把 “**数据契约、状态模型、错误语义**” 一次拉齐到 Web 同级别稳定性，再保留移动端自己的交互形态。

---

## 九、实施记录（2026-03-18）

### P0 已完成

| 项                          | 实现                                                                                    |
| --------------------------- | --------------------------------------------------------------------------------------- |
| 1. fetchMarket 请求序列保护 | `marketRequestIdRef` + 每次调用递增，仅 `requestId === current` 时应用结果              |
| 2. 服务端可识别错误         | `getSkillList`、`getMcpList` catch 改为 `throw TRPCError`，不再返回空结构               |
| 3. 空态拆分 + 重试          | `marketFetchError` 状态；失败时展示「加载失败」+ 重试按钮；成功空结果展示「未找到扩展」 |

### P1 已完成

| 项                              | 实现                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Skill Explore 移除 builtin 混入 | 列表仅展示社区数据；builtin 仅出现在 Installed Tab；移除 `builtinMarketItems`、`buildBuiltinMarketItem`、`getSkillCategoryForFilter` |

### P1 未实施（需跨包重构）

- 共享 Skill/MCP 分类契约：需在 `packages/types` 或 `src/constants` 提炼 canonical 定义，App/Web 共同消费
