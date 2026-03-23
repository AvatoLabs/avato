# React Native 引用号链接未渲染审计报告

**审计日期**: 2025-03-23\
**审计范围**: `apps/mobile` 中 `[1]`、`[^1^]`、`[^1]` 等引用号未正确渲染为可点击链接的问题\
**相关组件**: MessageBubble、injectCitationLinks、Markdown、RichContentPartsBlock、CompareGroupBlock\
**含**: Web 与 RN 的深度对比

**修复状态** (2025-03-23): CompareGroupBlock 已改为使用 `markdownRules`，引用链接在群聊 Compare 模式下可正确渲染。

---

## 1. 引用链接处理流程

### 1.1 支持的引用格式

| 原始格式 | 转换后（有 citations 时） | 说明                           |
| -------- | ------------------------- | ------------------------------ |
| `[^1^]`  | `[^1^](url)`              | 标准引用格式                   |
| `[^1]`   | `[^1](url)`               | 简写格式                       |
| `[1]`    | `[\[1\]](url)`            | 数字引用，label 中 `[]` 需转义 |

**位置**: `MessageBubble.tsx` 约 1827–1846 行，`injectCitationLinks`

### 1.2 依赖条件

`injectCitationLinks(content, citations)` 仅在 `citations?.length > 0` 时进行转换；否则返回原 `content`。

- `citations` 来自 `message.search?.citations`
- `message.search` 由 SSE `grounding` 事件经 `onSearch` 回调写入

---

## 2. 问题分析

### 2.1 根因 1：citations 缺失或时机滞后

| 场景                            | 行为                      | 结果                                             |
| ------------------------------- | ------------------------- | ------------------------------------------------ |
| grounding 事件未发送            | `message.search` 为空     | `injectCitationLinks` 返回原串，`[1]` 保持 `[1]` |
| grounding 晚于 text 到达        | 首帧渲染时 citations 为空 | 首帧 `[1]` 不转链接；后续 state 更新后应正确     |
| `/webapi/chat` 不支持 grounding | 服务端未 emit grounding   | 移动端始终无 citations                           |

**服务端 grounding 支持**（`src/server/services/mobileChat/index.ts`）：

- `streamToolLoopFallback`: `onGrounding`、`onCompletion` 中写入 `roundGrounding`，`writeEvent('grounding', roundGrounding)`
- `createStaticSSETextResponse`: 若 `params.assistant?.grounding` 存在则写入
- 依赖上游 provider/runtime 返回 grounding 数据

### 2.2 根因 2：CompareGroupBlock 使用 codeInlineRules（已修复）

**位置**: `MessageBubble.tsx` 约 544 行

- 已改为 `rules={markdownRules ?? codeInlineRules}`，父级传入 `markdownRules` 时使用完整规则（含 link、onLinkPress）
- 群聊 Compare 模式下的子消息现在可与主气泡一致地渲染引用链接

### 2.3 根因 3：RichContentPartsBlock 的 rules 回退

**位置**: `MessageBubble.tsx` 约 1930–1932 行

```tsx
<Markdown
  rules={markdownRules ?? codeInlineRules}
  ...
>
  {injectCitationLinks(part.text, citations)}
</Markdown>
```

- 父级传入 `markdownRules` 时使用完整规则（含 link）
- 若 `markdownRules` 为 `undefined`，会回退到 `codeInlineRules`，与 CompareGroupBlock 相同风险

### 2.4 根因 4：react-native-markdown-display 解析

- 库使用 markdown-it 解析
- 自定义 `link` 规则依赖 `node.attributes?.href`、`node.children`
- 若库生成的 AST 结构与预期不符，自定义 link 可能不生效

### 2.5 根因 5：`[1]` 转义后的 markdown 合法性

```ts
// [1] → [\[1\]](url)
return `[${escapeMarkdownLinkLabel(token)}](${citation.url})`;
```

- `escapeMarkdownLinkLabel` 将 `[` → `\[`，`]` → `\]`
- 输出 `[\[1\]](url)`：label 为 `\[1\]`，应渲染为 `[1]`
- 部分解析器对嵌套转义处理不同，存在兼容性风险

---

## 3. 调用路径检查

