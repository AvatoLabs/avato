# App 端内置工具全面支持实施计划

> 目标：将 Web 端 12+ 内置工具的 Render / Intervention / Streaming / Inspector 能力完整移植到 App 端，实现与 Web 对等的工具调用体验。

---

## 一、现状与差距

### 1.1 已完成（2025-03）

| 能力 | 状态 | 说明 |
|------|------|------|
| 批准/拒绝流程 | ✅ | store + API + ToolCallsBlock 回调，后端占位 |
| intervention 透传 | ✅ | transformToolCalls / toolExecutionsToPayloads |
| 通用 ToolCard | ✅ | 展示 apiName、arguments、result、pending/rejected 样式 |
| Render / Intervention / Streaming / Inspector | ✅ | BuiltinTools 注册表 + ToolCard 集成 |

### 1.2 未完成

| 能力 | Web | App |
|------|-----|-----|
| 工具专用 Render | 12 工具集 | ✅ 推荐工具已支持 |
| 工具专用 Intervention | 7 工具集 | ✅ GTD CreatePlan/AddTodo |
| Streaming 实时反馈 | 9 工具集 | ✅ GTD/Notebook 占位 |
| Inspector 标题定制 | 14 工具集 | ✅ displayNames |
| 拒绝并继续 | ✅ | ❌ |
| 参数编辑 | ✅ | ❌ |
| ModeSelector | ✅ | ❌ |

---

## 二、内置工具能力矩阵

### 2.1 按工具集（Web 端注册情况）

| 工具集 | identifier | Render | Intervention | Streaming | Inspector | Mobile 推荐 |
|--------|------------|:------:|:-------------:|:---------:|:---------:|:-----------:|
| GTD | lobe-gtd | ✓ | ✓ | ✓ | ✓ | ✓ |
| Notebook | lobe-notebook | ✓ | ✓ | ✓ | ✓ | ✓ |
| Memory | lobe-user-memory | ✓ | ✓ | ✓ | ✓ | ✓ |
| Cloud Sandbox | lobe-cloud-sandbox | ✓ | ✓ | ✓ | ✓ | ✓ |
| Local System | lobe-local-system | ✓ | ✓ | ✓ | ✓ | 否（桌面专用） |
| Web Browsing | lobe-web-browsing | ✓ | - | - | ✓ | 否 |
| Knowledge Base | lobe-knowledge-base | ✓ | - | - | ✓ | 否 |
| Agent Builder | lobe-agent-builder | ✓ | ✓ | ✓ | ✓ | 否 |
| Agent Management | lobe-agent-management | ✓ | - | ✓ | ✓ | 否 |
| Group Agent Builder | lobe-group-agent-builder | ✓ | - | ✓ | ✓ | 否 |
| Group Management | lobe-group-management | ✓ | ✓ | ✓ | ✓ | 否 |
| Skill Store | lobe-skill-store | ✓ | - | - | ✓ | 否 |
| Skills | lobe-skills | ✓ | - | - | ✓ | 否 |
| Tools (LobeTools) | lobe-tools | - | - | - | ✓ | 否 |
| Page Agent | lobe-page-agent | - | - | - | ✓ | 否 |
| Calculator | lobe-calculator | - | - | - | - | ✓ |
| Artifacts | lobe-artifacts | (Agent) | - | - | - | ✓ |

### 2.2 各工具 API 与组件清单

| 工具 | API 示例 | Render 组件 | Intervention 组件 | Streaming 组件 |
|------|----------|-------------|-------------------|----------------|
| **lobe-gtd** | createPlan, createTodos, execTask | TodoList, CreatePlan, ExecTask, ExecTasks | CreatePlan, AddTodo, ClearTodos, UpdateTodos 等 | CreatePlan, ExecTask, ExecTasks |
| **lobe-notebook** | createDocument | CreateDocument | CreateDocument | - |
| **lobe-memory** | addExperienceMemory, searchUserMemory | AddExperience, AddPreference, SearchUserMemory | AddExperienceMemory | AddExperience, AddPreference |
| **lobe-cloud-sandbox** | executeCode | - | ExecuteCode | - |
| **lobe-web-browsing** | search | SearchResult | - | Search |
| **lobe-knowledge-base** | searchKnowledgeBase | SearchKnowledgeBase | - | SearchKnowledgeBase |
| **lobe-local-system** | runCommand, searchLocalFiles | - | RunCommand | - |

---

## 三、实施阶段

### 阶段 0：基础设施（已完成）

- [x] 批准/拒绝 store + API
- [x] intervention 透传
- [x] ToolCallsBlock / ToolResultBlock 回调接入

### 阶段 1：RN 渲染框架（2–3 周）

**目标**：建立 App 端工具渲染注册与分发机制，与 Web 的 getBuiltinRender 对齐。

| 任务 | 产出 | 依赖 |
|------|------|------|
| 1.1 创建 `apps/mobile/src/features/BuiltinTools/` | 目录结构 | - |
| 1.2 实现 `getMobileBuiltinRender(identifier, apiName)` | 注册表 + 分发函数 | - |
| 1.3 在 ToolCard 中按 identifier+apiName 分支渲染 | 有则用专用 Render，无则用通用 ToolCard | 1.2 |
| 1.4 定义 `MobileBuiltinRenderProps` 接口 | 与 Web BuiltinRender 对齐的 props | - |

**技术选型**：
- 不直接依赖 `@lobechat/builtin-tools`（Web 组件无法在 RN 运行）
- 每个工具在 `apps/mobile/src/features/BuiltinTools/<tool>/` 下实现 RN 版本

