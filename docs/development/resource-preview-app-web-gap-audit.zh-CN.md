# 资源预览实现差距审计：App vs Web

本文档审计资源（文件）预览在移动端 App 与 Web 端之间的实现差异，重点排查为何 Web 能正常预览而 App 显示「无法加载预览」。

**审计范围**：

- **Web**：`src/features/FileViewer`、`src/routes/(main)/resource`、`src/features/Portal/FilePreview`
- **App**：`apps/mobile/src/screens/ResourceScreen.tsx`、`FilePreviewModal`、`fileApi`
- **后端**：`src/app/(backend)/f/[id]/route.ts`（文件代理）、`src/server/routers/lambda/file.ts`

---

## 一、URL 与代理机制（共享）

### 1.1 文件 URL 格式

- **统一格式**：`${APP_URL}/f/${fileId}`
- **后端**：`file.getFiles`、`file.createFile` 等返回 `url: getFileProxyUrl(item.id)` = `${appEnv.APP_URL}/f/${id}`
- **GET /f/:id**：查询 DB → 生成 S3 预签名 URL（5 分钟有效）→ 302 重定向到 S3，或混合内容时直接代理返回字节流

### 1.2 请求流程

```
客户端请求 https://example.com/f/file-id
  → 服务端查 DB 取 file 记录
  → FileService.createPreSignedUrlForPreview(file.url, 300)
  → 302 重定向到 S3 预签名 URL
  → 客户端（浏览器/Image/WebView）跟随重定向加载文件
```

---

## 二、Web 端实现

### 2.1 组件与数据流

| 入口               | 组件               | 数据来源                                             | URL 来源             |
| ------------------ | ------------------ | ---------------------------------------------------- | -------------------- |
| 资源页 /resource   | `FilePreview`      | `useFileStore(fileManagerSelectors.getFileById(id))` | file.url（API 返回） |
| Portal 文件预览    | `FilePreview/Body` | `useFetchFileItem(previewFileId)`                    | data.url             |
| 知识库 ChunkDrawer | `FileContent`      | `useFileStore`                                       | displayFile.url      |

### 2.2 FileViewer 渲染器

| 类型        | 渲染器        | 用法                                                      |
| ----------- | ------------- | --------------------------------------------------------- |
| PDF         | `PDFViewer`   | react-pdf `Document file={url}`，直接 fetch               |
| 图片        | `ImageViewer` | `<img src={url}>`                                         |
| 视频        | `VideoViewer` | `<video src={url}>`                                       |
| Office      | `MSDocViewer` | iframe `view.officeapps.live.com/op/embed.aspx?src={url}` |
| 代码 / 文本 | `CodeViewer`  | `useTextFileLoader(url)` → fetch                          |
| 不支持      | `NotSupport`  | 仅下载按钮                                                |

### 2.3 特点

- **同源**：Web 与 API 同域，请求 `/f/:id` 时自动带 cookie，无 CORS 问题
- **Office**：使用 **Microsoft** Office Online Viewer（`view.officeapps.live.com`）
- **PDF**：使用 react-pdf 原生渲染，支持高亮、分页

---

## 三、App 端实现

### 3.1 组件与数据流

| 入口           | 组件               | 数据来源                   | URL 构建 |
| -------------- | ------------------ | -------------------------- | -------- |
| ResourceScreen | `FilePreviewModal` | `fileApi.list()` → `files` | 见下     |

### 3.2 URL 构建逻辑（ResourceScreen）

```ts
// loadFiles 时: setApiBase(await getApiUrl())
const base = apiBaseUrl?.replace(/\/$/, '') || '';
const fileUrl =
  base && base.startsWith('http')
    ? `${base}/f/${item.id}` // 优先：客户端配置的 base
    : item.url?.startsWith('http')
      ? item.url // 回退：API 返回的 url
      : '';
```

- **apiBaseUrl**：来自 `getApiUrl()` → AsyncStorage 或 `DEFAULT_API_URL`（`EXPO_PUBLIC_API_URL` 或 `http://localhost:3010`）
- **item.url**：API `file.getFiles` 返回的 `${APP_URL}/f/${id}`

### 3.3 FilePreviewModal 渲染逻辑

