#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
ANDROID_DIR="$ROOT_DIR/apps/mobile/android"
DEFAULT_KEYSTORE="$ANDROID_DIR/avato-release.jks"
DEFAULT_API_URL="${AVATO_MOBILE_DEFAULT_API_URL:-https://avato.turingmesh.com}"

export AVATO_RELEASE_STORE_FILE="${AVATO_RELEASE_STORE_FILE:-$DEFAULT_KEYSTORE}"
export AVATO_RELEASE_KEY_ALIAS="${AVATO_RELEASE_KEY_ALIAS:-avato-release}"
export EXPO_PUBLIC_API_URL="${EXPO_PUBLIC_API_URL:-$DEFAULT_API_URL}"
export NODE_ENV="${NODE_ENV:-production}"

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

cd "$ANDROID_DIR"
echo "Using EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"
echo "Using NODE_ENV=${NODE_ENV}"
./gradlew assembleRelease

APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
if [[ -f "$APK_PATH" ]]; then
  echo "Built APK:"
  echo "  $APK_PATH"
fi
