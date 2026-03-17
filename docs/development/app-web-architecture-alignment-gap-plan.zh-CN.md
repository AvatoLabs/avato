# App / Web 架构对齐差距总表（2026-03）

本文档是移动端 App 与 Web 端 “架构级对齐” 总表。目标不是列 UI 小问题，而是明确：

1. 数据契约是否一致
2. 会话 / 消息生命周期是否一致
3. 渲染语义是否一致
4. 能力边界是否一致

相关详细审计文档：

- `docs/development/chat-sync-app-web-audit.zh-CN.md`
- `docs/development/group-chat-app-web-gap-audit.zh-CN.md`
- `docs/development/skill-mcp-category-app-web-audit.zh-CN.md`

---

## 0. 重新审计更新（2026-03-18）

本轮按代码路径重新审计后，状态更新如下：

### 0.1 本轮确认已落地

1. **默认模型链路补强（部分达成）**

- `apps/mobile/src/store/model.ts`
  - 读取优先级已改为：session/group -> server default + user default -> runtime enabled fallback。
  - 全局选模会写回 `user.settings.defaultAgent.config`。
- `apps/mobile/src/store/chat.ts`
  - 发送前会走 defaultAgent fallback，且可通过 `model -> provider` 反推 provider。

2. **群聊消息写入契约兜底仍在**

- `apps/mobile/src/store/chat.ts` 的 `buildMessageContainerParams`
- `apps/mobile/src/lib/api.ts` 的 `normalizeCreateMessageParams`
- `src/server/routers/lambda/message.ts` 的 `createMessage` 归一化

3. **文件下载能力从 “打开链接” 升级为真实下载**

- `apps/mobile/src/lib/api.ts`：`fileApi.download` 使用 `FileSystem.createDownloadResumable`
- `apps/mobile/src/screens/ResourceScreen.tsx` 与 `apps/mobile/src/components/ui/MessageBubble.tsx` 已调用下载流程

4. **预加载内建技能已存在**

- `apps/mobile/src/constants/recommendedBuiltins.ts`
- `apps/mobile/src/screens/ChatDetailScreen.tsx`（打开技能面板时先 preload）

### 0.2 本轮确认仍未对齐

1. **Server 侧图片出站净化未形成统一兜底**

- 当前主要在 mobile client `apps/mobile/src/lib/api.ts` 做 sanitizer。
- `src/app/(backend)/webapi/chat/[provider]/route.ts` 未见等价的 “非法 image_url 统一净化” 最终闸口。

2. **消息解析仍未与 Web 同源**

- App 仍以 `normalizeMessage` 为主（`apps/mobile/src/lib/api.ts`），仅做 children 递归。
- 未引入 Web 的 `conversation-flow parse()` 语义层，`compareGroup/compressedGroup/tool/search/citation` 的对齐仍靠局部补丁。

3. **群聊 settle 判定仍是高复杂度启发式**

- `apps/mobile/src/store/chat.ts` 中 group polling 逻辑仍包含大量 “兜底 + 重试 + byId 判定”。
- 虽有改善，但仍可能出现 `group completed but assistant not settled` 类型告警（尤其在后端落库时序波动时）。

4. **数据库迁移一致性仍是运行前提**

- 若目标环境未完成 `sessions.tag_id` 等迁移，`agent.getAgentConfig` 等路径仍可能 500。
- 这不是前端逻辑问题，但会表现为 App 端 “配置 / 会话异常”。

---

## 一、当前状态（已完成）

以下项目已具备 “基础可用” 的架构对齐，不再是主阻塞：

1. 群聊消息持久化参数：`groupId/sessionId` 三层兜底（Store/API/Server）已加。
2. 会话与消息基础 focus 刷新：ChatDetail 等核心页面已补焦点拉取。
3. 商店分类基础归一化：MCP/Skill key 映射与固定兜底已加入。
4. 图片消息 SSRF 兜底：出站 sanitizer 已加入（非法图片 URL 不再直接外发）。
5. **默认模型决策链**：DEFAULT_AGENT_CONFIG、server default、user default 优先级链已对齐 Web。
6. **群聊 settle 判定**：结构化判定 + 信任 `operationStatus.isCompleted`，与 Web 语义对齐。

> 注意：这些 “已完成” 不代表体验已与 Web 1:1，仅代表核心链路不再是明显错误状态。

---

## 二、仍未对齐的核心差距（按优先级）

## P0（必须先修）

1. **默认模型决策链** —— ✅ 已修复

- 已实施：`DEFAULT_AGENT_CONFIG` 兜底、`configApi.getDefaultAgentConfig`、user default 有效性校验、`resolveProviderByModel`。详见 `default-model-app-web-audit.zh-CN.md`。

2. **群聊 settle 判定** —— ✅ 已修复

