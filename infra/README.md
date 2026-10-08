# Deployment

Deployed to the `sandbox` AWS account (956315450098, us-east-1) as one of several apps on a
**shared EC2 host** (`sandbox-apps-host`, tag `Name=sandbox-apps-host`), alongside ChoreChart,
dont-atrophy, PollsAndForms.com, to-do.ninja, memorize-your-scripture, suggestionbox,
unslop-your-flyer, mynextsteps and rileysfreetools.com. There is no per-app infrastructure
(no RDS, no ECR, no load balancer) — everything lives under `/opt/apps/` on that one box:

- `/opt/apps/docker-compose.yml` — one file, every app's services plus shared `postgres`
  (pgvector image, used as plain Postgres here), `mysql` (mariadb), `redis` and `nginx`.
- `/opt/apps/nginx/conf.d/` — the live nginx config (TLS server block per domain). There is also
  `conf.d.final/`, a template `scripts/enable-tls-nginx-conf.sh` overwrites `conf.d/` with — the
  **two must always be edited together**, or the next time that script runs it silently deletes
  this app's server block (this happened once, to a different app, and took it down for 4 days).
- `/opt/apps/fruitfull-footprints/` — this repo's git checkout, pulled fresh on every deploy.
- `/opt/apps/scripts/deploy-fruitfull.sh` — fetches secrets, rebuilds the two containers,
  migrates, restarts nginx.
- `/opt/apps/certbot/etc/` — Let's Encrypt certs, renewed by a single host-wide daily cron line
  that covers every app's domain.

**There is no image registry** (ECR has zero repos on this account) — every app's image is built
in place on the host from its git checkout.

## Topology — this app specifically

Unlike a plain static-site app, `frontend/next.config.ts` proxies `/api/*` to the Laravel backend
(`rewrites()`, kept same-origin so cookies work) — that's the local-dev topology. In production
on this shared host, **nginx intercepts `/api/*` before it ever reaches Next**, exactly like every
other Laravel+Next app on the box: nginx's `location ~ ^/(api)` FastCGI-passes straight to the
`fruitfull-backend` container's php-fpm on :9000, and only `location /` proxies to
`fruitfull-frontend` (Next's standalone server, :3000). Next's own `rewrites()` becomes dead code
in this deployment — harmless, since it's never reached — not a bug. The browser-facing contract
(relative `/api/*`, same-origin cookies, CSRF's `Sec-Fetch-Site: same-origin`) is identical either
way; only which layer does the proxying differs.

One addition specific to this app: `fastcgi_param HTTP_X_FORWARDED_FOR $proxy_add_x_forwarded_for;`
in the `/api` location (most apps on the box don't need this — this app's unlock throttle keys on
the real client IP). `backend/config/trustedproxy.php` must then be told to trust the Docker
`apps` network (not `*` — the config always returns an array, and `TrustProxies` middleware's `'*'`
fast path only fires when the value is the literal string `'*'`, so embedding `'*'` inside the
array silently matches nothing). The host's `apps` network is `172.18.0.0/16` — set
`TRUSTED_PROXIES=172.18.0.0/16` in the production secret (re-check with
`docker network inspect apps_apps --format '{{json .IPAM.Config}}'` on the host if the network is
ever recreated, since compose doesn't guarantee the same subnet).

## Recipe for re-provisioning (or copying this pattern to a new app)

1. **Secrets Manager**: `sandbox/apps/fruitfull/env` (flat JSON → `.env`, see
   `deploy-fruitfull.sh`) and `sandbox/apps/fruitfull/deploy-key` (a dedicated read-only GitHub
   deploy key, private half only — the public half is on the repo's Settings → Deploy keys).
2. **Database**: a role + database created once on the shared `postgres` service
   (`docker compose exec postgres psql -U postgres`), see `/opt/apps/scripts/create-databases.sh`
   on the host for the pattern (and note: Postgres 15+ revokes `CREATE` on the `public` schema
   from non-owners, so `ALTER SCHEMA public OWNER TO fruitfull;` is required or every migration
   fails with "permission denied for schema public").
3. **Route 53**: a hosted zone for the domain, A records (apex + `www`) to the host's Elastic IP,
   then the zone's 4 NS records go into the registrar's custom-nameserver settings.
4. **nginx**: add the domain to the shared HTTP(80) redirect block's `server_name` list first (so
   certbot's ACME HTTP-01 challenge has somewhere to answer) — *then* issue the cert — *then* add
   the HTTPS(443) server block below (`nginx/default.conf` in this directory is a snapshot of what
   was added). Always `docker compose exec nginx nginx -t` before restarting, and always
   `docker compose restart nginx` — never `nginx -s reload`, which has silently left new worker
   processes not listening on this host before.
5. **docker-compose.yml**: append the two service blocks (see `docker-compose.fragment.yml` in
   this directory — it's documentation, the host's copy is the one that runs).
6. **Deploy script**: `/opt/apps/scripts/deploy-fruitfull.sh` on the host (same shape as every
   other app's — fetch the deploy key, `git fetch`/`reset --hard origin/main`, write the env
   secret to `.env.production`, `docker compose build`/`up -d`, `migrate --force`,
   `config:cache`, restart nginx).
7. **GitHub Actions role**: `github-actions-sandbox-deploy`'s OIDC trust policy whitelists repos
   by `sub` claim (`repo:RileyGWeb*/<name>*:ref:refs/heads/main`) — a new app's repo must be added
   there before its workflow can assume the role. **The default branch must be `main`** — the
   trust policy and every deploy script hard-code it.
8. **Crontab**: this app's `php artisan ff:prune-sessions` is scheduled daily
   (`crontab -e` as root on the host) — most apps on the box need no crontab entry at all; only
   ones with a queue or a scheduled command do.

## Verify

`nginx/verify.sh` in this directory does an outside-in curl/TLS smoke test against the live
domain. `docker compose exec -T nginx nginx -t` checks syntax before any restart.
