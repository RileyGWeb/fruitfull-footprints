// People: add, edit and remove a person; their spiritual gifts; dates to remember.
import type { Member, MemberDate } from '@/lib/types';
import { dialog, expect, expectToast, h1, isoDay, open, re, test } from './fixtures';

test('add a person, edit them, and remove them from the group', async ({ page, qa }) => {
  const name = qa.name('Robin');
  await open(page, '/people', 'Our group');

  await test.step('add', async () => {
    await page.getByRole('button', { name: 'Add person' }).click();
    const add = dialog(page, 'Add a person');
    await add.getByLabel('Name').fill(name);
    await add.getByRole('radio', { name: 'Sand' }).click();
    await expect(add.getByRole('radio', { name: 'Sand' })).toHaveAttribute('aria-checked', 'true');
    await add.getByLabel('One line about them').fill('Brings the good biscuits.');
    await add.getByLabel('Family').fill('Married to Sam');
    await add.getByLabel('Interests').fill('Hiking');
    const created = qa.created<Member>(page, '/api/members');
    await add.getByRole('button', { name: 'Add person' }).click();

    const member = await created;
    expect(member).toMatchObject({ name, tone: 'sand', line: 'Brings the good biscuits.', family: 'Married to Sam' });
    await expectToast(page, 'QA is in the group');
    await expect(add).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/people/${member.id}$`)); // straight to the new profile
    await expect(h1(page, name)).toBeVisible();
    await expect(page.getByText('Married to Sam', { exact: true })).toBeVisible();
  });

  await test.step('they show on Everyone', async () => {
    await page.getByRole('link', { name: 'Everyone', exact: true }).click();
    await expect(h1(page, 'Our group')).toBeVisible();
    await page.getByRole('link', { name: new RegExp(re(qa.uid)) }).click();
    await expect(h1(page, name)).toBeVisible();
  });

  await test.step('edit', async () => {
    await page.getByRole('button', { name: 'Edit QA' }).click();
    const edit = dialog(page, 'Edit QA');
    await expect(edit.getByLabel('Name')).toHaveValue(name);
    await expect(edit.getByLabel('Interests')).toHaveValue('Hiking');
    await edit.getByLabel('Interests').fill('Hiking and birds');
    await edit.getByLabel('Good to know').fill('Prefers texts');
    await edit.getByRole('button', { name: 'Save' }).click();
    await expectToast(page, 'Saved');
    await expect(edit).toBeHidden();
    await expect(page.getByText('Hiking and birds', { exact: true })).toBeVisible();
    await expect(page.getByText('Prefers texts', { exact: true })).toBeVisible();
  });

  await test.step('remove from the group', async () => {
    // Watch every frame: on /people the removed person must never be painted, not even briefly.
    await page.evaluate(uid => {
      const w = window as Window & { ffSeenOnPeople?: boolean };
      w.ffSeenOnPeople = false;
      const look = () => {
        if (location.pathname === '/people' && document.getElementById('main')?.textContent?.includes(uid)) w.ffSeenOnPeople = true;
        requestAnimationFrame(look);
      };
      requestAnimationFrame(look);
    }, qa.uid);
    await page.getByRole('button', { name: 'Edit QA' }).click();
    await dialog(page, 'Edit QA').getByRole('button', { name: 'Remove from group' }).click();
    const confirm = dialog(page, 'Remove QA?');
    await expect(confirm).toContainText('Their prayer requests and dates will be removed too.');
    await confirm.getByRole('button', { name: 'Remove', exact: true }).click();
    await expectToast(page, 'Removed QA');
    await expect(page).toHaveURL(/\/people$/);
    await expect(h1(page, 'Our group')).toBeVisible();
    await expect(h1(page, 'Our group')).toBeFocused(); // the profile (and its Edit button) went: focus lands on the new page
    await expect(page.getByRole('link', { name: new RegExp(re(qa.uid)) })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => (window as Window & { ffSeenOnPeople?: boolean }).ffSeenOnPeople)).toBe(false);
  });
});

test('spiritual gifts toggle on the profile and are saved', async ({ page, qa }) => {
  const member = await qa.member('Gifted', { gifts: ['Mercy'] });
  await open(page, `/people/${member.id}`, member.name);

  await page.getByRole('button', { name: 'Edit gifts' }).click();
  const gifts = page.getByRole('group', { name: 'QA’s spiritual gifts' });
  await expect(gifts.getByRole('button', { name: 'Mercy' })).toHaveAttribute('aria-pressed', 'true');

  const toggle = async (gift: string, on: boolean) => {
    const saved = page.waitForResponse(r => r.url().endsWith(`/api/members/${member.id}`) && r.request().method() === 'PATCH');
    await gifts.getByRole('button', { name: gift }).click();
    await expect(gifts.getByRole('button', { name: gift })).toHaveAttribute('aria-pressed', String(on));
    expect((await saved).ok()).toBe(true);
  };
  await toggle('Hospitality', true);
  await toggle('Teaching', true);
  await toggle('Mercy', false);
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(gifts).toBeHidden();

  await page.reload();
  await expect(h1(page, member.name)).toBeVisible();
  await expect(page.getByText('Hospitality', { exact: true })).toBeVisible();
  await expect(page.getByText('Teaching', { exact: true })).toBeVisible();
  await expect(page.getByText('Mercy', { exact: true })).toHaveCount(0);
});

test('dates to remember: add a birthday and a one-time event, edit one, remove one', async ({ page, qa }) => {
  const member = await qa.member('Dates');
  const event = qa.name('graduation');
  const party = qa.name('party');
  await open(page, `/people/${member.id}`, member.name);
  const addDate = page.getByRole('button', { name: 'Add a date for QA' });
  const dates = page.getByRole('complementary');

  await test.step('a birthday (remembered every year)', async () => {
    await addDate.click();
    const form = dialog(page, 'A date to remember');
    await form.getByRole('radio', { name: 'Birthday' }).click();
    await expect(form.getByLabel('What is it?')).toHaveCount(0); // a birthday needs no label
    await expect(form.getByLabel('Remember it every year')).toBeChecked();
    await form.getByLabel('Date', { exact: true }).fill(`1992-${isoDay(10).slice(5)}`);
    await form.getByRole('button', { name: 'Save date' }).click();
    await expectToast(page, 'Date saved');
    await expect(form).toBeHidden();
    await expect(dates.getByRole('button', { name: /^Birthday, .* · in (10|9|11) days$/ })).toBeVisible();
  });

  await test.step('a one-time life event', async () => {
    await addDate.click();
    const form = dialog(page, 'A date to remember');
    await expect(form.getByRole('radio', { name: 'Life event' })).toHaveAttribute('aria-checked', 'true');
    await form.getByLabel('What is it?').fill(event);
    await form.getByLabel('Date', { exact: true }).fill(isoDay(30));
    await expect(form.getByLabel('Remember it every year')).not.toBeChecked();
    await form.getByRole('button', { name: 'Save date' }).click();
    await expectToast(page, 'Date saved');
    await expect(dates.getByRole('button', { name: new RegExp(`^${re(event)}, `) })).toBeVisible();
  });

  await test.step('both show on Dates to remember', async () => {
    await page.getByRole('link', { name: 'Everyone', exact: true }).click();
    await page.getByRole('navigation', { name: 'People views' }).getByRole('link', { name: 'Dates to remember' }).click();
    await expect(page).toHaveURL(/\/people\/dates$/);
    await expect(page.getByRole('link', { name: new RegExp(`^${re(event)}, `) })).toBeVisible();
    await page.getByRole('link', { name: new RegExp(`^${re(event)}, `) }).click();
    await expect(h1(page, member.name)).toBeVisible();
  });

  await test.step('edit the event', async () => {
    await dates.getByRole('button', { name: new RegExp(`^${re(event)}, `) }).click();
    const form = dialog(page, 'A date to remember');
    await expect(form.getByLabel('What is it?')).toHaveValue(event);
    await expect(form.getByLabel('Date', { exact: true })).toHaveValue(isoDay(30));
    await form.getByLabel('What is it?').fill(party);
    await form.getByRole('button', { name: 'Save date' }).click();
    await expectToast(page, 'Date saved');
    await expect(dates.getByRole('button', { name: new RegExp(`^${re(party)}, `) })).toBeVisible();
    await expect(dates.getByRole('button', { name: new RegExp(`^${re(event)}, `) })).toHaveCount(0);
  });

  await test.step('remove it', async () => {
    await dates.getByRole('button', { name: new RegExp(`^${re(party)}, `) }).click();
    await dialog(page, 'A date to remember').getByRole('button', { name: 'Remove this date' }).click();
    await dialog(page, 'Remove this date?').getByRole('button', { name: 'Remove', exact: true }).click();
    await expectToast(page, 'Date removed');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(dates.getByRole('button', { name: new RegExp(`^${re(party)}, `) })).toHaveCount(0);
    await expect(dates.getByRole('button', { name: /^Birthday, / })).toBeVisible();
  });
});

test('a date kept without a year moves to another day and still has no year', async ({ page, qa }) => {
  const member = await qa.member('Yearless');
  const label = qa.name('remembering');
  const stored = await qa.api.post<MemberDate>(`/api/members/${member.id}/dates`, { kind: 'event', label, date: '--05-04', recurring: true });
  expect(stored.year).toBeNull();
  await open(page, `/people/${member.id}`, member.name);

  await page.getByRole('complementary').getByRole('button', { name: new RegExp(`^${re(label)}, `) }).click();
  const form = dialog(page, 'A date to remember');
  const year = new Date().getFullYear(); // the field needs a year: it shows this one, for display only
  await expect(form.getByLabel('Date', { exact: true })).toHaveValue(`${year}-05-04`);
  await form.getByLabel('Date', { exact: true }).fill(`${year}-05-06`);
  const saved = page.waitForResponse(r => r.url().endsWith(`/api/dates/${stored.id}`) && r.request().method() === 'PATCH');
  await form.getByRole('button', { name: 'Save date' }).click();
  const res = await saved;
  expect(res.request().postDataJSON().date).toBe('--05-06');
  expect(await res.json()).toMatchObject({ month: 5, day: 6, year: null, recurring: true });
  await expectToast(page, 'Date saved');
});

test('a date the server refuses is explained under the field, not in a toast', async ({ page, qa }) => {
  const member = await qa.member('Range');
  await open(page, `/people/${member.id}`, member.name);
  await page.getByRole('button', { name: 'Add a date for QA' }).click();
  const form = dialog(page, 'A date to remember');
  await form.getByLabel('What is it?').fill(qa.name('long ago'));
  const date = form.getByLabel('Date', { exact: true });
  await date.fill('1850-06-01');
  const refused = page.waitForResponse(r => r.url().endsWith(`/api/members/${member.id}/dates`));
  await form.getByRole('button', { name: 'Save date' }).click();
  expect((await refused).status()).toBe(422);

  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await expect(date).toHaveAccessibleDescription('Pick a date between 1900 and 2200.');
  await expect(date).toBeFocused();
  // Said once, under the field: the toast's alert region stays empty.
  await expect(page.getByRole('alert').filter({ hasText: 'Pick a date between 1900 and 2200.' })).toHaveCount(1);

  await date.fill(isoDay(3));
  await expect(date).not.toHaveAttribute('aria-invalid', 'true');
  await form.getByRole('button', { name: 'Save date' }).click();
  await expectToast(page, 'Date saved');
});
