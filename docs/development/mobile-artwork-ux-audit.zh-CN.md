# 移动端 Artwork 页面 UX 优化审计

> 复核时间：2026-03-20\
> 范围：`apps/mobile/src/screens/ArtworkScreen.tsx` 及关联组件
>
> 执行摘要：
>
> - Mobile 已具备完整的生成主流程，但目前更像 “可用版”，距离 Web 的高频消费体验还差三个关键点：单图操作、全屏预览、失败重试。
> - 优先级应先解决 “看图、拿图、重试” 这类直接影响生成闭环的问题，再做空状态、侧边栏分组、下拉刷新等增强项。
> - `Topic` 切换不应被当作 Artwork 页面内的独立修补项，它更接近移动端会话历史模型的上层设计问题。

## 一、当前实现概览

ArtworkScreen 与 Web `/image` 对齐，提供：

- 模型选择、参考图、分辨率、宽高比、生成数量等配置
- 侧边栏（SlideInRight）配置面板
- 底部固定 Prompt 输入 + 生成按钮
- 生成结果以 BatchCard 展示，支持复制 Prompt、复用设置、删除批次

---

## 二、与 Web 端能力对比

| 能力         | Web                   | Mobile | 差距                        |
| ------------ | --------------------- | ------ | --------------------------- |
| 单张图片下载 | ✅                    | ❌     | 仅批次级操作，无单图下载    |
| 单张图片分享 | ✅（通过 ShareModal） | ❌     | 无法分享单张到社交 / 相册   |
| 复制 Seed    | ✅                    | ❌     | 无 Seed 展示与复制          |
| 保存到资源库 | ✅                    | ❌     | 无「保存到资源」入口        |
| 大图预览     | ✅                    | ❌     | 点击图片无全屏预览          |
| Topic 切换   | ✅                    | ❌     | 无多 Topic 历史，仅当前会话 |
| 配置持久化   | ✅                    | ✅     | AsyncStorage 已支持         |
| 键盘避让     | N/A                   | ✅     | 已实现                      |

---

## 三、UX 优化建议（按优先级）

### 3.1 高优先级

#### 1. 单张图片操作：下载、分享

**现状**：BatchCard 仅有「复用设置 / 复制 Prompt / 删除批次」，无法对单张图片操作。

**建议**：

- 在每张成功图片上增加长按菜单或操作图标（下载、分享）
- 优先复用 `ResourceScreen` / `MessageBubble` 现有的下载与 `Share.share` 流程，避免再引入一套平行交互
- 参考 Web：`GenerationItem/ActionButtons` 的 Download 行为

**实现要点**：

- 使用 `getApiUrl()` + `/f/${fileId}` 或 `asset.url` 作为下载 URL
- 下载、分享、权限申请尽量复用现有移动端文件处理栈，不在 Artwork 页面重复实现一套权限分支

#### 2. 单张图片全屏预览

**现状**：图片仅在小格内展示，无法放大查看细节。

**建议**：

- 点击成功图片进入全屏 Modal 预览
- 支持双指缩放、滑动关闭
- 预览内提供下载、分享快捷入口

**实现要点**：

- 使用 `Modal` + `Image` 或 `expo-image` 全屏展示
- 优先抽离通用 `ImagePreviewModal`，若已有文件预览模式可复用，则避免在 Artwork 里再做一套专用预览器

#### 3. 失败生成重试

**现状**：失败时仅显示「Failed」文案，无重试入口。

**建议**：

- 在失败格内增加「重试」按钮
- 重试时复用当前 batch 的 prompt、model、params，仅重新调用 `createImage`
- 触发重试后应有明确的 loading /disabled 状态，避免重复提交

**实现要点**：

- 新增 `onRetry` 回调，传入 `batch`，从 `batch.config` 恢复参数并调用 `handleGenerate`

---

### 3.2 中优先级

#### 4. 参考图在主界面可见性

**现状**：参考图仅在侧边栏内展示，主界面无提示。

**建议**：

- 在 Prompt 输入栏上方或模型栏旁显示参考图缩略图（1–2 张）
- 点击可进入侧边栏编辑或移除
- 减少用户「是否已选参考图」的困惑

