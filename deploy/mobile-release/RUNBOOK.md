# Avato Mobile Canary 发布 Runbook

这份文档记录 `apps/mobile` 的自建 Android 发布链路，目标是让 `canary` 同时具备这两种能力：

- 提供可安装的 APK 基线包
- 提供可灰度迭代的 OTA 热更新

当前线上默认地址：

- 服务入口: `http://8.217.101.26:3212`
- OTA manifest: `http://8.217.101.26:3212/api/manifest`
- 最新 canary APK: `http://8.217.101.26:3212/apk/canary/latest.apk`
- 服务端部署目录: `/opt/avato-mobile-release`
- APK 上传用户: `avato_release`

## 1. 总体架构

发布链路由 3 部分组成：

1. `apps/mobile` 构建 Android release APK
2. `apps/mobile` 导出 Expo OTA bundle 并上传到 OTA 服务
3. 服务端用 Nginx 同时暴露 OTA API 和静态 APK 下载目录

组件分工：

- `expo-updates`: 客户端热更新能力
- `xaviaio/xavia-ota`: 自建 Expo Updates 协议服务
- `deploy/mobile-release/xavia-ota/Dockerfile`: 构建 patched Xavia 镜像
- `deploy/mobile-release/xavia-ota/patch-api-bundles.js`: 修复 upstream Postgres manifest 查询缺少 `update_id` 的问题
- `deploy/mobile-release/postgres/init/001-schema.sql`: 初始化 `releases` 和 `releases_tracking`
- `deploy/mobile-release/nginx/default.conf`: 暴露 `/api/*` 和 `/apk/*`

## 2. 关键约束

### 2.1 APK 和 OTA 必须共用同一个 `runtimeVersion`

这套方案里，`runtimeVersion` 不是手写字符串，而是通过下面命令按 Android 原生工程指纹生成：

```bash
npx expo-updates fingerprint:generate --platform android
```

只要 Android 原生文件变了，指纹就会变。客户端只会接收与自己 `runtimeVersion` 完全一致的 OTA。

因此发布时必须保证：

- 先同步 Android 原生覆盖层
- 再生成 fingerprint
- 再构建 APK
- 再发布 OTA

如果顺序错了，就会出现 “APK 能装，但拉不到热更新” 的问题。

### 2.2 `apps/mobile/android` 是忽略目录，不能把运行态改动当成版本资产

仓库里 `apps/mobile/android` 被忽略，所以不能依赖本机残留改动。当前做法是把必须的原生 OTA 配置放到版本化覆盖层：

- `apps/mobile/native-overlays/android/gradle.properties`
- `apps/mobile/native-overlays/android/settings.gradle`
- `apps/mobile/native-overlays/android/app/build.gradle`
- `apps/mobile/native-overlays/android/app/src/main/AndroidManifest.xml`

发布前统一执行：

```bash
npm run sync:android:release
```

对应脚本：

- `apps/mobile/scripts/sync-android-release-overlay.sh`

这个脚本会：

- 如果 `android/` 不存在，先执行 `npx expo prebuild --platform android --no-install`
- 再把 overlay 文件覆盖到真实 Android 工程

## 3. 代码入口

日常只需要记住这几类文件：

### 3.1 客户端

- `apps/mobile/app.config.ts`
- `apps/mobile/src/lib/ota.ts`
- `apps/mobile/App.tsx`
- `apps/mobile/index.js`

### 3.2 发布脚本

- `apps/mobile/scripts/sync-android-release-overlay.sh`
- `apps/mobile/scripts/build-canary-apk.sh`
- `apps/mobile/scripts/publish-canary-ota.sh`
- `apps/mobile/scripts/upload-canary-apk.sh`

### 3.3 服务端

- `deploy/mobile-release/docker-compose.yml`
- `deploy/mobile-release/.env.example`
- `deploy/mobile-release/nginx/default.conf`
- `deploy/mobile-release/postgres/init/001-schema.sql`
- `deploy/mobile-release/xavia-ota/Dockerfile`
- `deploy/mobile-release/xavia-ota/patch-api-bundles.js`

### 3.4 CI

- `.github/workflows/mobile-canary-ota.yml`

## 4. 本地发布流程

以下命令都在 `apps/mobile` 目录执行。

### 4.1 前置环境

本地至少需要这些变量：

- `AVATO_OTA_SERVER_URL`
- `AVATO_OTA_UPLOAD_KEY`
- `AVATO_RELEASE_STORE_FILE`
- `AVATO_RELEASE_STORE_PASSWORD`
- `AVATO_RELEASE_KEY_ALIAS`
- `AVATO_RELEASE_KEY_PASSWORD`
- `AVATO_SERVER_HOST`
- `AVATO_SERVER_USER`
- `AVATO_SERVER_PORT`
- `AVATO_RELEASE_PUBLIC_BASE_URL`
- `AVATO_RELEASE_SERVER_DIR`

