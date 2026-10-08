import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { setLockedOut } from './gate.ts';
import { goBack, guardHistory, leaveTo } from './historyGuard.ts';

// A small stand-in for window.history: entries with a cursor; traversals land a tick later and fire
// popstate, like the browser's.
type Entry = { url: string; state: unknown };
const win = new EventTarget() as EventTarget & { history: unknown };
let entries: Entry[] = [];
let at = 0;
const history = {
  get state() { return entries[at].state; },
  pushState(state: unknown) {
    entries = [...entries.slice(0, at + 1), { url: entries[at].url, state }];
    at++;
  },
  replaceState(state: unknown) { entries[at] = { ...entries[at], state }; },
  go(delta: number) {
    setTimeout(() => {
      const next = at + delta;
      if (next < 0 || next >= entries.length) return;
      at = next;
      win.dispatchEvent(new Event('popstate'));
    }, 1);
  },
  back() { this.go(-1); },
};
win.history = history;
(globalThis as unknown as { window: unknown }).window = win;

const tick = (ms = 10) => new Promise(r => setTimeout(r, ms));
const urls = () => entries.map(e => e.url);
/** The user pressing Back. */
const back = async () => { history.go(-1); await tick(); };
const router = () => {
  const calls: string[] = [];
  return {
    calls,
    push: (href: string) => { calls.push(`push ${href}`); history.pushState({ next: href }); entries[at].url = href; },
    replace: (href: string) => { calls.push(`replace ${href}`); history.replaceState({ next: href }); entries[at].url = href; },
  };
};

beforeEach(async () => {
  leaveTo({ push() {}, replace() {} }, '/'); // drop whatever guards the last test left behind
  await tick(20);
  entries = [{ url: '/', state: { page: '/' } }, { url: '/prayer', state: { page: '/prayer' } }];
  at = 1;
  setLockedOut(false);
});

