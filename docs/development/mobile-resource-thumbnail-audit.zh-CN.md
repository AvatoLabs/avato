# 资源图片缩略图实现审计：Mobile vs Web

## 一、实现概览

| 维度 | Web | Mobile |
|------|-----|--------|
| **列表视图** | 无图片缩略图，仅 FileIcon | 有图片缩略图 |
| **网格视图** | 有图片预览（MasonryView） | 有图片预览（Grid） |
| **URL 来源** | getFullFileUrl（presigned） | /f/:id 代理或 item.url |
| **懒加载** | IntersectionObserver | 无，可见即加载 |
| **缩略图尺寸** | 无专用缩略图，原图 | 无专用缩略图，原图 |

---

## 二、Web 端实现

### 2.1 ListView（列表模式）

**位置**：`src/features/ResourceManager/components/Explorer/ListView/ListItem/index.tsx`

- **图片文件**：使用 `FileIcon`，**不显示图片缩略图**
- 所有文件类型统一用图标（FolderIcon、FileText、FileIcon）
- 无图片预览能力

### 2.2 MasonryView（瀑布流/网格模式）

**位置**：`src/features/ResourceManager/components/Explorer/MasonryView/MasonryItem/ImageFileItem.tsx`

- **图片文件**：使用 antd `Image`，`src={url}`
- **URL**：来自 `getKnowledgeItems` 返回的 `url`（`getFullFileUrl` 生成的 presigned URL）
- **懒加载**：`isInView` + `loading="lazy"`，通过 IntersectionObserver 仅在进入视口时加载
- **预览**：`preview={{ src: url }}` 支持点击放大
- **加载前**：占位显示 FileIcon + 文件名 + 大小
- **无缩略图**：直接使用原图 URL，浏览器按容器尺寸缩放显示

### 2.3 数据流

```
getKnowledgeItems → url: await ctx.fileService.getFullFileUrl(item.url)
→ 返回 presigned URL 或公网直链
→ Image 组件 src={url}，浏览器直接请求
```

---

## 三、Mobile 端实现

### 3.1 ListView（FileRow 列表模式）

**位置**：`apps/mobile/src/screens/ResourceScreen.tsx` 约 833–970 行

- **图片文件**：显示缩略图（48×48 或 64×64）
- **实现方式**：
  1. `thumbnailUrl` = `/f/${id}` 或 `item.url`
  2. `fetch(thumbnailUrl, { redirect: 'follow' })` 拉取**完整原图**
  3. `res.blob()` → `FileReader.readAsDataURL(blob)` 转为 data URL
  4. `ExpoImage source={thumbnailDataUrl}` 显示

- **原因**：注释写明「native Image may not follow 302」——React Native 的 Image 对 302 重定向支持不稳定，故先 fetch 再转 data URL
- **问题**：拉取的是**原图**，无尺寸裁剪，大图（如 5MB）也会完整下载，仅用于小缩略图

### 3.2 Grid 模式

**位置**：`apps/mobile/src/screens/ResourceScreen.tsx` 约 1835–1850 行

- **图片文件**：`ExpoImage source={{ uri: buildRemoteFileCandidates(apiBase, item)[0] }}`
- **实现**：直接使用 URL，依赖 ExpoImage 处理重定向
- **无 data URL 转换**：与 ListView 不同，此处未做 fetch → data URL

### 3.3 数据流

```
resourceApi.getKnowledgeItems → items（含 id、url）
→ buildRemoteFileCandidates: proxyUrl = `${base}/f/${id}`
→ ListView: fetch → blob → data URL → ExpoImage
→ Grid: 直接 uri → ExpoImage
```

---

## 四、差距与问题

### 4.1 功能差异

| 能力 | Web | Mobile |
|------|-----|--------|
| 列表模式图片缩略图 | ❌ 无 | ✅ 有 |
| 网格模式图片预览 | ✅ 有 | ✅ 有 |
| 懒加载 | ✅ IntersectionObserver | ❌ 无 |
| 点击预览/放大 | ✅ Image.preview | ✅ FilePreviewModal |
| 专用缩略图 API | ❌ 无 | ❌ 无 |

### 4.2 性能问题（Mobile ListView）

1. **拉取原图**：为 48×48 缩略图拉取完整原图，带宽浪费明显
2. **内存**：每张图转 base64 data URL，体积约增加 33%，且常驻内存
3. **无懒加载**：可见行全部加载，列表长时并发请求多
4. **无缓存策略**：每次进入列表都会重新 fetch

### 4.3 与 Web 的架构差异

- **Web ListView**：不展示图片缩略图，仅图标，无上述性能问题
- **Web Masonry**：用原图 URL + 懒加载，由浏览器负责缩放与缓存
- **Mobile ListView**：为展示缩略图，采用 fetch → data URL，代价较高

---

## 五、优化建议

### 5.1 短期（不改后端）

1. **ListView 改为直接使用 URL**：若 ExpoImage 在目标平台能正确跟随 302，可去掉 fetch → data URL，与 Grid 一致
2. **懒加载**：用 FlatList 的 `windowSize`、`initialNumToRender` 或 `onViewableItemsChanged` 控制缩略图加载时机
3. **失败回退**：URL 直接加载失败时，再回退到 fetch → data URL

### 5.2 中期（需后端支持）

1. **缩略图 API**：如 `GET /f/:id/thumb?w=96&h=96`，服务端生成或返回小图，减少传输
2. **或**：在 `getKnowledgeItems` 中增加 `thumbnailUrl` 字段，由后端生成/存储缩略图

### 5.3 与 Web 对齐的选项

1. **列表模式不展示图片缩略图**：与 Web ListView 一致，仅用 FileIcon，避免当前性能问题
2. **保留缩略图**：则需引入缩略图 API 或优化加载策略（懒加载 + 直接 URL）

---

## 六、相关代码路径

| 模块 | 路径 |
|------|------|
| Mobile ListView 缩略图 | `apps/mobile/src/screens/ResourceScreen.tsx` FileRow, 约 876–967 行 |
| Mobile Grid 缩略图 | `apps/mobile/src/screens/ResourceScreen.tsx` 约 1835 行 |
| Web ListView | `src/features/ResourceManager/.../ListView/ListItem/index.tsx` |
| Web Masonry 图片 | `src/features/ResourceManager/.../MasonryView/MasonryItem/ImageFileItem.tsx` |
| API URL 解析 | `src/server/routers/lambda/knowledge.ts` getKnowledgeItems |
| 文件代理 | `src/app/(backend)/f/[id]/route.ts` |