上传 APK 二选一：

- 推荐: `AVATO_SERVER_SSH_KEY_PATH`
- 兼容回退: `AVATO_SERVER_PASSWORD`

### 4.2 同步 Android 发布覆盖层

```bash
npm run sync:android:release
```

用途：

- 生成或刷新 `android/`
- 注入 OTA 所需的原生配置
- 为后续 fingerprint、APK、OTA 保持一致输入

### 4.3 构建 canary APK

```bash
npm run build:android:canary
```

脚本输出会包含：

- `runtimeVersion=...`
- `versionCode=...`
- `versionName=...`
- `apk=/absolute/path/to/file.apk`

产物目录：

- `apps/mobile/dist/apk/canary/`

### 4.4 发布 canary OTA

```bash
npm run publish:ota:canary
```

这个脚本会：

- 再次同步 Android overlay
- 再次生成与 APK 相同逻辑的 fingerprint
- 执行 `npx expo export --platform android`
- 打包 zip
- 上传到 `POST /api/upload`

脚本输出会包含：

- `runtimeVersion=...`
- `channel=canary`
- `bundle=/absolute/path/to/file.zip`

### 4.5 上传最新 APK

```bash
npm run upload:apk:canary -- /absolute/path/to/file.apk
```

如果不传路径，脚本默认上传 `dist/apk/canary/` 里最新的 APK。

服务端目录结构：

- `apk/canary/versions/<apk-file>`
- `apk/canary/latest.apk` 通过软链指向当前版本

成功后可直接访问：

```bash
http://8.217.101.26:3212/apk/canary/latest.apk
```

### 4.6 推荐手动顺序

```bash
cd /Users/arthur/RustroverProjects/lobehub/apps/mobile

npm run sync:android:release
npm run build:android:canary
npm run publish:ota:canary
npm run upload:apk:canary
```

## 5. 服务端部署流程

服务端目录固定为：

```bash
/opt/avato-mobile-release
```

### 5.1 目录准备

至少需要这些内容：

- `.env`
- `docker-compose.yml`
- `nginx/default.conf`
- `postgres/init/001-schema.sql`
- `xavia-ota/`
- `apk/canary/versions/`
- `data/postgres/`
- `data/releases/`

建议直接把 `deploy/mobile-release/` 同步到服务器后再补 `.env`。

### 5.2 环境变量

服务端 `.env` 基于 `deploy/mobile-release/.env.example`：

- `PUBLIC_PORT`
- `PUBLIC_BASE_URL`
- `POSTGRES_PASSWORD`
- `ADMIN_PASSWORD`
- `UPLOAD_KEY`
- `PRIVATE_KEY_BASE64`

说明：

- `PUBLIC_BASE_URL` 必须与对外访问地址一致
- `PRIVATE_KEY_BASE64` 用于 Expo Updates code signing
- `UPLOAD_KEY` 用于 OTA bundle 上传鉴权

### 5.3 启动或更新服务

在服务器的 `/opt/avato-mobile-release` 下执行：

```bash
docker compose build xavia-ota
docker compose up -d
```

常用检查：

```bash
docker compose ps
docker compose logs -f xavia-ota
docker compose logs -f nginx
docker compose logs -f postgres
```

### 5.4 为什么必须使用 patched Xavia

upstream Xavia 的 Postgres manifest 查询缺少 `update_id`，会导致服务端在某些请求头组合下误判为 `noUpdateAvailable`。

当前修复方式：

- 构建自定义镜像 `avato/xavia-ota:patched`
- 在镜像构建阶段执行 `patch-api-bundles.js`

如果以后升级 Xavia 版本，先重新验证这个 patch 是否仍然需要。

## 6. APK 上传用户

CI 和日常上传都不应该继续使用 `root`。当前约定：

- 用户名: `avato_release`
- 登录方式: SSH 公钥
- 密码登录：禁用

权限要求：

- `avato_release` 需要对 `/opt/avato-mobile-release/apk/canary` 有写权限

典型做法：

1. 创建 `avato_release`
2. 配置 `~/.ssh/authorized_keys`
3. 将 `apk/canary` 和 `apk/canary/versions` 所有权切给该用户
4. 在 sshd 中对该用户关闭密码登录

本地上传示例：

