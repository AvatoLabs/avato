# Agent 管理系统

<cite>
**本文引用的文件**
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts)
- [packages/agent-manager-runtime/src/types.ts](file://packages/agent-manager-runtime/src/types.ts)
- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts)
- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts)
- [packages/builtin-tool-group-agent-builder/src/systemRole.ts](file://packages/builtin-tool-group-agent-builder/src/systemRole.ts)
- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts)
- [packages/agent-runtime/src/index.ts](file://packages/agent-runtime/src/index.ts)
- [packages/agent-runtime/src/core/index.ts](file://packages/agent-runtime/src/core/index.ts)
- [packages/agent-runtime/src/groupOrchestration/index.ts](file://packages/agent-runtime/src/groupOrchestration/index.ts)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts)
- [src/store/agent/index.ts](file://src/store/agent/index.ts)
- [src/features/Conversation/store.test.ts](file://src/features/Conversation/store.test.ts)
- [packages/types/src/discover/skills.ts](file://packages/types/src/discover/skills.ts)
</cite>

## 目录

1. [引言](#引言)
2. [项目结构](#项目结构)
3. [核心组件](#核心组件)
4. [架构总览](#架构总览)
5. [详细组件分析](#详细组件分析)
6. [依赖关系分析](#依赖关系分析)
7. [性能考量](#性能考量)
8. [故障排除指南](#故障排除指南)
9. [结论](#结论)
10. [附录](#附录)

## 引言

本文件面向 “Agent 管理系统” 的使用者与开发者，系统性阐述 Agent 的创建、配置、生命周期管理与分组协作机制；详解 Agent 构建器（Agent Builder）的工作原理（模板选择、参数配置、自动化设置）；说明 Agent 管理工具的批量操作、导入导出与性能监控能力；解释 Agent 运行时环境的架构设计（上下文管理、状态同步、错误处理）；并提供可直接定位到源码路径的示例，帮助快速创建自定义 Agent、配置行为与实现 Agent 协作。同时覆盖调试技巧、性能优化建议与故障排除，并延伸至 Agent 市场集成、版本管理与扩展开发。

## 项目结构

本仓库采用多包（monorepo）组织方式，围绕 Agent 生命周期与运行时展开的关键模块如下：

- agent-manager-runtime：统一的 Agent 管理运行时，提供 CRUD、搜索、模型 / 提供商查询、插件 / 工具安装与提示词更新等能力
- builtin-tool-agent-builder：单 Agent 构建器工具，封装 Agent 配置与提示词更新接口
- builtin-tool-group-agent-builder：群组 Agent 构建器工具，支持成员管理、群组配置与提示词共享
- agent-runtime：Agent 运行时核心、干预检查、用量统计与群组编排
- server/services/discover：市场服务，提供 Agent 列表与工具列表检索
- store/agent：Agent 状态存储与选择器，支撑乐观更新与流式提示词渲染
- 类型与技能分类：discover/skills.ts 定义市场技能类别

```mermaid
graph TB
subgraph "管理与构建层"
AMR["AgentManagerRuntime<br/>统一管理运行时"]
AB["AgentBuilder 工具"]
GAB["GroupAgentBuilder 工具"]
end
subgraph "运行时层"
AR_CORE["Agent Runtime 核心"]
ORCH["群组编排"]
end
subgraph "市场与存储"
DISCOVER["Discover 服务"]
STORE_AGENT["Agent Store"]
end
AB --> AMR
GAB --> AMR
AMR --> DISCOVER
AMR --> STORE_AGENT
AR_CORE --> STORE_AGENT
ORCH --> STORE_AGENT
```

**图表来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L61-L72)
- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts#L1-L21)
- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts#L1-L4)
- [packages/agent-runtime/src/core/index.ts](file://packages/agent-runtime/src/core/index.ts#L1-L4)
- [packages/agent-runtime/src/groupOrchestration/index.ts](file://packages/agent-runtime/src/groupOrchestration/index.ts#L1-L7)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/store/agent/index.ts](file://src/store/agent/index.ts#L1-L2)

**章节来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L1-L1060)
- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts#L1-L21)
- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts#L1-L4)
- [packages/agent-runtime/src/index.ts](file://packages/agent-runtime/src/index.ts#L1-L7)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/store/agent/index.ts](file://src/store/agent/index.ts#L1-L2)

## 核心组件

- AgentManagerRuntime：统一的 Agent 管理运行时，负责 Agent CRUD、搜索、模型 / 提供商查询、插件 / 工具安装与提示词更新。通过注入 IAgentService 与 IDiscoverService 实现运行时无关（前后端均可使用）。
- AgentBuilder 工具：封装单 Agent 的配置更新与提示词更新接口，参数与状态类型清晰，便于在对话上下文中自动注入当前 Agent。
- GroupAgentBuilder 工具：在 AgentBuilder 基础上扩展群组成员管理、群组配置与提示词共享，支持批量创建 Agent 并加入群组。
- Agent Runtime：提供运行时核心能力（干预检查、用量统计）与群组编排（Supervisor、编排配置与类型）。
- Discover 服务：对接市场，提供 Agent 列表与 MCP 工具列表检索。
- Agent Store：提供乐观更新、流式提示词渲染与选择器，支撑 UI 与运行时的状态一致性。

**章节来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L61-L72)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L1-L219)
- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L1-L304)
- [packages/agent-runtime/src/core/index.ts](file://packages/agent-runtime/src/core/index.ts#L1-L4)
- [packages/agent-runtime/src/groupOrchestration/index.ts](file://packages/agent-runtime/src/groupOrchestration/index.ts#L1-L7)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/store/agent/index.ts](file://src/store/agent/index.ts#L1-L2)

## 架构总览

Agent 管理系统由 “构建层”“运行时层”“市场与存储层” 三部分协同构成。构建层通过 AgentBuilder 与 GroupAgentBuilder 将用户意图转化为对 Agent 的配置与提示词更新；运行时层负责执行与编排；市场与存储层提供模型 / 工具检索与状态持久化。

```mermaid
sequenceDiagram
participant U as "用户"
participant AB as "AgentBuilder"
participant AMR as "AgentManagerRuntime"
participant DIS as "Discover 服务"
participant ST as "Agent Store"
U->>AB : 触发配置更新/提示词更新
AB->>AMR : 调用 updateAgentConfig/updatePrompt
AMR->>ST : 乐观更新配置/提示词
AMR->>DIS : 搜索可用模型/工具
DIS-->>AMR : 返回模型/工具列表
AMR-->>AB : 返回结果与状态
AB-->>U : 渲染更新结果
```

**图表来源**

- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L31-L71)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L114-L223)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/store/agent/index.ts](file://src/store/agent/index.ts#L1-L2)

## 详细组件分析

### AgentManagerRuntime 组件分析

- 职责边界：统一的 Agent 管理运行时，屏蔽前后端差异，提供一致的 API。
- 关键能力：
  - Agent CRUD：创建、更新配置、删除
  - 搜索：支持用户自有 Agent 与市场 Agent 双通道
  - 模型 / 提供商：按 Provider 过滤返回可用模型清单
  - 提示词更新：支持普通更新与流式 typewriter 效果
  - 插件 / 工具安装：支持官方（内置 / Klavis/LobehubSkill）与市场（MCP）两类来源
- 错误处理：统一包装错误信息，保留上下文与状态，便于前端反馈与重试

```mermaid
classDiagram
class AgentManagerRuntime {
-agentService : IAgentService
-discoverService : IDiscoverService
+createAgent(params) BuiltinToolResult
+updateAgentConfig(agentId, params) BuiltinToolResult
+deleteAgent(agentId) BuiltinToolResult
+searchAgents(params) BuiltinToolResult
+getAvailableModels(params) BuiltinToolResult
+updatePrompt(agentId, params) BuiltinToolResult
+searchMarketTools(params) BuiltinToolResult
+installPlugin(agentId, params) BuiltinToolResult
}
class IAgentService {
+createAgent(config)
+queryAgents(keyword, limit)
+removeAgent(agentId)
}
class IDiscoverService {
+getAssistantList(category, pageSize, q)
+getMcpList(category, pageSize, q)
}
AgentManagerRuntime --> IAgentService : "依赖"
AgentManagerRuntime --> IDiscoverService : "依赖"
```

**图表来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L61-L72)
- [packages/agent-manager-runtime/src/types.ts](file://packages/agent-manager-runtime/src/types.ts#L10-L54)

**章节来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L79-L243)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L250-L325)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L332-L374)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L381-L436)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L443-L494)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L499-L593)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L805-L856)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L1029-L1058)
- [packages/agent-manager-runtime/src/types.ts](file://packages/agent-manager-runtime/src/types.ts#L10-L69)

### AgentBuilder 组件分析

- 工具标识与 API 名称：集中于 AgentBuilderIdentifier 与 AgentBuilderApiName，屏蔽底层细节
- 参数与状态：
  - 更新配置：支持部分配置与元数据更新，以及插件开关合并
  - 获取可用模型：可按 Provider 过滤
  - 搜索市场工具：支持关键词与分类过滤
  - 更新提示词：支持流式 typewriter 效果
- 自动注入上下文：当前 Agent 上下文自动注入，简化调用

```mermaid
flowchart TD
Start(["调用 updateAgentConfig"]) --> Merge["合并配置与插件开关"]
Merge --> Optimistic["乐观更新 Agent Store"]
Optimistic --> RemoteUpdate{"是否需要远程更新？"}
RemoteUpdate --> |是| CallAPI["调用 AgentManagerRuntime.updateAgentConfig"]
RemoteUpdate --> |否| Return["返回成功状态"]
CallAPI --> Done(["完成"])
```

**图表来源**

- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L31-L53)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L114-L223)

**章节来源**

- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts#L1-L21)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L12-L24)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L31-L71)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L123-L154)
- [packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L161-L170)

### GroupAgentBuilder 组件分析

- 在 AgentBuilder 基础上扩展群组能力：
  - 成员管理：邀请、移除、批量创建 Agent
  - 群组配置：更新群组元数据与打开消息 / 问题
  - 共享提示词：更新群组共享提示词
- 参数与状态：
  - 批量创建：传入多个 Agent 创建参数，返回成功 / 失败计数
  - 邀请 / 移除：返回被操作 Agent 的标识与名称
  - 更新提示词：支持流式效果

```mermaid
sequenceDiagram
participant U as "用户"
participant GAB as "GroupAgentBuilder"
participant AMR as "AgentManagerRuntime"
participant ST as "Agent Store"
U->>GAB : 调用 batchCreateAgents
GAB->>AMR : 逐个创建 Agent
AMR->>ST : 乐观更新配置
AMR-->>GAB : 返回每个 Agent 的创建结果
GAB-->>U : 展示批量结果
```

**图表来源**

- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L211-L235)
- [packages/builtin-tool-group-agent-builder/src/systemRole.ts](file://packages/builtin-tool-group-agent-builder/src/systemRole.ts#L22-L38)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L79-L109)

**章节来源**

- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts#L1-L4)
- [packages/builtin-tool-group-agent-builder/src/systemRole.ts](file://packages/builtin-tool-group-agent-builder/src/systemRole.ts#L22-L38)
- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L12-L39)
- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L211-L235)
- [packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L267-L303)

### Agent 运行时与上下文管理

- 运行时核心：提供干预检查与用量统计等基础能力
- 群组编排：Supervisor 与编排配置类型，支持群组级协作
- 上下文与作用域：Conversation Store 支持 thread、topic、group、group_agent 等多种作用域，确保运行时上下文正确传递

```mermaid
stateDiagram-v2
[*] --> Idle
Idle --> Running : "开始会话"
Running --> GroupScope : "进入群组会话"
GroupScope --> GroupAgentScope : "进入群组-代理会话"
GroupAgentScope --> Running : "回到通用会话"
Running --> Idle : "结束会话"
```

**图表来源**

- [packages/agent-runtime/src/core/index.ts](file://packages/agent-runtime/src/core/index.ts#L1-L4)
- [packages/agent-runtime/src/groupOrchestration/index.ts](file://packages/agent-runtime/src/groupOrchestration/index.ts#L1-L7)
- [src/features/Conversation/store.test.ts](file://src/features/Conversation/store.test.ts#L152-L198)

**章节来源**

- [packages/agent-runtime/src/index.ts](file://packages/agent-runtime/src/index.ts#L1-L7)
- [packages/agent-runtime/src/core/index.ts](file://packages/agent-runtime/src/core/index.ts#L1-L4)
- [packages/agent-runtime/src/groupOrchestration/index.ts](file://packages/agent-runtime/src/groupOrchestration/index.ts#L1-L7)
- [src/features/Conversation/store.test.ts](file://src/features/Conversation/store.test.ts#L152-L198)

### 市场集成与技能分类

- 市场服务：提供 Agent 列表与 MCP 工具列表检索，支持分页与关键词过滤
- 技能分类：定义了丰富的技能类别枚举，便于市场筛选与推荐

```mermaid
flowchart TD
Q["输入关键词/分类"] --> DIS["Discover 服务"]
DIS --> RET["返回匹配项与总数"]
RET --> UI["渲染市场结果"]
```

**图表来源**

- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [packages/types/src/discover/skills.ts](file://packages/types/src/discover/skills.ts#L10-L44)

**章节来源**

- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [packages/types/src/discover/skills.ts](file://packages/types/src/discover/skills.ts#L10-L44)

## 依赖关系分析

- 组件耦合：
  - AgentManagerRuntime 通过接口 IAgentService 与 IDiscoverService 解耦具体实现
  - AgentBuilder 与 GroupAgentBuilder 仅依赖 AgentManagerRuntime 的公共 API
  - 运行时层与存储层通过 Agent Store 解耦 UI 与业务逻辑
- 外部依赖：
  - 市场 SDK：Discover 服务封装市场 API
  - Store：Agent Store 提供乐观更新与选择器

```mermaid
graph LR
AB["AgentBuilder"] --> AMR["AgentManagerRuntime"]
GAB["GroupAgentBuilder"] --> AMR
AMR --> DIS["Discover 服务"]
AMR --> ST["Agent Store"]
AR["Agent Runtime"] --> ST
ORCH["群组编排"] --> ST
```

**图表来源**

- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts#L1-L21)
- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts#L1-L4)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L61-L72)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/store/agent/index.ts](file://src/store/agent/index.ts#L1-L2)

**章节来源**

- [packages/agent-manager-runtime/src/types.ts](file://packages/agent-manager-runtime/src/types.ts#L10-L69)
- [packages/builtin-tool-agent-builder/src/index.ts](file://packages/builtin-tool-agent-builder/src/index.ts#L1-L21)
- [packages/builtin-tool-group-agent-builder/src/index.ts](file://packages/builtin-tool-group-agent-builder/src/index.ts#L1-L4)

## 性能考量

- 流式提示词更新：通过分块与延迟实现 typewriter 效果，避免阻塞主线程
- 乐观更新：在本地先更新状态，再异步提交后端，提升交互响应速度
- 结果集限制：搜索与模型列表默认限制数量，减少网络与渲染压力
- 缓存与轮询：OAuth 授权轮询与超时控制，避免长时间阻塞

**章节来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L419-L436)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L250-L325)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L332-L374)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L869-L940)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L942-L1025)

## 故障排除指南

- 插件安装失败：
  - 官方工具需授权（Klavis/OAuth），若授权窗口关闭或失败，系统回退轮询检测连接状态
  - 市场工具已安装但未启用，将尝试启用并刷新插件列表
- 提示词更新异常：
  - 若开启流式更新，需确保 Store 正确触发 start/append/finish 流程
- 搜索无结果：
  - 检查关键词与分类参数，确认 Discover 服务可用且返回 totalCount
- 群组协作异常：
  - 确认当前会话作用域（group/group_agent）与上下文是否正确传递

**章节来源**

- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L597-L803)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L805-L856)
- [packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L419-L436)
- [src/server/services/discover/index.ts](file://src/server/services/discover/index.ts#L2033-L2077)
- [src/features/Conversation/store.test.ts](file://src/features/Conversation/store.test.ts#L152-L198)

## 结论

Agent 管理系统以 AgentManagerRuntime 为核心，结合 AgentBuilder 与 GroupAgentBuilder，实现了从创建、配置到运行时协作的完整闭环。通过 Discover 服务与 Store 的解耦设计，系统具备良好的扩展性与跨端兼容性。建议在实际使用中充分利用流式更新、乐观更新与作用域上下文，以获得更佳的用户体验与性能表现。

## 附录

### 快速上手示例（路径指引）

- 创建单 Agent 并更新配置
  - 使用 AgentBuilder 的 updateAgentConfig 接口，参考参数与状态类型定义
  - 示例路径：[packages/builtin-tool-agent-builder/src/types.ts](file://packages/builtin-tool-agent-builder/src/types.ts#L31-L53)
- 批量创建群组 Agent
  - 使用 GroupAgentBuilder 的 batchCreateAgents 接口
  - 示例路径：[packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L211-L235)
- 搜索可用模型与工具
  - 使用 AgentManagerRuntime 的 getAvailableModels 与 searchMarketTools
  - 示例路径：[packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L332-L374)
  - 示例路径：[packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L443-L494)
- 更新提示词（含流式）
  - 使用 AgentManagerRuntime 的 updatePrompt
  - 示例路径：[packages/agent-manager-runtime/src/AgentManagerRuntime.ts](file://packages/agent-manager-runtime/src/AgentManagerRuntime.ts#L381-L436)
- 群组提示词与成员管理
  - 使用 GroupAgentBuilder 的 updateGroupPrompt 与 invite/remove
  - 示例路径：[packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L185-L209)
  - 示例路径：[packages/builtin-tool-group-agent-builder/src/types.ts](file://packages/builtin-tool-group-agent-builder/src/types.ts#L88-L100)

### 调试与优化建议

- 调试技巧
  - 利用流式更新的分块与延迟，逐步定位渲染卡顿点
  - 在插件安装流程中观察授权窗口状态与轮询间隔
- 性能优化
  - 合理设置搜索与模型列表的分页大小
  - 对频繁更新的配置采用节流 / 防抖策略
- 故障排查
  - 记录 AgentManagerRuntime 返回的错误体与状态字段，便于前端反馈与日志追踪
  - 确保 Discover 服务可用性与网络超时配置
