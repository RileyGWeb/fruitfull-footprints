// Screenshot the running app (default http://localhost:3110) for visual comparison
// against docs/design/refs. Unlocks the password gate automatically and caches the
// session in tools/.auth.json.
//
//   node tools/shot.mjs --url /prayer --out /tmp/prayer.png
//   node tools/shot.mjs --url /studies --viewport desktop --full --out /tmp/s.png
//   node tools/shot.mjs --url /prayer --click "text=Add request" --out /tmp/d.png
//   node tools/shot.mjs --url / --scroll 760 --out /tmp/home-lower.png
//
// Options: --base <origin>  --viewport mobile|desktop  --full  --scroll <px>
//          --click <selector> (repeatable, run in order)  --wait <ms>  --locked (don't unlock)
//          --fill <selector>=<value> (repeatable, run before clicks; split on the last '=', so
//                 input[type=search]=psalm works and the value can't contain '=')
import { chromium } from 'playwright';
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFill } from './shot-args.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const all = k => args.flatMap((a, i) => (a === '--' + k ? [args[i + 1]] : []));
const flag = k => args.includes('--' + k);

const base = opt('base', process.env.FF_BASE_URL || 'http://localhost:3110');
const url = opt('url', '/');
const out = opt('out', '/tmp/ff-shot.png');
const desktop = opt('viewport', 'mobile') === 'desktop';
const password = process.env.GROUP_PASSWORD || 'footprints';
const fills = all('fill').map(parseFill);
const authFile = path.join(path.dirname(fileURLToPath(import.meta.url)), '.auth.json');

const browser = await chromium.launch();
try {
  const viewport = desktop ? { width: 1280, height: 900 } : { width: 390, height: 844 };
  const ctxOpts = { viewport, deviceScaleFactor: desktop ? 1 : 2, hasTouch: !desktop, isMobile: !desktop };
  if (!flag('locked') && existsSync(authFile)) ctxOpts.storageState = authFile;
  if (flag('locked')) ctxOpts.storageState = undefined;
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.error('[console]', m.text()); });

  await page.goto(base + url, { waitUntil: 'networkidle' });
  // Let the gate settle: the splash (<main aria-busy>) shows until GET /api/group answers.
  await page.locator('main[aria-busy="true"]').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
  if (!flag('locked')) {
    // The gate's “can't reach the group” card (GET /api/group failed with nothing cached) has no
    // password field, so without this the shot would silently be of that card.
    if (await page.getByRole('heading', { name: 'We can’t reach the group just now' }).isVisible().catch(() => false)) {
      throw new Error('The app can’t reach the API — is the backend up (and BACKEND_URL right)?');
    }
    const pw = page.locator('#ff-pw'); // the gate's password field (not e.g. Settings' password inputs)
    if (await pw.isVisible().catch(() => false)) {
      await pw.fill(password);
      await pw.press('Enter');
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      if (await pw.isVisible().catch(() => false)) throw new Error('Unlock failed — is GROUP_PASSWORD right and the backend up?');
      await ctx.storageState({ path: authFile });
      await page.goto(base + url, { waitUntil: 'networkidle' });
    }
  }
  for (const { selector, text } of fills) await page.locator(selector).first().fill(text);
  for (const sel of all('click')) { await page.locator(sel).first().click(); await page.waitForTimeout(350); }
  await page.waitForTimeout(Number(opt('wait', 600)));
  const y = Number(opt('scroll', 0));
  if (y) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(300); }
  await page.screenshot({ path: out, fullPage: flag('full') });
  console.log('saved', out);
} catch (e) {
  if (String(e).includes('Unlock failed') && existsSync(authFile)) rmSync(authFile);
  throw e;
} finally {
  await browser.close();
}
