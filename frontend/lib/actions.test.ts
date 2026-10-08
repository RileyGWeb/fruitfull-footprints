import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import type { Cache } from 'swr';
import { initCache } from 'swr/_internal';
import { createActions } from './actions.ts';
import { ApiError, OFFLINE_MESSAGE, isConflict } from './api.ts';
import * as ep from './endpoints.ts';
import { routeCommitted } from './route.ts';
import { members, studies } from './testing/fixtures.ts';
import type { Member, Prayer, Snapshot, Study, StudyInput } from './types.ts';

// Real SWR cache + mutate (so optimistic data and rollback behave as in the app), a scripted fetch,
// and a recorded toast.
type Reply = { status: number; body?: unknown } | 'offline';
let replies: Map<string, Reply[]>;
let calls: string[];
let bodies: unknown[];
let toasts: { text: string; tone: string }[];
let cache: Cache;
let actions: ReturnType<typeof createActions>;
const g = globalThis as unknown as { fetch: typeof fetch };
const realFetch = g.fetch;

const reply = (method: string, path: string, r: Reply) => {
  const k = `${method} ${path}`;
  replies.set(k, [...(replies.get(k) ?? []), r]);
};

const prayer = (id: number, member_id: number): Prayer =>
  ({ id, member_id, body: 'x', status: 'active', answer: null, answered_at: null, created_at: '2026-10-01T19:00:00.000000Z', updates: [] });
const snap = (): Snapshot => ({
  settings: { group_name: 'G', tagline: 't', meeting_day: 'Wednesday', meeting_time: '7pm', meeting_place: 'p', since_year: 2023 },
  members: members(), prayers: [prayer(1, 1), prayer(2, 2)], studies: studies(), activity: [], server_time: '2026-10-07T19:00:00Z',
});
const study = (id: number, status: Study['status']): Study => ({ ...studies()[0], id, status, sections: [] });
const input = (status: StudyInput['status']): StudyInput => ({ meeting_date: '2026-10-14', sections: [], status });

