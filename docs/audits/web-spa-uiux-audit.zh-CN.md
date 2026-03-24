# Web 端（SPA）UI/UX 审计汇总

**范围**：`src/spa/entry.web.tsx`、桌面主路由 `desktopRoutes`、主布局 / 侧栏 / 对话输入区，以及浏览器端社区、设置、资源等共享页面。\
**方法**：以静态代码阅读为主。本文只把能直接从代码确认的问题写成 “已确认”；需要运行环境、设备或产品决策才能定性的项，统一降级为 “需验证 / 需决策”。

---

## 如何阅读本文

- **已确认问题**：代码已经直接体现出问题触发条件，适合直接进入排期。
- **需验证项**：代码存在风险信号，但影响范围依赖路由、设备、交互链路或样式叠层，落地前应补一轮实机走查。
- **一致性债务**：不一定马上造成 bug，但会持续拉高后续实现成本。

---

## 执行摘要

| 优先级    | 结论                                                                                       | 状态                |
| --------- | ------------------------------------------------------------------------------------------ | ------------------- |
| **P0**    | 社区列表页把 “加载中” 和 “请求失败但无数据” 混为一类，失败后可能持续停留在 Loading         | 已确认              |
| **P1**    | tRPC 客户端仅对 `401` 做前台处理，其余错误默认只 `console.error`，全局错误反馈边界不清     | 已确认              |
| **P1**    | `ServerConfigStore.isMobile` 与 `useIsMobile()` 并存，Web 桌面窄窗口下会出现判定来源不一致 | 已确认              |
| **P1**    | 切换会话时强制 `editor.focus()`，会抢走用户正在进行的阅读、复制或表单操作焦点              | 已确认              |
| **P1**    | 输入区存在仅 `hover` 可见的操作，缺少键盘与触屏等价路径                                    | 已确认              |
| **P1**    | 侧栏返回按钮固定跳转 `/`，不是历史返回                                                     | 已确认              |
| **P2**    | Home 保活逻辑、全局 `100dvh`/`device-width` 滚动策略、脚注叠层等仍需实机验证影响范围       | 需验证              |
| **P2-P3** | i18n、reduced motion、focus-visible、硬编码颜色、断点常量、触摸热区等存在持续性一致性债务  | 已确认 / 需验证混合 |

---

## 一、已确认且建议优先处理的问题

### 1. 列表页把失败状态吞成 Loading（P0）

社区多个列表页都采用相同模式：

- `src/routes/(main)/community/(list)/mcp/index.tsx`
- `src/routes/(main)/community/(list)/agent/index.tsx`
- `src/routes/(main)/community/(list)/model/index.tsx`
- `src/routes/(main)/community/(list)/provider/index.tsx`
- `src/routes/(main)/community/(list)/skill/index.tsx`

当前写法是：

```tsx
if (isLoading || !data) return <Loading />;
```

这会把以下两种状态混为一类：

- 首次加载中
- 请求失败且 `data` 仍为空

**落地建议**：

1. 统一拆成 `loading / error / empty / success` 四态。
2. 失败态给出重试入口，不要依赖用户刷新页面。
3. 这一类判断可以顺手做一次全仓扫描，避免只修社区页。

### 2. tRPC 全局错误处理边界不清（P1）

`src/libs/trpc/client/lambda.ts` 中，错误链路只对 `401` 做了显式处理；其余状态走默认分支时仅 `console.error(err)`。

这意味着：

- 基础设施级错误是否需要 toast，目前没有统一策略。
- 业务层如果没自己补错误 UI，用户就只能看到静默失败。
- 如果后面补全局 toast，又容易与业务层 toast 重复。

**落地建议**：

1. 先定义 “哪些错误由基础设施层提示，哪些错误必须由页面自己处理”。
2. 若保留全局 toast，限制在网络断开、服务异常、权限失效等基础设施错误。
3. 统一约定 `showNotification` 的使用边界，避免重复提示。

### 3. Web 响应式判定存在双轨制（P1）

当前至少有两套来源：

