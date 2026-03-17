#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$ROOT_DIR/apps/mobile"
ANDROID_DIR="$MOBILE_DIR/android"
DEFAULT_KEYSTORE="$ANDROID_DIR/avato-release.jks"

export AVATO_RELEASE_STORE_FILE="${AVATO_RELEASE_STORE_FILE:-$DEFAULT_KEYSTORE}"
export AVATO_RELEASE_KEY_ALIAS="${AVATO_RELEASE_KEY_ALIAS:-avato-release}"
export AVATO_USE_RELEASE_SIGNING_FOR_DEBUG=1

if [[ -z "${AVATO_RELEASE_STORE_PASSWORD:-}" || -z "${AVATO_RELEASE_KEY_PASSWORD:-}" ]]; then
  echo "Missing signing secrets. Export AVATO_RELEASE_STORE_PASSWORD and AVATO_RELEASE_KEY_PASSWORD first."
  echo "Example:"
  echo "  export AVATO_RELEASE_STORE_PASSWORD='your-password'"
  echo "  export AVATO_RELEASE_KEY_PASSWORD='your-password'"
  exit 1
fi

if [[ ! -f "$AVATO_RELEASE_STORE_FILE" ]]; then
  echo "Keystore not found: $AVATO_RELEASE_STORE_FILE"
  exit 1
fi

cd "$MOBILE_DIR"
exec bun run android
