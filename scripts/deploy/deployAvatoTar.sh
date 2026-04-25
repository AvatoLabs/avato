#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

BUILD_ENV_FILE="${BUILD_ENV_FILE:-.env.prod}"
DEPLOY_HOST="${DEPLOY_HOST:-8.217.101.26}"
DEPLOY_USER="${DEPLOY_USER:-root}"
DEPLOY_PASSWORD="${DEPLOY_PASSWORD:?DEPLOY_PASSWORD is required}"
DEPLOY_DOMAIN="${DEPLOY_DOMAIN:-https://avato.turingmesh.com}"
DEPLOY_VERIFY_HOST="${DEPLOY_VERIFY_HOST:-avato.turingmesh.com}"
DEPLOY_VERIFY_PATH="${DEPLOY_VERIFY_PATH:-/signin}"
DEPLOY_PUBLIC_VERIFY_MODE="${DEPLOY_PUBLIC_VERIFY_MODE:-resolve}"
REMOTE_ARTIFACT_DIR="${REMOTE_ARTIFACT_DIR:-/data/avato}"
REMOTE_DEPLOY_PATH="${REMOTE_DEPLOY_PATH:-/data/avato/deploy-image}"
REMOTE_DEVICE_GATEWAY_SYNC_SCRIPT="${REMOTE_DEVICE_GATEWAY_SYNC_SCRIPT-/data/avato/device-gateway-dev/sync-from-avato.sh}"
LOCAL_ARTIFACT_FILE="${LOCAL_ARTIFACT_FILE:-}"
if [ -z "${IMAGE_TAG:-}" ] && [ -n "${LOCAL_ARTIFACT_FILE}" ]; then
  LOCAL_ARTIFACT_BASENAME="$(basename "${LOCAL_ARTIFACT_FILE}")"
  if [[ "${LOCAL_ARTIFACT_BASENAME}" == avato-runtime-*-amd64.tar.gz ]]; then
    IMAGE_TAG="${LOCAL_ARTIFACT_BASENAME#avato-runtime-}"
    IMAGE_TAG="${IMAGE_TAG%-amd64.tar.gz}"
  fi
fi
IMAGE_TAG="${IMAGE_TAG:-prod-$(date +%Y%m%d-%H%M%S)}"
IMAGE_NAME="${IMAGE_NAME:-avato-runtime:${IMAGE_TAG}}"
REMOTE_RUNTIME_TAG="${REMOTE_RUNTIME_TAG:-avato-lobe:deploy}"
TMP_BUILD_DIR="${TMP_BUILD_DIR:-/tmp/avato-runtime-build}"
TMP_ARTIFACT_DIR="${TMP_ARTIFACT_DIR:-/tmp/avato-artifacts}"
ARTIFACT_NAME="${ARTIFACT_NAME:-avato-runtime-${IMAGE_TAG}-amd64.tar.gz}"
REMOTE_UPLOAD_NAME=".${ARTIFACT_NAME}.uploading"
KEEP_LOCAL_ARTIFACTS="${KEEP_LOCAL_ARTIFACTS:-3}"
KEEP_REMOTE_ARTIFACTS="${KEEP_REMOTE_ARTIFACTS:-3}"
KEEP_REMOTE_RUNTIME_IMAGES="${KEEP_REMOTE_RUNTIME_IMAGES:-1}"

LOCAL_ARTIFACT_PRUNE_FROM=$((KEEP_LOCAL_ARTIFACTS + 1))
REMOTE_ARTIFACT_PRUNE_FROM=$((KEEP_REMOTE_ARTIFACTS + 1))
REMOTE_IMAGE_PRUNE_FROM=$((KEEP_REMOTE_RUNTIME_IMAGES + 1))

SSH_CONFIG_FILE="${SSH_CONFIG_FILE:-/tmp/ssh_config_avato}"
SSH_CONNECT_TIMEOUT="${SSH_CONNECT_TIMEOUT:-10}"
SSH_RETRY_COUNT="${SSH_RETRY_COUNT:-3}"
SSH_RETRY_DELAY_SECONDS="${SSH_RETRY_DELAY_SECONDS:-5}"
USE_RSYNC_UPLOAD="${USE_RSYNC_UPLOAD:-1}"
SSH_PROXY_COMMAND="${SSH_PROXY_COMMAND:-}"

