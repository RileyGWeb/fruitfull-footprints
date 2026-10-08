// Runs once before the suite: checks the app is up, then WIPES the dev database back to the demo data
// (skip with FF_E2E_NO_RESET=1). The reset also clears sessions and the unlock throttle (both live in
// the database), which is why the `setup` project unlocks afresh afterwards.
import { execFileSync } from 'node:child_process';
import { BACKEND_DIR, BASE_URL } from './env';

export default async function globalSetup() {
  try {
    const res = await fetch(`${BASE_URL}/api/group`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`GET /api/group answered ${res.status}`);
  } catch (e) {
    throw new Error(`The app isn't reachable at ${BASE_URL} (${(e as Error).message}). Start it with \`npm run dev\` at the repo root, or set FF_BASE_URL.`);
  }

  if (process.env.FF_E2E_NO_RESET === '1') {
    console.log('[e2e] FF_E2E_NO_RESET=1: keeping the current database');
    return;
  }
  console.log('[e2e] Resetting the dev database to the demo data (migrate:fresh --seed --seeder=DemoSeeder)…');
  execFileSync('php', ['artisan', 'migrate:fresh', '--seed', '--seeder=DemoSeeder', '--force'], {
    cwd: BACKEND_DIR,
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}
