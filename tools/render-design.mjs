// Renders the Claude Design prototype into reference PNGs (mobile frames, full-length mobile, desktop).
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';

const site = process.argv[2], out = process.argv[3];
mkdirSync(out, { recursive: true });
const SCREENS = [
  ['01-entrance', 'entrance'], ['02-home', 'home'], ['03-home-lower', 'home', null, 760],
  ['04-people', 'people'], ['05-dates', 'dates'], ['06-profile-rachel', 'profile', 'rachel'],
  ['07-profile-grace-lower', 'profile', 'grace', 640], ['08-gifts-ben', 'gifts', 'ben'], ['09-dialog-date', 'dialog-date'],
  ['10-prayer', 'prayer'], ['11-updating', 'updating', null, 300], ['12-dialog-prayer', 'dialog-prayer'],
  ['13-dialog-answer', 'dialog-answer'], ['14-answered', 'answered'], ['15-prayer-empty', 'prayer-empty'],
  ['16-studies', 'studies'], ['17-studies-lower', 'studies', null, 640], ['18-study', 'study'],
  ['19-study-mid', 'study', null, 560], ['20-study-end', 'study', null, 1900], ['21-editor', 'editor'],
];
const page = (preview, screen, person, scroll, w, h) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="./support.js"></script></head><body>
<x-dc><helmet><link rel="stylesheet" href="_ds/organic-f379f166-c343-4f0d-a850-0e741b8aed12/styles.css"><style>body{margin:0}</style></helmet>
<div id="frame" style="width:${w};height:${h};overflow:hidden;background:var(--color-bg)"><dc-import name="Fruitfull Footprints" preview="${preview}" start-screen="${screen}"${person ? ` person-id="${person}"` : ''} scroll-to="{{ s }}" hint-size="${w},${h}"></dc-import></div>
</x-dc><script type="text/x-dc" data-dc-script>
class Component extends DCLogic { renderVals() { return { s: ${scroll || 0} }; } }
</script></body></html>`;

const files = [];
for (const [name, screen, person, scroll] of SCREENS) {
  writeFileSync(path.join(site, `m-${name}.html`), page('Embed', screen, person, scroll, '390px', '844px'));
  files.push(['mobile', name, screen, person, scroll]);
}
const DESKTOP = [['home', 'home'], ['people', 'people'], ['dates', 'dates'], ['profile-rachel', 'profile', 'rachel'], ['prayer', 'prayer'], ['answered', 'answered'], ['studies', 'studies'], ['study', 'study'], ['editor', 'editor'], ['entrance', 'entrance'], ['dialog-prayer', 'dialog-prayer']];
for (const [name, screen, person] of DESKTOP) writeFileSync(path.join(site, `d-${name}.html`), page('Responsive', screen, person, 0, '100%', '100vh'));

const srv = spawn('python3', ['-I', '-m', 'http.server', '8799', '--bind', '127.0.0.1'], { cwd: site, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
const browser = await chromium.launch();
try {
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  for (const [, name, , , scroll] of files) {
    const p = await mctx.newPage();
    await p.goto(`http://127.0.0.1:8799/m-${name}.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(scroll ? 1800 : 1200);
    await p.locator('#frame').screenshot({ path: path.join(out, `mobile-${name}.png`) });
    if (!scroll) {
      // full-length capture: unclip the phone shell so the whole scroll content renders
      await p.evaluate(() => {
        const frame = document.getElementById('frame');
        const sc = [...frame.querySelectorAll('div')].find(d => d.style.overflowY === 'auto');
        if (!sc) return;
        const shell = sc.parentElement;
        const total = shell.scrollHeight - sc.clientHeight + sc.scrollHeight;
        sc.style.overflow = 'visible'; sc.style.flex = 'none';
        shell.style.height = total + 'px'; frame.style.height = total + 'px';
      });
      await p.waitForTimeout(300);
      await p.locator('#frame').screenshot({ path: path.join(out, `mobile-full-${name}.png`) });
    }
    await p.close();
  }
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  for (const [name] of DESKTOP) {
    const p = await dctx.newPage();
    await p.goto(`http://127.0.0.1:8799/d-${name}.html`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      const frame = document.getElementById('frame');
      const sc = [...frame.querySelectorAll('div')].find(d => d.style.overflowY === 'auto');
      if (!sc) return;
      const shell = sc.parentElement;
      const total = Math.max(900, shell.scrollHeight - sc.clientHeight + sc.scrollHeight);
      sc.style.overflow = 'visible'; sc.style.flex = 'none';
      shell.style.height = total + 'px'; frame.style.height = total + 'px';
    });
    await p.waitForTimeout(300);
    await p.locator('#frame').screenshot({ path: path.join(out, `desktop-${name}.png`) });
    await p.close();
  }
} finally { await browser.close(); srv.kill(); }
console.log('done');
