#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
APK_PATH="${1:-$(ls -t "$PROJECT_DIR"/dist/apk/canary/*.apk 2>/dev/null | head -n 1)}"
SERVER_HOST="${AVATO_SERVER_HOST:-8.217.101.26}"
SERVER_USER="${AVATO_SERVER_USER:-root}"
SERVER_PORT="${AVATO_SERVER_PORT:-22}"
SERVER_BASE_DIR="${AVATO_RELEASE_SERVER_DIR:-/opt/avato-mobile-release}"
PUBLIC_BASE_URL="${AVATO_RELEASE_PUBLIC_BASE_URL:-http://${SERVER_HOST}:3212}"
SSH_KEY_PATH="${AVATO_SERVER_SSH_KEY_PATH:-}"

if [[ -z "${APK_PATH:-}" || ! -f "$APK_PATH" ]]; then
  echo "APK file not found. Pass the APK path explicitly or run build:android:canary first."
  exit 1
fi

APK_NAME="$(basename "$APK_PATH")"

ssh_options=(
  -o StrictHostKeyChecking=no
  -o GSSAPIAuthentication=no
  -o PreferredAuthentications=publickey,password
  -o PubkeyAuthentication=yes
)

ssh_base=(ssh -p "$SERVER_PORT" "${ssh_options[@]}")
scp_base=(scp -P "$SERVER_PORT" "${ssh_options[@]}")

if [[ -n "$SSH_KEY_PATH" ]]; then
  ssh_base+=(-i "$SSH_KEY_PATH")
  scp_base+=(-i "$SSH_KEY_PATH")
else
  SERVER_PASSWORD="${AVATO_SERVER_PASSWORD:?AVATO_SERVER_PASSWORD is required when AVATO_SERVER_SSH_KEY_PATH is not set}"
  ssh_base=(sshpass -p "$SERVER_PASSWORD" "${ssh_base[@]}")
  scp_base=(sshpass -p "$SERVER_PASSWORD" "${scp_base[@]}")
fi

remote="${SERVER_USER}@${SERVER_HOST}"

"${ssh_base[@]}" "$remote" "mkdir -p '${SERVER_BASE_DIR}/apk/canary/versions'"

"${scp_base[@]}" "$APK_PATH" "${remote}:${SERVER_BASE_DIR}/apk/canary/versions/${APK_NAME}"

"${ssh_base[@]}" "$remote" \
  "cd '${SERVER_BASE_DIR}/apk/canary' && ln -sfn 'versions/${APK_NAME}' latest.apk"

echo "uploaded=$APK_NAME"
echo "downloadUrl=${PUBLIC_BASE_URL%/}/apk/canary/latest.apk"
