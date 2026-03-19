# 上传/下载性能审计：App 端与 Server 端

## 一、整体流程概览

### 上传流程（Mobile → Server）

```
[App] ensureUploadableUri → getLocalFileDescriptor → checkFileHash (tRPC)
       ↓
[App] uploadFileToSameOrigin (POST /api/file/upload)
       ↓
[Server] formData.arrayBuffer() → S3.uploadBuffer
       ↓
[App] file.createFile (tRPC)
       ↓
[Server] getFileMetadata (S3 HeadObject) → fileModel.create
```

### 下载流程（Mobile ← Server）

```
[App] FileSystem.createDownloadResumable(GET /f/:id)
       ↓
[Server] Redis 缓存 presigned URL？
       ↓ 未命中
[Server] DB 查文件 → createPreSignedUrlForPreview (S3)
       ↓
[Server] shouldProxyFileResponse？
  - 是（HTTPS app + HTTP S3）：getFileByteArray 拉取全文件 → 代理返回
  - 否：302 重定向到 presigned URL
       ↓
[App] 接收文件流写入本地
```

---

## 二、App 端瓶颈

### 2.1 高优先级：getLocalFileDescriptor 全文件读入

**位置**：`apps/mobile/src/lib/api.ts` 第 197-221 行

**问题**：当 `FileSystem.getInfoAsync(uri, { md5: true })` 返回的 `info.md5` 为空时（部分平台/部分 URI 类型），会执行：

```ts
const base64 = await FileSystem.readAsStringAsync(uri, {
  encoding: FileSystem.EncodingType.Base64,
});
return { hash: computeStringHash(base64), size: approxSize };
```

- **全文件读入内存**：大文件（如 50MB）会生成约 67MB 的 base64 字符串
- **内存与耗时**：移动端内存紧张，易 OOM；读盘 + 哈希计算耗时明显
- **computeStringHash**：FNV 风格哈希，与 Web 的 sha256 不兼容，无法跨端去重（仅影响去重，不影响功能）

**建议**：
- 使用流式/分块哈希（如 expo-crypto 的 incremental hash），避免一次性读入
- 或对超大文件（如 >10MB）跳过哈希，直接上传（牺牲去重）
- 确认各平台 `md5: true` 的可用性，减少 fallback 触发

### 2.2 高优先级：ensureUploadableUri 额外拷贝

**位置**：`apps/mobile/src/lib/api.ts` 第 128-142 行

**问题**：当 URI 非 `file://`（如相册 `ph://`、`assets-library://`）时，会先 `FileSystem.copyAsync` 到 `upload-cache/`，再上传。

- 大文件会多一次完整拷贝，增加 I/O 和等待时间

**建议**：
- 评估 expo-file-system 是否支持直接从 `ph://` 等 URI 上传
- 若必须拷贝，可考虑后台任务或延迟到真正需要上传时再执行

### 2.3 中优先级：串行 RTT

**现状**：checkFileHash → upload → createFile 严格串行，至少 3 次网络往返。

**建议**：
- checkFileHash 与 createFile 无法并行（逻辑依赖）
- 可考虑将 checkFileHash 与「准备上传」并行，减少首包等待（收益有限）

### 2.4 中优先级：发送消息时多附件串行上传

**位置**：`apps/mobile/src/store/chat.ts` 约 1249 行

**现状**：`Promise.all(attachments.map(uploadFile))`，多个文件并行上传，但每个文件内部仍是串行流程。

**建议**：当前并行已合理；若单文件流程优化，整体会同步改善。

---

## 三、Server 端瓶颈

### 3.1 高优先级：上传接口全量缓冲

**位置**：`src/app/(backend)/api/file/upload/route.ts` 第 51 行

```ts
const fileBuffer = Buffer.from(await file.arrayBuffer());
await s3.uploadBuffer(pathname, fileBuffer, file.type || 'application/octet-stream');
```

**问题**：
- `file.arrayBuffer()` 将整个 multipart 文件读入内存
- 大文件（如 100MB）会占用 100MB+ 的 Node 堆内存
- S3 `PutObjectCommand` 使用 `Body: buffer`，也是一次性上传，无流式

**建议**：
- 使用 `Readable.fromWeb(request.body)` 或 Node `stream` 流式读取
- S3 SDK 支持 `Body` 为 `Readable`，可流式上传，降低内存峰值

