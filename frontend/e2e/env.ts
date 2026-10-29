// Settings shared by playwright.config.ts, the global setup and the tests (no test imports here).
import path from 'node:path';

/** The running app (Next dev or start), which proxies /api to Laravel. */
export const BASE_URL = (process.env.FF_BASE_URL || 'http://localhost:3110').replace(/\/$/, '');

/** Rachel Owens, a leader of the demo group: the password DemoSeeder::LOGINS gives her. The suite signs in as her. */
export const PASSWORD = process.env.FF_PASSWORD || 'footprints';

/** Sarah Lindqvist, a regular member of the demo group (DemoSeeder::LOGINS), for what members can't do. */
export const MEMBER_PASSWORD = process.env.FF_MEMBER_PASSWORD || 'sarah-member';

/** Where the leader's signed-in session from auth.setup.ts is kept for every other test. */
export const AUTH_FILE = path.join(import.meta.dirname, '.auth', 'leader.json');

/** Where the member's session is kept, for the tests that `test.use` it. */
export const MEMBER_AUTH_FILE = path.join(import.meta.dirname, '.auth', 'member.json');

/** The Laravel app whose dev database globalSetup resets. */
export const BACKEND_DIR = path.resolve(import.meta.dirname, '..', '..', 'backend');

/** The demo group's name (DemoSeeder); the tests never change it. */
export const GROUP_NAME = 'Fruitfull Footprints';
