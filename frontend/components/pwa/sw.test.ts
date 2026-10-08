// public/sw.js, run against an in-memory Cache Storage and a scripted network. Its timers run 100× fast
// (NAV_TIMEOUT 3s → 30ms, API_TIMEOUT 4s → 40ms, the warm-up pause 2s → 20ms).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const SOURCE = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8');
const ORIGIN = 'https://ff.test';
const PRECACHE = ['/', '/people', '/people/dates', '/prayer', '/prayer/answered', '/studies', '/studies/new', '/settings', '/offline'];
const SLOW = 150;

type Key = string | URL | { url: string };
const abs = (key: Key) => (typeof key === 'object' && 'url' in key ? key.url : new URL(String(key), ORIGIN).href);
const pathOf = (url: string) => new URL(url).pathname + new URL(url).search;
const later = <T>(ms: number, value: () => T) => new Promise<T>(resolve => setTimeout(() => resolve(value()), ms));

class FakeCache {
  readonly entries = new Map<string, Response>();
  async match(key: Key, opts: { ignoreSearch?: boolean } = {}) {
    const url = abs(key);
    const bare = (u: string) => u.split('?')[0];
    const hit = this.entries.get(url) ?? (opts.ignoreSearch ? [...this.entries].find(([k]) => bare(k) === bare(url))?.[1] : undefined);
    return hit?.clone();
  }
  async put(key: Key, res: Response) {
    this.entries.set(abs(key), res);
  }
  async keys() {
    return [...this.entries.keys()].map(u => new Request(u));
  }
  async delete(key: Key) {
    return this.entries.delete(abs(key));
  }
  paths() {
    return [...this.entries.keys()].map(pathOf).sort();
  }
  async text(key: Key) {
    return (await this.match(key))?.text();
  }
}

class FakeStorage {
  readonly all = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.all.has(name)) this.all.set(name, new FakeCache());
    return this.all.get(name)!;
  }
  async keys() {
    return [...this.all.keys()];
  }
  async delete(name: string) {
    return this.all.delete(name);
  }
  async match(key: Key, opts: { cacheName?: string; ignoreSearch?: boolean } = {}) {
    const list = opts.cacheName ? [this.all.get(opts.cacheName)] : [...this.all.values()];
    for (const cache of list) {
      const hit = await cache?.match(key, opts);
      if (hit) return hit;
    }
    return undefined;
  }
  paths(name: string) {
    return this.all.get(name)?.paths() ?? [];
  }
  seed(name: string, entries: Record<string, string>) {
    const cache = new FakeCache();
    for (const [path, body] of Object.entries(entries)) cache.entries.set(abs(path), new Response(body));
    this.all.set(name, cache);
  }
}

class Req extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, ORIGIN) : input, init);
  }
}

const page = (name: string) => () => new Response(
  `<html><head><link rel="stylesheet" href="/_next/static/chunks/app.css"><script src="/_next/static/chunks/${name.replace(/\W/g, '_') || 'home'}.js"></script></head><body>${name}</body></html>`,
  { headers: { 'content-type': 'text/html', link: '</_next/static/media/latin.woff2>; rel=preload; as="font"' } },
);
const json = (data: unknown, status = 200) => () => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
const CSS = '@font-face{src:url(../media/latin-ext.woff2) format("woff2")}.x{background:url("data:image/png;base64,AA")}';

type Route = () => Response | Promise<Response>;
type Fired = { response?: Promise<Response>; done: Promise<unknown[]> };

/** Boots a worker registered as /sw.js?v=<version>. */
function boot(version: string, storage = new FakeStorage()) {
  const listeners = new Map<string, (event: object) => void>();
  const routes = new Map<string, Route>();
  const fetched: string[] = [];
  const messages: unknown[] = [];
  const state = { online: true, skipped: false, claimed: false };

  const fakeFetch = async (input: Key) => {
    const path = pathOf(abs(input));
    fetched.push(path);
    if (!state.online) throw new TypeError('Failed to fetch');
    const route = routes.get(path) ?? [...routes].find(([p]) => p.endsWith('*') && path.startsWith(p.slice(0, -1)))?.[1];
    return route ? route() : new Response('Not found', { status: 404 });
  };
  const self = {
    location: new URL(`/sw.js?v=${version}`, ORIGIN),
    addEventListener: (type: string, fn: (event: object) => void) => listeners.set(type, fn),
    skipWaiting: async () => { state.skipped = true; },
    clients: {
      claim: async () => { state.claimed = true; },
      matchAll: async () => [{ postMessage: (m: unknown) => messages.push(m) }],
    },
  };
  vm.runInNewContext(SOURCE, {
    self, caches: storage, fetch: fakeFetch, Request: Req, Response, URL,
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms / 100), clearTimeout,
  });

  /** Dispatches an event; `done` settles once everything it kept alive has, with the rejections. */
  const fire = (type: string, init: object = {}): Fired => {
    const pending: Promise<unknown>[] = [];
    let response: Promise<Response> | undefined;
    listeners.get(type)!({
      ...init,
      waitUntil: (p: Promise<unknown>) => { pending.push(Promise.resolve(p)); },
      respondWith: (p: Promise<Response>) => { response = Promise.resolve(p); },
    });
    const done = (async () => {
      const errors: unknown[] = [];
      await response?.catch(e => errors.push(e));
      for (let i = 0; i < pending.length; i++) await pending[i].catch(e => errors.push(e));
      return errors;
    })();
    return { response, done };
  };
  const get = (path: string) => fire('fetch', { request: new Request(ORIGIN + path) });
  const navigate = (path: string) => fire('fetch', { request: { url: ORIGIN + path, method: 'GET', mode: 'navigate' } });
  const message = (data: object) => fire('message', { data });

  return { storage, routes, fetched, messages, state, fire, get, navigate, message, shell: `ff-shell-${version}`, static: `ff-static-${version}` };
}

