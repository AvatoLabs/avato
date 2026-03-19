# Mobile Builtin Tools 完备性审计

> 审计 Mobile 端 BuiltinTools 实现：完备性、潜在 Bug、与 Web 对齐情况。

---

## 一、Bug 修复

### 1.1 已修复

| 问题 | 位置 | 说明 |
|------|------|------|
| **WEB_BROWSING_ID / KNOWLEDGE_BASE_ID 未定义** | `index.ts` | 在 `BUILTIN_RENDERS` 中使用了 `[WEB_BROWSING_ID]`、`[KNOWLEDGE_BASE_ID]` 但未声明常量，会导致 `ReferenceError`。已补充定义。 |

---

## 二、与 Web 对齐检查

### 2.1 identifier 与 apiName

| 工具集 | Web identifier | Mobile | Web API 示例 | Mobile 注册 | 对齐 |
|--------|-----------------|--------|--------------|-------------|------|
| GTD | lobe-gtd | lobe-gtd | createPlan, createTodos, execTask... | 一致 | ✅ |
| Notebook | lobe-notebook | lobe-notebook | createDocument | 一致 | ✅ |
| Memory | lobe-user-memory | lobe-user-memory | addExperienceMemory, searchUserMemory | 一致 | ✅ |
| Cloud Sandbox | lobe-cloud-sandbox | lobe-cloud-sandbox | executeCode | 一致 | ✅ |
| Calculator | lobe-calculator | lobe-calculator | calculate, solve... | 一致 | ✅ |
| Web Browsing | lobe-web-browsing | lobe-web-browsing | **search**（非 searchWeb） | search | ✅ |
| Knowledge Base | lobe-knowledge-base | lobe-knowledge-base | searchKnowledgeBase | 一致 | ✅ |

### 2.2 数据格式对齐

| 工具 | 数据来源 | Web 结构 | Mobile 解析 | 对齐 |
|------|----------|----------|-------------|------|
| GTD TodoList | pluginState | `todos: { items, updatedAt }` | `pluginState?.todos`、`parsed.todos?.items` | ✅ |
| GTD CreatePlan | pluginState/content | `plan: { goal, description, context }` | `pluginState?.plan`、`parsed.plan` | ✅ |
| Notebook CreateDocument | pluginState/content | `document: { title, content }` | `pluginState?.document`、`parsed.state?.document` | ✅ |
| Memory AddExperience | args/content | `title, summary, details, action` | 一致 | ✅ |
| Cloud Sandbox ExecuteCode | pluginState/content | `output, stderr` | `pluginState?.output/stderr` | ✅ |
| Web Search | pluginState | `results: UniformSearchResult[]` | `pluginState?.results`、`parsed.state?.results` | ✅ |
| Knowledge Base | pluginState | `fileResults: FileSearchResult[]` | `pluginState?.fileResults` | ✅ |

**UniformSearchResult**：Web 有 `url`、`parsedUrl`，Mobile 使用 `url` 即可，兼容。

### 2.3 Intervention 对齐

| 工具 | Web Intervention | Mobile | 对齐 |
|------|------------------|--------|------|
| GTD CreatePlan | 可编辑 goal/description/context | 可编辑 goal/description/context | ✅ |
| GTD AddTodo | 可编辑 items，支持 add/remove | 可编辑 items，支持 add/remove | ✅ |
| Notebook CreateDocument | Web 无（NotebookInterventions 为空） | 新增 title/description/content 表单 | 扩展 ✅ |
| Memory AddExperience | 只读展示 ExperienceMemoryCard | 只读展示 | ✅ |
| Cloud Sandbox ExecuteCode | 只读展示 code + language | 只读展示 | ✅ |

### 2.4 Streaming 对齐

| 工具 | Web Streaming | Mobile | 对齐 |
|------|---------------|--------|------|
| GTD createPlan/execTask/execTasks | 有 | 有 | ✅ |
| Notebook createDocument | 有 | 有 | ✅ |
| Memory addExperience/addPreference | 有 | 有 | ✅ |
| Cloud Sandbox executeCode | 有 | 有 | ✅ |
| Web search | 无（用 Placeholder） | 新增 | 扩展 ✅ |
| Knowledge Base searchKnowledgeBase | 无 | 新增 | 扩展 ✅ |

---

## 三、完备性检查

### 3.1 Render 覆盖

| 工具 | API | Mobile Render | 备注 |
|------|-----|---------------|------|
| lobe-gtd | clearTodos, createTodos, updateTodos | TodoList | ✅ |
| lobe-gtd | createPlan, updatePlan | CreatePlan | ✅ |
| lobe-gtd | execTask, execTasks | ExecTask, ExecTasks | ✅ |
| lobe-notebook | createDocument | CreateDocument | ✅ |
| lobe-user-memory | addExperienceMemory, addPreferenceMemory, searchUserMemory | AddExperience, AddPreference, SearchUserMemory | ✅ |
| lobe-cloud-sandbox | executeCode | ExecuteCode | ✅ |
| lobe-calculator | 全部 | Result | ✅ |
| lobe-web-browsing | search | SearchResult | ✅ |
| lobe-knowledge-base | searchKnowledgeBase | SearchKnowledgeBase | ✅ |

### 3.2 Intervention 覆盖

| 工具 | API | Mobile Intervention |
|------|-----|----------------------|
| lobe-gtd | createPlan, createTodos | CreatePlan, AddTodo |
| lobe-notebook | createDocument | CreateDocument |
| lobe-user-memory | addExperienceMemory | AddExperienceMemory（只读） |
| lobe-cloud-sandbox | executeCode | ExecuteCode（只读） |