### 阶段 2：Mobile 推荐工具 Render（4–6 周）

**优先级**：按 Mobile 推荐列表 + 使用频率排序。

| 顺序 | 工具 | 组件 | 预估 | 说明 |
|------|------|------|------|------|
| 2.1 | lobe-gtd | TodoList, CreatePlan, ExecTask, ExecTasks | 1 周 | ✅ 已完成（2025-03） |
| 2.2 | lobe-notebook | CreateDocument | 0.5 周 | ✅ 已完成 |
| 2.3 | lobe-memory | AddExperience, AddPreference, SearchUserMemory | 1 周 | ✅ 已完成 |
| 2.4 | lobe-cloud-sandbox | ExecuteCode（代码+输出） | 0.5 周 | ✅ 已完成 |
| 2.5 | lobe-calculator | Result 结果卡片 | 0.5 周 | ✅ 已完成 |

### 阶段 3：Inspector 与显示名（1 周）

| 任务 | 产出 |
|------|------|
| 3.1 建立 displayName 映射 | ✅ getMobileBuiltinDisplayName |
| 3.2 替换 formatToolDisplayTitle 中的通用逻辑 | ✅ buildToolDisplayProps 优先使用 displayName |

### 阶段 4：Intervention 表单（3–4 周）

**前提**：后端支持 human approval（AgentRuntimeService 实现 approve/reject）。

| 顺序 | 工具 | Intervention 组件 | 预估 |
|------|------|-------------------|------|
| 4.1 | lobe-gtd | CreatePlan, AddTodo | ✅ 已完成 |
| 4.2 | lobe-notebook | CreateDocument | ✅ 已完成 |
| 4.3 | lobe-memory | AddExperienceMemory + Streaming | ✅ 已完成 |
| 4.4 | lobe-cloud-sandbox | ExecuteCode 参数展示 + Streaming | ✅ 已完成 |
| 4.5 | lobe-local-system | RunCommand（移动端可能不启用） | 0.5 周 |

### 阶段 5：Streaming 实时反馈（2–3 周）✅ 已完成

| 任务 | 产出 |
|------|------|
| 5.1 getMobileBuiltinStreaming 注册表 | streamings.ts + 分发函数 |
| 5.2 实现 Streaming 占位组件 | 如「正在创建计划…」「正在执行任务…」 |
| 5.3 ToolCard 集成 streamingContent | !hasResult && !isPending 时展示 Streaming 占位 |

### 阶段 6：扩展工具（按需）

| 工具 | 适用场景 | 优先级 |
|------|----------|--------|
| lobe-web-browsing | 搜索结果展示 | ✅ Render + Streaming |
| lobe-knowledge-base | RAG 检索结果 | ✅ Render + Streaming |
| lobe-agent-builder | 创建 Agent（设置页可能更合适） | displayNames |
| lobe-group-management | 群组会话 | displayNames |
| lobe-skill-store / lobe-skills | 技能市场 | ✅ searchSkill Render + Streaming |

---

## 四、目录与文件规划

```
apps/mobile/src/
├── features/
│   └── BuiltinTools/
│       ├── index.ts                 # getMobileBuiltinRender, getMobileBuiltinDisplayName
│       ├── types.ts                 # MobileBuiltinRenderProps 等
│       ├── gtd/
│       │   ├── TodoList.tsx
│       │   ├── CreatePlan.tsx
│       │   ├── ExecTask.tsx
│       │   └── ExecTasks.tsx
│       ├── notebook/
│       │   └── CreateDocument.tsx
│       ├── memory/
│       │   ├── AddExperienceMemory.tsx
│       │   ├── AddPreferenceMemory.tsx
│       │   └── SearchUserMemory.tsx
│       ├── cloudSandbox/
│       │   └── ExecuteCode.tsx
│       └── displayNames.ts          # identifier+apiName → 展示名
└── components/ui/
    └── MessageBubble.tsx            # 集成 getMobileBuiltinRender
```

---

## 五、技术约束与决策

| 决策 | 说明 |
|------|------|
| **不复用 Web 组件** | antd、@lobehub/ui 为 Web 库，RN 需独立实现 |
| **数据格式对齐** | Render 入参与 Web 的 `content`、`pluginState`、`args` 保持一致 |
| **WebView 方案** | 可评估用 WebView 嵌入简单 HTML 渲染，复杂度与维护成本需权衡 |
| **Local System** | 移动端通常不启用，可延后或跳过 |
| **后端依赖** | Intervention、Streaming 依赖后端 human approval 支持 |

---

## 六、里程碑与排期（建议）

| 里程碑 | 内容 | 预估 |
|--------|------|------|
| M1 | 阶段 1 完成，框架可扩展 | 2–3 周 |
| M2 | GTD + Notebook + Memory Render 上线 | +2 周 |
| M3 | Cloud Sandbox + Calculator + Inspector | +1 周 |
| M4 | Intervention（依赖后端） | +3 周 |
| M5 | Streaming | +2 周 |
| M6 | 扩展工具（Web Browsing、Knowledge Base 等） | +2 周 |

**总计**：约 12–14 周（按 1 人全职估算）。

---

## 七、验收标准

- [ ] Mobile 推荐的内置工具（GTD、Notebook、Memory、Cloud Sandbox、Calculator）均有专用 Render
- [ ] 工具调用结果展示与 Web 端语义一致（可简化样式，核心信息完整）
- [ ] 批准/拒绝流程在 pending 时可用（含后端支持后）
- [ ] 内置工具标题使用友好展示名（Inspector 或 displayNames）
- [ ] 新工具接入仅需新增 `BuiltinTools/<tool>/` 下组件并注册
