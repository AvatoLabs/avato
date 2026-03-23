# React Native「商店 / 扩展」页 UI/UX 审计报告

**审计日期**: 2025-03-24

**审计范围**:

- 主实现：`apps/mobile/src/screens/StoreScreen.tsx`（底部 Tab `Store`，顶栏标题 `t.tabStore`）
- 依赖 UI：`ScreenHeader`、`SearchField`、`SegmentedControl` / `FilterChip` / `MetaTag`（`ChoiceControls.tsx`）、`CardSkeleton`、`EmptyState`、`PressableScale`
- 路由：`apps/mobile/src/navigation/index.tsx` → `Tab.Screen` `name="Store"`
- 文案键：`apps/mobile/src/lib/i18n.ts` 中 `store*`、`skillsCustomMcp*`、`accessibilityAddStore` 等

**不含**：Web 端插件市场、桌面端商店、会话内智能体选择器（仅作边界说明）。

---

## 1. 信息架构

### 1.1 层级结构

| 层级        | 内容                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| 顶栏        | `ScreenHeader`（`headerLevel="root"`）：标题 `t.tabStore`；右侧搜索开关 + 「添加」`Plus`         |
| 一级分段    | **探索** / **已安装**（`SegmentedControl`）；已安装数量大于 0 时标签为 `已安装 N`                |
| 探索内二级  | **MCP** / **Skills**（横向固定宽度容器内的 `SegmentedControl`）                                  |
| 探索内三级  | 分类 `FilterChip` 横滑（含「全部」及接口 / 快照合并后的分类）                                    |
| 列表        | 探索：`FlatList` + `ItemCard`；已安装：`FlatList` + `InstalledRow` + 分隔线                      |
| 详情 / 操作 | `StoreItemModal`（底部上滑）：简介、标识、类型标签、安装 / 移除                                  |
| 添加入口    | `Modal` 底部菜单：URL / GitHub / ZIP / 自定义 MCP；另有 `SimpleImportModal`、`AddCustomMcpModal` |

文件头注释与实现一致：管理动作集中在商店内完成，不另开栈页面（除系统级文件选择等）。

### 1.2 心智模型与命名

- Tab 与顶栏均使用 `**t.tabStore`（商店）\*\*，列表与空状态文案使用 **「扩展 /extensions」**（如 `storeEmpty`、`storeSearch` placeholder）。对英文用户尚可；中文下「商店」与「扩展」略像两个产品概念，**建议在文案规范中统一主称谓**（例如统一为「扩展商店」或统一用「插件与技能」）。
- **已安装** Tab 混合三类：**推荐内置技能**（来自 `MOBILE_RECOMMENDED_BUILTIN_SKILLS` + 用户 `uninstalledBuiltinTools`）、**插件（含自定义 MCP）**、**技能（市场 / 导入 / 内置 API 列表）**。列表通过 `mergeSkillLists` 去重，逻辑正确但 **用户无分段**，长列表时扫描成本较高。

---

## 2. 搜索体验（高优先级）

### 2.1 同一搜索框、两种行为

- **探索**：`appliedSearchQuery` 仅在输入框 `**onSubmitEditing`（键盘「搜索」）\*\* 时更新，进而触发 `fetchMarket` / `fetchCategories`。仅输入不提交 **不会** 拉取新数据。
- **已安装**：`filteredInstalled` 直接使用 `**searchQuery`（实时过滤）\*\*，与是否提交无关。

**风险**：用户从「已安装」切到「探索」时，若习惯「边输边看」，会发现列表不变；反之从「探索」到「已安装」可能误以为要按搜索键才生效。**建议**：在探索态增加明确提示（如副文案「按搜索确认」）、或探索也支持 debounce 实时搜、或两 Tab 统一一种模式并在切换时重置 / 同步状态。

### 2.2 空状态未区分「无数据」与「无匹配」

探索与已安装在无列表时均使用 `**t.storeEmpty`（No extensions found）\*\*。当 **已安装有数据但筛选为空**、或 **探索有总量但当前搜索无结果** 时，用户无法区分是「库里没有」还是「关键词不对」。**建议**：增加 `storeSearchNoResults` 类副本，并在 `filteredInstalled.length === 0 && allInstalled.length > 0` 等条件下分支展示。

### 2.3 无障碍与清除按钮

搜索栏右侧 `X`：`TouchableOpacity` **未设置 `accessibilityLabel`**，读屏用户难以区分「清空输入」与「关闭搜索」两种路径（清空后再次点 X 会关闭搜索区，逻辑在代码中成立但缺少语义）。

---

## 3. 视觉与组件一致性

### 3.1 硬编码英文标签

`ItemCard` 中 `MetaTag` 使用字面量 `**'MCP'` / `'Skill'**`（见 `StoreScreen.tsx`），**未走 i18n**；与详情模态里使用 `t.storeMcp` / `t.storeSkills` 不一致。**建议**：改为 `t.storeMcp` 与 `t.storeSkills`（或单独短标签键）。

### 3.2 复用资源文案

列表底部「加载更多」已改用 **`t.storeLoadMore`**。

### 3.3 未使用的 i18n 键（已处理）

`storeFeatured`、`storeManage` 已从移动 `TranslationKeys` 与三语文案中移除。