cat >"${SSH_CONFIG_FILE}" <<EOF
Host avato-prod
  HostName ${DEPLOY_HOST}
  User ${DEPLOY_USER}
  StrictHostKeyChecking no
  UserKnownHostsFile /dev/null
EOF

if [ -n "${SSH_PROXY_COMMAND}" ]; then
  printf '  ProxyCommand %s\n' "${SSH_PROXY_COMMAND}" >> "${SSH_CONFIG_FILE}"
fi

SSH_COMMON_ARGS=(
  -F "${SSH_CONFIG_FILE}"
  -o PreferredAuthentications=password
  -o PubkeyAuthentication=no
  -o KexAlgorithms=curve25519-sha256
  -o ConnectTimeout="${SSH_CONNECT_TIMEOUT}"
  -o ConnectionAttempts=1
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=3
)

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

run_with_sshpass() {
  SSHPASS="${DEPLOY_PASSWORD}" sshpass -e "$@"
}

run_with_retry() {
  local attempt=1
  local exit_code=0

  while true; do
    if "$@"; then
      return 0
    fi

    exit_code=$?
    if [ "${exit_code}" -ne 255 ] || [ "${attempt}" -ge "${SSH_RETRY_COUNT}" ]; then
      return "${exit_code}"
    fi

    echo "SSH transport failed with exit ${exit_code}; retrying in ${SSH_RETRY_DELAY_SECONDS}s (${attempt}/${SSH_RETRY_COUNT})" >&2
    sleep "${SSH_RETRY_DELAY_SECONDS}"
    attempt=$((attempt + 1))
  done
}

ssh_expect() {
  if command -v sshpass >/dev/null 2>&1; then
    run_with_retry run_with_sshpass ssh "${SSH_COMMON_ARGS[@]}" "$@"
    return
  fi

  run_with_retry run_with_expect ssh "${SSH_COMMON_ARGS[@]}" "$@"
}

scp_expect() {
  if command -v sshpass >/dev/null 2>&1; then
    run_with_retry run_with_sshpass scp "${SSH_COMMON_ARGS[@]}" "$@"
    return
  fi

  run_with_retry run_with_expect scp "${SSH_COMMON_ARGS[@]}" "$@"
}

rsync_expect() {
  local ssh_cmd

  if ! command -v rsync >/dev/null 2>&1 || ! command -v sshpass >/dev/null 2>&1; then
    return 1
  fi

  printf -v ssh_cmd '%q ' ssh "${SSH_COMMON_ARGS[@]}"
  run_with_retry run_with_sshpass rsync \
    --archive \
    --human-readable \
    --partial \
    --append-verify \
    --progress \
    --rsh="${ssh_cmd}" \
    "$@"
}

upload_artifact() {
  local local_artifact="$1"
  local remote_destination="avato-prod:${REMOTE_ARTIFACT_DIR}/${REMOTE_UPLOAD_NAME}"

  ssh_expect avato-prod "mkdir -p ${REMOTE_ARTIFACT_DIR}"

  if [ "${USE_RSYNC_UPLOAD}" = "1" ]; then
    if command -v rsync >/dev/null 2>&1 && command -v sshpass >/dev/null 2>&1; then
      rsync_expect "${local_artifact}" "${remote_destination}"
      return
    fi

    echo "rsync or sshpass is unavailable; falling back to scp upload" >&2
  fi

  scp_expect "${local_artifact}" "${remote_destination}"
}

verify_uploaded_artifact() {
  local remote_output
  local remote_sha

  remote_output="$(
    ssh_expect avato-prod \
      "bash -lc '
set -euo pipefail
cd ${REMOTE_ARTIFACT_DIR}
sha256sum ${REMOTE_UPLOAD_NAME} | awk \"{print \\\$1}\"
'"
  )"
  remote_sha="$(awk 'NF { value = $1 } END { print value }' <<<"${remote_output}")"

  if [ "${remote_sha}" != "${LOCAL_ARTIFACT_SHA}" ]; then
    ssh_expect avato-prod "rm -f ${REMOTE_ARTIFACT_DIR}/${REMOTE_UPLOAD_NAME}" || true
    echo "Checksum mismatch for ${ARTIFACT_NAME}: expected ${LOCAL_ARTIFACT_SHA}, got ${remote_sha}" >&2
    exit 1
  fi

  ssh_expect avato-prod \
    "mv -f ${REMOTE_ARTIFACT_DIR}/${REMOTE_UPLOAD_NAME} ${REMOTE_ARTIFACT_DIR}/${ARTIFACT_NAME}"
}

