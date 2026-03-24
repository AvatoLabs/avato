#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Canary deployment configuration
BUILD_ENV_FILE="${BUILD_ENV_FILE:-.env.canary}"
DEPLOY_HOST="${DEPLOY_HOST:-8.217.101.26}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:?DEPLOY_PASSWORD is required}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-https://canary.turingmesh.com}"
DEPLOY_VERIFY_HOST="${DEPLOY_VERIFY_HOST:-canary.turingmesh.com}"
DEPLOY_VERIFY_PATH="${DEPLOY_VERIFY_PATH:-/signin}"
DEPLOY_PUBLIC_VERIFY_MODE="${DEPLOY_PUBLIC_VERIFY_MODE:-direct}"
# Presigned S3 uploads: clients PUT to this URL (must not be localhost)
DEPLOY_S3_PORT="${DEPLOY_S3_PORT:-9002}"
PUBLIC_S3_ENDPOINT="${PUBLIC_S3_ENDPOINT:-http://${DEPLOY_HOST}:${DEPLOY_S3_PORT}}"
# Runtime Dockerfile base (override when Docker registry-mirror DNS fails, e.g. docker.mirrors.ustc.edu.cn)
CANARY_RUNTIME_NODE_IMAGE="${CANARY_RUNTIME_NODE_IMAGE:-node:24-slim}"

# Canary-specific paths (different from production)
REMOTE_ARTIFACT_DIR="${REMOTE_ARTIFACT_DIR:-/data/canary}"
REMOTE_DEPLOY_PATH="${REMOTE_DEPLOY_PATH:-/data/canary/deploy-image}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-${ROOT_DIR}/docker-compose/canary/.env}"
IMAGE_TAG="${IMAGE_TAG:-canary-$(date +%Y%m%d-%H%M%S)}"
IMAGE_NAME="${IMAGE_NAME:-canary-runtime:${IMAGE_TAG}}"
REMOTE_RUNTIME_TAG="${REMOTE_RUNTIME_TAG:-canary-lobe:deploy}"
TMP_BUILD_DIR="${TMP_BUILD_DIR:-/tmp/canary-runtime-build}"
TMP_ARTIFACT_DIR="${TMP_ARTIFACT_DIR:-/tmp/canary-artifacts}"
ARTIFACT_NAME="${ARTIFACT_NAME:-canary-runtime-${IMAGE_TAG}-amd64.tar.gz}"
KEEP_LOCAL_ARTIFACTS="${KEEP_LOCAL_ARTIFACTS:-3}"
KEEP_REMOTE_ARTIFACTS="${KEEP_REMOTE_ARTIFACTS:-3}"
KEEP_REMOTE_RUNTIME_IMAGES="${KEEP_REMOTE_RUNTIME_IMAGES:-1}"

LOCAL_ARTIFACT_PRUNE_FROM=$((KEEP_LOCAL_ARTIFACTS + 1))
REMOTE_ARTIFACT_PRUNE_FROM=$((KEEP_REMOTE_ARTIFACTS + 1))
REMOTE_IMAGE_PRUNE_FROM=$((KEEP_REMOTE_RUNTIME_IMAGES + 1))

SSH_CONFIG_FILE="${SSH_CONFIG_FILE:-/tmp/ssh_config_canary}"

cat >"${SSH_CONFIG_FILE}" <<EOF
Host canary-deploy
  HostName ${DEPLOY_HOST}
  User ${DEPLOY_USER}
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

run_with_expect() {
  EXPECT_PASSWORD="${DEPLOY_PASSWORD}" expect -f - "$@" <<'EOF'
log_user 1
set timeout -1

set password $env(EXPECT_PASSWORD)
spawn {*}$argv
expect {
  -re ".*yes/no.*" { send "yes\r"; exp_continue }
  -re ".*password:.*" { send "$password\r"; exp_continue }
  eof
}

set wait_status [wait]
set exit_code [lindex $wait_status 3]
if {$exit_code eq ""} {
  set exit_code 0
}
exit $exit_code
EOF
}

restore_build_env() {
  if [ -n "${BUILD_ENV_BACKUP_FILE:-}" ] && [ -f "${BUILD_ENV_BACKUP_FILE}" ]; then
    mv "${BUILD_ENV_BACKUP_FILE}" "${ROOT_DIR}/.env.production"
  else
    rm -f "${ROOT_DIR}/.env.production"
  fi
}

cd "${ROOT_DIR}"