/** A worker whose network serves every app page, its assets and the API. */
function online(version = 'b2', storage?: FakeStorage) {
  const sw = boot(version, storage);
  for (const p of PRECACHE) sw.routes.set(p, page(p));
  sw.routes.set('/people/*', page('profile'));
  sw.routes.set('/studies/*', page('study'));
  sw.routes.set('/_next/static/chunks/app.css', () => new Response(CSS));
  sw.routes.set('/_next/static/*', () => new Response('asset'));
  return sw;
}

test('install saves every app route and /offline, with their scripts, styles and fonts', async () => {
  const sw = online();
  assert.deepEqual(await sw.fire('install').done, []);
  assert.deepEqual(sw.storage.paths(sw.shell), [...PRECACHE].sort());
  const assets = sw.storage.paths(sw.static);
  for (const a of ['/_next/static/chunks/app.css', '/_next/static/chunks/_people_dates.js', '/_next/static/chunks/_settings.js', '/_next/static/media/latin.woff2']) {
    assert.ok(assets.includes(a), a);
  }
  // fonts the CSS points at relatively (url(../media/…)), not data: URIs
  assert.ok(assets.includes('/_next/static/media/latin-ext.woff2'));
  assert.ok(!assets.some(a => a.startsWith('data:')));
  assert.equal(sw.state.skipped, true);
});

test('install fails (the old worker stays) when an app route can’t be saved', async () => {
  const sw = online();
  sw.routes.set('/settings', () => new Response('oops', { status: 500 }));
  const errors = await sw.fire('install').done;
  assert.equal(errors.length, 1);
  assert.equal(sw.state.skipped, false);
});

test('a new build refetches the pages the last one saved, reuses unchanged assets and drops old caches', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-static-b0', { '/_next/static/chunks/ancient.js': 'x' });
  storage.seed('ff-shell-b1', { '/': 'old home', '/people/3': 'old profile', '/studies/5/edit': 'old editor' });
  storage.seed('ff-static-b1', { '/_next/static/chunks/app.css': CSS });
  storage.seed('ff-api', { '/api/snapshot': '{"v":1}' });
  storage.seed('ff-api-v2', { '/api/group': '{}' });
  storage.seed('someone-else', {});
  const sw = online('b2', storage);

  assert.deepEqual(await sw.fire('install').done, []);
  assert.deepEqual(sw.storage.paths(sw.shell), [...PRECACHE, '/people/3', '/studies/5/edit'].sort());
  assert.match(await storage.all.get(sw.shell)!.text('/people/3') ?? '', /profile/);
  assert.ok(sw.storage.paths(sw.static).includes('/_next/static/chunks/app.css'));
  assert.ok(!sw.fetched.includes('/_next/static/chunks/app.css'), 'copied from the previous build, not refetched');

  assert.deepEqual(await sw.fire('activate').done, []);
  assert.deepEqual((await storage.keys()).sort(), ['ff-api', 'ff-shell-b2', 'ff-static-b1', 'ff-static-b2', 'someone-else']);
  assert.equal(await storage.all.get('ff-api')!.text('/api/snapshot'), '{"v":1}');
  assert.equal(sw.state.claimed, true);
});

test('navigations: network first, then the saved page, then /offline', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-shell-b2', { '/people/3': 'saved profile', '/offline': 'offline page' });
  const sw = online('b2', storage);

  const fresh = sw.navigate('/prayer');
  assert.match(await (await fresh.response!).text(), /\/prayer/);
  await fresh.done;
  assert.ok(sw.storage.paths(sw.shell).includes('/prayer'));

  sw.state.online = false;
  assert.equal(await (await sw.navigate('/people/3?from=home').response!).text(), 'saved profile');
  assert.equal(await (await sw.navigate('/studies/9').response!).text(), 'offline page');
});

