// Prayer requests, on the Prayer page and on a profile: add, update, answer, reopen, edit, delete.
import { dialog, expect, expectToast, h1, open, test } from './fixtures';

test('on the Prayer page: add a request, update it, answer it, reopen it, edit it, delete it', async ({ page, qa }) => {
  const member = await qa.member('Lee');
  const body = qa.name('request: a new job');
  const edited = qa.name('request: a new job, and a good team');
  const update = 'Second interview on Friday.';
  const answer = 'Started on Monday.';
  await open(page, '/prayer', 'Prayer');
  const card = (text: string) => page.getByRole('article').filter({ hasText: text });
  const views = page.getByRole('navigation', { name: 'Prayer views' });

  await test.step('add', async () => {
    await page.getByRole('button', { name: 'Add request', exact: true }).click();
    const add = dialog(page, 'Add a prayer request');
    await add.getByLabel('For').selectOption({ label: member.name });
    await add.getByLabel('Request').fill(body);
    await add.getByRole('button', { name: 'Add request' }).click();
    await expectToast(page, 'Added — we’ll be praying');
    await expect(add).toBeHidden();
    await expect(card(body)).toBeVisible();
    await expect(card(body).getByRole('heading', { name: 'QA' })).toBeVisible();
  });

  await test.step('add an update inline', async () => {
    await card(body).getByRole('button', { name: 'Add update' }).click();
    await expect(card(body).getByRole('button', { name: 'Add update' })).toHaveAttribute('aria-expanded', 'true');
    await card(body).getByLabel('Update on QA’s request').fill(update);
    await card(body).getByRole('button', { name: 'Save update' }).click();
    await expectToast(page, 'Update added');
    await expect(card(body).getByRole('list', { name: 'Updates' })).toContainText(update);
    await expect(card(body).getByLabel('Update on QA’s request')).toHaveCount(0);
  });

  await test.step('mark it answered', async () => {
    await card(body).getByRole('button', { name: 'Mark answered' }).click();
    const answering = dialog(page, 'Mark as answered');
    await expect(answering).toContainText(`“${body}”`);
    await answering.getByLabel('How did it turn out? (optional)').fill(answer);
    await answering.getByRole('button', { name: 'Mark answered' }).click();
    await expectToast(page, 'Answered. Thank God.');
    await expect(card(body)).toHaveCount(0);
    await expect(h1(page, 'Prayer')).toBeFocused(); // its card (and button) went away
  });

  await test.step('it is kept on Answered', async () => {
    await views.getByRole('link', { name: /^Answered · \d+$/ }).click();
    await expect(page).toHaveURL(/\/prayer\/answered$/);
    await expect(card(body)).toContainText(answer);
    await expect(card(body)).toContainText(`QA asked: “${body}”`);
  });

  await test.step('move it back to active', async () => {
    await card(body).getByRole('button', { name: 'Edit QA’s answered request' }).click();
    await dialog(page, 'Edit request').getByRole('button', { name: 'Move back to active' }).click();
    const confirm = dialog(page, 'Move back to active?');
    await expect(confirm).toContainText('The note about how it turned out will be cleared.');
    await confirm.getByRole('button', { name: 'Move back', exact: true }).click();
    await expectToast(page, 'Moved back to active');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card(body)).toHaveCount(0);
    await views.getByRole('link', { name: /^Active · \d+$/ }).click();
    await expect(page).toHaveURL(/\/prayer$/);
    await expect(card(body).getByRole('list', { name: 'Updates' })).toContainText(update);
  });

  await test.step('edit the request', async () => {
    await card(body).getByRole('button', { name: 'Edit QA’s request' }).click();
    const edit = dialog(page, 'Edit request');
    await expect(edit.getByLabel('For')).toHaveValue(String(member.id));
    await edit.getByLabel('Request').fill(edited);
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expectToast(page, 'Request updated');
    await expect(card(edited)).toBeVisible();
  });

  await test.step('remove its update', async () => {
    await card(edited).getByRole('button', { name: 'Edit QA’s request' }).click();
    const edit = dialog(page, 'Edit request');
    await edit.getByRole('button', { name: /^Remove the update from / }).click();
    await dialog(page, 'Remove this update?').getByRole('button', { name: 'Remove', exact: true }).click();
    await expectToast(page, 'Update removed');
    await expect(edit.getByRole('button', { name: /^Remove the update from / })).toHaveCount(0);
    await edit.getByRole('button', { name: 'Cancel' }).click();
    await expect(edit).toBeHidden();
    await expect(card(edited).getByRole('list', { name: 'Updates' })).toHaveCount(0);
  });

  await test.step('delete it', async () => {
    await card(edited).getByRole('button', { name: 'Edit QA’s request' }).click();
    await dialog(page, 'Edit request').getByRole('button', { name: 'Delete this request' }).click();
    const confirm = dialog(page, 'Delete this request?');
    await expect(confirm).toContainText('It will be gone for everyone, along with its updates.');
    await confirm.getByRole('button', { name: 'Delete', exact: true }).click();
    await expectToast(page, 'Request deleted');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card(edited)).toHaveCount(0);
    await expect(h1(page, 'Prayer')).toBeFocused();
  });
});