- `src/layout/SPAGlobalProvider/index.tsx`：`isMobile` 由 `window.__SERVER_CONFIG__` / `__MOBILE__` 注入。
- `src/hooks/useIsMobile.ts`：`useResponsive()` 基于视口断点判断。

这不是 “理论上可能不一致”，而是**在 Web 桌面构建的窄窗口 / 平板窗口里必然可能不一致**：

- 一部分组件读构建注入值；
- 一部分组件读当前视口。

**落地建议**：

1. Web SPA 统一单一来源。
2. 如果确实要保留 “双语义”，必须明确区分：
   - 构建形态：mobile build /desktop build
   - 运行时视口：current viewport
3. 文档和代码里避免再把两者都叫 `isMobile`。

### 4. 切换会话时会强制抢焦点（P1）

`src/features/ChatInput/Desktop/index.tsx`：

```tsx
useEffect(() => {
  if (editor) editor.focus();
}, [chatKey, editor]);
```

这个行为已不是 “可能影响体验”，而是明确会在 `chatKey` 变化时抢回焦点。

**直接影响**：

- 用户切换会话后想先读内容，会被输入框打断。
- 复制、选中文本、操作其他控件时可能被打断。
- 对键盘和读屏用户尤为不友好。

**落地建议**：

1. 改为条件聚焦，而不是无条件聚焦。
2. 仅在 “新建会话且用户意图是立即输入” 时聚焦。
3. 为键盘快捷流保留可配置的自动聚焦策略。

### 5. 输入区存在仅 hover 可见的操作（P1）

同文件中 `.show-on-hover` 默认 `opacity: 0`，只在 `:hover` 时显示。

这说明至少有一批操作目前缺少：

- 键盘可发现路径
- `focus-within` 等价状态
- 触屏常驻或替代入口

**落地建议**：

1. 为输入区工具补 `:focus-within` 展示逻辑。
2. 移动端 / 触屏场景改为常驻或折叠菜单。
3. 把 “只靠 hover 暴露操作” 列为禁止模式。

### 6. 侧栏返回按钮语义固定为 “回首页”（P1）

`src/features/NavPanel/components/BackNav.tsx` 中点击后直接 `navigate('/')`。

这和用户通常理解的 “返回” 不同：

- 不是浏览器历史返回
- 不是返回上一层路由
- 也不是基于上下文的 `backTo`

**落地建议**：

1. 把组件语义改名为 “回首页”，或者
2. 默认走 `history.back()`，失败时回退到 `/`，或者
3. 显式支持 `backTo`，由上层提供语义。

### 7. Home 保活逻辑的影响范围需要重新表述（P2）

`src/routes/(main)/home/_layout/index.tsx` 中：

```tsx
const [hasActivated, setHasActivated] = useState(isHomeRoute);
if (!hasActivated) return null;
```

但 `src/routes/(main)/_layout/index.tsx` 里，`DesktopHomeLayout` 只包裹 `DesktopHome`，**不包裹主 `Outlet`**。\
因此，之前 “深链首屏可能白屏” 的表述过强。

更准确的结论是：

- 从非 `/` 深链进入桌面主布局时，`DesktopHome` 这棵树初始不会渲染；
- 影响的是 Home 侧区域 / 保活区，而不是整个主内容区一定白屏；
- 是否造成可见问题，要结合 `DesktopHome` 的实际职责再实机验证。

**落地建议**：

1. 如果保活区必须全程可用，就不要依赖 “先访问 `/` 才激活”。
2. 若只是优化型保活，文档里应明确它不影响主 `Outlet` 渲染。

---

## 二、需要实机验证或产品决策的项

### 1. 全局滚动策略：`100dvh` + `device-width` + 外壳滚动接管

`src/styles/global.ts` 中：

- `html/body/#__next` 使用 `max-height: 100dvh`
- `@media (device-width >= 576px)` 时 `overflow: hidden`

这类策略本身不是 bug，但风险点明确：

