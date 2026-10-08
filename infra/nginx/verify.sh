#!/usr/bin/env bash
# Outside-in smoke test against the live domain: DNS, TLS, and that both the frontend and the API
# actually answer through nginx. Run after any nginx change on the host.
set -euo pipefail
DOMAIN="${1:-fruitfullfootprints.club}"

echo "== DNS =="
dig +short "$DOMAIN" A || true

echo "== TLS cert =="
echo | openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" 2>/dev/null \
  | openssl x509 -noout -subject -dates 2>/dev/null || echo "(no cert / connection failed)"

echo "== HTTP -> HTTPS redirect =="
curl -sI "http://$DOMAIN/" | head -1

echo "== Frontend =="
curl -s -o /dev/null -w "status: %{http_code}\n" "https://$DOMAIN/"

echo "== API (public, no-auth route) =="
curl -s -o /dev/null -w "status: %{http_code}\n" "https://$DOMAIN/api/group"