test('from a profile: add a request, answer it, reopen it, edit it, delete it', async ({ page, qa }) => {
  const member = await qa.member('Jo');
  const body = qa.name('request: rest after surgery');
  const edited = qa.name('request: rest, and a quick recovery');
  await open(page, `/people/${member.id}`, member.name);
  const prayers = page.getByRole('region', { name: 'Prayer requests' });
  const card = (text: string) => prayers.getByRole('article').filter({ hasText: text });
  const nothing = prayers.getByText('Nothing active right now');
  await expect(nothing).toBeVisible();

  await test.step('add (the dialog already knows who for)', async () => {
    await page.getByRole('button', { name: 'Add prayer request' }).click();
    const add = dialog(page, 'Add a prayer request');
    await expect(add.getByLabel('For')).toHaveValue(String(member.id));
    await add.getByLabel('Request').fill(body);
    await add.getByRole('button', { name: 'Add request' }).click();
    await expectToast(page, 'Added — we’ll be praying');
    await expect(card(body)).toBeVisible();
    await expect(nothing).toHaveCount(0);
  });

  await test.step('mark it answered', async () => {
    await card(body).getByRole('button', { name: 'Mark answered' }).click();
    await dialog(page, 'Mark as answered').getByRole('button', { name: 'Mark answered' }).click();
    await expectToast(page, 'Answered. Thank God.');
    await expect(prayers.getByRole('heading', { level: 3, name: 'Answered' })).toBeVisible();
    await expect(card(body).getByRole('button', { name: 'Mark answered' })).toHaveCount(0);
    await expect(nothing).toBeVisible();
  });

  await test.step('move it back to active', async () => {
    await card(body).getByRole('button', { name: 'Edit request' }).click();
    await dialog(page, 'Edit request').getByRole('button', { name: 'Move back to active' }).click();
    await dialog(page, 'Move back to active?').getByRole('button', { name: 'Move back', exact: true }).click();
    await expectToast(page, 'Moved back to active');
    await expect(prayers.getByRole('heading', { name: 'Answered' })).toHaveCount(0);
    await expect(card(body).getByRole('button', { name: 'Mark answered' })).toBeVisible();
  });

  await test.step('edit it', async () => {
    await card(body).getByRole('button', { name: 'Edit request' }).click();
    const edit = dialog(page, 'Edit request');
    await edit.getByLabel('Request').fill(edited);
    await edit.getByRole('button', { name: 'Save', exact: true }).click();
    await expectToast(page, 'Request updated');
    await expect(card(edited)).toBeVisible();
  });

  await test.step('delete it', async () => {
    await card(edited).getByRole('button', { name: 'Edit request' }).click();
    await dialog(page, 'Edit request').getByRole('button', { name: 'Delete this request' }).click();
    await dialog(page, 'Delete this request?').getByRole('button', { name: 'Delete', exact: true }).click();
    await expectToast(page, 'Request deleted');
    await expect(card(edited)).toHaveCount(0);
    await expect(nothing).toBeVisible();
  });
});