beforeEach(() => {
  replies = new Map();
  calls = [];
  bodies = [];
  toasts = [];
  const [c, mutate] = initCache(new Map())!;
  cache = c;
  actions = createActions(cache, mutate, (text, opts) => toasts.push({ text, tone: opts?.tone ?? 'success' }));
  g.fetch = (async (url: string, init: RequestInit) => {
    const k = `${init.method ?? 'GET'} ${url}`;
    calls.push(k);
    bodies.push(typeof init.body === 'string' ? JSON.parse(init.body) : init.body);
    const next = replies.get(k)?.shift();
    if (!next) throw new Error('unexpected fetch ' + k);
    if (next === 'offline') throw new TypeError('Failed to fetch');
    return next.status === 204
      ? new Response(null, { status: 204 })
      : new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
});

afterEach(() => {
  g.fetch = realFetch;
});

describe('saveStudy: the toast follows the status change', () => {
  test('a new study: draft or published', async () => {
    reply('POST', '/api/studies', { status: 201, body: study(50, 'draft') });
    await actions.saveStudy(input('draft'));
    reply('POST', '/api/studies', { status: 201, body: study(51, 'published') });
    await actions.saveStudy(input('published'));
    assert.deepEqual(toasts.map(t => t.text), ['Draft saved', 'Published — everyone can read it now']);
    assert.equal((cache.get(ep.studyKey(51))?.data as Study).status, 'published'); // stored under its key
  });

  test('an existing study, previous status read from its own key', async () => {
    const [, mutate] = initCache(cache)!;
    await mutate(ep.studyKey(7), study(7, 'published'), { revalidate: false });
    reply('PUT', '/api/studies/7', { status: 200, body: study(7, 'published') });
    await actions.saveStudy(input('published'), 7);
    reply('PUT', '/api/studies/7', { status: 200, body: study(7, 'draft') });
    await actions.saveStudy(input('draft'), 7);
    assert.deepEqual(toasts.map(t => t.text), ['Changes saved', 'Moved back to drafts']);
  });

  test('an existing study, previous status read from the snapshot', async () => {
    const [, mutate] = initCache(cache)!;
    const s = snap();
    const draftId = s.studies.find(x => x.status === 'draft')!.id;
    await mutate(ep.SNAPSHOT_KEY, s, { revalidate: false });
    reply('PUT', `/api/studies/${draftId}`, { status: 200, body: study(draftId, 'published') });
    await actions.saveStudy(input('published'), draftId);
    reply('PUT', `/api/studies/${draftId}`, { status: 200, body: study(draftId, 'draft') });
    await actions.saveStudy(input('draft'), draftId);
    assert.deepEqual(toasts.map(t => t.text), ['Published — everyone can read it now', 'Moved back to drafts']);
  });
});

describe('saveStudy: a conflict (409) is the editor’s to show', () => {
  test('sends expected_updated_at, and rethrows the refusal untoasted with their version', async () => {
    const theirs = study(7, 'draft');
    reply('PUT', '/api/studies/7', { status: 409, body: { message: 'This study was changed somewhere else.', study: theirs } });
    await assert.rejects(actions.saveStudy({ ...input('published'), expected_updated_at: '2026-10-07T19:00:00.000000Z' }, 7), (e: unknown) =>
      isConflict(e) && e.message === 'This study was changed somewhere else.' && (e.data as { study: Study }).study.id === 7);
    assert.equal((bodies[0] as { expected_updated_at?: string }).expected_updated_at, '2026-10-07T19:00:00.000000Z');
    assert.deepEqual(toasts, []);
    assert.equal(cache.get(ep.studyKey(7))?.data, undefined); // nothing stored from a refused save
  });

  test('other study save failures are still toasted', async () => {
    reply('PUT', '/api/studies/7', { status: 500 });
    await assert.rejects(actions.saveStudy(input('draft'), 7));
    assert.deepEqual(toasts, [{ text: 'Something went wrong — try again in a moment.', tone: 'error' }]);
  });
});

describe('gifts: optimistic and silent', () => {
  test('the new gifts show at once and stay; no toast', async () => {
    const [, mutate] = initCache(cache)!;
    await mutate(ep.SNAPSHOT_KEY, snap(), { revalidate: false });
    let during: string[] | undefined;
    const saved: Member = { ...members()[0], gifts: ['Mercy'] };
    reply('PATCH', '/api/members/1', { status: 200, body: saved });
    const origFetch = g.fetch;
    g.fetch = (async (...args: Parameters<typeof fetch>) => {
      during = (cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot).members[0].gifts;
      return origFetch(...args);
    }) as typeof fetch;
    assert.deepEqual(await actions.updateMember(1, { gifts: ['Mercy'] }), saved);
    assert.deepEqual(during, ['Mercy']);
    assert.deepEqual((cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot).members[0].gifts, ['Mercy']);
    assert.deepEqual(toasts, []);
  });

  test('a failure rolls the gifts back and says why', async () => {
    const [, mutate] = initCache(cache)!;
    const before = snap().members[0].gifts;
    await mutate(ep.SNAPSHOT_KEY, snap(), { revalidate: false });
    reply('PATCH', '/api/members/1', 'offline');
    await assert.rejects(actions.updateMember(1, { gifts: ['Mercy'] }), ApiError);
    assert.deepEqual((cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot).members[0].gifts, before);
    assert.deepEqual(toasts, [{ text: OFFLINE_MESSAGE, tone: 'error' }]);
  });

  test('any other change toasts “Saved”', async () => {
    reply('PATCH', '/api/members/1', { status: 200, body: members()[0] });
    await actions.updateMember(1, { name: 'Rachel Owens' });
    assert.deepEqual(toasts, [{ text: 'Saved', tone: 'success' }]);
  });
});

describe('failures', () => {
  test('a 422 that names fields is left to the form: rethrown with its errors, no toast', async () => {
    reply('PATCH', '/api/dates/4', { status: 422, body: { message: 'A one-time date needs a year.', errors: { date: ['A one-time date needs a year.'] } } });
    await assert.rejects(actions.updateDate(4, { recurring: false }), (e: unknown) =>
      e instanceof ApiError && e.status === 422 && e.errors?.date?.[0] === 'A one-time date needs a year.');
    assert.deepEqual(toasts, []);
  });

  test('a 422 without fields is toasted, in the error style', async () => {
    reply('POST', '/api/prayers', { status: 422, body: { message: 'Not now.' } });
    await assert.rejects(actions.addPrayer({ member_id: 1, body: 'x' }));
    assert.deepEqual(toasts, [{ text: 'Not now.', tone: 'error' }]);
  });

  test('offline and server errors are toasted in the error style', async () => {
    reply('DELETE', '/api/prayers/3', 'offline');
    reply('DELETE', '/api/prayers/3', { status: 500 });
    await assert.rejects(actions.deletePrayer(3));
    await assert.rejects(actions.deletePrayer(3));
    assert.deepEqual(toasts, [
      { text: OFFLINE_MESSAGE, tone: 'error' },
      { text: 'Something went wrong — try again in a moment.', tone: 'error' },
    ]);
  });

  test('a 401 is not toasted — the Entrance is already showing', async () => {
    reply('POST', '/api/prayers/3/answer', { status: 401, body: { message: 'Locked' } });
    await assert.rejects(actions.answerPrayer(3, ''), (e: unknown) => e instanceof ApiError && e.status === 401);
    assert.deepEqual(toasts, []);
  });

  test('success is toasted in the success style', async () => {
    reply('POST', '/api/prayers/3/answer', { status: 200, body: prayer(3, 1) });
    await actions.answerPrayer(3, '  ');
    assert.deepEqual(toasts, [{ text: 'Answered. Thank God.', tone: 'success' }]);
    assert.ok(calls.includes('POST /api/prayers/3/answer'));
  });
});

describe('deleteMember', () => {
  test('drops the person and their requests from the cached snapshot', async () => {
    const [, mutate] = initCache(cache)!;
    await mutate(ep.SNAPSHOT_KEY, snap(), { revalidate: false });
    reply('DELETE', '/api/members/2', { status: 204 });
    await actions.deleteMember({ id: 2, name: 'Sarah Lindqvist' });
    await new Promise(r => setTimeout(r, 0));
    const s = cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot;
    assert.ok(!s.members.some(m => m.id === 2));
    assert.deepEqual(s.prayers.map(p => p.id), [1]);
    assert.deepEqual(toasts, [{ text: 'Removed Sarah', tone: 'success' }]);
  });

  test('from their profile, the cache edit waits for the next screen and lands in the commit that shows it', async () => {
    const [, mutate] = initCache(cache)!;
    await mutate(ep.SNAPSHOT_KEY, snap(), { revalidate: false });
    reply('DELETE', '/api/members/2', { status: 204 });
    routeCommitted('/people/2');
    await actions.deleteMember({ id: 2, name: 'Sarah Lindqvist' });
    const listed = () => (cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot).members.some(m => m.id === 2);
    assert.equal(listed(), true); // the profile on screen doesn't flash “not found”
    routeCommitted('/people');
    assert.equal(listed(), false); // synchronously, in the commit that puts /people up
  });
});
