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

**This app's actual deployment** (shared sandbox host) is documented in
[`../infra/README.md`](../infra/README.md) — read that for the real topology, nginx config and
deploy script. It uses the FastCGI variant of step 5 below (nginx → php-fpm directly for `/api`),
not Next's own rewrite. The rest of this section is the generic checklist, for this or any other
host.

Shape: **HTTPS reverse proxy** (nginx or Caddy) in front, terminating TLS, reachable from
outside — everything behind it (Next, Laravel, Postgres) stays on a private network or loopback.
`/api/*` must end up at Laravel with the session cookie still same-origin from the browser's
point of view, either by the reverse proxy routing `/api` straight to php-fpm/Laravel itself
(what this app's actual deployment does), or by routing everything to Next and letting its own
`rewrites()` forward `/api` to Laravel (what `next.config.ts` is written for, and what local dev
does) — both give the browser an identical same-origin contract; pick whichever fits the host.

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
5. **Client IPs — required for the unlock throttle.** Laravel only honors `X-Forwarded-For` from
   proxies listed in `TRUSTED_PROXIES` (`config/trustedproxy.php`) — loopback is trusted by
   default, nothing else. Whichever reverse-proxy layer talks to Laravel (nginx directly, or Next
   in between) must append the real socket address — nginx:
   `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` for an HTTP proxy, or
   `fastcgi_param HTTP_X_FORWARDED_FOR $proxy_add_x_forwarded_for;` for FastCGI — and
   `TRUSTED_PROXIES` must list that layer's own network (its container/host IP or CIDR — **never
   `*`**: `config/trustedproxy.php` always returns an array, and `TrustProxies`' wildcard fast
   path only fires for the literal string `'*'`, so `'*'` inside the array silently matches
   nothing and every client collapses onto one throttle bucket). Never expose Next or Laravel
   directly — if you do, anyone can choose the address they are throttled by.
6. **Next build:** if Next itself proxies `/api` (its own `rewrites()`), `BACKEND_URL` is baked in
   at build time — point it at Laravel's loopback/private address. If something in front of Next
   (nginx) routes `/api` straight to Laravel instead, this is moot — `rewrites()` never fires.
7. **Scheduler:** `* * * * * cd /path/to/backend && php artisan schedule:run >> /dev/null 2>&1`
   (prunes idle locked sessions daily).
