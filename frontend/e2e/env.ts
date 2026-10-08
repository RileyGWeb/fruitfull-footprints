// Settings shared by playwright.config.ts, the global setup and the tests (no test imports here).
import path from 'node:path';

/** The running app (Next dev or start), which proxies /api to Laravel. */
export const BASE_URL = (process.env.FF_BASE_URL || 'http://localhost:3110').replace(/\/$/, '');

/** The group password the backend was seeded with (backend/.env GROUP_PASSWORD). */
export const PASSWORD = process.env.GROUP_PASSWORD || 'footprints';

/** Where the unlocked session from auth.setup.ts is kept for every other test. */
export const AUTH_FILE = path.join(import.meta.dirname, '.auth', 'group.json');

/** The Laravel app whose dev database globalSetup resets. */
export const BACKEND_DIR = path.resolve(import.meta.dirname, '..', '..', 'backend');

/** The demo group's name (DemoSeeder); the tests never change it. */
export const GROUP_NAME = 'Fruitfull Footprints';
