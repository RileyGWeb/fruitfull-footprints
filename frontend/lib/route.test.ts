import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { leaveTo, navigating } from './historyGuard.ts';
import { routeCommitted, whenRoute } from './route.ts';

// Module state carries from test to test here (in order): no commit has been reported until the second.
const tick = (ms = 5) => new Promise(r => setTimeout(r, ms));

describe('route commits', () => {
  test('outside the app (nothing reports commits) the callback runs straight away', () => {
    let ran = 0;
    whenRoute(p => p === '/people', () => { ran++; });
    assert.equal(ran, 1);
  });

  test('runs in the commit that brings a matching route, and not before', () => {
    routeCommitted('/people/5');
    const ran: string[] = [];
    whenRoute(p => p !== '/people/5', () => ran.push('left the profile'));
    whenRoute(p => p === '/people/5', () => ran.push('already there'));
    assert.deepEqual(ran, ['already there']);
    routeCommitted('/people/5'); // a commit on the same route changes nothing
    assert.deepEqual(ran, ['already there']);
    routeCommitted('/people');
    assert.deepEqual(ran, ['already there', 'left the profile']);
    routeCommitted('/prayer'); // once only
    assert.deepEqual(ran, ['already there', 'left the profile']);
  });

  test('stops waiting after the timeout', async () => {
    let ran = 0;
    whenRoute(p => p === '/nowhere', () => { ran++; }, 20);
    await tick(40);
    assert.equal(ran, 1);
    routeCommitted('/nowhere');
    assert.equal(ran, 1);
  });

  test('navigating(): a leaveTo is under way until its screen has been committed', async () => {
    const win = new EventTarget() as EventTarget & { history: unknown; location: unknown };
    win.history = { state: null, go() {}, pushState() {} };
    win.location = { href: 'http://localhost/prayer' };
    (globalThis as unknown as { window: unknown }).window = win;
    routeCommitted('/prayer');
    assert.equal(navigating(), null);

    const calls: string[] = [];
    leaveTo({ push: h => calls.push(h), replace: h => calls.push(h) }, '/people/5?x=1');
    assert.deepEqual(calls, ['/people/5?x=1']);
    let arrived = false;
    void navigating()!.then(() => { arrived = true; });
    await tick();
    assert.equal(arrived, false);
    routeCommitted('/people/5');
    await tick();
    assert.equal(arrived, true);
    assert.equal(navigating(), null);

    // Somewhere already on screen (only the query changes): nothing to wait for.
    leaveTo({ push() {}, replace() {} }, '/people/5?x=2');
    await tick();
    assert.equal(navigating(), null);
  });
});
