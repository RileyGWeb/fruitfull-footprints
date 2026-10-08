// Dialogs: Escape and Back close them (one at a time when stacked), and focus goes back where it was.
import { dialog, expect, goTab, h1, open, test } from './fixtures';

test('Escape closes a dialog without saving and hands focus back to what opened it', async ({ page }) => {
  await open(page, '/prayer', 'Prayer');
  const add = page.getByRole('button', { name: 'Add request', exact: true });
  await add.click();
  const form = dialog(page, 'Add a prayer request');
  await expect(form).toBeVisible();
  await expect(form).toHaveAttribute('aria-modal', 'true');
  await form.getByLabel('Request').fill('Typed, then thought better of it.');
  await page.keyboard.press('Escape');
  await expect(form).toBeHidden();
  await expect(add).toBeFocused();
  await expect(page.getByText('Typed, then thought better of it.')).toHaveCount(0);
});

test('Back closes the dialog instead of leaving the page, and the next Back leaves', async ({ page }) => {
  await open(page, '/', /friends\.$/);
  await goTab(page, 'Prayer');
  await expect(h1(page, 'Prayer')).toBeVisible();
  await page.getByRole('button', { name: 'Add request', exact: true }).click();
  await expect(dialog(page, 'Add a prayer request')).toBeVisible();

  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL(/\/prayer$/);
  await expect(h1(page, 'Prayer')).toBeVisible();

  await page.goBack();
  await expect(h1(page, /friends\.$/)).toBeVisible();
});

test('stacked dialogs close one at a time, by Escape and by Back', async ({ page, qa }) => {
  const member = await qa.member('Stack');
  const prayer = await qa.prayer(member.id, qa.name('request'));
  await open(page, '/prayer', 'Prayer');
  const card = page.getByRole('article').filter({ hasText: prayer.body });
  await card.getByRole('button', { name: 'Edit QA’s request' }).click();
  const edit = dialog(page, 'Edit request');
  await edit.getByRole('button', { name: 'Delete this request' }).click();
  const confirm = dialog(page, 'Delete this request?');
  await expect(confirm).toBeVisible();

  await page.keyboard.press('Escape'); // only the confirm on top
  await expect(confirm).toBeHidden();
  await expect(edit).toBeVisible();

  await page.goBack(); // then the edit dialog, and the page stays
  await expect(edit).toBeHidden();
  await expect(page).toHaveURL(/\/prayer$/);
  await expect(card).toBeVisible(); // nothing was deleted
});

test('a click on the backdrop closes a dialog', async ({ page, qa }) => {
  const member = await qa.member('Backdrop');
  await open(page, `/people/${member.id}`, member.name);
  await page.getByRole('button', { name: 'Add a date for QA' }).click();
  const form = dialog(page, 'A date to remember');
  await expect(form).toBeVisible();
  const box = (await form.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, Math.max(2, box.y - 8)); // just above the dialog
  await expect(form).toBeHidden();
});