| 路径                                      | injectCitationLinks                               | 使用的 rules                     | 链接渲染风险 |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------- | ------------ |
| 主消息正文                                | ✅ `message.content`, `message.search?.citations` | markdownRules                    | 低           |
| 主消息 reasoning                          | ✅                                                | markdownRules（ThinkingBlock）   | 低           |
| 长文折叠预览                              | ✅                                                | markdownRules                    | 低           |
| RichContentPartsBlock（多模态 text part） | ✅ `part.text`, `citations`                       | markdownRules ?? codeInlineRules | 中（回退时） |
| CompareGroupBlock 子消息                  | ✅ `child.content`, `child.search?.citations`     | **markdownRules**（已修复）      | 低           |
| AssistantChainBlock 子消息                | ✅                                                | markdownRules                    | 低           |

---

## 4. 建议修复

### 4.1 高优先级：CompareGroupBlock 使用 markdownRules（✅ 已修复）

CompareGroupBlock 现已接收并传入 `markdownRules`，与主消息一致使用含 link 规则和 `onLinkPress` 的完整规则。

### 4.2 中优先级：确认 grounding 与 citations 的完整性

1. 抓包验证 `/webapi/chat` SSE 是否包含 `event: grounding`
2. 检查 `grounding.citations` 结构是否符合 `CitationItem[]`（含 `url`、`title` 等）
3. 若 provider 不返回 grounding，在 UI 上明确降级（如引用号保持纯文本）

### 4.3 低优先级：citations 缺失时的降级展示

- 当 `citations` 为空但内容含 `[1]`、`[^1^]` 时，可考虑：
  - 保持现状：展示为纯文本
  - 或：渲染为不可点击的样式化引用号，避免误以为可点击

---

## 5. Web 与 RN 深度对比

### 5.1 架构差异

| 维度               | Web                                                                                               | RN                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Markdown 组件**  | `@lobehub/ui` Markdown                                                                            | `react-native-markdown-display`                                              |
| **引用处理方式**   | 将 `citations`、`enableCustomFootnotes`、`showFootnotes` 传给 Markdown，库内部处理                | 手动 `injectCitationLinks(content, citations)` 做字符串替换，再传入 Markdown |
| **解析器**         | remark/rehype（unified 生态）                                                                     | markdown-it                                                                  |
| **API 入口**       | tRPC `sendMessageInServer` + 客户端 execAgentRuntime（fetch-sse + model-runtime）                 | `/webapi/chat/${provider}`（MobileChatService）                              |
| **grounding 来源** | StreamingHandler 解析 `chunkType: 'grounding'` → `onGroundingUpdate` → `updateMessage { search }` | SSE `event: grounding` → `onSearch` → store 合并 `message.search`            |

### 5.2 引用链接实现差异

| 环节               | Web                                                                                | RN                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **内容预处理**     | 无；原始 content 直接给 Markdown                                                   | `injectCitationLinks` 将 `[^1^]`、`[^1]`、`[1]` 替换为 `[text](url)`                         |
| **citations 传递** | `useMarkdown` 从 store 取 `search?.citations`，作为 `citations` prop 传给 Markdown | 各渲染路径显式传 `message.search?.citations` 给 `injectCitationLinks`                        |
| **链接渲染**       | Markdown 库内部根据 citations 将引用号渲染为可点击链接                             | 依赖预生成的 `[text](url)` 被 markdown-it 解析为 link，再由自定义 `link` rule 处理 `onPress` |
| **脚注区**         | `showFootnotes` 控制库内置脚注列表是否展示                                         | 自定义 `SearchGroundingBlock`、`CitationFootnotesBlock` 单独渲染引用卡片                     |

### 5.3 调用路径对比

**Web 主消息**（`MessageContent` → `DisplayContent` → `MarkdownMessage`）：

```
content (原始) + markdownProps { citations, enableCustomFootnotes, showFootnotes }
  → @lobehub/ui Markdown
  → 库内部：根据 citations 映射 [1] → 链接
```

**RN 主消息**（`MessageBubble`）：

```
injectCitationLinks(message.content, message.search?.citations)
  → 得到含 [1](url) 的字符串
  → preprocessMathBlocks → preprocessMentionDisplay
  → Markdown (markdownRules) children
```

### 5.4 数据流对比

