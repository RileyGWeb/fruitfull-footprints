#!/usr/bin/env bash
# Stop the local Laravel + Next.js servers started by dev-up.sh (Postgres keeps running).
for port in 8110 3110; do
  pid=$(lsof -tiTCP:$port -sTCP:LISTEN || true)
  [ -n "$pid" ] && kill $pid && echo "stopped :$port"
done
exit 0