### 3.2 高优先级：createFile 中的 getFileMetadata

**位置**：`src/server/routers/lambda/file.ts` 第 81-90 行

**问题**：`createFile` 在写入 DB 前会调用 `ctx.fileService.getFileMetadata(input.url)`（S3 HeadObject），用于校验实际大小和 contentType。

- 上传刚完成，紧接着一次 S3 HeadObject，增加约 50–200ms 延迟
- 若信任客户端传入的 size/type，可跳过；但存在篡改风险

**建议**：
- 保留校验逻辑，作为安全策略
- 若对延迟敏感，可改为异步校验或仅在异常时校验

### 3.3 高优先级：下载代理模式全量拉取

**位置**：`src/app/(backend)/f/[id]/route.ts` 第 91-103 行

**问题**：当 `shouldProxyFileResponse(redirectUrl)` 为 true 时（App 为 HTTPS，S3 返回 HTTP presigned URL，存在混合内容问题），会：

```ts
const byteArray = await fileService.getFileByteArray(file.url);
return new Response(byteArray as unknown as BodyInit, { ... });
```

- 从 S3 拉取**整个文件**到服务器内存
- 再通过 Response 一次性返回给客户端
- 大文件会导致：服务器内存峰值高、延迟大、带宽浪费（S3→Server→Client 双倍传输）

**建议**：
- 使用流式代理：`Readable.fromWeb((await fetch(presignedUrl)).body)` → `new Response(stream)`
- 或配置 S3 使用 HTTPS 公网域名，避免混合内容，直接 302 重定向，无需代理

### 3.4 中优先级：Redis 未命中时的链路

**现状**：每次 Redis 未命中需：建立 DB 连接、查文件、创建 FileService、调用 S3 生成 presigned URL。

**建议**：
- 已使用 Redis 缓存 presigned URL（TTL 4 分钟），命中时跳过上述步骤
- 可适当延长 TTL 或对热点文件做预热（若存在明显热点）

### 3.5 中优先级：DB 连接

**现状**：每次请求 `getServerDB()`，可能有连接池复用。

**建议**：确认 Drizzle/Postgres 连接池配置合理，避免冷启动或连接耗尽。

---

## 四、Hash 与去重差异

| 端   | Hash 算法              | 格式示例        |
|------|------------------------|-----------------|
| Web  | sha256 (js-sha256)     | 64 位 hex       |
| Mobile (md5 可用) | expo getInfoAsync md5 | 32 位 hex (MD5) |
| Mobile (md5 不可用) | computeStringHash (FNV) | `mobile-{len}-{hex}` |

- Web 与 Mobile 使用不同哈希，**跨端无法去重**
- Mobile 内部：md5 可用时能去重；md5 不可用时每次都会上传新文件

---

## 五、优化优先级汇总

| 优先级 | 位置       | 问题                     | 建议                         |
|--------|------------|--------------------------|------------------------------|
| 高     | App        | getLocalFileDescriptor 全文件读入 | 流式/分块哈希或大文件跳过哈希 |
| 高     | App        | ensureUploadableUri 额外拷贝     | 评估直接上传或延迟拷贝        |
| 高     | Server     | 上传 route 全量 arrayBuffer     | 流式读取 + 流式上传 S3        |
| 高     | Server     | 下载代理 getFileByteArray 全量   | 流式代理或 S3 HTTPS 直连      |
| 中     | Server     | createFile 中 getFileMetadata    | 视安全策略决定是否异步/按需   |
| 中     | 两端       | 串行 RTT                     | 可做小幅并行优化              |

---

## 六、相关代码路径

| 模块         | 路径 |
|--------------|------|
| App 上传入口 | `apps/mobile/src/lib/api.ts` (fileApi.upload, getLocalFileDescriptor, uploadFileToSameOrigin) |
| App 下载     | `apps/mobile/src/lib/api.ts` (fileApi.download) |
| App 文件 Store | `apps/mobile/src/store/file.ts` |
| Server 上传 API | `src/app/(backend)/api/file/upload/route.ts` |
| Server 文件代理 | `src/app/(backend)/f/[id]/route.ts` |
| Server file.createFile | `src/server/routers/lambda/file.ts` |
| S3 实现       | `src/server/modules/S3/index.ts`, `src/server/services/file/impls/s3.ts` |