if [ ! -f "${COMPOSE_ENV_FILE}" ]; then
  echo "Missing compose env file: ${COMPOSE_ENV_FILE}" >&2
  echo "Create docker-compose/canary/.env or set COMPOSE_ENV_FILE to a valid runtime env file." >&2
  exit 1
fi

echo "==> Building canary assets with ${BUILD_ENV_FILE}"
BUILD_ENV_BACKUP_FILE=""
if [ -e "${ROOT_DIR}/.env.production" ]; then
  BUILD_ENV_BACKUP_FILE="$(mktemp "${ROOT_DIR}/.env.production.backup.XXXXXX")"
  cp -p "${ROOT_DIR}/.env.production" "${BUILD_ENV_BACKUP_FILE}"
fi
cp "${BUILD_ENV_FILE}" .env.production
trap restore_build_env EXIT
bun run build:docker

echo "==> Preparing runtime bundle"
rm -rf "${TMP_BUILD_DIR}/app"
mkdir -p "${TMP_BUILD_DIR}" "${TMP_ARTIFACT_DIR}"

cat >"${TMP_BUILD_DIR}/Dockerfile" <<EOF
FROM ${CANARY_RUNTIME_NODE_IMAGE} AS sharp-runtime
WORKDIR /sharp-runtime
RUN printf '{"name":"sharp-runtime","private":true}' > package.json \\
  && npm install --legacy-peer-deps --no-save --include=optional --os=linux --cpu=x64 sharp@^0.34.4 \\
  && npm cache clean --force

FROM ${CANARY_RUNTIME_NODE_IMAGE}
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

# Auto-detect standalone app path (handles both lobehub/ and RustRoverProjects/minkhub/)
STANDALONE_APP_DIR="$(dirname "$(find .next/standalone -maxdepth 5 -name server.js -type f | head -1)")"
rsync -a \
  --exclude='dist/desktop/' \
  --exclude='dist/mobile/' \
  --exclude='packages/database/migrations/' \
  --exclude='node_modules/.pnpm/@napi-rs+canvas-*-musl*' \
  --exclude='node_modules/.pnpm/@img+sharp-libvips-*musl*' \
  --exclude='node_modules/.pnpm/@img+sharp-linuxmusl*' \
  "${STANDALONE_APP_DIR}/" "${TMP_BUILD_DIR}/app/"
# Copy top-level external node_modules if present (Turbopack externals)
if [ -d .next/standalone/node_modules ]; then
  rsync -a .next/standalone/node_modules/ "${TMP_BUILD_DIR}/app/node_modules/"
fi
# Resolve any symlinks in .next/node_modules (Turbopack hashed module refs)
if [ -d "${TMP_BUILD_DIR}/app/.next/node_modules" ]; then
  find "${TMP_BUILD_DIR}/app/.next/node_modules" -type l | while read -r link; do
    target="$(readlink -f "$link")"
    if [ -e "$target" ]; then rm -f "$link" && cp -a "$target" "$link"; fi
  done || true
fi
mkdir -p "${TMP_BUILD_DIR}/app/.next"
rsync -a .next/static/ "${TMP_BUILD_DIR}/app/.next/static/"
rsync -a public/ "${TMP_BUILD_DIR}/app/public/"

echo "==> Building runtime image ${IMAGE_NAME} (base: ${CANARY_RUNTIME_NODE_IMAGE})"
docker buildx build --platform linux/amd64 --load -t "${IMAGE_NAME}" "${TMP_BUILD_DIR}"

echo "==> Packaging ${ARTIFACT_NAME}"
docker save "${IMAGE_NAME}" | gzip > "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
shasum -a 256 "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
ls -lh "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"

echo "==> Cleaning local build leftovers"
docker image rm "${IMAGE_NAME}" >/dev/null 2>&1 || true
docker image prune -f >/dev/null 2>&1 || true
ls -1t "${TMP_ARTIFACT_DIR}"/canary-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +"${LOCAL_ARTIFACT_PRUNE_FROM}" | xargs -r rm -f

echo "==> Ensuring remote directory structure"
run_with_expect \
  ssh -F "${SSH_CONFIG_FILE}" canary-deploy \
  "mkdir -p ${REMOTE_ARTIFACT_DIR} ${REMOTE_DEPLOY_PATH}"

echo "==> Uploading docker-compose config"
config_files=(
  "${ROOT_DIR}/docker-compose/canary/docker-compose.yml"
  "${ROOT_DIR}/docker-compose/canary/bucket.config.json"
  "${ROOT_DIR}/docker-compose/canary/searxng-settings.yml"
)
run_with_expect \
  scp -F "${SSH_CONFIG_FILE}" \
  "${config_files[@]}" \
  "canary-deploy:${REMOTE_DEPLOY_PATH}/"