```bash
AVATO_SERVER_HOST=8.217.101.26 \
  AVATO_SERVER_PORT=22 \
  AVATO_SERVER_USER=avato_release \
  AVATO_SERVER_SSH_KEY_PATH=~/.ssh/avato-mobile-release-ci \
  AVATO_RELEASE_PUBLIC_BASE_URL=http://8.217.101.26:3212 \
  AVATO_RELEASE_SERVER_DIR=/opt/avato-mobile-release \
  npm run upload:apk:canary
```

## 7. GitHub Actions 自动发布

工作流文件：

- `.github/workflows/mobile-canary-ota.yml`

触发条件：

- `canary` 分支 push 且改动落在 `apps/mobile/**`
- 手动 `workflow_dispatch`

CI 流程：

1. 安装 Node、Java、Android SDK
2. `npm ci`
3. 还原 Android 签名 keystore
4. 可选还原 APK 上传 SSH 私钥
5. 构建 canary APK
6. 发布 canary OTA
7. 比对 APK 和 OTA 的 `runtimeVersion`
8. 上传 `latest.apk`

必须配置的 GitHub secrets：

- `AVATO_OTA_SERVER_URL`
- `AVATO_OTA_UPLOAD_KEY`
- `AVATO_ANDROID_KEYSTORE_BASE64`
- `AVATO_RELEASE_STORE_PASSWORD`
- `AVATO_RELEASE_KEY_ALIAS`
- `AVATO_RELEASE_KEY_PASSWORD`
- `AVATO_SERVER_HOST`
- `AVATO_SERVER_PORT`
- `AVATO_SERVER_USER`
- `AVATO_SERVER_SSH_PRIVATE_KEY`
- `AVATO_RELEASE_PUBLIC_BASE_URL`
- `AVATO_RELEASE_SERVER_DIR`

说明：

- `AVATO_SERVER_USER` 应为 `avato_release`
- `AVATO_SERVER_PASSWORD` 不建议放进 CI；只保留本地人工回退用途

## 8. 发布后校验

### 8.1 校验 APK 是否在线

```bash
curl -I http://8.217.101.26:3212/apk/canary/latest.apk
```

预期：

- HTTP 200

### 8.2 校验指定 `runtimeVersion` 能否拿到 manifest

```bash
curl -i \
  -H 'expo-platform: android' \
  -H 'expo-runtime-version: <runtimeVersion>' \
  -H 'expo-protocol-version: 1' \
  -H 'accept: application/expo+json,application/json,multipart/mixed' \
  http://8.217.101.26:3212/api/manifest
```

预期：

- HTTP 200
- 返回 multipart manifest
- body 中能看到 update id、launch asset、assets

### 8.3 校验 “已是最新版” 时返回 `noUpdateAvailable`

先从上一步返回结果里拿到 update id，再带上：

```bash
curl -i \
  -H 'expo-platform: android' \
  -H 'expo-runtime-version: <runtimeVersion>' \
  -H 'expo-protocol-version: 1' \
  -H 'expo-current-update-id: <updateId>' \
  -H 'accept: application/expo+json,application/json,multipart/mixed' \
  http://8.217.101.26:3212/api/manifest
```

预期：

- 返回 `noUpdateAvailable`

## 9. 常见故障

### 9.1 APK 能安装，但拿不到 OTA

优先检查：

- 是否在构建 APK 前执行了 `sync:android:release`
- 发布 OTA 时是否再次同步了 overlay
- APK 输出的 `runtimeVersion` 与 OTA 输出的 `runtimeVersion` 是否完全一致

### 9.2 manifest 总是 `noUpdateAvailable`

优先检查：

- 服务端是否跑的是 patched Xavia 镜像
- `deploy/mobile-release/xavia-ota/patch-api-bundles.js` 是否已重新打进镜像
- Postgres 里 `releases` / `releases_tracking` 是否存在

### 9.3 上传 APK 失败

优先检查：

- `AVATO_SERVER_USER` 是否为 `avato_release`
- `AVATO_SERVER_SSH_KEY_PATH` 是否指向可读私钥
- 服务器 `apk/canary/versions` 是否对 `avato_release` 可写
- SSH 是否仍允许该用户公钥登录

### 9.4 构建时 fingerprint 变化异常

优先检查：

- 是否有人直接改了 `android/` 运行目录
- overlay 文件是否与当前预期一致
- 是否先执行了 `expo prebuild` 但没重新同步 overlay

## 10. 维护建议

- 永远把 Android OTA 改动写回 `native-overlays/android/`，不要只改 `android/`
- 发布失败先看 `runtimeVersion`，不要先怀疑客户端逻辑
- 升级 Xavia 或 Expo SDK 后，先人工走一轮本地 build + OTA + manifest 校验
- CI 使用独立 deploy 用户和 SSH key，不要让 `root` 进入自动化链路
