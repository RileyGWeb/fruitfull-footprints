import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, test } from 'node:test';
import { ApiError, LOCKED_EVENT, OFFLINE_MESSAGE, api, errorMessage, fieldErrors, isConflict } from './api.ts';
import { answerPrayer } from './endpoints.ts';

type Call = { url: string; init: RequestInit };
let calls: Call[] = [];
let replies: (() => Response | Promise<Response>)[] = [];
let locked = 0;
const g = globalThis as unknown as { fetch: typeof fetch; document?: { cookie: string }; window?: EventTarget };
const realFetch = g.fetch;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  calls = [];
  replies = [];
  locked = 0;
  g.document = { cookie: 'laravel_session=x; XSRF-TOKEN=abc%3D%3D' };
  g.window = new EventTarget();
  g.window.addEventListener(LOCKED_EVENT, () => locked++);
  g.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = replies.shift();
    if (!next) throw new Error('unexpected fetch ' + url);
    return next();
  }) as typeof fetch;
});

afterEach(() => {
  g.fetch = realFetch;
  delete g.document;
  delete g.window;
});

const headers = (c: Call) => c.init.headers as Record<string, string>;

describe('api', () => {
  test('GET: same-origin JSON, no XSRF header, path normalised under /api', async () => {
    replies.push(() => json(200, { ok: 1 }));
    assert.deepEqual(await api.get('/snapshot'), { ok: 1 });
    assert.equal(calls[0].url, '/api/snapshot');
    assert.equal(calls[0].init.method, 'GET');
    assert.equal(calls[0].init.credentials, 'same-origin');
    assert.equal(headers(calls[0]).Accept, 'application/json');
    assert.equal(headers(calls[0])['X-XSRF-TOKEN'], undefined);
    assert.equal(calls[0].init.body, undefined);
  });

  test('non-GET sends the decoded XSRF-TOKEN cookie and a JSON body', async () => {
    replies.push(() => json(201, { id: 3 }));
    await api.post('/api/prayers', { member_id: 1, body: 'x' });
    assert.equal(calls[0].url, '/api/prayers');
    assert.equal(headers(calls[0])['X-XSRF-TOKEN'], 'abc==');
    assert.equal(headers(calls[0])['Content-Type'], 'application/json');
    assert.equal(calls[0].init.body, JSON.stringify({ member_id: 1, body: 'x' }));
  });

  test('204 resolves undefined', async () => {
    replies.push(() => new Response(null, { status: 204 }));
    assert.equal(await api.del('/api/dates/4'), undefined);
    assert.equal(calls[0].init.method, 'DELETE');
  });

  test('419 refreshes the cookie via GET /api/group and retries once with the new token', async () => {
    replies.push(() => json(419, { message: 'CSRF token mismatch.' }));
    replies.push(() => {
      g.document!.cookie = 'XSRF-TOKEN=fresh';
      return json(200, { unlocked: true });
    });
    replies.push(() => json(200, { id: 1 }));
    assert.deepEqual(await api.patch('/api/members/1', { name: 'A' }), { id: 1 });
    assert.deepEqual(calls.map(c => [c.init.method ?? 'GET', c.url]), [['PATCH', '/api/members/1'], ['GET', '/api/group'], ['PATCH', '/api/members/1']]);
    assert.equal(headers(calls[2])['X-XSRF-TOKEN'], 'fresh');
  });

  test('a second 419 is thrown, not retried again', async () => {
    replies.push(() => json(419, {}), () => json(200, {}), () => json(419, {}));
    await assert.rejects(api.put('/api/studies/1', {}), (e: unknown) => e instanceof ApiError && e.status === 419);
    assert.equal(calls.length, 3);
  });

  test('401 dispatches ff:locked and throws', async () => {
    replies.push(() => json(401, { message: 'Locked' }));
    await assert.rejects(api.get('/api/snapshot'), (e: unknown) => e instanceof ApiError && e.status === 401);
    assert.equal(locked, 1);
  });

  test('network failure → ApiError {status 0, offline}', async () => {
    replies.push(() => Promise.reject(new TypeError('Failed to fetch')));
    await assert.rejects(api.post('/api/prayers', {}), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 0);
      assert.equal(e.offline, true);
      assert.equal(errorMessage(e), OFFLINE_MESSAGE);
      return true;
    });
    assert.equal(locked, 0);
  });

  test('422 keeps the validation errors; errorMessage shows the first one', async () => {
    replies.push(() => json(422, { message: 'The name field is required. (and 1 more error)', errors: { name: ['The name field is required.'], tone: ['Bad tone.'] } }));
    await assert.rejects(api.post('/api/members', {}), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.deepEqual(e.errors, { name: ['The name field is required.'], tone: ['Bad tone.'] });
      assert.equal(errorMessage(e), 'The name field is required.');
      assert.deepEqual(fieldErrors(e), { name: 'The name field is required.', tone: 'Bad tone.' });
      return true;
    });
  });

  test('409 keeps the parsed body (their version) and the server’s message', async () => {
    replies.push(() => json(409, { message: 'This study was changed somewhere else.', study: { id: 7 } }));
    await assert.rejects(api.put('/api/studies/7', {}), (e: unknown) => {
      assert.ok(isConflict(e));
      assert.deepEqual(e.data, { message: 'This study was changed somewhere else.', study: { id: 7 } });
      assert.equal(errorMessage(e), 'This study was changed somewhere else.');
      assert.equal(fieldErrors(e), null);
      return true;
    });
    assert.equal(isConflict(new ApiError(422, 'x')), false);
  });

  test('fieldErrors is only for 422s that name fields', () => {
    assert.equal(fieldErrors(new ApiError(422, 'Nope', {})), null);
    assert.equal(fieldErrors(new ApiError(500, 'Boom', { name: ['x'] })), null);
    assert.equal(fieldErrors(new ApiError(0, OFFLINE_MESSAGE, undefined, true)), null);
    assert.equal(fieldErrors(new Error('x')), null);
  });

  test('5xx without JSON → plain message', async () => {
    replies.push(() => new Response('<html>oops</html>', { status: 500, headers: { 'Content-Type': 'text/html' } }));
    await assert.rejects(api.get('/api/snapshot'), (e: unknown) => {
      assert.ok(e instanceof ApiError);
      assert.equal(e.status, 500);
      assert.equal(errorMessage(e), 'Something went wrong — try again in a moment.');
      return true;
    });
    assert.equal(errorMessage(new Error('x')), 'Something went wrong — try again in a moment.');
  });
});

describe('endpoints', () => {
  test('answerPrayer: omitting the answer keeps an existing note; blank clears it', async () => {
    replies.push(() => json(200, {}), () => json(200, {}), () => json(200, {}));
    await answerPrayer(5);
    await answerPrayer(5, '');
    await answerPrayer(5, 'Got the job.');
    assert.deepEqual(calls.map(c => [c.url, c.init.body]), [
      ['/api/prayers/5/answer', '{}'],
      ['/api/prayers/5/answer', '{"answer":null}'],
      ['/api/prayers/5/answer', '{"answer":"Got the job."}'],
    ]);
  });
});
