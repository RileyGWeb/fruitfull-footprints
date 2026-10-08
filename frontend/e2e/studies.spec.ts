// Studies: the editor's whole life cycle, the reader's section types, the leave guard, the archive search.
import type { Page } from '@playwright/test';
import type { Study } from '@/lib/types';
import { dialog, expect, expectToast, h1, open, test } from './fixtures';

const editorField = (page: Page, label: string) => page.getByLabel(label, { exact: true });

test('a study from new to draft to published, then edited, moved back to drafts and deleted', async ({ page, qa }) => {
  test.slow();
  const ref = qa.name('Jonah');
  const title = 'Out of the Deep';
  const verses = 'I called because of my affliction to Yahweh. He answered me.';
  let id = '';
  await open(page, '/studies', 'Studies');

  await test.step('new → saved as a draft', async () => {
    await page.getByRole('link', { name: 'New study' }).click();
    await expect(h1(page, 'New study')).toBeVisible();
    await editorField(page, 'Passage').fill(ref);
    await editorField(page, 'Title').fill(title);
    // In the past, so it never becomes anyone's “This week” while other tests run.
    await editorField(page, 'Meeting date').fill('2001-03-07');
    const created = qa.created<Study>(page, '/api/studies');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const study = await created;
    expect(study).toMatchObject({ ref, title, meeting_date: '2001-03-07', status: 'draft', series: ref }); // no chapter number to strip
    id = String(study.id);
    await expectToast(page, 'Draft saved');
    await expect(page).toHaveURL(new RegExp(`/studies/${id}/edit$`));
    await expect(h1(page, `Preparing ${ref}`)).toBeVisible();
    await expect(editorField(page, 'Passage')).toHaveValue(ref);
  });

  await test.step('the draft waits on Studies', async () => {
    await page.getByRole('link', { name: 'Studies', exact: true }).first().click();
    await expect(h1(page, 'Studies')).toBeVisible();
    const draft = page.getByRole('region', { name: ref });
    await expect(draft).toContainText('Draft · only visible here');
    await draft.getByRole('link', { name: `Keep writing ${ref}` }).click();
    await expect(h1(page, `Preparing ${ref}`)).toBeVisible();
  });

  await test.step('write every kind of section and publish', async () => {
    await editorField(page, 'Section text').fill('A thought to open with.\n\nAnd a second paragraph.');
    await editorField(page, 'Scripture reference').fill('Jonah 2:2');
    await editorField(page, 'Verses').fill(verses);
    await editorField(page, 'Questions, one per line').fill('Where have you called out?\n\nHow were you answered?');
    const add = page.getByRole('group', { name: 'Add' });
    await add.getByRole('button', { name: 'Reflection' }).click();
    await expect(editorField(page, 'Reflection heading')).toBeFocused();
    await editorField(page, 'Reflection text').fill('Sit with it for a minute.');
    await add.getByRole('button', { name: 'Prayer' }).click();
    await editorField(page, 'Prayer text').fill('Thank you for hearing us.');
    await expect(page.getByRole('group', { name: 'Prayer, 5 of 5' })).toBeVisible();

    await page.getByRole('button', { name: 'Publish to group' }).click();
    await expectToast(page, 'Published — everyone can read it now');
    await expect(page).toHaveURL(new RegExp(`/studies/${id}$`));
  });

  await test.step('the reader shows each section type', async () => {
    await expect(h1(page, ref)).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    // text
    await expect(page.getByRole('heading', { level: 2, name: 'Opening Thought' })).toBeVisible();
    await expect(page.getByText('And a second paragraph.', { exact: true })).toBeVisible();
    // scripture
    await expect(page.getByText('Read together · Jonah 2:2', { exact: true })).toBeVisible();
    await expect(page.getByRole('blockquote')).toHaveText(verses);
    // questions, numbered, blank lines dropped
    await expect(page.getByRole('heading', { level: 2, name: 'Discussion Questions' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('listitem')).toHaveText(['1Where have you called out?', '2How were you answered?']);
    // reflection and prayer
    await expect(page.getByRole('heading', { level: 2, name: 'Reflection' })).toBeVisible();
    await expect(page.getByText('Sit with it for a minute.', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Closing Prayer' })).toBeVisible();
    await expect(page.getByText('Thank you for hearing us.', { exact: true })).toBeVisible();
    await expect(page.getByText('Scripture quotations from the World English Bible.')).toBeVisible();
  });

  await test.step('edit the published study', async () => {
    await page.getByRole('link', { name: 'Edit study' }).click();
    await expect(h1(page, `Editing ${ref}`)).toBeVisible();
    await expect(page.getByText('Live — changes show up for everyone when you save.')).toBeVisible();
    await editorField(page, 'Title').fill('Out of the Depths');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expectToast(page, 'Changes saved');
    await expect(page).toHaveURL(new RegExp(`/studies/${id}$`));
    await expect(page.getByText('Out of the Depths', { exact: true })).toBeVisible();
  });

  await test.step('move it back to drafts', async () => {
    await page.getByRole('link', { name: 'Edit study' }).click();
    await expect(h1(page, `Editing ${ref}`)).toBeVisible();
    await page.getByRole('button', { name: 'Move back to drafts' }).click();
    await dialog(page, 'Move back to drafts?').getByRole('button', { name: 'Move to drafts' }).click();
    await expectToast(page, 'Moved back to drafts');
    await expect(h1(page, `Preparing ${ref}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publish to group' })).toBeFocused();
  });

  await test.step('delete it', async () => {
    await page.getByRole('button', { name: 'Delete study' }).click();
    const confirm = dialog(page, 'Delete this study?');
    await expect(confirm).toContainText('Its notes will be gone for everyone.');
    await confirm.getByRole('button', { name: 'Delete study' }).click();
    await expectToast(page, 'Study deleted');
    await expect(page).toHaveURL(/\/studies$/);
    await expect(h1(page, 'Studies')).toBeVisible();
    await expect(page.getByRole('region', { name: ref })).toHaveCount(0);

    await page.goto(`/studies/${id}`);
    await expect(h1(page, 'This study isn’t here anymore')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to Studies' })).toBeVisible();
  });
});

test('publishing asks for a passage and a title first, under each field', async ({ page }) => {
  await open(page, '/studies/new', 'New study');
  const posts: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/studies')) posts.push(r.url()); });
  await page.getByRole('button', { name: 'Publish to group' }).click();

  const passage = editorField(page, 'Passage');
  await expect(passage).toHaveAttribute('aria-invalid', 'true');
  await expect(passage).toHaveAccessibleDescription('Add the passage before publishing.');
  await expect(editorField(page, 'Title')).toHaveAccessibleDescription('Add a title before publishing.');
  await expect(passage).toBeFocused();
  expect(posts).toEqual([]);

  await passage.fill('Ruth 1');
  await expect(passage).not.toHaveAttribute('aria-invalid', 'true');
});

test('Back from unsaved writing asks first, and the writing is kept on this device', async ({ page, qa }) => {
  const ref = qa.name('Ruth');
  await open(page, '/studies', 'Studies');
  await page.getByRole('link', { name: 'New study' }).click();
  await expect(h1(page, 'New study')).toBeVisible();
  const passage = editorField(page, 'Passage');
  await passage.fill(ref);

  await test.step('Back asks, and Keep editing stays', async () => {
    await page.goBack();
    const ask = dialog(page, 'Leave without saving?');
    await expect(ask).toContainText('They’ll stay on this device for when you come back.');
    await ask.getByRole('button', { name: 'Keep editing' }).click();
    await expect(ask).toBeHidden();
    await expect(page).toHaveURL(/\/studies\/new$/);
    await expect(passage).toHaveValue(ref);
  });

  await test.step('the back link asks too', async () => {
    await page.getByRole('link', { name: 'Studies', exact: true }).first().click();
    await dialog(page, 'Leave without saving?').getByRole('button', { name: 'Keep editing' }).click();
    await expect(page).toHaveURL(/\/studies\/new$/);
  });

  await test.step('Back, then Leave, goes to the page before', async () => {
    await page.goBack();
    await dialog(page, 'Leave without saving?').getByRole('button', { name: 'Leave', exact: true }).click();
    await expect(h1(page, 'Studies')).toBeVisible();
    await expect(page).toHaveURL(/\/studies$/);
  });

  await test.step('coming back restores the writing, until it is discarded', async () => {
    await page.getByRole('link', { name: 'New study' }).click();
    await expect(page.getByText('Your unsaved changes were kept on this device.')).toBeVisible();
    await expect(passage).toHaveValue(ref);
    await page.getByRole('button', { name: 'Discard them' }).click();
    await dialog(page, 'Discard your unsaved changes?').getByRole('button', { name: 'Discard', exact: true }).click();
    await expect(passage).toHaveValue('');
    await expect(page.getByText('Your unsaved changes were kept on this device.')).toHaveCount(0);

    // Nothing unsaved now: leaving doesn't ask.
    await page.goBack();
    await expect(h1(page, 'Studies')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('a new study’s blank editor isn’t left in history once it’s saved', async ({ page, qa }) => {
  const ref = qa.name('Obadiah');
  await open(page, '/studies', 'Studies');

  await test.step('saving a draft moves to its edit page in place: Back goes to Studies', async () => {
    await page.getByRole('link', { name: 'New study' }).click();
    await expect(h1(page, 'New study')).toBeVisible();
    await editorField(page, 'Passage').fill(ref);
    await editorField(page, 'Meeting date').fill('2001-03-14');
    const created = qa.created<Study>(page, '/api/studies');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const study = await created;
    await expect(page).toHaveURL(new RegExp(`/studies/${study.id}/edit$`));
    await page.goBack();
    await expect(h1(page, 'Studies')).toBeVisible();
    await expect(page).toHaveURL(/\/studies$/);
  });

  await test.step('publishing straight from a new study, unsaved writing and all: Back skips the editor', async () => {
    await page.getByRole('link', { name: 'New study' }).click();
    await expect(h1(page, 'New study')).toBeVisible();
    await editorField(page, 'Passage').fill(`${ref} 2`);
    await editorField(page, 'Title').fill('A second one');
    await editorField(page, 'Meeting date').fill('2001-03-21');
    const created = qa.created<Study>(page, '/api/studies');
    await page.getByRole('button', { name: 'Publish to group' }).click();
    const study = await created;
    await expectToast(page, 'Published — everyone can read it now');
    await expect(page).toHaveURL(new RegExp(`/studies/${study.id}$`));
    await expect(h1(page, `${ref} 2`)).toBeVisible();
    await page.goBack();
    await expect(h1(page, 'Studies')).toBeVisible();
    await expect(page).toHaveURL(/\/studies$/);
  });
});

test('saved somewhere else meanwhile: the editor asks, then loads theirs or keeps its own', async ({ page, qa }) => {
  const ref = qa.name('Micah');
  const base = { ref, title: 'Walk Humbly', meeting_date: '2001-04-04', sections: [], status: 'draft' };
  const study = await qa.api.post<Study>('/api/studies', base);
  qa.removeLater(`/api/studies/${study.id}`);
  const title = editorField(page, 'Title');
  const conflict = dialog(page, 'This study was changed somewhere else.');
  /** Someone else saves a new title (a second later: updated_at is kept to the second). */
  const theySave = async (theirs: string) => {
    await page.waitForTimeout(1100);
    await qa.api.send('PUT', `/api/studies/${study.id}`, { ...base, title: theirs });
  };

  await open(page, `/studies/${study.id}/edit`, `Preparing ${ref}`);
  await theySave('Do Justice');
  await title.fill('Love Mercy');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(conflict).toBeVisible();
  await expect(page.getByText('Something went wrong', { exact: false })).toHaveCount(0); // the dialog, not a toast
  await conflict.getByRole('button', { name: 'Load their version' }).click();
  await expectToast(page, 'Their version is loaded');
  await expect(title).toHaveValue('Do Justice');

  await theySave('Act Justly');
  await title.fill('Love Mercy');
  await page.getByRole('button', { name: 'Save draft' }).click();
  await conflict.getByRole('button', { name: 'Keep mine' }).click();
  await expectToast(page, 'Draft saved');
  await expect(conflict).toBeHidden();
  expect((await qa.api.get<Study>(`/api/studies/${study.id}`)).title).toBe('Love Mercy');
});

test('the archive search filters previous studies, survives Back, and says when nothing matches', async ({ page }) => {
  await open(page, '/studies', 'Studies');
  const archive = page.getByRole('region', { name: 'Previous studies' });
  const search = archive.getByRole('searchbox', { name: 'Search previous studies' });
  const james3 = archive.getByRole('link', { name: /^James 3 Taming the Tongue/ });
  const psalm121 = archive.getByRole('link', { name: /^Psalm 121 / });
  await expect(psalm121).toBeVisible();

  await search.fill('tongue');
  await expect(james3).toBeVisible();
  await expect(psalm121).toHaveCount(0);
  await expect(page).toHaveURL(/\/studies\?q=tongue$/);

  await james3.click();
  await expect(h1(page, 'James 3')).toBeVisible();
  await page.goBack();
  await expect(h1(page, 'Studies')).toBeVisible();
  await expect(search).toHaveValue('tongue');
  await expect(james3).toBeVisible();
  await expect(psalm121).toHaveCount(0);

  await search.fill('zzqx');
  await expect(archive.getByRole('status')).toHaveText('Nothing matches “zzqx” yet.');
  await expect(archive.getByRole('link')).toHaveCount(0);
  await search.press('Escape');
  await expect(search).toHaveValue('');
  await expect(psalm121).toBeVisible();
  await expect(page).toHaveURL(/\/studies$/);
});

test('a deep link to a study opens the reader; a bad id says it isn’t here', async ({ page }) => {
  await open(page, '/studies', 'Studies');
  await page.getByRole('link', { name: 'Read study' }).first().click();
  await expect(page.getByRole('link', { name: 'Edit study' })).toBeVisible();
  const ref = await page.getByRole('heading', { level: 1 }).textContent();
  expect(ref).toMatch(/^Romans 8$/);
  await page.reload();
  await expect(h1(page, ref!)).toBeVisible();
  await expect(page.getByText('Read together · Romans 8:1–2', { exact: true })).toBeVisible();

  await page.goto('/studies/abc');
  await expect(h1(page, 'This study isn’t here anymore')).toBeVisible();
  await page.getByRole('link', { name: 'Back to Studies' }).click();
  await expect(h1(page, 'Studies')).toBeVisible();
});
