#!/usr/bin/env bash
set -euo pipefail

expect <<'EOFEXPECT'
log_user 1
set timeout 30
spawn ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null root@8.217.101.26
expect "*password*"
send "br8sb9GvxNiWBnm\r"
expect "*#*"
send "docker logs --since 5m canary-lobe 2>&1 | grep -A 10 'embeddingChunks error' | tail -30\r"
expect "*#*"
send "docker logs --since 5m canary-lobe 2>&1 | grep -B 2 -A 5 'ai_providers' | tail -30\r"
expect "*#*"
send "docker logs --since 5m canary-lobe 2>&1 | grep -i 'resource\\|space\\|spc_p' | tail -20\r"
expect "*#*"
send "exit\r"
expect eof
EOFEXPECT
