# Avato 生产构建与部署

这套流程的目标只有一个：`生产机不再参与源码构建`。

本次事故里，生产机同时承担了：

- 从源码构建前端和 Next.js 服务端产物
- 在 Linux 上补齐原生依赖
- 作为正式流量入口继续对外服务

结果就是：

- 构建时内存被打爆，`ssh` 和 `http` 一起卡死
- 手工热修容易把错误平台的 `sharp` 带进生产镜像
- 错误的本地 env 也可能被编译进服务端 bundle

## 新流程

现在改成两个通用脚本，任何 CI 系统都能直接调用：

- [buildProductionImage.sh](/Users/arthur/RustroverProjects/lobehub/scripts/deploy/buildProductionImage.sh)
- [deployRemoteImage.sh](/Users/arthur/RustroverProjects/lobehub/scripts/deploy/deployRemoteImage.sh)

标准链路：

1. 在外部 Linux 构建机或 CI runner 上构建 `linux/amd64` 镜像
2. 构建时强制传入 `BUILD_ENV_FILE=.env.prod`
3. 构建完成后本地执行最小 smoke test：
   - `require('sharp')`
4. 将镜像推送到远端仓库
5. 生产机通过 SSH 只做：
   - `docker pull`
   - `docker compose up -d lobe`

## 构建命令

本地加载镜像并做 smoke test：

```bash
LOBE_IMAGE=ghcr.io/your-org/avato \
  LOBE_IMAGE_TAG=prod \
  OUTPUT_MODE=load \
  ./scripts/deploy/buildProductionImage.sh
```

推送到镜像仓库：

```bash
LOBE_IMAGE=ghcr.io/your-org/avato \
  LOBE_IMAGE_TAG=sha-$(git rev-parse --short=12 HEAD) \
  OUTPUT_MODE=push \
  SKIP_SMOKE_TEST=1 \
  ./scripts/deploy/buildProductionImage.sh
```

## 远端部署命令

```bash
DEPLOY_REMOTE=root@example.com \
  DEPLOY_PATH=/data/avato/deploy-image \
  LOBE_IMAGE=ghcr.io/your-org/avato \
  LOBE_IMAGE_TAG=sha-xxxxxxxxxxxx \
  REGISTRY_SERVER=ghcr.io \
  REGISTRY_USER=your-user \
  REGISTRY_PASSWORD=your-token \
  ./scripts/deploy/deployRemoteImage.sh
```

## 部署侧要求

`docker-compose/deploy/docker-compose.yml` 现在支持：

```env
LOBE_IMAGE=ghcr.io/your-org/avato
LOBE_IMAGE_TAG=prod
```

部署脚本会在远端临时注入：

- `LOBE_IMAGE`
- `LOBE_IMAGE_TAG`

所以生产目录中的 `.env` 只需要保留固定业务配置，不再负责 “决定这次部署构建什么代码”。

## 原则

- 不在生产机运行 `docker build`
- 不在生产机运行 `vite build` / `next build`
- 不再通过本地开发机把错误平台产物热灌进线上
- 所有生产镜像都必须来自同一条外部构建链
