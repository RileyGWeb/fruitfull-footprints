# fruitfull-footprints

Private small-group PWA (people, prayer, Bible studies) behind one shared group password.
`backend/` Laravel 13 JSON API · `frontend/` Next.js 16 App Router client · Postgres 17 via
`docker compose` (127.0.0.1:5490, loopback only). Read `docs/SPEC.md` before structural changes —
it is the contract (data model, endpoints, frontend architecture, settled decisions). As-built
surfaces: `docs/contracts/`.

## Run
`docker compose up -d`, then `npm run dev` at the root (Laravel :8110, Next :3110; logs in
`/tmp/ff_api.log`, `/tmp/ff_web.log`). Demo data: `npm run demo` (wipes the dev DB). Local group
password: `GROUP_PASSWORD` in `backend/.env` (`footprints` locally).

## Design source of truth
`docs/design/prototype.dc.html` (Claude Design prototype — markup + logic + seed data) and the
reference renders in `docs/design/refs/` (mobile 390×844 @2x, desktop 1280). UI changes should
stay pixel-faithful to them; the phone status bar in the mobile refs is frame chrome. Check a
change visually with `node tools/shot.mjs --url <route> --out /tmp/x.png [--viewport desktop]
[--full] [--scroll px] [--fill sel=text] [--click sel]` (needs the dev servers; unlocks the gate
itself; console errors are printed) and compare against the matching ref.
Re-render the refs from the prototype with `tools/render-design.mjs` if the design changes.

## Conventions
- Frontend: no Tailwind. Global Organic tokens/classes in `frontend/app/globals.css`; screen
  styles in CSS Modules. One SWR snapshot (`/api/snapshot`) feeds every screen; all mutations go
  through `useActions()` / `useDialogs()` (`frontend/lib/actions.ts`, `components/dialogs`).
  Breakpoint 760px, CSS-only. Copy is plain and warm — no exclamation marks, curly quotes.
- Frontend shared patterns (details in `docs/contracts/frontend-foundation.md`): a 422 with field
  errors isn't toasted, so show `fieldErrors(e)` (`lib/api`) under the field (a study save's 409 is
  rethrown untoasted too: `isConflict(e)`, theirs in `e.data.study`); busy buttons use
  `aria-disabled`, not `disabled`; small icon buttons get the global `.hit` for a 44px target;
  name a screen with `useDocumentTitle` (`lib/title`), never `metadata.title`; loading/failed/missing
  screens use `ScreenState` / `NotFound` (`components/ui`, with the heading `level` that fits the
  screen's outline); leave a guarded page or navigate right after a dialog with `leaveTo`
  (`lib/historyGuard`); the Lock button is `useLock()` (`lib/hooks`).
- `frontend/AGENTS.md`: this Next.js differs from training data — read
  `frontend/node_modules/next/dist/docs/` before using Next APIs.
- Backend: `/api` routes run through the `web` middleware group (session + CSRF via
  `XSRF-TOKEN`/`X-XSRF-TOKEN`); `group.unlocked` guards everything except group/unlock/lock.
  `backend/CLAUDE.md` holds the Laravel Boost guidelines. Unlock is throttled by the `unlock`
  limiter (wrong passwords only); production setup, including the X-Forwarded-For-appending
  reverse proxy it relies on, is the checklist in `backend/README.md`.
- The service worker (`frontend/public/sw.js`) only registers in production builds (or with
  `NEXT_PUBLIC_ENABLE_SW=1`). It is versioned per build automatically: `ServiceWorker.tsx`
  registers `/sw.js?v=<NEXT_PUBLIC_BUILD_ID>` (from `next.config.ts`, override with `FF_BUILD_ID`),
  so every deploy installs a fresh worker and drops old caches; no manual bump.

## Tests
`cd backend && php artisan test && ./vendor/bin/pint --test` (Postgres `fruitfull_test`),
`cd frontend && npm test && npm run lint && npx tsc --noEmit && npm run build`, `cd tools && npm test`
(shot.mjs argument parsing). End-to-end: `cd frontend && npm run e2e` (Playwright, needs the dev
stack; wipes the dev DB to the demo baseline and signs every browser out — `FF_E2E_NO_RESET=1`
skips the reset). The service worker only runs in a production build: check offline behaviour with
`npm run build && npx next start -p <port>` (proxies to the same Laravel), and stop it afterwards.
Backend 422 messages are plain copy pinned by `ValidationMessagesTest`; a few keep Laravel's
wording because the frontend matches on them (`docs/contracts/backend.md`, VALIDATION MESSAGES).

Update this file whenever something in it goes stale.