restore_build_env() {
  if [ -n "${BUILD_ENV_BACKUP_FILE:-}" ] && [ -f "${BUILD_ENV_BACKUP_FILE}" ]; then
    mv "${BUILD_ENV_BACKUP_FILE}" "${ROOT_DIR}/.env.production"
  else
    rm -f "${ROOT_DIR}/.env.production"
  fi
}

materialize_next_external_modules() {
  local app_dir="$1"
  local standalone_app_name="$2"
  local next_node_modules_dir="${app_dir}/.next/node_modules"

  [ -d "${next_node_modules_dir}" ] || return 0

  find "${next_node_modules_dir}" -type l | while read -r link; do
    local raw_target resolved_target suffix candidate_target fallback_suffix fallback_target

    raw_target="$(readlink "${link}")"
    resolved_target="$(readlink -f "${link}" 2>/dev/null || true)"

    if [ -e "${resolved_target}" ] || [ -z "${raw_target}" ]; then
      continue
    fi

    case "${raw_target}" in
      "../../../${standalone_app_name}/"*)
        suffix="${raw_target#"../../../${standalone_app_name}/"}"
        candidate_target="${app_dir}/${suffix}"

        if [ -e "${candidate_target}" ]; then
          rm -f "${link}"
          ln -s "../../${suffix}" "${link}"
          continue
        fi

        if [[ "${suffix}" == *"node_modules/"* ]]; then
          fallback_suffix="${suffix#*node_modules/}"
          fallback_target="${app_dir}/node_modules/${fallback_suffix}"

          if [ -e "${fallback_target}" ]; then
            rm -f "${link}"
            ln -s "../../node_modules/${fallback_suffix}" "${link}"
          fi
        fi
        ;;
    esac
  done || true
}

cd "${ROOT_DIR}"

if [ -n "${LOCAL_ARTIFACT_FILE}" ]; then
  echo "==> Using existing artifact ${LOCAL_ARTIFACT_FILE}"
  if [ ! -f "${LOCAL_ARTIFACT_FILE}" ]; then
    echo "LOCAL_ARTIFACT_FILE does not exist: ${LOCAL_ARTIFACT_FILE}" >&2
    exit 1
  fi

  mkdir -p "${TMP_ARTIFACT_DIR}"

  if [ "$(cd "$(dirname "${LOCAL_ARTIFACT_FILE}")" && pwd)/$(basename "${LOCAL_ARTIFACT_FILE}")" != "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}" ]; then
    cp -f "${LOCAL_ARTIFACT_FILE}" "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
  fi