### 3.4 Modal 遮罩与圆角（部分处理）

「添加扩展」菜单遮罩已与 `SimpleImportModal` 等对齐为 **`bg-black/40`**。圆角仍为 `rounded-t-3xl` / `rounded-t-2xl` 混用，若需完全统一可再收一次 token。

### 3.5 破坏性色（已处理）

详情移除按钮已改为 **`colors.danger` / `dangerSubtle`**。

---

## 4. 交互与反馈

### 4.1 触摸目标

`ItemCard` 右侧安装 / 已装状态为 **约 28×28** 的圆形按钮。低于常见 **44pt** 推荐命中区，且与整卡 `PressableScale`（`accessibilityRole="button"`）嵌套 **子 `TouchableOpacity`**，可能带来 **读屏焦点重复或手势冲突**。**建议**：扩大 `hitSlop` 或改为行内主按钮样式；为安装动作单独 `accessibilityLabel`（如「安装 xxx」）。

### 4.2 加载与刷新

- 探索列表 `RefreshControl` 的 `refreshing={marketLoading}` 与首屏加载共用同一状态，**下拉刷新与初次进入可能同为 loading**，体验上可接受但需确认是否会出现短暂「无法区分」的转圈。
- **触底加载**（`onEndReached`）与底部 **「加载更多」按钮** 并存，存在 **短时间重复请求** 的理论可能（虽 `loadMoreMarket` 有 guard）。若用户反馈重复加载，可择一为主交互。

### 4.3 触觉反馈

列表项进入详情、`ItemCard` 安装链路等已使用 `haptics`；顶栏分段、`FilterChip`、`SegmentedControl` 等与项目其他屏一致度较高。**已安装行 `InstalledRow`** 未单独设置 `accessibilityLabel`（仅依赖子文本），长列表时建议至少合并读出标题与类型标签。

### 4.4 网络失败与离线快照

`fetchMarket` 失败时会 **回退到 `marketSnapshotRef` 本地快照** 并 `toast` `storeLoadFailed`，空态提供重试。策略清晰；**分类接口 `fetchCategories` 在 `catch` 中静默失败**，仅依赖已有 / 推导分类，用户无感知。**建议**：开发模式下 log，或首次全失败时轻提示「分类暂不可用」。

---

## 5. 复杂表单（自定义 MCP）

`AddCustomMcpModal` 内嵌 **快速粘贴 JSON**、基础字段、**测试连接**、**高级**（Headers / 描述 / 头像）与保存，功能完整。

**UX 观察**：

- 长表单 + `ScrollView` + 键盘，已使用 `keyboardShouldPersistTaps="handled"`，合理。
- **测试失败**仅文案区分，无错误详情；对高级用户可接受，排障时可能希望展示服务端返回摘要（需注意脱敏）。
- 与 **会话设置 / Web** 的 MCP 配置若存在文案差异，建议在文档中标注「以 RN 商店为准」或对齐关键术语（identifier、streamable 等）。

---

## 6. 数据与性能（简要）

- 单文件 **约 2500+ 行**，含多种 Modal 与子组件，**可维护性与 Code Review 成本高**；后续可考虑拆出 `StoreItemModal`、`AddCustomMcpModal`、`useStoreMarket` 等，不改变产品行为。
- `MOBILE_RECOMMENDED_BUILTIN_SKILLS` 与 API 内置列表通过 `builtinIdsAlreadyShown` 去重，避免双行展示，逻辑合理。

---

## 7. 建议优先级汇总

| 优先级 | 项                                                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------- |
| P0     | 探索 vs 已安装 **搜索行为不一致**；空状态 **未区分无数据 / 无匹配**                                  |
| P1     | `ItemCard` **MCP/Skill 硬编码英文**；安装按钮 **命中区与无障碍嵌套**                                 |
| P2     | 清理或落地 `**storeFeatured` / `storeManage`\*\*；**加载更多**文案域统一；Modal 遮罩 / 圆角 token 化 |
| P3     | 已安装列表 **按类型分组**或筛选 Chip；分类接口失败 **弱提示**                                        |

**后续实现（2025-03-24 起）**：P0/P1 已改 `StoreScreen` + i18n；P2 已移除未用 `storeFeatured` / `storeManage`、`storeLoadMore`、添加菜单 Modal 遮罩与 `SimpleImportModal` 等对齐为 `bg-black/40`；P3 已增加「已安装」横滑类型 Chip（全部 / 内置 / MCP / 技能）、`storeInstalledKindEmpty` 空态，以及分类接口失败时每数据源一次 `info` Toast（`storeCategoriesLoadHint`）。

---

## 8. 参考代码锚点

- 主屏布局与搜索：`StoreScreen.tsx` 中 `export default function StoreScreen` 返回的 `ScreenHeader` + `SearchField` + 双 `FlatList`
- 搜索提交 vs 实时过滤：`appliedSearchQuery` / `onSubmitEditing` vs `filteredInstalled` 对 `searchQuery` 的依赖
- 探索请求与错误回退：`fetchMarket`、`marketSnapshotRef`
- 卡片类型标签：`ItemCard` 内 `MetaTag` 已使用 `t.storeMcp` / `t.storeSkills` / `t.storeBuiltIn`
