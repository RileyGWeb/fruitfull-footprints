// The `setup` project: sign in once through the Entrance as a leader (every test's session) and once as a
// member (for the tests of what members can't do), and save both. The leader also opens each route once,
// so Next dev has compiled them before the parallel tests start.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { AUTH_FILE, MEMBER_AUTH_FILE, MEMBER_PASSWORD, PASSWORD } from './env';

const ROUTES: [string, string | RegExp][] = [
  ['/people', 'Our group'],
  ['/people/dates', 'Our group'],
  ['/people/1', 'Rachel Owens'],
  ['/prayer', 'Prayer'],
  ['/prayer/answered', 'Prayer'],
  ['/studies', 'Studies'],
  ['/studies/1', 'Romans 8'],
  ['/studies/new', 'New study'],
  ['/studies/1/edit', /^(Editing|Preparing) Romans 8$/],
  ['/settings', 'Settings'],
  ['/qa-no-such-page', 'That page isn’t here'],
];

setup('sign in as a member', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your password').fill(MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /friends\.$/ })).toBeVisible({ timeout: 60_000 });
  mkdirSync(path.dirname(MEMBER_AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: MEMBER_AUTH_FILE });
});

setup('sign in as a leader and warm up the routes', async ({ page }) => {
  setup.setTimeout(240_000);
  await page.goto('/');
  await page.getByLabel('Your password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: /friends\.$/ })).toBeVisible();
  mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE });

  for (const [route, heading] of ROUTES) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible({ timeout: 60_000 });
  }
});
