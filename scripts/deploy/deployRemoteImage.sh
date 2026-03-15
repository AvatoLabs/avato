#!/usr/bin/env bash

set -euo pipefail

DEPLOY_REMOTE="${DEPLOY_REMOTE:?DEPLOY_REMOTE is required, e.g. root@example.com}"
DEPLOY_PATH="${DEPLOY_PATH:?DEPLOY_PATH is required, e.g. /data/avato/deploy-image}"
LOBE_IMAGE="${LOBE_IMAGE:?LOBE_IMAGE is required, e.g. ghcr.io/acme/avato}"
LOBE_IMAGE_TAG="${LOBE_IMAGE_TAG:?LOBE_IMAGE_TAG is required, e.g. sha-abc123}"
REGISTRY_SERVER="${REGISTRY_SERVER:-}"
REGISTRY_USER="${REGISTRY_USER:-}"
REGISTRY_PASSWORD="${REGISTRY_PASSWORD:-}"

echo "==> Deploying ${LOBE_IMAGE}:${LOBE_IMAGE_TAG} to ${DEPLOY_REMOTE}:${DEPLOY_PATH}"

ssh "${DEPLOY_REMOTE}" \
  LOBE_IMAGE="${LOBE_IMAGE}" \
  LOBE_IMAGE_TAG="${LOBE_IMAGE_TAG}" \
  DEPLOY_PATH="${DEPLOY_PATH}" \
  REGISTRY_SERVER="${REGISTRY_SERVER}" \
  REGISTRY_USER="${REGISTRY_USER}" \
  REGISTRY_PASSWORD="${REGISTRY_PASSWORD}" \
  'bash -s' <<'REMOTE_SCRIPT'
set -euo pipefail

cd "${DEPLOY_PATH}"

if [[ -n "${REGISTRY_SERVER}" && -n "${REGISTRY_USER}" && -n "${REGISTRY_PASSWORD}" ]]; then
  echo "${REGISTRY_PASSWORD}" | docker login "${REGISTRY_SERVER}" -u "${REGISTRY_USER}" --password-stdin
fi

export LOBE_IMAGE
export LOBE_IMAGE_TAG

docker pull "${LOBE_IMAGE}:${LOBE_IMAGE_TAG}"
docker compose up -d lobe
docker compose ps
docker logs --tail 100 avato-lobe
REMOTE_SCRIPT
