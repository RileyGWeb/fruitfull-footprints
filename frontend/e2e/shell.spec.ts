// The app chrome: the main tabs and Settings, Home's links, page titles, and the not-found page.
import { GROUP_NAME } from './env';
import { expect, goTab, h1, mainNav, open, test } from './fixtures';

test('the main tabs and the Settings gear move between screens', async ({ page }) => {
  await open(page, '/', /friends\.$/);
  const tabs = [['People', 'Our group'], ['Prayer', 'Prayer'], ['Studies', 'Studies'], ['Home', /friends\.$/]] as const;
  for (const [tab, heading] of tabs) {
    await goTab(page, tab);
    await expect(h1(page, heading)).toBeVisible();
    await expect(mainNav(page).getByRole('link', { name: tab, exact: true })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: 'Settings' }).click();
  await expect(h1(page, 'Settings')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
});

test('Home links into the week’s study, prayer and the group', async ({ page }) => {
  await open(page, '/', /friends\.$/);
  await page.getByRole('link', { name: /^View all \d+ prayer requests$/ }).click();
  await expect(h1(page, 'Prayer')).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: 'Read study' }).click();
  await expect(h1(page, 'Romans 8')).toBeVisible();
  await page.goBack();
  await page.getByRole('link', { name: /Rachel Owens/ }).first().click();
  await expect(h1(page, 'Rachel Owens')).toBeVisible();
});

const TITLES: [path: string, heading: string | RegExp, title: string][] = [
  ['/', /friends\.$/, `Home · ${GROUP_NAME}`],
  ['/people', 'Our group', `People · ${GROUP_NAME}`],
  ['/people/dates', 'Our group', `Dates to remember · ${GROUP_NAME}`],
  ['/people/1', 'Rachel Owens', `Rachel Owens · ${GROUP_NAME}`],
  ['/prayer', 'Prayer', `Prayer · ${GROUP_NAME}`],
  ['/prayer/answered', 'Prayer', `Answered prayers · ${GROUP_NAME}`],
  ['/studies', 'Studies', `Studies · ${GROUP_NAME}`],
  ['/studies/1', 'Romans 8', `Romans 8 · ${GROUP_NAME}`],
  ['/studies/new', 'New study', `New study · ${GROUP_NAME}`],
  ['/settings', 'Settings', `Settings · ${GROUP_NAME}`],
];

test('each screen names itself in the title when opened directly', async ({ page }) => {
  for (const [path, heading, title] of TITLES) {
    await open(page, path, heading);
    await expect(page, path).toHaveTitle(title);
  }
});

// On `next dev` Next can hoist the layout's metadata <title> ahead of the screen's after a client
// navigation; lib/title.ts puts the screen's back (it watches <head>).
test('each screen names itself in the title after client-side navigation', async ({ page }) => {
  await open(page, '/prayer', 'Prayer');
  const tabs = [['Studies', 'Studies'], ['People', 'Our group'], ['Home', /friends\.$/], ['Prayer', 'Prayer']] as const;
  for (const [tab, heading] of tabs) {
    await goTab(page, tab);
    await expect(h1(page, heading)).toBeVisible();
    await expect(page).toHaveTitle(`${tab} · ${GROUP_NAME}`);
  }
  await page.getByRole('link', { name: /Rachel Owens/ }).first().click();
  await expect(page).toHaveTitle(`Rachel Owens · ${GROUP_NAME}`);
});

test('an unknown address says so inside the app, with a way home', async ({ page }) => {
  await page.goto('/qa-no-such-page');
  await expect(h1(page, 'That page isn’t here')).toBeVisible();
  await expect(mainNav(page)).toBeVisible();
  await expect(page).toHaveTitle(`Not found · ${GROUP_NAME}`);
  await page.getByRole('link', { name: 'Go to Home' }).click();
  await expect(h1(page, /friends\.$/)).toBeVisible();
});

test('a profile that isn’t there says so, with a way back to everyone', async ({ page }) => {
  await page.goto('/people/999999');
  await expect(h1(page, 'We couldn’t find that person')).toBeVisible();
  await page.getByRole('link', { name: 'Back to everyone' }).click();
  await expect(h1(page, 'Our group')).toBeVisible();
});
