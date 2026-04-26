#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIST_DIR="$PROJECT_DIR/dist/ota/canary"
SERVER_URL="${AVATO_OTA_SERVER_URL:-http://8.217.101.26:3212}"
UPLOAD_KEY="${AVATO_OTA_UPLOAD_KEY:?AVATO_OTA_UPLOAD_KEY is required}"
CHANNEL="${AVATO_RELEASE_CHANNEL:-canary}"
BUILD_STAMP="$(date -u +%Y%m%d%H%M%S)"
WORK_DIR="$DIST_DIR/$BUILD_STAMP"
ZIP_PATH="$DIST_DIR/avato-${CHANNEL}-${BUILD_STAMP}.zip"
COMMIT_HASH="$(git -C "$PROJECT_DIR" rev-parse HEAD)"
COMMIT_MESSAGE="$(git -C "$PROJECT_DIR" log -1 --pretty=%B | tr '\n' ' ' | sed 's/[[:space:]]\\+/ /g')"

bash "$PROJECT_DIR/scripts/sync-android-release-overlay.sh"

RUNTIME_VERSION="$(
  cd "$PROJECT_DIR"
  npx expo-updates fingerprint:generate --platform android \
    | node -e "let data='';process.stdin.on('data',c=>data+=c);process.stdin.on('end',()=>console.log(JSON.parse(data).hash));"
)"

export AVATO_OTA_SERVER_URL="$SERVER_URL"
export AVATO_RELEASE_CHANNEL="$CHANNEL"
export AVATO_UPDATES_ENABLED=1
export EXPO_UPDATES_FINGERPRINT_OVERRIDE="$RUNTIME_VERSION"

rm -rf "$WORK_DIR"
mkdir -p "$WORK_DIR"

(
  cd "$PROJECT_DIR"
  npx expo export --platform android --output-dir "$WORK_DIR"
  npx expo config --json > "$WORK_DIR/expoconfig.json"
  cp package.json "$WORK_DIR/package.json"
)

rm -f "$ZIP_PATH"
(
  cd "$WORK_DIR"
  zip -qr "$ZIP_PATH" .
)

curl --fail --show-error --silent \
  -X POST "$SERVER_URL/api/upload" \
  -F "file=@${ZIP_PATH}" \
  -F "runtimeVersion=${RUNTIME_VERSION}" \
  -F "commitHash=${COMMIT_HASH}" \
  -F "commitMessage=${COMMIT_MESSAGE}" \
  -F "uploadKey=${UPLOAD_KEY}"

echo
echo "runtimeVersion=$RUNTIME_VERSION"
echo "channel=$CHANNEL"
echo "bundle=$ZIP_PATH"