**Web 有但 Mobile 未实现**：GTD ClearTodos、UpdateTodos 等（Web 有 ClearTodosIntervention 等，Mobile 按需可补）。

### 3.3 Streaming 覆盖

已覆盖：GTD、Notebook、Memory、Cloud Sandbox、Web Browsing、Knowledge Base。

### 3.4 displayNames 覆盖

已覆盖：GTD、Notebook、Memory、Cloud Sandbox、Calculator、Web Browsing、Knowledge Base、Agent Builder、Group Management、Skill Store、Skills。

---

## 四、潜在风险与建议

### 4.1 数据解析

- **content 解析**：部分工具从 `content` 解析 JSON，需兼容 `{ state: { ... } }` 与 `{ plan }` 等不同结构。当前实现已覆盖常见格式。
- **pluginState 透传**：依赖后端 `pluginState` 正确透传，若后端未返回则 fallback 到 content 解析。

### 4.2 边界情况

- **空结果**：各 Render 在无数据时返回 `null`，ToolCard 会 fallback 到 `argumentsText`，逻辑正确。
- **URL 解析**：`getHost` 使用 `new URL(url)`，无效 URL 会 catch 返回原串，可接受。

### 4.3 待完善（可选）

| 项 | 说明 |
|----|------|
| GTD ClearTodos/UpdateTodos Intervention | Web 有，Mobile 未实现，使用频率较低 |
| ToolResultBlock 的 identifier | 若 `message.plugin?.identifier` 为空，fallback 为 `toolName`，可能影响 getMobileBuiltinRender 查找 |
| i18n 迁移 | displayNames 当前硬编码，TODO 建议迁移到 i18n 键 |

---

## 五、P3 工具（agent-builder / group-management / skill-store）审计

### 5.1 App 端现有实现

| 工具 | App 现有能力 | 与 Builtin Tool 的关系 |
|------|--------------|------------------------|
| **lobe-agent-builder** | AgentConfigScreen、AgentListScreen、agentApi.create/updateConfig | **不同流**：App 为表单式配置；Builtin Tool 为对话中 AI 调用 updateAgentConfig、installPlugin 等 |
| **lobe-group-management** | AgentGroupApi、ChatDetailScreen 群聊、execGroupAgent | **同一流**：群聊中 Supervisor 会调用 broadcast、speak、executeAgentTask 等，工具调用会出现在消息中 |
| **lobe-skill-store / lobe-skills** | StoreScreen、SkillsSheet、marketSkillApi | **不同流**：App 为 Store 浏览；Builtin Tool 为对话中 AI 调用 searchSkill、importSkill 等 |

### 5.2 工具调用出现场景

| 工具 | 何时出现 | Mobile 是否支持 |
|------|----------|-----------------|
| lobe-agent-builder | Agent 配置对话中 AI 建议修改配置 | 配置页为表单，无对话式 AI 助手，**出现概率低** |
| lobe-group-management | 群聊中 Supervisor 分配任务、发言 | **有**：群聊使用 execGroupAgent，Supervisor 会调用这些工具 |
| lobe-skill-store / lobe-skills | 对话中 AI 帮用户搜索/安装技能 | 可能出现在 AgentConfig 或通用对话，**出现概率中等** |

### 5.3 Web Render 对比

| 工具 | Web Render | 数据结构 | 实现复杂度 |
|------|------------|----------|------------|
| group-management broadcast | 展示 instruction（Markdown） | `args.instruction` | 低 |
| group-management speak | 展示 instruction（Markdown） | `args.instruction` | 低 |
| group-management executeAgentTask | 展示任务分配 | `args.agentId, task` | 中 |
| group-management executeAgentTasks | 展示多任务分配 | `args.assignments` | 中 |
| agent-builder updateAgentConfig | 展示配置变更 | 复杂 | 高 |
| agent-builder installPlugin | 展示插件安装 | 中等 | 中 |
| skill-store searchSkill | 展示技能列表 | `pluginState.skills` | 中 |

### 5.4 覆盖建议

| 工具 | 建议 | 理由 |
|------|------|------|
| **lobe-group-management** | ✅ **建议覆盖** | 群聊中必现，broadcast/speak 仅展示 instruction，实现简单 |
| **lobe-agent-builder** | ⚠️ 暂不覆盖 | 配置页为表单，对话中调用少；Web Render 较复杂 |
| **lobe-skill-store / lobe-skills** | ✅ 已覆盖 | searchSkill Render + Streaming（两者共用） |

### 5.5 若覆盖 group-management

- **broadcast**、**speak**：Render 展示 `args.instruction`（Markdown），与 Web 一致
- **executeAgentTask**、**executeAgentTasks**：可先做通用展示（任务/分配对象），或延后

---

## 六、结论

**完备性**：Mobile 推荐工具（GTD、Notebook、Memory、Cloud Sandbox、Calculator）及扩展工具（Web Browsing、Knowledge Base）的 Render、Intervention、Streaming、displayNames 已覆盖。

**Bug**：`WEB_BROWSING_ID`、`KNOWLEDGE_BASE_ID` 未定义已修复。

**与 Web 对齐**：identifier、apiName、数据格式、Intervention 行为、Streaming 占位与 Web 一致或扩展合理。

**P3 覆盖建议**：优先为 lobe-group-management（broadcast、speak）添加 Render，群聊中会调用；lobe-agent-builder、lobe-skill-store 按需延后。
