# Fruitfull Footprints — API

The Laravel 13 JSON API behind the app. The browser never talks to it directly: Next.js rewrites
`/api/*` here, so the session cookie lives on the app's origin. The contract is
[`docs/SPEC.md`](../docs/SPEC.md) §2; the as-built detail is
[`docs/contracts/backend.md`](../docs/contracts/backend.md). Running and testing it locally are in
the root [`README.md`](../README.md) (start the whole stack there with `npm run dev`; Laravel on
:8110). This file adds the artisan commands and the production checklist.

## Commands

| Command | What it does |
|---|---|
| `php artisan ff:password` | Set the group password (prompts; `--password=` to pass it). Locks every other device. |
| `php artisan ff:prune-sessions` | Remove locked sessions idle for a day (`--hours=` to change). Scheduled daily. |
| `php artisan migrate:fresh --seed --seeder=DemoSeeder` | Demo data. Wipes the database. |
| `php artisan test` | Feature tests against Postgres `fruitfull_test`. |
| `./vendor/bin/pint --test` | Code style check (`pint` without `--test` fixes it). |

## Production

Shape: **HTTPS reverse proxy** (nginx or Caddy) → **Next.js** (`next start`, listening on
loopback only) → **Laravel** (php-fpm or similar, loopback only) → Postgres. Only the reverse
proxy is reachable from outside.

1. **Install without dev tools:** `composer install --no-dev --optimize-autoloader`. This also
   leaves out Laravel Boost, which opens an unauthenticated browser-log route whenever the app
   runs in local mode or with debug on.
2. **Environment:** copy `.env.example`, apply its *Production* block (`APP_ENV=production`,
   `APP_DEBUG=false`, `APP_URL` = the public https origin, `LOG_LEVEL=warning`), run
   `php artisan key:generate` once, and set the group password (`GROUP_PASSWORD` before the first
   seed, or `php artisan ff:password`). With `APP_ENV=production` the session and XSRF cookies are
   `Secure` unless `SESSION_SECURE_COOKIE=false`.
3. **Database and caches:** `php artisan migrate --force && php artisan db:seed --force`, then
   `php artisan config:cache && php artisan route:cache` (repeat after every deploy).
4. **PHP:** `expose_php=Off` and `display_errors=Off` in php.ini.
5. **Client IPs — required for the unlock throttle.** Next's rewrite proxy forwards the browser's
   `X-Forwarded-For` untouched and adds none, and Laravel trusts loopback (where Next connects
   from). So the reverse proxy in front of Next must append the real socket address:
   nginx `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` and
   `proxy_set_header X-Forwarded-Proto $scheme;` (Caddy does both by default). Never expose Next
   or Laravel directly; if you do, anyone can choose the address they are throttled by. If a CDN
   or load balancer sits in front of the reverse proxy, or Next runs on another machine, list
   those addresses in `TRUSTED_PROXIES`.
6. **Next build:** `BACKEND_URL` is baked into the rewrites at build time; point it at Laravel's
   loopback/private address.
7. **Scheduler:** `* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1`
   (prunes idle locked sessions daily).