- 浏览器窗口宽度与 `device-width` 心智不一致
- 软键盘场景下 `dvh` 表现需要真机验证
- 任何内层滚动容器漏接都会变成 “内容看得见但滚不到”

**建议**：单独做浏览器 / 设备矩阵走查，不要只靠桌面 Chrome 判断。

### 2. 脚注与输入区叠层

输入区脚注使用 `zIndex: 100`，全屏输入区也在同级叠层体系中。\
从代码上可以确认 “叠层关系紧耦合”，但是否形成真实遮挡仍需 UI 走查。

### 3. 触摸热区、空状态高度、硬编码颜色

这些问题在代码中能找到样例，但更适合在一轮视觉 / 交互收敛时统一修：

- 触摸热区未统一到可点击安全尺寸
- 空状态高度在 `30vh`、`50vh` 等多处不一致
- 局部硬编码颜色仍在绕过主题 token

---

## 三、持续性一致性债务

### 1. i18n 仍有用户可见英文提示

可以直接检出多处未走 `t()` 的用户提示，例如：

- `src/features/ResourceManager/components/LibraryHierarchy/HierarchyNode.tsx`
- `src/features/ResourceManager/components/Explorer/ItemDropdown/useFileItemDropdown.tsx`
- `src/routes/(main)/home/_layout/hooks/useCreateMenuItems.tsx`
- `src/routes/(main)/agent/cron/[cronId]/index.tsx`

这类问题不一定是 P0，但如果这些审计文档后续要作为实现依据，**建议把 “所有用户可见文案必须走 i18n” 写成硬规则**。

### 2. `focus-visible` / `aria` /reduced motion 还没有形成统一规范

当前更像 “局部有实践，但没有体系”：

- 键盘焦点轨迹不稳定
- `aria-*` 和 landmark 使用零散
- `prefers-reduced-motion` 未成为统一入口

如果后面要系统性修 UI/UX，建议单独开一个无障碍与交互规范任务，而不是散点修。

### 3. 断点、z-index、交互动效缺少统一约束

这不是单点 bug，但会让新功能持续复制旧问题：

- 断点常量部分依赖 antd，部分手写
- `z-index` 缺少分层表
- 动效配置更多来自组件局部，而不是系统偏好与全局规范

---

## 四、建议实施顺序

1. 统一列表页请求四态，先把 “失败仍显示 Loading” 清掉。
2. 明确全局错误提示边界，再改 tRPC 默认错误行为。
3. 收敛 Web 端 `isMobile` 判定来源，避免后续继续混用。
4. 修正输入区焦点与 hover-only 操作，让桌面键盘和触屏路径都成立。
5. 重新定义返回按钮语义，不再把 “返回” 和 “回首页” 混写。
6. 用一轮专项修复处理 i18n、focus-visible、reduced-motion、断点和 z-index 债务。

---

## 五、主要代码索引

| 区域              | 路径                                               |
| ----------------- | -------------------------------------------------- |
| SPA 全局 Provider | `src/layout/SPAGlobalProvider/index.tsx`           |
| 视口判定 Hook     | `src/hooks/useIsMobile.ts`                         |
| 桌面主布局        | `src/routes/(main)/_layout/index.tsx`              |
| Home 保活布局     | `src/routes/(main)/home/_layout/index.tsx`         |
| 返回按钮          | `src/features/NavPanel/components/BackNav.tsx`     |
| 桌面输入区        | `src/features/ChatInput/Desktop/index.tsx`         |
| 全局样式          | `src/styles/global.ts`                             |
| tRPC 客户端错误链 | `src/libs/trpc/client/lambda.ts`                   |
| SWR 默认策略      | `src/libs/swr/index.ts`                            |
| 社区列表示例      | `src/routes/(main)/community/(list)/mcp/index.tsx` |

---

**修订说明**：本次修订删除了 “首屏一定白屏”“Portal 必然造成错误侧栏残留” 等无法仅凭静态代码直接定性的表述，并把深链、叠层、滚动等问题统一降级为 “需验证风险”，以便后续按真实行为落地。
