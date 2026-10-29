import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { isInAppBrowser, isMobileBrowser, isMobileDevice } from './install.ts';

const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  // iPadOS asks for desktop sites, so it says Macintosh and gives itself away by its touch screen.
  ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  linux: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  facebook: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0.0.0]',
  instagram: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36 Instagram 330.0.0.0',
};

/** Runs as a browser with this user agent / touch screen / display mode, for the helper under test. */
function browser(ua: string, opts: { touchPoints?: number; displayModes?: string[]; iosStandalone?: boolean } = {}) {
  const modes = opts.displayModes ?? [];
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { userAgent: ua, maxTouchPoints: opts.touchPoints ?? 0, standalone: opts.iosStandalone },
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { matchMedia: (q: string) => ({ matches: modes.some(m => q === `(display-mode: ${m})`) }) },
  });
}

afterEach(() => {
  // @ts-expect-error — put the real (absent) browser globals back
  delete globalThis.window;
});

describe('isMobileDevice', () => {
  it('knows phones and tablets by their user agent', () => {
    for (const ua of [UA.iphone, UA.iphoneChrome, UA.androidChrome, UA.androidTablet, UA.samsung]) {
      browser(ua);
      assert.equal(isMobileDevice(), true, ua);
    }
  });

  it('knows an iPad that is posing as a Mac by its touch screen', () => {
    browser(UA.ipad, { touchPoints: 5 });
    assert.equal(isMobileDevice(), true);
  });

  it('leaves computers alone, a Mac with no touch screen included', () => {
    browser(UA.mac, { touchPoints: 0 });
    assert.equal(isMobileDevice(), false);
    for (const ua of [UA.windows, UA.linux]) {
      browser(ua);
      assert.equal(isMobileDevice(), false, ua);
    }
  });

  it('is not fooled by a touch-screen laptop', () => {
    browser(UA.windows, { touchPoints: 10 });
    assert.equal(isMobileDevice(), false);
  });
});

describe('isMobileBrowser (the install screen replaces everything)', () => {
  it('is true for a phone in its browser', () => {
    browser(UA.iphone);
    assert.equal(isMobileBrowser(), true);
    browser(UA.androidChrome);
    assert.equal(isMobileBrowser(), true);
  });

  it('is false once the app runs from the home screen', () => {
    browser(UA.androidChrome, { displayModes: ['standalone'] });
    assert.equal(isMobileBrowser(), false);
    browser(UA.iphone, { iosStandalone: true });
    assert.equal(isMobileBrowser(), false);
  });

  it('counts every way a browser opens an installed app', () => {
    for (const mode of ['standalone', 'fullscreen', 'minimal-ui', 'window-controls-overlay']) {
      browser(UA.androidChrome, { displayModes: [mode] });
      assert.equal(isMobileBrowser(), false, mode);
    }
    browser(UA.androidChrome, { displayModes: ['browser'] });
    assert.equal(isMobileBrowser(), true, 'a plain tab is not an app');
  });

  it('is false on a computer, in a tab or not', () => {
    browser(UA.windows);
    assert.equal(isMobileBrowser(), false);
    browser(UA.mac);
    assert.equal(isMobileBrowser(), false);
  });
});

describe('isInAppBrowser', () => {
  it('spots the browsers inside other apps', () => {
    for (const ua of [UA.facebook, UA.instagram]) {
      browser(ua);
      assert.equal(isInAppBrowser(), true, ua);
    }
  });

  it('does not mistake real browsers for them', () => {
    for (const ua of [UA.iphone, UA.iphoneChrome, UA.androidChrome, UA.samsung, UA.windows]) {
      browser(ua);
      assert.equal(isInAppBrowser(), false, ua);
    }
  });
});