describe('historyGuard', () => {
  test('an open dialog adds one same-URL entry; Back closes it instead of leaving the page', async () => {
    let closed = 0;
    const release = guardHistory(() => { closed++; }, { modal: true });
    assert.deepEqual(urls(), ['/', '/prayer', '/prayer']);
    await back();
    assert.equal(closed, 1);
    assert.equal(at, 1); // still on /prayer, the guard entry gone
    void release(); // the dialog's own close afterwards is a no-op
    await tick();
    assert.equal(at, 1);
    assert.equal(entries.length, 3); // nothing popped twice
  });

  test('closing the dialog normally takes its entry back off', async () => {
    const release = guardHistory(() => undefined, { modal: true });
    assert.equal(at, 2);
    void release();
    await tick();
    assert.equal(at, 1);
    // ...and that pop is not mistaken for the user pressing Back next time
    let closed = 0;
    guardHistory(() => { closed++; }, { modal: true });
    await back();
    assert.equal(closed, 1);
  });

  test('stacked dialogs share one entry; each Back closes the top one', async () => {
    const closed: string[] = [];
    const releaseA = guardHistory(() => { closed.push('edit'); void releaseA(); }, { modal: true });
    const releaseB = guardHistory(() => { closed.push('confirm'); void releaseB(); }, { modal: true });
    assert.equal(entries.length, 3);
    await back();
    assert.deepEqual(closed, ['confirm']);
    assert.equal(at, 2); // re-guarded for the dialog still open
    await back();
    assert.deepEqual(closed, ['confirm', 'edit']);
    assert.equal(at, 1);
  });

  test('a dialog answers Back before a page guard, even one registered later', async () => {
    const order: string[] = [];
    const releaseDialog = guardHistory(() => { order.push('dialog'); void releaseDialog(); }, { modal: true });
    guardHistory(() => { order.push('editor'); return true; });
    await back();
    await back();
    assert.deepEqual(order, ['dialog', 'editor']);
    assert.equal(at, 2); // the editor stays guarded while it asks
  });

  test('“Leave” after a guarded Back goes past the page in one step', async () => {
    guardHistory(() => true);
    await back();
    assert.equal(at, 2); // still on the page, re-guarded
    assert.equal(goBack(), true);
    await tick();
    assert.equal(at, 0);
    assert.equal(entries[at].url, '/');
  });

  test('a page guard that opens its confirm straight from onBack leaves one entry, so “Leave” still goes past the page', async () => {
    let confirm: (() => Promise<void>) | null = null;
    guardHistory(() => { confirm = guardHistory(() => undefined, { modal: true }); return true; });
    await back();
    assert.deepEqual(urls(), ['/', '/prayer', '/prayer']); // the confirm's entry, not a second one
    assert.equal(at, 2);
    await confirm!(); // “Leave” closes the confirm (the page guard keeps the entry)...
    assert.equal(at, 2);
    assert.equal(goBack(), true); // ...and goes back past the page
    await tick();
    assert.equal(at, 0);
    assert.equal(entries[at].url, '/');
  });

  test('release resolves once the entry is off, so navigating next can\'t race it', async () => {
    const release = guardHistory(() => undefined, { modal: true });
    let atWhenSettled = -1;
    await release().then(() => { atWhenSettled = at; });
    assert.equal(atWhenSettled, 1);
  });

  test('leaveTo takes over the guard entry instead of leaving a dead Back step', async () => {
    const r = router();
    guardHistory(() => undefined, { modal: true });
    leaveTo(r, '/people/5'); // navigating away while guarded (e.g. “Leave” on a link)
    await tick();
    assert.deepEqual(r.calls, ['replace /people/5']);
    assert.deepEqual(urls(), ['/', '/prayer', '/people/5']);
    assert.equal(at, 2);
  });

  test('leaveTo with replace steps off the guard entry first, so Back from there skips the page', async () => {
    const r = router();
    guardHistory(() => true); // e.g. an editor with unsaved changes; Lock goes Home with a replace
    assert.deepEqual(urls(), ['/', '/prayer', '/prayer']);
    leaveTo(r, '/settings', { replace: true });
    assert.deepEqual(r.calls, []); // not on top of the guard entry: that would leave the page's own entry below
    await tick();
    assert.deepEqual(r.calls, ['replace /settings']);
    assert.equal(at, 1);
    assert.equal(entries[at].url, '/settings'); // the page's own entry, replaced
    assert.equal(entries[at - 1].url, '/'); // so Back goes to the page before it
    // ...and that pop isn't taken for the user pressing Back next time
    let closed = 0;
    guardHistory(() => { closed++; }, { modal: true });
    await back();
    assert.equal(closed, 1);
  });

  test('without a guard entry leaveTo with replace is a plain replace', () => {
    const r = router();
    leaveTo(r, '/', { replace: true });
    assert.deepEqual(r.calls, ['replace /']);
    assert.deepEqual(urls(), ['/', '/']);
  });

  test('leaveTo right after a dialog closed waits for its entry to come off, then pushes', async () => {
    const r = router();
    const release = guardHistory(() => undefined, { modal: true });
    void release(); // the dialog closed...
    leaveTo(r, '/people/5'); // ...and navigates in the same tick
    assert.deepEqual(r.calls, []); // not while the pop is in flight
    await tick();
    assert.deepEqual(r.calls, ['push /people/5']);
    assert.deepEqual(urls(), ['/', '/prayer', '/people/5']);
  });

  test('without a guard entry leaveTo is a plain push', () => {
    const r = router();
    leaveTo(r, '/people');
    assert.deepEqual(r.calls, ['push /people']);
  });

  test('while the Entrance is up (locked out) Back leaves the hidden dialog alone', async () => {
    let closed = 0;
    const release = guardHistory(() => { closed++; }, { modal: true });
    setLockedOut(true);
    await back();
    assert.equal(closed, 0);
    assert.equal(at, 2); // re-guarded
    setLockedOut(false);
    void release();
    await tick();
    assert.equal(at, 1);
  });

  test('a guard registered while a pop is in flight gets its own entry once it lands', async () => {
    const release = guardHistory(() => undefined, { modal: true });
    void release(); // the pop has been started, not finished
    let closed = 0;
    guardHistory(() => { closed++; }, { modal: true });
    await tick();
    assert.equal(at, 2);
    await back();
    assert.equal(closed, 1);
  });
});
