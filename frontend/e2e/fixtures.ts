// The suite's `test`: Playwright's, plus
// - `qa`: a unique id for the data this test creates, API shortcuts for setting data up, and cleanup
//   of everything registered with it (so tests stay independent and the demo data stays as it was);
// - a guard that fails the test on any uncaught error in the page.
// Plus small page helpers that read like the UI: nav links, dialogs, toasts.
import { test as base, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { Member, Prayer, Settings } from '@/lib/types';

export { expect };

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** JSON calls to /api with the test's own session (the browser context's cookies), as the app makes them. */
export class Api {
  constructor(private readonly context: BrowserContext) {}

  private async xsrf(): Promise<string> {
    const find = async () => (await this.context.cookies()).find(c => c.name === 'XSRF-TOKEN');
    let cookie = await find();
    if (!cookie) {
      await this.context.request.get('/api/group'); // sets the cookie
      cookie = await find();
    }
    if (!cookie) throw new Error('No XSRF-TOKEN cookie after GET /api/group');
    return decodeURIComponent(cookie.value);
  }

  async send<T>(method: Method, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') headers['X-XSRF-TOKEN'] = await this.xsrf();
    const res = await this.context.request.fetch(path, { method, headers, data: body });
    if (!res.ok()) throw new ApiError(res.status(), `${method} ${path} → ${res.status()} ${await res.text()}`);
    return (res.status() === 204 ? undefined : await res.json()) as T;
  }

  get = <T>(path: string) => this.send<T>('GET', path);
  post = <T>(path: string, body?: unknown) => this.send<T>('POST', path, body);
  patch = <T>(path: string, body?: unknown) => this.send<T>('PATCH', path, body);
  del = (path: string) => this.send<void>('DELETE', path);
}

export type Qa = {
  /** Unique per test and project (e.g. “m4k2zq”): put it in every name this test creates. */
  uid: string;
  /** “QA {label} {uid}”: the shared-database naming rule. */
  name: (label: string) => string;
  api: Api;
  /** A member made through the API, removed after the test (with their dates and requests). */
  member: (label: string, input?: Partial<Omit<Member, 'id' | 'dates' | 'created_at'>>) => Promise<Member>;
  /** An active request for a member, made through the API (it goes when the member does). */
  prayer: (memberId: number, body: string) => Promise<Prayer>;
  /** Registers a DELETE (e.g. `/api/members/12`) to run after the test; a 404 is fine. */
  removeLater: (path: string) => void;
  /**
   * Resolves with what the app creates next through `POST {path}` (e.g. '/api/members'), and removes
   * it after the test (`DELETE {path}/{id}`), even if the test fails before it would have. Start
   * waiting before the click that creates it.
   */
  created: <T extends { id: number }>(page: Page, path: string) => Promise<T>;
  /** Registers a PATCH /api/settings that puts these values back after the test. */
  restoreSettings: (values: Partial<Settings>) => void;
};

export const test = base.extend<{ qa: Qa; pageErrors: string[] }>({
  qa: async ({ context }, provide, testInfo) => {
    const api = new Api(context);
    const uid = `${testInfo.project.name.charAt(0)}${Math.random().toString(36).slice(2, 7)}`;
    const undo: (() => Promise<unknown>)[] = [];
    const removeLater = (path: string) => void undo.push(() => api.del(path));
    await provide({
      uid,
      api,
      name: label => `QA ${label} ${uid}`,
      removeLater,
      restoreSettings: values => void undo.push(() => api.patch('/api/settings', values)),
      created: <T extends { id: number }>(page: Page, path: string) =>
        page
          .waitForResponse(r => new URL(r.url()).pathname === path && r.request().method() === 'POST' && r.status() === 201)
          .then(async r => {
            const item = (await r.json()) as T;
            removeLater(`${path}/${item.id}`);
            return item;
          }),
      member: async (label, input = {}) => {
        const m = await api.post<Member>('/api/members', { ...input, name: `QA ${label} ${uid}` });
        removeLater(`/api/members/${m.id}`);
        return m;
      },
      prayer: (memberId, body) => api.post<Prayer>('/api/prayers', { member_id: memberId, body }),
    });
    for (const step of undo.reverse()) {
      await step().catch(e => {
        if (!(e instanceof ApiError && e.status === 404)) console.warn(`[e2e] cleanup failed: ${(e as Error).message}`);
      });
    }
  },

  // Uncaught exceptions in the page fail the test (console noise doesn't).
  pageErrors: [
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on('pageerror', e => errors.push(e.stack || e.message));
      await provide(errors);
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});

// — Page helpers —

/** The main navigation that's showing: the top nav on desktop, the tab bar on mobile. */
export const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

/** Follow a main tab (Home, People, Prayer, Studies) the way a person would. */
export async function goTab(page: Page, tab: 'Home' | 'People' | 'Prayer' | 'Studies') {
  await mainNav(page).getByRole('link', { name: tab, exact: true }).click();
}

/** Open a route and wait for the screen's h1 (the gate and the first snapshot are through by then). */
export async function open(page: Page, path: string, heading: string | RegExp) {
  await page.goto(path);
  await expect(h1(page, heading)).toBeVisible();
}

export const h1 = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name });

/** An open dialog by its title. */
export const dialog = (page: Page, name: string | RegExp): Locator => page.getByRole('dialog', { name });

/** The sage success toast (its screen-reader copy in the polite live region). */
export async function expectToast(page: Page, text: string) {
  await expect(page.getByRole('status').getByText(text, { exact: true })).toBeAttached();
}

/** The neutral error toast (announced as an alert). */
export async function expectErrorToast(page: Page, text: string) {
  await expect(page.getByRole('alert').getByText(text, { exact: true })).toBeAttached();
}

/** `YYYY-MM-DD` for today + `days`, in the browser's (= this machine's) local time. */
export function isoDay(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Escapes text for use inside a RegExp. */
export const re = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