| 类型            | 渲染方式    | 实现                                                                                |
| --------------- | ----------- | ----------------------------------------------------------------------------------- |
| 图片            | `ExpoImage` | `source={{ uri: fileUrl }}`                                                         |
| PDF             | `WebView`   | fetch 跟随 302 → `FileReader.readAsDataURL` → `source={{ uri: pdfDataUrl }}`        |
| Office          | `WebView`   | `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}` |
| 文本 / Markdown | 原生        | fetch 跟随 302 → Markdown 组件或 ScrollView+Text                                    |
| 其他            | 占位        | 图标 + 下载按钮，显示 `resourcePreviewUnavailable`                                  |

### 3.4 缩略图（FileRow）

```ts
const thumbnailUrl = isImage(item.fileType)
  ? (base && base.startsWith('http') ? `${base}/f/${item.id}` : item.url) || null
  : null;
```

---

## 四、关键差异对比

| 维度                | Web                      | App                                                                            |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| **URL 来源**        | API 返回 `url`，直接使用 | 优先用 `getApiUrl()` 拼 `${base}/f/${id}`，否则用 `item.url`                   |
| **PDF**             | react-pdf 原生组件       | fetch 跟随 302 → data URL → WebView（避免 WebView 对 302 处理不稳定）          |
| **Office**          | Microsoft Office Viewer  | Microsoft Office Viewer（已与 Web 对齐）                                       |
| **文本 / Markdown** | CodeViewer fetch → 渲染  | fetch 跟随 302 → Markdown 组件或 Text（避免 WebView 302 问题）                 |
| **认证**            | 同源 cookie 自动携带     | WebView 不共享 native 的 `X-lobe-chat-auth` 等 header；但 `/f/:id` 不校验 auth |
| **baseUrl 时机**    | 无（直接用 API url）     | `loadFiles` 异步设置 `apiBase`，若未完成或失败则为空                           |

---

## 五、可能导致 App 预览失败的原因

### 5.1 apiBase 为空或错误

- **场景**：`loadFiles` 因 `!isConnected` 提前 return，`setApiBase` 未执行
- **结果**：`apiBase` 保持初始 `''`，`fileUrl` 回退到 `item.url`
- **若 item.url 正常**：应能工作；若 API 未返回 url 或格式异常则失败

### 5.2 localhost 在真机不可达

- **场景**：开发时 `DEFAULT_API_URL = http://localhost:3010`，在真机调试
- **结果**：设备上的 localhost 指向设备自身，无法访问开发机 → 请求失败

### 5.3 WebView 与认证

- **/f/:id 不校验 auth**：理论上无需 cookie/header
- **若未来加鉴权**：WebView 需单独注入 cookie 或 token，否则会 401

### 5.4 Office 文档（已修复）

- **Web**：Microsoft Office Viewer（`view.officeapps.live.com`）
- **App**：已改为 Microsoft Office Viewer，与 Web 一致（此前为 Google Docs Viewer，存在重定向限制）

### 5.5 WebView 安全策略

- **iOS ATS**：非 HTTPS 可能被拦截（`normalizeApiUrl` 对公网会强制 https）
- **Android**：`cleartextTrafficPermitted` 等配置影响 http

### 5.6 自建部署

- **S3 未配置**：`createPreSignedUrlForPreview` 可能抛错，/f/:id 返回 500
- **APP_URL 与用户配置不一致**：API 返回的 `item.url` 与用户 `getApiUrl()` 不同域时，若 base 错误会拼出错误 URL

---

## 六、建议排查步骤（不涉及改代码）

1. **确认 apiBase**：在 `FilePreviewModal` 打开时打印 `apiBaseUrl`、`fileUrl`、`item.url`
2. **确认网络**：在 App 内用 WebView 或系统浏览器直接打开 `fileUrl`，看是否能加载
3. **区分类型**：图片 / PDF / Office 是否全部失败，还是仅 Office 失败（指向 Google Viewer 问题）
4. **检查后端**：直接 `curl -I https://your-server/f/{fileId}` 看是否 302 且 Location 为有效 S3 URL
5. **自建环境**：确认 S3 与 APP_URL 配置正确

---

## 七、与 Web 对齐的改进方向（供后续实现参考）

1. **Office**：已改用 Microsoft Office Viewer，与 Web 一致
2. **PDF**：已通过 fetch + data URL 解决 WebView 302 问题；可评估 react-pdf 或专用 PDF 库以提升体验
3. **文本 / Markdown**：已通过 fetch + Markdown/Text 组件解决 WebView 302 问题
4. **URL 回退**：当 `apiBase` 为空时，优先使用 `item.url`，并确保 API 始终返回完整 `url`
5. **错误反馈**：已增加 `previewLoadFailed` 状态，fetch 失败或 `!res.ok` 时显示「无法加载预览」
