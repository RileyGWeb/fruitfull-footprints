// A phone's browser tab is shown how to put the app on the home screen and nothing else: the app is opened
// from there, and that's where signing in happens. Computers, and the app once installed, go straight to
// the Entrance. (Playwright's mobile project only has a touch screen and a small one, not a phone's user
// agent, which is what the app goes by, so the phones here are made with one.)
import { MEMBER_PASSWORD } from './env';
import { expect, h1, test } from './fixtures';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const FACEBOOK = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]';

const phone = (userAgent: string) => ({
  userAgent,
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  storageState: { cookies: [], origins: [] },
});

test('an iPhone in Safari is shown how to add the app, and there is nothing to sign in to', async ({ browser }) => {
  const context = await browser.newContext(phone(IPHONE));
  const page = await context.newPage();
  try {
    await page.goto('/people/1'); // even a deep link
    await expect(h1(page, 'Fruitfull Footprints')).toBeVisible();
    await expect(page.getByText('Add to Home Screen')).toBeVisible();
    await expect(page.getByText('Open Footprints from your home screen to sign in')).toBeVisible();
    await expect(page.getByLabel('Your password')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await expect(page).toHaveURL(/\/people\/1$/);
  } finally {
    await context.close();
  }
});

test('Chrome on Android offers one Install button, and says it’s done', async ({ browser }) => {
  const context = await browser.newContext(phone(ANDROID));
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(h1(page, 'Fruitfull Footprints')).toBeVisible();
    // Until the browser says it can install the app, the way to do it from the menu.
    await expect(page.getByText('Add to Home screen')).toBeVisible();
    await expect(page.getByLabel('Your password')).toHaveCount(0);

    await page.evaluate(() => {
      const offer = Object.assign(new Event('beforeinstallprompt'), { prompt: async () => undefined, userChoice: Promise.resolve({ outcome: 'accepted' }) });
      window.dispatchEvent(offer);
    });
    const install = page.getByRole('button', { name: 'Install the app' });
    await expect(install).toBeVisible();
    await install.click();
    await expect(page.getByRole('status').filter({ hasText: 'It’s on your phone now' })).toBeVisible();
    await expect(page.getByLabel('Your password')).toHaveCount(0); // still not here: it opens from the home screen
  } finally {
    await context.close();
  }
});

test('inside another app’s browser it says to open the page somewhere that can install it', async ({ browser }) => {
  const context = await browser.newContext(phone(FACEBOOK));
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByText('Open this page in Safari or Chrome first')).toBeVisible();
    await expect(page.getByLabel('Your password')).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test('opened from the home screen, it goes on to the sign-in, and signing in works', async ({ browser }) => {
  const context = await browser.newContext(phone(IPHONE));
  // What iOS tells a page that was opened from the home screen.
  await context.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }));
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByLabel('Your password')).toBeVisible();
    await expect(page.getByText('Add to Home Screen')).toHaveCount(0);
    await page.getByLabel('Your password').fill(MEMBER_PASSWORD);
    await page.getByRole('button', { name: 'Open', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: /friends\.$/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a computer is never asked to install anything', async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] }, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await expect(page.getByLabel('Your password')).toBeVisible();
    await expect(page.getByText('Add to Home Screen')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Install the app' })).toHaveCount(0);
  } finally {
    await context.close();
  }
});
