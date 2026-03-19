#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BUILD_ENV_FILE="${BUILD_ENV_FILE:-.env.prod}"
DEPLOY_HOST="${DEPLOY_HOST:-8.217.101.26}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:?DEPLOY_PASSWORD is required}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-https://avato.turingmesh.com}"
DEPLOY_VERIFY_HOST="${DEPLOY_VERIFY_HOST:-avato.turingmesh.com}"
REMOTE_ARTIFACT_DIR="${REMOTE_ARTIFACT_DIR:-/data/avato}"
REMOTE_DEPLOY_PATH="${REMOTE_DEPLOY_PATH:-/data/avato/deploy-image}"
IMAGE_TAG="${IMAGE_TAG:-prod-$(date +%Y%m%d-%H%M%S)}"
IMAGE_NAME="${IMAGE_NAME:-avato-runtime:${IMAGE_TAG}}"
REMOTE_RUNTIME_TAG="${REMOTE_RUNTIME_TAG:-avato-lobe:deploy}"
TMP_BUILD_DIR="${TMP_BUILD_DIR:-/tmp/avato-runtime-build}"
TMP_ARTIFACT_DIR="${TMP_ARTIFACT_DIR:-/tmp/avato-artifacts}"
ARTIFACT_NAME="${ARTIFACT_NAME:-avato-runtime-${IMAGE_TAG}-amd64.tar.gz}"
KEEP_LOCAL_ARTIFACTS="${KEEP_LOCAL_ARTIFACTS:-3}"
KEEP_REMOTE_ARTIFACTS="${KEEP_REMOTE_ARTIFACTS:-3}"
KEEP_REMOTE_RUNTIME_IMAGES="${KEEP_REMOTE_RUNTIME_IMAGES:-1}"

LOCAL_ARTIFACT_PRUNE_FROM=$((KEEP_LOCAL_ARTIFACTS + 1))
REMOTE_ARTIFACT_PRUNE_FROM=$((KEEP_REMOTE_ARTIFACTS + 1))
REMOTE_IMAGE_PRUNE_FROM=$((KEEP_REMOTE_RUNTIME_IMAGES + 1))

SSH_CONFIG_FILE="${SSH_CONFIG_FILE:-/tmp/ssh_config_avato}"

cat >"${SSH_CONFIG_FILE}" <<EOF
Host avato-prod
  HostName ${DEPLOY_HOST}
  User ${DEPLOY_USER}
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

cd "${ROOT_DIR}"

echo "==> Building production assets with ${BUILD_ENV_FILE}"
cp "${BUILD_ENV_FILE}" .env.production
trap 'rm -f "${ROOT_DIR}/.env.production"' EXIT
bun run build:docker

echo "==> Preparing runtime bundle"
rm -rf "${TMP_BUILD_DIR}/app"
mkdir -p "${TMP_BUILD_DIR}" "${TMP_ARTIFACT_DIR}"

cat >"${TMP_BUILD_DIR}/Dockerfile" <<'EOF'
FROM node:24-slim AS sharp-runtime
WORKDIR /sharp-runtime
RUN printf '{"name":"sharp-runtime","private":true}' > package.json \
  && npm install --legacy-peer-deps --no-save --include=optional --os=linux --cpu=x64 sharp@^0.34.4 \
  && npm cache clean --force

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3210
ENV HOSTNAME=0.0.0.0
COPY app/ ./lobehub/
COPY --from=sharp-runtime /sharp-runtime/node_modules/sharp ./lobehub/node_modules/sharp
COPY --from=sharp-runtime /sharp-runtime/node_modules/@img ./lobehub/node_modules/@img
WORKDIR /app/lobehub
EXPOSE 3210
CMD ["node", "server.js"]
EOF

rsync -a .next/standalone/lobehub/ "${TMP_BUILD_DIR}/app/"
mkdir -p "${TMP_BUILD_DIR}/app/.next"
rsync -a .next/static/ "${TMP_BUILD_DIR}/app/.next/static/"
rsync -a public/ "${TMP_BUILD_DIR}/app/public/"

echo "==> Building runtime image ${IMAGE_NAME}"
docker buildx build --platform linux/amd64 --load -t "${IMAGE_NAME}" "${TMP_BUILD_DIR}"

echo "==> Packaging ${ARTIFACT_NAME}"
docker save "${IMAGE_NAME}" | gzip > "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
shasum -a 256 "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
ls -lh "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"

echo "==> Cleaning local build leftovers"
docker image rm "${IMAGE_NAME}" >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
ls -1t "${TMP_ARTIFACT_DIR}"/avato-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +"${LOCAL_ARTIFACT_PRUNE_FROM}" | xargs -r rm -f

echo "==> Uploading artifact to ${DEPLOY_HOST}"
expect <<EOF
log_user 1
set timeout -1
spawn scp -F ${SSH_CONFIG_FILE} ${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME} avato-prod:${REMOTE_ARTIFACT_DIR}/
expect {
  -re ".*yes/no.*" { send "yes\r"; exp_continue }
  -re ".*password:.*" { send "${DEPLOY_PASSWORD}\r"; exp_continue }
  eof
}
EOF

echo "==> Loading image and restarting ${REMOTE_RUNTIME_TAG} on remote"
expect <<EOF
log_user 1
set timeout -1
spawn ssh -F ${SSH_CONFIG_FILE} avato-prod {bash -lc '
set -euo pipefail
cd ${REMOTE_ARTIFACT_DIR}
sha256sum ${ARTIFACT_NAME}
cd ${REMOTE_DEPLOY_PATH}
docker load < ${REMOTE_ARTIFACT_DIR}/${ARTIFACT_NAME}
docker tag ${IMAGE_NAME} ${REMOTE_RUNTIME_TAG}
docker compose up -d lobe
docker image ls avato-runtime --format "{{.Repository}}:{{.Tag}}" | tail -n +${REMOTE_IMAGE_PRUNE_FROM} | grep -v "^${IMAGE_NAME}$" | xargs -r docker image rm || true
docker image prune -f >/dev/null 2>&1 || true
ls -1t ${REMOTE_ARTIFACT_DIR}/avato-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +${REMOTE_ARTIFACT_PRUNE_FROM} | xargs -r rm -f
docker compose ps
docker logs --tail 50 avato-lobe
'}
expect {
  -re ".*yes/no.*" { send "yes\r"; exp_continue }
  -re ".*password:.*" { send "${DEPLOY_PASSWORD}\r"; exp_continue }
  eof
}
EOF

echo "==> Verifying remote service on 127.0.0.1:3210"
expect <<EOF
log_user 1
set timeout -1
spawn ssh -F ${SSH_CONFIG_FILE} avato-prod {bash -lc '
set -euo pipefail
curl -I -L --max-time 30 http://127.0.0.1:3210/signin
'}
expect {
  -re ".*yes/no.*" { send "yes\r"; exp_continue }
  -re ".*password:.*" { send "${DEPLOY_PASSWORD}\r"; exp_continue }
  eof
}
EOF

echo "==> Verifying ${DEPLOY_DOMAIN}/signin via explicit DNS resolve"
curl -I -L --max-time 30 --resolve "${DEPLOY_VERIFY_HOST}:443:${DEPLOY_HOST}" "${DEPLOY_DOMAIN}/signin"
