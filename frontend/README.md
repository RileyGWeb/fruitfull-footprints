# Fruitfull Footprints — app

The Next.js 16 (App Router) client: every screen, the password gate, and the service worker for
offline reading. It talks only to its own origin; `/api/*` is rewritten to the Laravel API
(`BACKEND_URL`, default `http://127.0.0.1:8110`, baked in at `next build`).

Running it, testing it and hosting it are covered in the root [`README.md`](../README.md); start the
whole stack from the repo root with `npm run dev` (Next on :3110). The contract is
[`docs/SPEC.md`](../docs/SPEC.md) §3, and the shared `lib/` and `components/` surface screens build
on is [`docs/contracts/frontend-foundation.md`](../docs/contracts/frontend-foundation.md).

Before using a Next API, read [`AGENTS.md`](AGENTS.md): this Next.js differs from older versions,
and its docs are in `node_modules/next/dist/docs/`.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | `node --test` unit tests (`lib/**/*.test.ts`, `components/**/*.test.ts`) |
| `npm run lint` · `npx tsc --noEmit` | ESLint and type checks |
| `npm run build` · `npm start` | Production build and server (the service worker registers only here, or in dev with `NEXT_PUBLIC_ENABLE_SW=1`) |
| `npm run icons` | Regenerate the PWA icons in `public/icons/` |
| `npm run e2e` | Playwright end-to-end tests against the running dev stack (:3110). **Wipes the dev database** first (demo reseed, which also signs every browser out); `FF_E2E_NO_RESET=1` skips that. See `playwright.config.ts` |
