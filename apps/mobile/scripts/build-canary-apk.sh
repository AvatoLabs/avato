#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
DIST_DIR="$PROJECT_DIR/dist/apk/canary"
SERVER_URL="${AVATO_OTA_SERVER_URL:-http://8.217.101.26:3212}"
CHANNEL="${AVATO_RELEASE_CHANNEL:-canary}"
BUILD_STAMP="$(date -u +%Y%m%d%H)"
VERSION_NAME="${AVATO_APP_VERSION_NAME:-1.0.0-canary.${BUILD_STAMP}}"
VERSION_CODE="${AVATO_ANDROID_VERSION_CODE:-${BUILD_STAMP}}"

bash "$PROJECT_DIR/scripts/sync-android-release-overlay.sh"

RUNTIME_VERSION="$(
  cd "$PROJECT_DIR"
  npx expo-updates fingerprint:generate --platform android \
    | node -e "let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>console.log(JSON.parse(data).hash));"
)"

export AVATO_RELEASE_STORE_FILE="${AVATO_RELEASE_STORE_FILE:-$ANDROID_DIR/avato-release.jks}"
export AVATO_RELEASE_KEY_ALIAS="${AVATO_RELEASE_KEY_ALIAS:-avato-release}"
export AVATO_OTA_SERVER_URL="$SERVER_URL"
export AVATO_RELEASE_CHANNEL="$CHANNEL"
export AVATO_UPDATES_ENABLED=1
export AVATO_APP_VERSION_NAME="$VERSION_NAME"
export AVATO_ANDROID_VERSION_CODE="$VERSION_CODE"
export EXPO_UPDATES_FINGERPRINT_OVERRIDE="$RUNTIME_VERSION"
export NODE_ENV="${NODE_ENV:-production}"

mkdir -p "$DIST_DIR"

(
  cd "$ANDROID_DIR"
  ./gradlew assembleRelease
)

APK_SOURCE="$(find "$ANDROID_DIR/app/build/outputs/apk/release" -name '*.apk' | head -n 1)"
if [[ -z "${APK_SOURCE:-}" ]]; then
  echo "Release APK not found."
  exit 1
fi

APK_TARGET="$DIST_DIR/avato-${CHANNEL}-${VERSION_NAME}-${VERSION_CODE}.apk"
cp "$APK_SOURCE" "$APK_TARGET"

echo "runtimeVersion=$RUNTIME_VERSION"
echo "versionCode=$VERSION_CODE"
echo "versionName=$VERSION_NAME"
echo "apk=$APK_TARGET"
