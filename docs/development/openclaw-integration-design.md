# OpenClaw Provider 集成设计文档

> **状态**: Draft\
> **目标**: 在 LobeHub 中将 OpenClaw Gateway 作为一等公民 AI Provider 支持\
> **涉及范围**: Web / Desktop / Mobile 全端

---

## 1. OpenClaw 概述

[OpenClaw](https://openclawcn.com) 是一个开源 AI 助手平台，其核心组件 **Gateway** 提供以下 HTTP API：

| 端点             | 路径                        | 用途                  | 兼容性             |
| ---------------- | --------------------------- | --------------------- | ------------------ |
| Chat Completions | `POST /v1/chat/completions` | 标准对话补全          | **OpenAI 兼容**    |
| Responses API    | `POST /v1/responses`        | OpenResponses 协议    | OpenResponses 兼容 |
| Tools Invoke     | `POST /tools/invoke`        | 单独调用 Gateway 工具 | 私有协议           |

### 关键特性

- **认证**: Bearer Token（`OPENCLAW_GATEWAY_TOKEN`）或 Password 模式
- **Agent 路由**: 通过 `model` 字段编码 `"openclaw:<agentId>"`，或 `x-openclaw-agent-id` header 指定
- **Session 管理**: 默认无状态；可通过 `user` 字段或 `x-openclaw-session-key` 实现有状态会话
- **SSE 流式**: `stream: true`，`data: [DONE]` 终止，与 OpenAI SSE 格式一致
- **多模态输入**: 支持 `input_image`（URL/base64）和 `input_file`（PDF/text/JSON 等）
- **动态模型列表**: Gateway 不暴露独立的 `/v1/models` 端点；模型由 Agent 配置决定，用户需手动配置 Agent ID

---

## 2. 架构决策

### 2.1 SDK 类型选择

**结论：使用 `openai` SDK（`sdkType: 'openai'`），通过 `createOpenAICompatibleRuntime()` 工厂创建。**

理由:

1. OpenClaw `/v1/chat/completions` 完全兼容 OpenAI Chat API 规格
2. 项目中 70%+ 的 provider（如 DeepSeek、Groq、SiliconCloud）都使用此模式
3. 避免引入新的 SDK 依赖
4. SSE 流格式与 OpenAI 一致，已有成熟的 stream parser

### 2.2 模型发现策略

**结论：不启用动态 model fetcher（`showModelFetcher: false`），预置常用 Agent ID 作为模型选项。**

理由:

1. OpenClaw Gateway 没有标准的 `/v1/models` 端点
2. Agent ID 是其模型路由的核心概念（`model: "openclaw:main"`）
3. 用户可在 LobeHub Settings 中自定义添加更多 Agent ID

### 2.3 认证方式

**结论：使用标准 API Key 字段映射 Gateway Token（`showApiKey: true`）。**

理由:

1. OpenClaw 的 Bearer Token 认证与 API Key 语义等价
2. 复用 LobeHub 现有的 API Key 输入框即可，无需自定义 UI
3. 环境变量命名: `OPENCLAW_API_KEY`

### 2.4 BaseURL 策略

**结论：默认 BaseURL 留空，要求用户手动填写自托管 Gateway 地址。**

理由:

1. OpenClaw 是自托管平台，无统一的 SaaS 端点
2. 类似 Ollama / LM Studio /vLLM 的模式
3. 设置 `defaultShowBrowserRequest: true`，便于用户调试连接

---

## 3. 实现步骤

### Phase 1: model-bank 注册（Provider Card + 模型定义）

#### 3.1 新增 Provider 枚举

**文件**: `packages/model-bank/src/const/modelProvider.ts`

```typescript
// 按字母序插入，在 Ollama 与 OpenAI 之间
OpenClaw = 'openclaw',
```

#### 3.2 创建 Provider Card

**新建文件**: `packages/model-bank/src/modelProviders/openclaw.ts`

```typescript
import type { ModelProviderCard } from '@/types/llm';

const OpenClaw: ModelProviderCard = {
  chatModels: [],
  checkModel: 'openclaw:main',
  defaultShowBrowserRequest: true,
  description:
    'OpenClaw is an open-source AI assistant platform. Its Gateway provides OpenAI-compatible endpoints for self-hosted AI agents with tools, multi-model routing, and session management.',
  id: 'openclaw',
  modelList: { showModelFetcher: false },
  name: 'OpenClaw',
  settings: {
    defaultShowBrowserRequest: true,
    proxyUrl: {
      placeholder: 'http://localhost:18789/v1',
    },
    sdkType: 'openai',
    showApiKey: true,
  },
  url: 'https://openclawcn.com',
};

export default OpenClaw;
```

#### 3.3 创建模型定义

**新建文件**: `packages/model-bank/src/aiModels/openclaw.ts`

```typescript
import type { AIChatModelCard } from '@/types/aiModel';

export const openclawChatModels: AIChatModelCard[] = [
  {
    abilities: { functionCall: true, vision: true },
    contextWindowTokens: 128_000,
    description: 'Default OpenClaw Gateway agent with full tool access.',
    displayName: 'OpenClaw Main',
    enabled: true,
    id: 'openclaw:main',
    type: 'chat',
  },
  {
    abilities: { functionCall: true },
    contextWindowTokens: 128_000,
    description: 'OpenClaw agent — specify your custom agent ID.',
    displayName: 'OpenClaw Agent',
    enabled: false,
    id: 'openclaw',
    type: 'chat',
  },
];
```

#### 3.4 注册到 Provider Index

**文件**: `packages/model-bank/src/modelProviders/index.ts`

- import section 添加 `import OpenClawProvider from './openclaw';`
- `DEFAULT_MODEL_PROVIDER_LIST` 数组中按字母序插入（Ollama 之后）
- named export 添加 `export { default as OpenClawProviderCard } from './openclaw';`

**文件**: `packages/model-bank/src/aiModels/index.ts`

- 添加 `export * from './openclaw';`

---

### Phase 2: model-runtime 实现

#### 3.5 创建 Runtime Provider

**新建目录**: `packages/model-runtime/src/providers/openclaw/`

**新建文件**: `packages/model-runtime/src/providers/openclaw/index.ts`

采用 `createOpenAICompatibleRuntime()` 工厂模式（参考 deepseek、groq 的实现）：

```typescript
import { ModelProvider } from 'model-bank';
import { createOpenAICompatibleRuntime } from '../../core/createOpenAICompatibleRuntime';

export const params = {
  baseURL: undefined, // 用户必须自行配置
  debug: {
    chatCompletion: () => process.env.DEBUG_OPENCLAW_CHAT_COMPLETION === '1',
  },
  provider: ModelProvider.OpenClaw,
};

export const LobeOpenClawAI = createOpenAICompatibleRuntime(params);
```

> **注**: 如果测试发现 OpenClaw 对某些 OpenAI 字段的处理有差异（如 `tool_choice` 格式），可在此层添加 `chatCompletion.handlePayload` transform。

**新建文件**: `packages/model-runtime/src/providers/openclaw/index.test.ts`

标准测试用例：连接验证、流式响应、错误处理。

#### 3.6 导出 Runtime

**文件**: `packages/model-runtime/src/index.ts`

```typescript
export { LobeOpenClawAI } from './providers/openclaw';
```

---

### Phase 3: 服务端配置

#### 3.7 环境变量

| 变量名                | 类型     | 说明                                                    |
| --------------------- | -------- | ------------------------------------------------------- |
| `OPENCLAW_API_KEY`    | Optional | Gateway Bearer Token                                    |
| `OPENCLAW_PROXY_URL`  | Optional | Gateway 地址（如 `http://localhost:18789/v1`）          |
| `OPENCLAW_MODEL_LIST` | Optional | 模型列表覆盖（如 `-all,+openclaw:main,+openclaw:beta`） |
| `ENABLED_OPENCLAW`    | Optional | 强制启用 / 禁用                                         |

这些变量会被 `src/server/globalConfig/genServerAiProviderConfig.ts` 自动读取（通过 `ModelProvider` 枚举名推导）。

#### 3.8 Docker /.env 配置

**文件**: `Dockerfile`, `Dockerfile.database`, `Dockerfile.pglite`

```dockerfile
# OpenClaw
OPENCLAW_API_KEY="" OPENCLAW_PROXY_URL=""
```

**文件**: `.env.example`

```bash
### OpenClaw ###
# OPENCLAW_API_KEY=your-gateway-token
# OPENCLAW_PROXY_URL=http://localhost:18789/v1
```

---

### Phase 4: 文档

#### 3.9 使用文档

**新建文件**:

- `docs/usage/providers/openclaw.mdx` (English)
- `docs/usage/providers/openclaw.zh-CN.mdx` (Chinese)

文档结构（参考 `ollama.mdx`）:

```
# Using OpenClaw in LobeHub

## What is OpenClaw?
- 开源 AI 助手平台
- Gateway = 统一代理网关，支持多 Agent、多模型、工具链

## Prerequisites
- 已部署并运行 OpenClaw Gateway（`openclaw gateway status` 验证）
- 已启用 Chat Completions 端点
- 已获取 Gateway Token

## Quick Start
1. 打开 LobeHub → Settings → AI Providers → OpenClaw
2. 填写 Gateway URL（如 `http://localhost:18789/v1`）
3. 填写 API Key（Gateway Token）
4. 选择 Agent ID（默认 `openclaw:main`）
5. 开始对话

## Self-Hosting Configuration
- 环境变量说明
- Docker Compose 示例

## Advanced: Custom Agent Routing
- 使用 `openclaw:<agentId>` 格式指定不同 Agent
- 通过 LobeHub 自定义模型列表添加更多 Agent

## Troubleshooting
- 常见连接问题排查
- CORS 配置
```

#### 3.10 环境变量文档

**文件**:

- `docs/self-hosting/environment-variables/model-provider.mdx` (追加)
- `docs/self-hosting/environment-variables/model-provider.zh-CN.mdx` (追加)

---

### Phase 5: Mobile App 支持

#### 3.11 Avato Mobile 集成

OpenClaw 支持将自动通过以下路径传递到 Mobile：

1. **Discover → Providers 列表**: 通过 `aiProviderApi.list()` 自动拉取（服务端已注册 OpenClaw provider）
2. **AI Providers 设置页**: 已有 `AIProvidersScreen` 支持查看 / 配置 provider
3. **无需额外 Mobile 代码**: Provider 注册在服务端完成，Mobile 仅消费 API 返回的 provider 列表

---

## 4. 文件变更清单

| 操作     | 文件路径                                                           | 说明                      |
| -------- | ------------------------------------------------------------------ | ------------------------- |
| **修改** | `packages/model-bank/src/const/modelProvider.ts`                   | 新增 `OpenClaw` 枚举值    |
| **新建** | `packages/model-bank/src/modelProviders/openclaw.ts`               | Provider Card 定义        |
| **新建** | `packages/model-bank/src/aiModels/openclaw.ts`                     | 模型定义（Agent ID 列表） |
| **修改** | `packages/model-bank/src/modelProviders/index.ts`                  | 注册 Provider Card        |
| **修改** | `packages/model-bank/src/aiModels/index.ts`                        | 导出模型定义              |
| **新建** | `packages/model-runtime/src/providers/openclaw/index.ts`           | Runtime 客户端            |
| **新建** | `packages/model-runtime/src/providers/openclaw/index.test.ts`      | 单元测试                  |
| **修改** | `packages/model-runtime/src/index.ts`                              | 导出 Runtime              |
| **修改** | `Dockerfile`                                                       | 环境变量                  |
| **修改** | `.env.example`                                                     | 示例配置                  |
| **新建** | `docs/usage/providers/openclaw.mdx`                                | 英文使用文档              |
| **新建** | `docs/usage/providers/openclaw.zh-CN.mdx`                          | 中文使用文档              |
| **修改** | `docs/self-hosting/environment-variables/model-provider.mdx`       | 英文 env 文档             |
| **修改** | `docs/self-hosting/environment-variables/model-provider.zh-CN.mdx` | 中文 env 文档             |

---

## 5. OpenClaw API 与 LobeHub 映射关系

```
LobeHub Concept          OpenClaw Concept          映射方式
─────────────────────    ─────────────────────     ──────────────────────
Provider ID              openclaw                  model-bank 注册
API Key                  Gateway Token             OPENCLAW_API_KEY
Base URL                 Gateway HTTP endpoint     OPENCLAW_PROXY_URL
Model ID                 Agent ID                  "openclaw:<agentId>"
Chat API                 /v1/chat/completions      OpenAI SDK 直连
Stream                   SSE (data: [DONE])        OpenAI stream parser
Function Calling         OpenAI function tools     标准 tools 参数
Vision                   input_image in messages   OpenAI vision 格式
```

---

## 6. 风险与注意事项

### 6.1 无 `/v1/models` 端点

OpenClaw Gateway 不提供模型列表 API。对策：

- 预置 `openclaw:main` 作为默认模型
- 用户通过 LobeHub Settings 的 "自定义模型" 功能手动添加其他 Agent ID
- `showModelFetcher: false`

### 6.2 Session 有状态性

OpenClaw 支持基于 `user` 字段的有状态会话。LobeHub 发送的 OpenAI 请求默认不包含 `user` 字段，因此每次请求是无状态的。这与 LobeHub 自身管理 session 的设计一致，不需要依赖 provider 侧的 session 持久化。

### 6.3 Tools Invoke API 扩展（未来）

OpenClaw 的 `/tools/invoke` API 允许直接调用 Gateway 工具（如文件操作、浏览器控制等）。这与 LobeHub 的 MCP 插件体系有潜在的融合点，但超出本次集成范围。可作为 Phase 2 规划。

### 6.4 OpenResponses API 扩展（未来）

OpenClaw 的 `/v1/responses` 端点与 OpenAI Responses API 兼容。LobeHub 已有部分 provider（如 OpenAI）支持 `supportResponsesApi` 设置。后续可为 OpenClaw 启用此能力，但需要验证 OpenClaw 的 Responses 实现完整度。建议在首个版本中仅支持 Chat Completions。

---

## 7. 测试计划

| 测试项        | 方式        | 验证点                                                         |
| ------------- | ----------- | -------------------------------------------------------------- |
| Provider 注册 | 单元测试    | `modelProvider.ts` 枚举包含 `openclaw`                         |
| Provider Card | 单元测试    | Card 的 `id`, `settings.sdkType`, `url` 正确                   |
| Runtime 连接  | 集成测试    | 向 OpenClaw Gateway 发送 `/v1/chat/completions` 请求并获取响应 |
| 流式响应      | 集成测试    | SSE 事件正确解析，`[DONE]` 正确终止                            |
| 自定义 Agent  | 手动测试    | 设置 `model: "openclaw:beta"` 后路由到对应 Agent               |
| 环境变量      | Docker 测试 | `OPENCLAW_API_KEY` 和 `OPENCLAW_PROXY_URL` 在容器中正确传递    |
| Mobile 可见性 | 手动测试    | Avato 的 Discover → Providers 能显示 OpenClaw                  |

---

## 8. 实施时间估计

| Phase                       | 预估工时   | 依赖      |
| --------------------------- | ---------- | --------- |
| Phase 1: model-bank 注册    | 30min      | 无        |
| Phase 2: model-runtime 实现 | 1h         | Phase 1   |
| Phase 3: 服务端配置         | 30min      | Phase 1   |
| Phase 4: 文档               | 1h         | Phase 1-3 |
| Phase 5: Mobile 验证        | 15min      | Phase 1-3 |
| **合计**                    | **\~3.5h** | —         |
