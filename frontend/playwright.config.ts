/**
 * End-to-end tests (Playwright) against the running dev stack.
 *
 *   docker compose up -d && npm run dev      # at the repo root: Laravel :8110, Next :3110
 *   cd frontend && npm run e2e               # all projects; add e.g. `-- --project=mobile e2e/prayer.spec.ts`
 *
 * WARNING: e2e/global-setup.ts WIPES THE DEV DATABASE first (`php artisan migrate:fresh --seed
 * --seeder=DemoSeeder --force` in backend/), so every run starts from the demo data. That also signs
 * every browser out (sessions live in the database). Set FF_E2E_NO_RESET=1 to skip the reset, e.g.
 * when re-running one spec against data that is already the demo baseline.
 *
 * Environment:
 * - FF_BASE_URL     the app (default http://localhost:3110)
 * - FF_PASSWORD     Rachel's password, a leader (default “footprints”, as DemoSeeder sets it)
 * - FF_MEMBER_PASSWORD  Sarah's, a regular member (default “sarah-member”)
 * - FF_E2E_NO_RESET=1  don't reset the database
 * - FF_E2E_WORKERS  parallel workers (default 4; the dev backend serves one request at a time)
 *
 * Projects: `setup` signs in once through the Entrance, as a leader and as a member, and saves both
 * sessions (e2e/.auth/); `mobile` (390×844, touch) and `desktop` (1280×900) reuse the leader's. Tests are independent and run in
 * parallel, both projects at once: anything a test creates is named “QA … <uid>” (unique per test and
 * project) and removed again (see the `qa` fixture in e2e/fixtures.ts). Nothing here changes anyone's
 * password or the group's name.
 */
import { defineConfig } from '@playwright/test';
import { AUTH_FILE, BASE_URL } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  workers: Number(process.env.FF_E2E_WORKERS) || 4,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Next dev compiles a route the first time it's opened, so allow for that.
  timeout: 90_000,
  expect: { timeout: 10_000 },
  // No HTML report: it would copy the trace viewer's scripts into the tree, where `npm run lint` finds them.
  // A failure keeps its trace in e2e/.results; open it with `npx playwright show-trace <trace.zip>`.
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    browserName: 'chromium',
    locale: 'en-US',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'mobile',
      dependencies: ['setup'],
      use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, storageState: AUTH_FILE },
    },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: { viewport: { width: 1280, height: 900 }, storageState: AUTH_FILE },
    },
  ],
});