else
  echo "==> Building production assets with ${BUILD_ENV_FILE}"
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
COPY docker.cjs ./docker.cjs
COPY errorHint.js ./errorHint.js
COPY migrations/ ./migrations/
COPY --from=sharp-runtime /sharp-runtime/node_modules/sharp ./lobehub/node_modules/sharp
COPY --from=sharp-runtime /sharp-runtime/node_modules/@img ./lobehub/node_modules/@img
RUN ln -sfn ./lobehub/node_modules ./node_modules
WORKDIR /app/lobehub
EXPOSE 3210
CMD ["node", "server.js"]
EOF

  STANDALONE_APP_DIR="$(dirname "$(find .next/standalone -maxdepth 5 -name server.js -type f | head -1)")"
  STANDALONE_APP_NAME="$(basename "${STANDALONE_APP_DIR}")"
  rsync -a "${STANDALONE_APP_DIR}/" "${TMP_BUILD_DIR}/app/"
  if [ -d .next/standalone/node_modules ]; then
    rsync -a .next/standalone/node_modules/ "${TMP_BUILD_DIR}/app/node_modules/"
  fi
  materialize_next_external_modules "${TMP_BUILD_DIR}/app" "${STANDALONE_APP_NAME}"
  mkdir -p "${TMP_BUILD_DIR}/app/.next"
  rsync -a .next/static/ "${TMP_BUILD_DIR}/app/.next/static/"
  # Next 16 Turbopack standalone can miss runtime chunk files that server routes still require
  # from .next/server/chunks and .next/server/chunks/ssr at runtime.
  mkdir -p "${TMP_BUILD_DIR}/app/.next/server/chunks"
  rsync -a .next/server/chunks/ "${TMP_BUILD_DIR}/app/.next/server/chunks/"
  rsync -a public/ "${TMP_BUILD_DIR}/app/public/"
  cp "${ROOT_DIR}/scripts/migrateServerDB/docker.cjs" "${TMP_BUILD_DIR}/docker.cjs"
  cp "${ROOT_DIR}/scripts/migrateServerDB/errorHint.js" "${TMP_BUILD_DIR}/errorHint.js"
  rsync -a "${ROOT_DIR}/packages/database/migrations/" "${TMP_BUILD_DIR}/migrations/"

  echo "==> Building runtime image ${IMAGE_NAME}"
  docker buildx build --platform linux/amd64 --load -t "${IMAGE_NAME}" "${TMP_BUILD_DIR}"

  echo "==> Packaging ${ARTIFACT_NAME}"
  docker save "${IMAGE_NAME}" | gzip > "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
fi

LOCAL_ARTIFACT_SHA="$(shasum -a 256 "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}" | awk '{print $1}')"
echo "${LOCAL_ARTIFACT_SHA}  ${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"
ls -lh "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"

echo "==> Cleaning local build leftovers"
if [ -z "${LOCAL_ARTIFACT_FILE}" ]; then
  docker image rm "${IMAGE_NAME}" >/dev/null 2>&1 || true
  docker image prune -f >/dev/null 2>&1 || true
fi
ls -1t "${TMP_ARTIFACT_DIR}"/avato-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +"${LOCAL_ARTIFACT_PRUNE_FROM}" | xargs -r rm -f

echo "==> Uploading artifact to ${DEPLOY_HOST}"
upload_artifact "${TMP_ARTIFACT_DIR}/${ARTIFACT_NAME}"

echo "==> Verifying uploaded artifact checksum"
verify_uploaded_artifact

echo "==> Loading image and restarting ${REMOTE_RUNTIME_TAG} on remote"
ssh_expect avato-prod \
  "bash -lc '
set -euo pipefail
cd ${REMOTE_ARTIFACT_DIR}
cd ${REMOTE_DEPLOY_PATH}
docker load < ${REMOTE_ARTIFACT_DIR}/${ARTIFACT_NAME}
docker tag ${IMAGE_NAME} ${REMOTE_RUNTIME_TAG}
docker compose up -d lobe
if [ -n "${REMOTE_DEVICE_GATEWAY_SYNC_SCRIPT}" ] && [ -x "${REMOTE_DEVICE_GATEWAY_SYNC_SCRIPT}" ]; then
  "${REMOTE_DEVICE_GATEWAY_SYNC_SCRIPT}"
fi
docker image ls avato-runtime --format \"{{.Repository}}:{{.Tag}}\" | tail -n +${REMOTE_IMAGE_PRUNE_FROM} | grep -v \"^${IMAGE_NAME}$\" | xargs -r docker image rm || true
docker image prune -f >/dev/null 2>&1 || true
ls -1t ${REMOTE_ARTIFACT_DIR}/avato-runtime-*-amd64.tar.gz 2>/dev/null | tail -n +${REMOTE_ARTIFACT_PRUNE_FROM} | xargs -r rm -f
docker compose ps
docker logs --tail 50 avato-lobe
'"

echo "==> Verifying remote service on 127.0.0.1:3210${DEPLOY_VERIFY_PATH}"
ssh_expect avato-prod \
  "bash -lc '
set -euo pipefail
curl -I -L --max-time 30 http://127.0.0.1:3210${DEPLOY_VERIFY_PATH}
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
