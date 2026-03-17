#!/usr/bin/env bash

set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-root@8.217.101.26}"
REMOTE_DEPLOY_PATH="${REMOTE_DEPLOY_PATH:-/data/avato/deploy-image}"
TAIL_LINES="${TAIL_LINES:-150}"
FOLLOW="${FOLLOW:-1}"
SINCE="${SINCE:-}"

usage() {
  cat <<'EOF'
Usage:
  tailRemoteLogs.sh [service...]

Examples:
  tailRemoteLogs.sh
  tailRemoteLogs.sh lobe
  tailRemoteLogs.sh lobe postgres redis
  FOLLOW=0 tailRemoteLogs.sh lobe
  SINCE=10m tailRemoteLogs.sh lobe
  REMOTE_HOST=root@1.2.3.4 tailRemoteLogs.sh

Environment:
  REMOTE_HOST         SSH target. Default: root@8.217.101.26
  REMOTE_DEPLOY_PATH  Remote docker compose directory. Default: /data/avato/deploy-image
  TAIL_LINES          Number of lines to show. Default: 150
  FOLLOW              1 to follow logs, 0 to print once. Default: 1
  SINCE               Optional docker compose --since value, e.g. 10m, 1h

Defaults:
  If no services are given, logs for: lobe postgres redis rustfs searxng
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then
  services=(lobe postgres redis rustfs searxng)
fi

remote_cmd=(
  "cd '$REMOTE_DEPLOY_PATH'"
  "docker compose ps"
)

log_cmd="docker compose logs"
if [[ "$FOLLOW" == "1" ]]; then
  log_cmd+=" -f"
fi
log_cmd+=" --tail '$TAIL_LINES'"

if [[ -n "$SINCE" ]]; then
  log_cmd+=" --since '$SINCE'"
fi

for service in "${services[@]}"; do
  log_cmd+=" '$service'"
done

remote_cmd+=(
  "echo"
  "$log_cmd"
)

echo "==> Remote host: $REMOTE_HOST"
echo "==> Compose dir: $REMOTE_DEPLOY_PATH"
echo "==> Services: ${services[*]}"
echo

ssh -t "$REMOTE_HOST" "$(printf '%s && ' "${remote_cmd[@]}" | sed 's/ && $//')"
