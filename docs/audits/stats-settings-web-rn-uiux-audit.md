# Web `/settings/stats` 与 RN 统计页 UI/UX 审计

**审计日期**: 2025-03-24

**范围**:

- **Web（SPA）**: `src/routes/(main)/settings/stats/index.tsx` 及其 `features/`（概览、热力图、排行、用量）
- **React Native**: `apps/mobile/src/screens/StatsScreen.tsx`（栈路由 `Stats`）
- **对照说明**: Web 在移动端视口下通过 `SettingsContent` 传入 `mobile`（见 `src/routes/(main)/settings/features/SettingsContent.tsx`），与 RN 为两套实现，仅语义上「对齐」。

---

## 1. 信息架构对照

| 区块                   | Web                                                                               | RN                                                                              | 备注                        |
| ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| 页标题                 | `SettingHeader` → `auth:tab.stats`（Statistics）                                  | `ScreenHeader` → `statsTitle`                                                   | 一致                        |
| 欢迎语 + 注册天数      | `Welcome`：`Trans` + 用户名 + 序数 / 数字天数                                     | 单行 `statsWelcome`，无用户名                                                   | RN **弱化个人化**           |
| 注册 / 活跃时间        | `TimeLabel` + `stats.createdAt` / `stats.updatedAt`                               | 图标 + `statsCreatedAt` / `statsUpdatedAt` 标签 + `formatDate`                  | 已对齐可读性                |
| 分享                   | `ShareButton` → 生成分享图 / 弹窗                                                 | **无**                                                                          | 跨端能力缺口                |
| 概览四卡               | 助手 → 话题 → 消息 → 词汇（`Grid`）                                               | 与 Web 同序（RN 已对齐）                                                        | —                           |
| 同比说明               | 卡片内「上月」+ `TitleWithPercentage`                                             | 卡片下环比 + 整组副标题「较上月」；上月为 0 时显示「新增」类文案，不再使用 `+∞` | 已缩小语义差距              |
| 活动热力图             | `@lobehub/charts` 全年热力图 + 月轴 + tooltip + 图例                              | 约 20 周简化网格 + 文案说明；**长按格子**弹出日期 / 消息数 / 强度               | RN 仍为精简版，已补可解释性 |
| 模型 / 助手 / 话题排行 | `BarList`，模型榜可 **全屏 Modal** 展开                                           | 固定 Top 5，**不可展开**                                                        | 长列表用户 Web 端更可扫     |
| 话题行交互             | `TopicsRank` 可 `navigate` 进话题（含 `mobile` 分支）                             | 点击话题行 → `ChatDetail`（`sessionId` 缺省为 inbox）                           | 已与 Web 意图对齐           |
| 用量统计               | 独立 `FormGroup`：`tab.usage` + 月选择 + 按模型 / 服务商分组 + Cards/Trends/Table | **整段缺失**                                                                    | **最大功能差**              |

---

## 2. Web 端体验要点

**优点**

- 信息分层清晰：「个人活跃概览」与「用量（按计费 / 消耗维度）」分块，符合「故事型统计 + 运营型用量」双目标。
- 热力图可解释性强（月份、tooltip、less/more 图例，`auth` + heatmaps 文案完整）。
- 排行与 `@lobehub/charts` 一致，空态有 `stats.empty.title` / `stats.empty.desc`。
- 分享能力强化传播与自我回顾场景。

**风险 / 可改进**

- **（已改进）** 四张 `Total*` 不再传入未使用的 `mobile`；小屏样式由 `StatisticCard` 内 `useResponsive()` 负责。
- 第二块「用量」依赖 `usageService.findAndGroupByDay`，与第一块消息统计 **数据源维度不同**；若需更强区分，可在 `tab.usage` 区块加一句说明文案（未做）。
- **（已改进）** `dateStrings` 初始为当月 `YYYY-MM`，`useClientDataSWR` 使用 `['usage-stat', dateStrings]` / `['usage-logs', dateStrings]` 作为 key，**切换月份自动重拉**，去掉对 `mutate` 的 `useEffect` 依赖。