| 阶段               | Web                                                                                 | RN                                                         |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **grounding 接收** | fetch-sse /model-runtime protocol 解析 grounding chunk                              | SSE `createSSEChunkParser` 解析 `event: grounding`         |
| **写入 store**     | `internal_dispatchMessage({ type: 'updateMessage', value: { search: grounding } })` | `set(m => m.id === assistantMsgId ? { ...m, search } : m)` |
| **读取**           | `useMarkdown` 内 `dataSelectors.getDbMessageById(id)` 取 `search`                   | `message.search` 从 `messagesBySession` 传入               |
| **时序**           | 与 text 同一流，chunk 顺序由 protocol 决定                                          | `grounding` 与 `text` 为不同 SSE 事件，顺序依赖服务端写入  |

### 5.5 多模态 / 富内容

| 场景                   | Web                                                                           | RN                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **多模态 content**     | `RichContentRenderer` 渲染 `deserializeParts` 的 parts                        | `RichContentPartsBlock` 遍历 parts，对 `type: 'text'` 使用 `injectCitationLinks(part.text, citations)` |
| **图片搜索结果引用**   | `ImageSearchRef` rehype 插件：`image_0.png` → `<image-search-ref>` 自定义组件 | 无对应插件；依赖 `search.imageResults` 在 `SearchGroundingBlock` 中展示                                |
| **Thinking/Reasoning** | `Thinking` 接收 `citations` prop，传给内层 Markdown                           | `ThinkingBlock` 使用 `injectCitationLinks(reasoning.content, citations)`                               |

### 5.6 差异导致的风险

| 风险                   | Web                                              | RN                                                                                            |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| **citations 缺失**     | 库可能做降级（如纯文本引用号）                   | `injectCitationLinks` 直接返回原 content，`[1]` 不变，需依赖 Markdown 将 `[1]` 解析为某种形式 |
| **rules 不一致**       | 单一 Markdown 入口，统一 props                   | CompareGroupBlock 已改用 markdownRules，与主气泡一致                                          |
| **link 点击**          | 库内置，通常用 `<a href>` 或等效                 | 自定义 `link` rule 的 `onPress` + `openUrl`，CompareGroupBlock 已传入 markdownRules           |
| **showFootnotes 逻辑** | `search.citations.length > 0` 等条件控制脚注展示 | 无 showFootnotes；用 `SearchGroundingBlock`、`CitationFootnotesBlock` 独立实现                |

### 5.7 对齐建议

1. **统一引用处理**：RN 可考虑将「引用转链接」逻辑收敛到单一入口，避免各路径传参不一致。
2. **CompareGroupBlock**：✅ 已对齐主气泡，使用含 `link` 规则的 `markdownRules`。
3. **grounding 契约**：与 Web 端约定同一 grounding 结构，确保 `/webapi/chat` 与 tRPC chat 的 grounding 格式一致。
4. **脚注区**：明确 Web `showFootnotes` 与 RN `SearchGroundingBlock` 的展示逻辑是否应对齐。

---

## 6. 文件索引

| 路径                                                                         | 职责                                                                           |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **RN**                                                                       |                                                                                |
| `apps/mobile/src/components/ui/MessageBubble.tsx`                            | injectCitationLinks、各 Markdown 调用、CompareGroupBlock、SearchGroundingBlock |
| `apps/mobile/src/lib/markdownRules.tsx`                                      | codeInlineRules（仅 code/code_inline）                                         |
| `apps/mobile/src/lib/api.ts`                                                 | SSE grounding 事件、onSearch                                                   |
| `apps/mobile/src/types/index.ts`                                             | CitationItem、GroundingSearch                                                  |
| **Web**                                                                      |                                                                                |
| `src/features/Conversation/Messages/Assistant/useMarkdown.tsx`               | citations、enableCustomFootnotes、showFootnotes                                |
| `src/features/Conversation/Messages/Assistant/components/MessageContent.tsx` | DisplayContent、SearchGrounding                                                |
| `src/features/Conversation/Messages/components/DisplayContent.tsx`           | MarkdownMessage、markdownProps                                                 |
| `src/store/chat/agents/StreamingHandler.ts`                                  | handleGroundingChunk、onGroundingUpdate                                        |
| `src/store/chat/agents/createAgentExecutors.ts`                              | onGroundingUpdate → updateMessage                                              |
| **服务端**                                                                   |                                                                                |
| `src/server/services/mobileChat/index.ts`                                    | writeEvent('grounding', ...)                                                   |