echo "==> Uploading compose env from ${COMPOSE_ENV_FILE}"
run_with_expect \
  scp -F "${SSH_CONFIG_FILE}" \
  "${COMPOSE_ENV_FILE}" \
  "canary-deploy:${REMOTE_DEPLOY_PATH}/.env"

echo "==> Patching remote .env: S3_ENDPOINT + INTERNAL_APP_URL (async /trpc/async must hit container :3210)"
CANARY_INTERNAL_APP_URL="${CANARY_INTERNAL_APP_URL:-http://127.0.0.1:3210}"
run_with_expect \
  ssh -F "${SSH_CONFIG_FILE}" canary-deploy \
  "f=${REMOTE_DEPLOY_PATH}/.env; test -f \"\$f\" || touch \"\$f\"; if grep -q '^S3_ENDPOINT=' \"\$f\"; then sed -i.bak \"s|^S3_ENDPOINT=.*|S3_ENDPOINT=${PUBLIC_S3_ENDPOINT}|\" \"\$f\"; else printf '\\nS3_ENDPOINT=%s\\n' \"${PUBLIC_S3_ENDPOINT}\" >> \"\$f\"; fi; if grep -q '^INTERNAL_APP_URL=' \"\$f\"; then sed -i.bak \"s|^INTERNAL_APP_URL=.*|INTERNAL_APP_URL=${CANARY_INTERNAL_APP_URL}|\" \"\$f\"; else printf '\\nINTERNAL_APP_URL=%s\\n' \"${CANARY_INTERNAL_APP_URL}\" >> \"\$f\"; fi"

echo "==> Uploading artifact to ${DEPLOY_HOST}"
run_with_expect \
  scp -F "${SSH_CONFIG_FILE}" \
  "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}" \
  "canary-deploy:${REMOTE_ARTIFACT_DIR}/"

echo "==> Loading image and restarting ${REMOTE_RUNTIME_TAG} on remote"
run_with_expect \
  ssh -F "${SSH_CONFIG_FILE}" canary-deploy \
  "bash -lc '
set -euo pipefail
cd ${REMOTE_ARTIFACT_DIR}
sha256sum ${ARTIFACT_NAME}
cd ${REMOTE_DEPLOY_PATH}
docker load < ${REMOTE_ARTIFACT_DIR}/${ARTIFACT_NAME}
docker tag ${IMAGE_NAME} ${REMOTE_RUNTIME_TAG}
docker compose up -d lobe
docker image ls canary-runtime --format \"{{.Repository}}:{{.Tag}}\" | tail -n +${REMOTE_IMAGE_PRUNE_FROM} | grep -v \"^${IMAGE_NAME}$\" | xargs -r docker image rm || true
docker image prune -f >/dev/null 2>&1 || true
ls -1t ${REMOTE_ARTIFACT_DIR}/canary-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +${REMOTE_ARTIFACT_PRUNE_FROM} | xargs -r rm -f
docker compose ps
docker logs --tail 50 canary-lobe
'"

echo "==> Verifying remote service on 127.0.0.1:3211${DEPLOY_VERIFY_PATH}"
run_with_expect \
  ssh -F "${SSH_CONFIG_FILE}" canary-deploy \
  "bash -lc '
set -euo pipefail
curl -I -L --max-time 30 http://127.0.0.1:3211${DEPLOY_VERIFY_PATH}
'"

case "${DEPLOY_PUBLIC_VERIFY_MODE}" in
  skip)
    echo "==> Skipping public verification (${DEPLOY_PUBLIC_VERIFY_MODE})"
    ;;
  resolve)
    echo "==> Verifying ${DEPLOY_DOMAIN}${DEPLOY_VERIFY_PATH} via explicit DNS resolve"
    curl -I -L --max-time 30 --resolve "${DEPLOY_VERIFY_HOST}:443:${DEPLOY_HOST}" "${DEPLOY_DOMAIN}${DEPLOY_VERIFY_PATH}"
    ;;
  direct)
    echo "==> Verifying ${DEPLOY_DOMAIN}${DEPLOY_VERIFY_PATH} via public DNS"
    curl -I -L --max-time 30 "${DEPLOY_DOMAIN}${DEPLOY_VERIFY_PATH}"
    ;;
  *)
    echo "Unsupported DEPLOY_PUBLIC_VERIFY_MODE: ${DEPLOY_PUBLIC_VERIFY_MODE}" >&2
    exit 1
    ;;
esac
