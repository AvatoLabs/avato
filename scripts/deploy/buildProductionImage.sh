#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

IMAGE_NAME="${LOBE_IMAGE:-avato}"
IMAGE_TAG="${LOBE_IMAGE_TAG:-prod-local}"
BUILD_ENV_FILE="${BUILD_ENV_FILE:-.env.prod}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
OUTPUT_MODE="${OUTPUT_MODE:-load}"
SKIP_SMOKE_TEST="${SKIP_SMOKE_TEST:-0}"

if [[ "$OUTPUT_MODE" != "load" && "$OUTPUT_MODE" != "push" ]]; then
  echo "OUTPUT_MODE must be 'load' or 'push'" >&2
  exit 1
fi

IMAGE_REF="${IMAGE_NAME}:${IMAGE_TAG}"

echo "==> Building ${IMAGE_REF}"
echo "    platform: ${DOCKER_PLATFORM}"
echo "    env file: ${BUILD_ENV_FILE}"
echo "    output:   ${OUTPUT_MODE}"

docker buildx build \
  --platform "${DOCKER_PLATFORM}" \
  --build-arg "BUILD_ENV_FILE=${BUILD_ENV_FILE}" \
  --tag "${IMAGE_REF}" \
  "--${OUTPUT_MODE}" \
  "${ROOT_DIR}"

if [[ "${SKIP_SMOKE_TEST}" == "1" ]]; then
  exit 0
fi

if [[ "${OUTPUT_MODE}" != "load" ]]; then
  echo "Smoke test skipped because OUTPUT_MODE=${OUTPUT_MODE} does not load the image locally." >&2
  exit 0
fi

echo "==> Smoke testing ${IMAGE_REF}"
docker run --rm --entrypoint /bin/node "${IMAGE_REF}" -e "require('sharp'); console.log('sharp-ok')"