---

## 3. RN 端体验要点

**优点**

- 下拉 `RefreshControl` 符合移动端预期；骨架 / 加载用 `ActivityIndicator` 分区明确。
- 四卡用色与 `primarySubtle` 统一，进度条排行 **扫读成本低**。
- 模型行用 CDN provider icon，失败回退缩写，鲁棒性较好。

**风险 / 可改进**

- **（已改进）** 使用 `Promise.allSettled`：若全部请求失败则顶部错误条 + 重试；部分失败仍展示可得数据。
- **（已改进）** 无注册天数时展示 `statsWelcomeFallback`，并保留创建 / 活跃日期（若有）。
- **（已改进）** 环比在上月为 0 且本月有量时展示本地化「新增」文案，不再显示 `+∞`。
- 文案中 **Avato** 为本产品品牌名，与 Web 端若使用不同 `BRANDING_NAME` 时需在各端各自维护，**非缺陷**。
- **（已改进）** 无标题排行项使用 `statsRankUntitled`，随语言切换。

---

## 4. 跨端一致性与产品缺口（摘要）

1. **RN 无「用量统计」整块**（Web 的 `tab.usage`）：若产品希望「一端能看的账单型数据另一端也能看」，需在 RN 规划等价入口或明确「仅 Web」。
2. **RN 无分享**：若统计页承担传播，RN 缺口明显。
3. **热力图信息量差**：两端都叫「活动」类能力时，建议 RN 至少在副标题或帮助文案中说明「为近 N 周简化视图」，避免用户以为数据丢失。
4. **概览卡与环比**：RN 已与 Web 对齐卡序，并增加「较上月」副标题；若需与 Web 卡片内「上月绝对值」完全一致，可再迭代。
5. **下钻**：RN 话题排行已支持进入 `ChatDetail`（与 Web 跳会话 + 话题一致，inbox 会话用常量兜底）。

---

## 5. 建议优先级（产品 / 设计）

| 优先级 | 项                        | 说明                                                       |
| ------ | ------------------------- | ---------------------------------------------------------- |
| ~~P0~~ | ~~RN 错误态~~             | ~~已做：全失败时顶栏下错误条 + 点击重试~~                  |
| ~~P0~~ | ~~环比与 `+∞`~~           | ~~已做：副标题 + 「新增」文案~~                            |
| ~~P1~~ | ~~欢迎区缺数据~~          | ~~已做：`statsWelcomeFallback`~~                           |
| ~~P1~~ | ~~四卡顺序~~              | ~~已与 Web 对齐~~                                          |
| P2     | RN 用量区块               | 若商业 / 用量为统一能力，评估原生图表或 WebView / 共享 API |
| P2     | RN 分享                   | 导出图片或系统分享 sheet                                   |
| ~~P3~~ | ~~热力图说明 / 长按详情~~ | ~~已做：副标题文案 + 长按 `Alert` + `accessibilityLabel`~~ |

---

## 6. 工程卫生（非 UI，但影响可维护性）

- **（已修复）** `ModelsRank.tsx` 内组件已正名为 `ModelsRank`。
- **（已修复）** `TotalAssistants.tsx` / `TotalTopics.tsx` 内部组件名已与文件语义一致。

---

## 7. 关键文件索引

- Web 入口: `src/routes/(main)/settings/stats/index.tsx`
- Web 文案: `src/locales/default/auth.ts`（`stats.*`, `tab.stats`, `tab.usage`, `heatmaps.*`）
- RN 页面: `apps/mobile/src/screens/StatsScreen.tsx`
- RN 文案: `apps/mobile/src/lib/i18n.ts`（`stats*` 字段）
- RN API: `apps/mobile/src/lib/api.ts`（`statsApi` 段）
