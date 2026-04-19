#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$PROJECT_DIR/android"
OVERLAY_DIR="$PROJECT_DIR/native-overlays/android"

if [[ ! -d "$OVERLAY_DIR" ]]; then
  echo "Android overlay directory not found: $OVERLAY_DIR"
  exit 1
fi

if [[ ! -d "$ANDROID_DIR" ]]; then
  (
    cd "$PROJECT_DIR"
    npx expo prebuild --platform android --no-install
  )
fi

files=(
  "gradle.properties"
  "settings.gradle"
  "app/build.gradle"
  "app/src/main/AndroidManifest.xml"
)

for rel_path in "${files[@]}"; do
  src="$OVERLAY_DIR/$rel_path"
  dst="$ANDROID_DIR/$rel_path"

  if [[ ! -f "$src" ]]; then
    echo "Overlay source not found: $src"
    exit 1
  fi

  mkdir -p "$(dirname "$dst")"

  if [[ -f "$dst" ]] && cmp -s "$src" "$dst"; then
    echo "synced=$rel_path status=unchanged"
    continue
  fi

  cp "$src" "$dst"
  echo "synced=$rel_path status=updated"
done
