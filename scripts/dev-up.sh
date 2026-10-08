#!/usr/bin/env bash
# Start the whole stack locally: Postgres (docker), Laravel on :8110, Next.js on :3110.
# Logs go to /tmp/ff_api.log and /tmp/ff_web.log. Stop with scripts/dev-down.sh.
set -euo pipefail
cd "$(dirname "$0")/.."

docker compose up -d postgres
until docker compose exec -T postgres pg_isready -U fruitfull >/dev/null 2>&1; do sleep 1; done

for port in 8110 3110; do
  pid=$(lsof -tiTCP:$port -sTCP:LISTEN || true)
  [ -n "$pid" ] && kill $pid && sleep 1
done

(cd backend && php artisan migrate --force >/dev/null && nohup php artisan serve --port=8110 >/tmp/ff_api.log 2>&1 &)
(cd frontend && nohup npm run dev -- --port 3110 >/tmp/ff_web.log 2>&1 &)

echo "API  → http://localhost:8110  (logs: /tmp/ff_api.log)"
echo "App  → http://localhost:3110  (logs: /tmp/ff_web.log)"
