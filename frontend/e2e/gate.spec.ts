// The Entrance: one shared password; deep links wait behind it; Lock signs this device out.
// These tests start from a device with no session (they never touch the shared one).
import { GROUP_NAME, PASSWORD } from './env';
import { expect, h1, test } from './fixtures';

// Wrong passwords count toward the unlock throttle (10 a minute, 30 an hour per client). Through the dev
// proxy the client is whatever X-Forwarded-For says (docs/contracts/backend.md), so this file's misses
// count against a made-up address of its own, never against the 127.0.0.1 every local browser shares.
const client = `203.0.113.${1 + Math.floor(Math.random() * 254)}`;
test.use({ storageState: { cookies: [], origins: [] }, extraHTTPHeaders: { 'X-Forwarded-For': client } });

test('a deep link waits behind the gate, refuses a wrong password, then opens where it was going', async ({ page }) => {
  await page.goto('/people/1');
  await expect(h1(page, GROUP_NAME)).toBeVisible();
  await expect(page).toHaveTitle(GROUP_NAME);
  const password = page.getByLabel('Group password');

  const tryAgain = page.getByRole('alert').filter({ hasText: 'Try that once more.' });
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(tryAgain).toBeVisible(); // empty: asked again, nothing sent

  await password.fill('not the password');
  const refused = page.waitForResponse(r => r.url().endsWith('/api/unlock'));
  await page.getByRole('button', { name: 'Open' }).click();
  expect((await refused).status()).toBe(422);
  await expect(tryAgain).toBeVisible();
  await expect(password).toHaveAttribute('aria-invalid', 'true');

  await password.fill(PASSWORD);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(h1(page, 'Rachel Owens')).toBeVisible();
  await expect(page).toHaveURL(/\/people\/1$/);
  await expect(page).toHaveTitle(`Rachel Owens · ${GROUP_NAME}`);
});

test('Lock puts this device behind the gate, and it stays locked across reloads', async ({ page }) => {
  await page.goto('/prayer');
  await page.getByLabel('Group password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(h1(page, 'Prayer')).toBeVisible();
  // Unsaved study writing kept from an earlier visit goes too, even though no editor is open now.
  await page.evaluate(() => localStorage.setItem('ff:editor-draft:new', '{"v":1}'));

  const locked = page.waitForResponse(r => r.url().endsWith('/api/lock') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByLabel('Group password')).toBeVisible();
  await expect(page).toHaveURL(/\/$/); // Lock goes Home
  await expect(page).toHaveTitle(GROUP_NAME);
  expect((await locked).status()).toBe(204);
  expect(await page.evaluate(() => localStorage.getItem('ff:editor-draft:new'))).toBeNull();

  // The server agrees: this session can't read anything any more.
  expect((await page.request.get('/api/snapshot', { headers: { Accept: 'application/json' } })).status()).toBe(401);

  await page.reload();
  await expect(page.getByLabel('Group password')).toBeVisible();
  await page.goto('/studies');
  await expect(page.getByLabel('Group password')).toBeVisible();
  await expect(h1(page, 'Studies')).toHaveCount(0);
});

test('Lock from unsaved study writing asks first, and Back afterwards skips the editor', async ({ page }) => {
  await page.goto('/studies');
  await page.getByLabel('Group password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(h1(page, 'Studies')).toBeVisible();
  await page.getByRole('link', { name: 'New study' }).click();
  await expect(h1(page, 'New study')).toBeVisible();
  await page.getByLabel('Passage', { exact: true }).fill('Not saved');

  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  const ask = page.getByRole('dialog', { name: 'Lock without saving?' });
  await ask.getByRole('button', { name: 'Lock', exact: true }).click();
  await expect(page.getByLabel('Group password')).toBeVisible();
  await expect(page).toHaveURL(/\/$/);

  await page.getByLabel('Group password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /friends\.$/ })).toBeVisible();
  await page.goBack();
  await expect(h1(page, 'Studies')).toBeVisible();
  await expect(page).toHaveURL(/\/studies$/);
});
