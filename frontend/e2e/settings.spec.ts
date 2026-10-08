// Settings: the group's details save (only what changed), and bad input is caught under its field.
// The password card is deliberately untested here: changing it would lock every other device out.
import type { Settings } from '@/lib/types';
import { expect, expectToast, h1, open, test } from './fixtures';

// Both projects run at once against one database, so each changes its own field (and puts it back).
const FIELD: Record<string, [label: string, key: keyof Settings]> = {
  mobile: ['Meeting time', 'meeting_time'],
  desktop: ['Usual place', 'meeting_place'],
};

test('save a change to the group’s details', async ({ page, qa }, testInfo) => {
  const [label, key] = FIELD[testInfo.project.name];
  await open(page, '/settings', 'Settings');
  const form = page.getByRole('form', { name: 'About the group' });
  const field = form.getByLabel(label, { exact: true });
  const save = form.getByRole('button', { name: 'Save' });
  const before = await field.inputValue();
  qa.restoreSettings({ [key]: before });
  const value = qa.name('spot');

  await test.step('nothing changed: Save is off and Enter sends nothing', async () => {
    await expect(save).toHaveAttribute('aria-disabled', 'true');
    const patches: string[] = [];
    page.on('request', r => { if (r.method() === 'PATCH') patches.push(r.url()); });
    await field.press('Enter');
    await save.click({ force: true }); // a person can still press it; Playwright won't without force
    await page.waitForTimeout(500);
    expect(patches).toEqual([]);
  });

  await test.step('save one change', async () => {
    await field.fill(value);
    await expect(save).not.toHaveAttribute('aria-disabled', 'true');
    const patch = page.waitForRequest(r => r.url().endsWith('/api/settings') && r.method() === 'PATCH');
    await save.click();
    expect((await patch).postDataJSON()).toEqual({ [key]: value }); // only what changed
    await expectToast(page, 'Settings saved');
    await expect(save).toHaveAttribute('aria-disabled', 'true');
    await expect(save).toBeFocused();
  });

  await test.step('it was saved', async () => {
    await page.reload();
    await expect(h1(page, 'Settings')).toBeVisible();
    await expect(field).toHaveValue(value);
  });

  await test.step('and back again', async () => {
    await field.fill(before);
    await save.click();
    await expectToast(page, 'Settings saved');
    await expect(field).toHaveValue(before);
  });
});

test('bad input is caught under its field, and nothing is sent', async ({ page }) => {
  await open(page, '/settings', 'Settings');
  const form = page.getByRole('form', { name: 'About the group' });
  const since = form.getByLabel('Meeting since', { exact: true });
  const patches: string[] = [];
  page.on('request', r => { if (r.method() === 'PATCH') patches.push(r.url()); });

  await since.fill('20x3');
  await form.getByRole('button', { name: 'Save' }).click();
  await expect(since).toHaveAttribute('aria-invalid', 'true');
  await expect(since).toHaveAccessibleDescription('Add the year you started, like 2023.');
  await expect(since).toBeFocused();
  expect(patches).toEqual([]);

  await since.fill('2023');
  await expect(since).not.toHaveAttribute('aria-invalid', 'true');
});
