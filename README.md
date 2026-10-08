# Fruitfull Footprints

A private home for one small group: the people in it, what we're praying about, and the Bible
studies we walk through together. It's an installable PWA behind one shared group password.

- **People** — everyone in the group, their spiritual gifts, a few things worth knowing, and dates
  to remember (birthdays, anniversaries, life events).
- **Prayer** — active requests with short updates, marked answered (with how it turned out) and
  kept for looking back.
- **Studies** — the week's study notes (drafted, then published to the group), the path of series
  so far, and a searchable archive.

## Stack

| Part | What |
|---|---|
| `backend/` | Laravel 13 JSON API (PHP ≥ 8.3), session-cookie auth behind a shared password |
| `frontend/` | Next.js 16 App Router + React 19 + TypeScript, SWR, CSS Modules on the Organic design tokens, service worker for offline reading |
| Database | Postgres 17 (`docker compose`) |

The browser only talks to Next; Next rewrites `/api/*` to Laravel, so the API is same-origin (no
CORS, the session cookie lives on the app's origin).

## Run it locally

Requirements: PHP 8.3+, Composer, Node 20+, Docker.

```bash
docker compose up -d                                   # Postgres on 127.0.0.1:5490 (dev + test DBs)

cd backend
composer install
cp .env.example .env && php artisan key:generate       # then set GROUP_PASSWORD in .env
php artisan migrate --seed                             # settings + the group password
cd ..

cd frontend && npm install && cd ..
npm run dev                                            # Laravel :8110 + Next :3110 (logs in /tmp/ff_*.log)
```

Open http://localhost:3110 and enter the group password. `npm run dev:down` stops both servers.

**Demo data** (the group, prayers and studies from the design, shifted to sit around today):
`npm run demo` (runs `php artisan migrate:fresh --seed --seeder=DemoSeeder` — wipes the dev DB).

**Group password:** set `GROUP_PASSWORD` before the first seed, or any time with
`php artisan ff:password`. Changing it (here or in Settings) locks every other device out until
they enter the new one.

## Tests

```bash
cd backend && php artisan test && ./vendor/bin/pint --test   # feature tests (Postgres fruitfull_test) + code style
cd frontend && npm test               # node --test unit tests for lib/ and view helpers
cd frontend && npm run lint && npx tsc --noEmit && npm run build
cd frontend && npm run e2e            # Playwright, against the running dev stack — WIPES the dev DB to the demo data
cd tools && npm test                  # the screenshot tool's argument parsing
```

## Project layout

```
backend/            Laravel API — routes/api.php, app/Http/Controllers/Api, app/Services, database/seeders/DemoSeeder.php
frontend/           Next.js app — app/ (routes), components/<area>/, lib/ (types, api, dates, actions…), public/sw.js, e2e/ (Playwright)
docs/SPEC.md        The build contract: data model, API, frontend architecture, decisions
docs/contracts/     As-built API and frontend-foundation surfaces
docs/design/        The Claude Design prototype, the Organic stylesheet, reference renders of every screen
tools/              Dev helpers: shot.mjs (screenshot the running app), render-design.mjs (re-render design refs)
scripts/            dev-up.sh / dev-down.sh
```

## Decisions worth knowing

- **One shared password, no accounts.** Nothing is attributed to a person; "Lock" logs this device
  out. Sessions last a year.
- **Read-only offline.** The service worker (production builds only) keeps every page opened
  online, every profile and published study page, and the last-fetched data, and the app saves the
  notes of upcoming and recent studies in the background, so studies and prayer lists are readable
  without a connection; changes need one. Locking clears the cached data, and works offline too:
  the device locks at once and tells the server when it's back online.
- **Unsaved study writing is kept.** The editor asks before leaving with unsaved changes, keeps
  them on the device until they're saved, and if someone else saved the study meanwhile, asks
  whether to load their version or keep yours.
- **Locked from elsewhere, nothing lost.** If the password changes while the app is open, the
  password screen covers it, and whatever was half-typed is still there afterwards.
- **"This week" includes tonight.** On meeting night Home shows tonight's study.
- **Fills the design's gaps in its own style:** adding/editing/removing people, editing and
  deleting prayers and dates, deleting studies, and a Settings page.

## Hosting

Deployed at **fruitfullfootprints.club**, on a shared sandbox AWS host alongside several other
small apps — see [`infra/README.md`](infra/README.md) for the real topology, nginx config and
deploy script, and [`backend/README.md#production`](backend/README.md#production) for the
generic checklist. Push to `main` deploys automatically (`.github/workflows/deploy.yml`, via SSM
— no image registry, the host builds the containers from a git checkout). In short:

- A reverse proxy (nginx, on this deployment) terminates TLS and must append the client's real
  address to the header Laravel reads (`X-Forwarded-For` over HTTP, or
  `HTTP_X_FORWARDED_FOR` over FastCGI) — the unlock throttle keys on it, so without this anyone
  can pick the address they're throttled by. **Never expose Next or Laravel directly.**
- `TRUSTED_PROXIES` must list that proxy layer's actual network (never `*` — see
  `backend/README.md#production` §5 for why it silently does nothing).
- Each `next build` gets a fresh build id, which versions the service worker so every deploy
  installs a new one. Set `FF_BUILD_ID` (e.g. the commit sha) to choose it; it must change with
  every deploy.
- Run Laravel's scheduler (`php artisan schedule:run` every minute); it prunes idle locked
  sessions daily.