#### 5. 空状态引导增强

**现状**：EmptyState 仅有标题 + 描述，无操作引导。

**建议**：

- 增加「示例 Prompt」快捷填充（如「A cute cat in a garden, oil painting style」）
- 或提供 2–3 个预设标签，点击填充到输入框
- 首次进入可展示简短引导（如「输入描述，选择模型，点击生成」）

#### 6. 配置侧边栏可折叠区块

**现状**：侧边栏内容较长，需大量滚动，模型列表、参考图、分辨率等混在一起。

**建议**：

- 将「模型」「参考图」「分辨率 / 宽高比」「高级参数」分块，支持折叠 / 展开
- 默认展开「模型 + 参考图」，其余折叠
- 减少认知负担，常用项更易触达

#### 7. 无模型时的明确提示

**现状**：`loadModels` 失败时静默，用户可能不知道需配置 Provider。

**建议**：

- 当 `imageProviders.length === 0` 时，在模型栏或空状态显示「暂无可用模型，请前往设置启用图片生成服务」
- 提供跳转 Settings 的按钮（若路由支持）

---

### 3.3 低优先级

#### 8. 生成进度可视化

**现状**：轮询时仅有 ActivityIndicator + StatusBadge，无进度百分比。

**建议**：

- 若 API 返回进度（如 0–100），展示进度条
- 若无，可展示「预计还需约 X 秒」等文案（基于历史耗时估算）

#### 9. 下拉刷新

**现状**：轮询自动更新，但用户无法手动触发刷新。

**建议**：

- 在 ScrollView 上增加 `RefreshControl`，下拉时重新拉取当前 topic 的 batches
- 适用于网络抖动或服务端延迟更新的场景，但优先级低于 “单图操作 / 预览 / 重试”

#### 10. 复制 Seed

**现状**：Web 支持复制 Seed，Mobile 无。

**建议**：

- 在 BatchCard 的 Meta 区域或单图操作菜单中展示 Seed（若有）
- 提供复制 Seed 入口，便于复现生成结果

#### 11. 保存到资源库

**现状**：Web 可将生成图保存到资源库，Mobile 无。

**建议**：

- 在单图操作菜单中增加「保存到资源库」
- 调用 `fileApi` 或 Lambda 接口，将 generation 关联的 file 加入用户资源 / 知识库

#### 12. 无障碍与语义

**建议**：

- 为生成按钮、模型选择、侧边栏关闭等增加 `accessibilityLabel`
- 确保屏幕阅读器能正确描述各操作

---

## 四、实现优先级矩阵

| 优化项            | 用户价值 | 实现成本       | 建议优先级 |
| ----------------- | -------- | -------------- | ---------- |
| 单图下载 / 分享   | 高       | 中             | P0         |
| 单图全屏预览      | 高       | 低             | P0         |
| 失败重试          | 高       | 低             | P0         |
| 参考图主界面可见  | 中       | 中             | P1         |
| 空状态示例 Prompt | 中       | 低             | P1         |
| 侧边栏折叠区块    | 中       | 中             | P1         |
| 无模型提示        | 中       | 低             | P1         |
| 生成进度          | 低       | 高（依赖 API） | P2         |
| 下拉刷新          | 低       | 低             | P2         |
| 复制 Seed         | 低       | 低             | P2         |
| 保存到资源库      | 低       | 中             | P2         |
| 无障碍            | 中       | 低             | P2         |

---

## 五、相关文件索引

| 模块              | 路径                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| Artwork 主屏      | `apps/mobile/src/screens/ArtworkScreen.tsx`                          |
| Artwork Store     | `apps/mobile/src/store/artwork.ts`                                   |
| Artwork API       | `apps/mobile/src/lib/api.ts`（artworkApi）                           |
| Web 图片生成项    | `src/routes/(main)/image/features/GenerationFeed/GenerationItem/`    |
| Web 下载 Hook     | `src/hooks/useDownloadImage.ts`                                      |
| 移动端分享 / 下载 | `apps/mobile/src/components/ui/MessageBubble.tsx`（Share、Download） |
| EmptyState        | `apps/mobile/src/components/ui/EmptyState.tsx`                       |