- 已实施：`isGroupAssistantSettled` 支持 compressedGroup.compressedMessages、compareGroup 递归；`findSettledGroupAssistant` 递归搜索；当 `operationStatus.isCompleted` 时信任后端，按 id 查找 assistant 视为 settled。详见 `group-chat-app-web-gap-audit.zh-CN.md` 4.5 节。

3. **群聊 / 普通会话标题同步不一致**

- 现象：Web 有总结标题，App 仍显示默认标题；或跨端不同步。
- 根因：App 端标题生成触发条件、刷新时机、后端错误处理不完全一致。
- 需要对齐：
  - 统一默认标题识别集
  - 标题生成后强制刷新 session 列表与当前会话
  - 失败日志与用户提示区分（不要吞错误）

## P1（结构对齐）

1. **消息渲染语义未与 Web 同源**

- 现象：工具调用过程、搜索过程、引用 `[n]`、group/compressed 结构显示不完整。
- 根因：App 仍主要依赖 `normalizeMessage`，未完整使用 Web 端 conversation-flow parse 语义。
- 需要对齐：
  - 引入等价 parser（或直接复用 conversation-flow）
  - MessageBubble 输入统一为 “已解析结构”，而非临时拼接字段

2. **文件 / 文档能力链路仍是 “半真半假”**

- 现象：上传可成功，但下载与消息附件操作能力弱；文档抽取失败时模型感知差。
- 根因：
  - Resource “下载” 历史上偏向打开链接而非稳定本地下载
  - Chat 内 file 附件交互能力不完整
  - 文档抽取失败 fallback 语义弱（仅 URL 提示）
- 需要对齐：
  - 统一 “下载到本地 + 打开 + 分享” 能力
  - Chat 附件支持点击操作
  - 文档抽取失败给出结构化 fallback（而不是丢语义）

3. **群聊功能矩阵缺失（Profile / 成员 /@/DM/ 线程）**

- 现象：Web 群聊完整，App 仅基础发送。
- 需要对齐：
  - Group Profile 页面
  - 成员管理
  - @ 提及
  - DM 选项（若产品继续保留）
  - 线程 / 分支视图（按产品优先级）

## P2（体验与运营能力）

1. **Skills/MCP 预加载能力与 Web 不一致**

- 现象：App 看不到与 Web 一致的预加载技能集或推荐入口。
- 需要对齐：
  - 预加载清单同源配置化
  - 安装状态和默认启用策略一致

2. **Store 统计与分类呈现细节**

- 现象：大数量展示、分类 pill 宽度、列表可读性有差异。
- 需要对齐：
  - 计数格式化（`12.3k` / `1.2w` 等）
  - pill 自适应宽度与截断策略

---

## 三、对齐原则（必须遵守）

1. **服务端真值优先**：model/provider、session/group 元数据均以后端状态为准。
2. **单一解析源**：App 与 Web 必须共享同一消息语义解析层，不各自 “猜结构”。
3. **单一出站边界**：多模态消息只在最终 dispatch 前做净化，不在多入口散落特判。
4. **回退可解释**：任何 fallback 必须可记录（debug log）且不会覆盖用户显式选择。

---

## 四、落地路线图

## Milestone A（P0）

1. ~~固化模型选择优先级链，移除隐式回落覆盖。~~ ✅ 已实施
2. ~~群聊 settle 判定改为结构化判定，与 Web 同源。~~ ✅ 已实施
3. 标题总结触发与同步全链路打通。

**验收**：

- ~~新会话不再无故回落 Claude。~~ ✅
- ~~群聊发送不再出现连续 settle failure。~~ ✅
- Web 改标题后 App 在一次 focus 内可见，反之亦然。

## Milestone B（P1）

1. 接入统一消息 parser（包含 compare/compressed/group/tool/search/citation）。
2. 文档上传 / 下载 / 附件交互链路补全。
3. 群聊 Profile + 成员管理最小可用版本。

**验收**：

- 相同会话在 Web 与 App 的结构渲染语义一致。
- 文档在 Chat 与 Resource 两处行为一致。

## Milestone C（P2）

1. Skills/MCP 预加载与推荐同源化。
2. 商店分类与计数体验打磨。
3. 回归测试基线建立（关键链路 E2E + 日志面板）。

---

## 五、风险与依赖

1. **DB schema 漂移风险**：部署节点若未完成迁移，会导致 `agent.getAgentConfig` 等查询 500（如 `sessions.tag_id`）。
2. **第三方依赖波动**：QStash、SSRF 策略、OIDC 环境不齐会放大 “看似前端” 问题。
3. **多端并行改动风险**：App 与 Web 同时改消息结构时，必须先锁定共享 contract，再分端实现。

---

## 六、执行约束

1. 每次修复必须同时给出：

- 影响范围（Web/App/Server）
- 回滚点
- 验证日志关键字

2. 每个 P0/P1 任务必须提供：

- 最小复现步骤
- 修复前后行为对比
- 跨端一致性截图或日志证据
