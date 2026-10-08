// Offline: the banner says so, what was loaded stays readable, and writes say they need a connection.
// (Next dev has no service worker, so this covers the in-memory copy; the worker is production-only.)
import { expect, expectErrorToast, expectToast, goTab, h1, open, test } from './fixtures';

const BANNER = 'You’re offline — showing what was saved. Changes need a connection.';

test('offline: the banner shows, the data stays, a write waits for the connection', async ({ page, context, qa }) => {
  const member = await qa.member('Offline');
  const prayer = await qa.prayer(member.id, qa.name('request'));
  await open(page, '/prayer', 'Prayer');
  const card = page.getByRole('article').filter({ hasText: prayer.body });
  const banner = page.getByRole('status').filter({ hasText: BANNER });
  await expect(card).toBeVisible();
  await expect(banner).toHaveCount(0);

  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await expect(card).toBeVisible();

  const field = card.getByLabel('Update on QA’s request');
  await card.getByRole('button', { name: 'Add update' }).click();
  await field.fill('Written on the train.');
  await card.getByRole('button', { name: 'Save update' }).click();
  await expectErrorToast(page, 'You’re offline — try again when you’re connected.');
  await expect(field).toHaveValue('Written on the train.'); // nothing typed is lost

  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
  await card.getByRole('button', { name: 'Save update' }).click();
  await expectToast(page, 'Update added');
  await expect(card.getByRole('list', { name: 'Updates' })).toContainText('Written on the train.');
});

test('offline: going back to a screen already opened shows its saved data', async ({ page, context }) => {
  await open(page, '/people', 'Our group');
  await expect(page.getByRole('link', { name: /Rachel/ })).toBeVisible();
  await goTab(page, 'Prayer');
  await expect(h1(page, 'Prayer')).toBeVisible();

  await context.setOffline(true);
  await page.goBack();
  await expect(h1(page, 'Our group')).toBeVisible();
  await expect(page.getByRole('link', { name: /Rachel/ })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: BANNER })).toBeVisible();
  await context.setOffline(false);
});