test('navigations: a stalled connection shows the saved page after the timeout, and still saves the late answer', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-shell-b2', { '/people/3': 'saved profile' });
  const sw = online('b2', storage);
  sw.routes.set('/people/3', () => later(SLOW, page('fresh profile')));
  sw.routes.set('/studies/7', () => later(SLOW, page('fresh study')));

  const stalled = sw.navigate('/people/3');
  assert.equal(await (await stalled.response!).text(), 'saved profile');
  await stalled.done;
  assert.match(await storage.all.get(sw.shell)!.text('/people/3') ?? '', /fresh profile/);

  // nothing saved: keep waiting for the network
  assert.match(await (await sw.navigate('/studies/7').response!).text(), /fresh study/);
});

test('API: the saved copy when the network fails or the server answers 5xx; other answers pass through', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-api', { '/api/snapshot': '{"v":1}' });
  const sw = boot('b2', storage);

  sw.routes.set('/api/snapshot', json({ message: 'Bad gateway' }, 502));
  assert.equal(await (await sw.get('/api/snapshot').response!).text(), '{"v":1}');
  sw.routes.set('/api/studies/4', json({ message: 'Bad gateway' }, 502));
  assert.equal((await sw.get('/api/studies/4').response!).status, 502);

  sw.routes.set('/api/snapshot', json({ message: 'Locked' }, 401));
  assert.equal((await sw.get('/api/snapshot').response!).status, 401);
  assert.equal(await storage.all.get('ff-api')!.text('/api/snapshot'), '{"v":1}', 'errors are never saved');

  sw.state.online = false;
  assert.equal(await (await sw.get('/api/snapshot').response!).text(), '{"v":1}');
});

test('API: a slow answer shows the saved copy first, then lands in the cache and the page', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-api', { '/api/group': '{"v":1}' });
  const sw = boot('b2', storage);
  sw.routes.set('/api/group', () => later(SLOW, json({ v: 2 })));

  const slow = sw.get('/api/group');
  assert.equal(await (await slow.response!).text(), '{"v":1}');
  assert.deepEqual(sw.messages, []);
  await slow.done;
  assert.equal(await storage.all.get('ff-api')!.text('/api/group'), '{"v":2}');
  assert.deepEqual(JSON.parse(JSON.stringify(sw.messages)), [{ type: 'API_FRESH', key: '/api/group', data: { v: 2 } }]);
});

test('Lock clears the API cache, and an answer to a request made before it isn’t saved', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-api', { '/api/group': '{"unlocked":true}' });
  const sw = boot('b2', storage);
  sw.routes.set('/api/studies/1', () => later(SLOW, json({ id: 1 })));

  const inFlight = sw.get('/api/studies/1');
  await sw.message({ type: 'CLEAR_DATA' }).done;
  assert.equal(storage.all.has('ff-api'), false);
  assert.equal((await inFlight.response!).status, 200);
  await inFlight.done;
  assert.deepEqual(storage.paths('ff-api'), []);
  assert.deepEqual(sw.messages, []);
});

test('CACHE_URLS saves the pages it doesn’t have yet, and the assets the page loaded', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-shell-b2', { '/people/3': 'saved profile' });
  const sw = online('b2', storage);

  const urls = [`${ORIGIN}/_next/static/chunks/loaded.js`, 'https://elsewhere.test/_next/static/x.js'];
  await sw.message({ type: 'CACHE_URLS', pages: ['/people/3', '/studies/2', '/api/snapshot', '//elsewhere.test/'], urls }).done;
  assert.deepEqual(sw.storage.paths(sw.shell), ['/people/3', '/studies/2']);
  assert.ok(!sw.fetched.includes('/people/3'));
  assert.ok(sw.storage.paths(sw.static).includes('/_next/static/chunks/loaded.js'));
  assert.ok(!sw.fetched.some(p => p.includes('elsewhere')));
});

test('a fresh snapshot saves every profile and published study page, and drops pages of removed ones', async () => {
  const storage = new FakeStorage();
  storage.seed('ff-shell-b2', { '/people/99': 'removed member', '/studies/3': 'saved study', '/studies/42/edit': 'deleted study' });
  const sw = online('b2', storage);
  sw.routes.set('/api/snapshot', json({
    members: [{ id: 1 }, { id: 2 }],
    studies: [{ id: 3, status: 'published' }, { id: 4, status: 'published' }, { id: 5, status: 'draft' }],
  }));

  const snap = sw.get('/api/snapshot');
  assert.equal((await snap.response!).status, 200);
  assert.deepEqual(await snap.done, []);
  assert.deepEqual(sw.storage.paths(sw.shell), ['/people/1', '/people/2', '/studies/3', '/studies/4']);
  assert.ok(!sw.fetched.includes('/studies/3'), 'already saved');
});
