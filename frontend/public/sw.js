/* Fruitfull Footprints service worker — read-only offline.
 * Registered as /sw.js?v=<build id> (components/pwa/ServiceWorker.tsx; the id comes from next.config.ts),
 * so every deploy installs a fresh worker that saves that build's pages and drops the old build's caches.
 * - pages: the app routes + /offline are precached at install, with the /_next/static assets they load
 *   (the screens render client-side, so a saved page is useless without its JS/CSS/fonts). Pages saved by
 *   the previous build's worker are fetched again from the new build. Later pages are saved as they're
 *   opened ({type:'CACHE_URLS'} from the page on every route change: in-app navigations never come through
 *   here as page loads), and every profile and published study page is saved in the background whenever a
 *   fresh /api/snapshot comes in. Page HTML holds no group data (screens render from the API).
 * - navigations: network-first (a cached page after NAV_TIMEOUT) → cached page → /offline
 * - /_next/static/**: cache-first (content-hashed). The previous build's copies are kept one more deploy,
 *   for tabs still running it.
 * - GET /api/*: network-first; the cached copy when the network fails, answers 5xx, or takes longer than
 *   API_TIMEOUT (a late answer still updates the cache and is handed to the page as {type:'API_FRESH'}).
 *   Kept across deploys; cleared on Lock ({type:'CLEAR_DATA'}). The page warms the notes most likely to
 *   be read offline (upcoming and recent studies) through here (components/pwa/WarmNotes.tsx).
 * - never caches non-GET requests
 */
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL = `ff-shell-${VERSION}`;
const STATIC = `ff-static-${VERSION}`;
const API = 'ff-api'; // also read by components/pwa/WarmNotes.tsx
const PRECACHE = ['/', '/people', '/people/dates', '/prayer', '/prayer/answered', '/studies', '/studies/new', '/settings', '/offline'];
const STATIC_PATH = /\/_next\/static\/[^"'\s)<>\\]+/g;
const CSS_URL = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
const NAV_TIMEOUT = 3000;
const API_TIMEOUT = 4000;
const WARM_DELAY = 2000;

/** Bumped on Lock: nothing fetched before it is saved after it. */
let generation = 0;
/** URL → number of its newest request, so an older answer never replaces a newer one. */
const newest = new Map();
let requests = 0;
let warming = false;

const isStatic = url => {
  try {
    const u = new URL(url, self.location.origin);
    return u.origin === self.location.origin && u.pathname.startsWith('/_next/static/');
  } catch {
    return false;
  }
};

/** Runs `fn` over `items`, `limit` at a time. Resolves with the items it failed on. */
async function eachLimit(items, limit, fn) {
  const queue = [...items];
  const failed = [];
  await Promise.all(Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      await fn(item).catch(() => failed.push(item));
    }
  }));
  return failed;
}

/** Resolves like `promise`, or with undefined (calling `onTimeout`) if it takes longer than `ms`. */
const within = (promise, ms, onTimeout) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => {
    onTimeout();
    resolve(undefined);
  }, ms);
  promise.then(value => {
    clearTimeout(timer);
    resolve(value);
  }, err => {
    clearTimeout(timer);
    reject(err);
  });
});

/**
 * Adds the given /_next/static URLs to this build's static cache (skipping ones already there, and
 * reusing an older build's copy of the same file), plus the fonts their CSS uses.
 */
async function cacheStatic(urls) {
  const cache = await caches.open(STATIC);
  const todo = [...new Set(urls.filter(isStatic).map(u => new URL(u, self.location.origin).href))];
  await Promise.allSettled(todo.map(async href => {
    if (await cache.match(href)) return;
    const res = (await caches.match(href)) || (await fetch(href));
    if (!res.ok) return;
    await cache.put(href, res.clone());
    if (new URL(href).pathname.endsWith('.css')) {
      // Next's CSS points at its fonts relatively: url(../media/…woff2)
      const css = await res.text();
      await cacheStatic([...css.matchAll(CSS_URL)].map(m => new URL(m[2], href).href));
    }
  }));
}

/**
 * Fetches pages into the shell cache (all of them, or with `onlyNew` the ones it doesn't have yet) and
 * returns the static assets they reference. With `required`, rejects if any page couldn't be saved.
 */
async function cachePages(paths, { onlyNew = false, required = false } = {}) {
  const shell = await caches.open(SHELL);
  const found = [];
  const failed = await eachLimit([...new Set(paths)], 4, async path => {
    if (onlyNew && await shell.match(path, { ignoreVary: true })) return;
    const res = await fetch(new Request(path, { cache: 'reload', credentials: 'same-origin' }));
    if (!res.ok || res.redirected) throw new Error(`${path}: ${res.status}`);
    await shell.put(path, res.clone());
    found.push(...((await res.text()).match(STATIC_PATH) || []), ...((res.headers.get('link') || '').match(STATIC_PATH) || []));
  });
  if (required && failed.length) throw new Error(`Couldn’t save ${failed.join(', ')}`);
  return found;
}

/** Paths of the pages earlier workers saved. */
async function savedPages() {
  const names = (await caches.keys()).filter(k => k.startsWith('ff-shell-') && k !== SHELL);
  const lists = await Promise.all(names.map(async k => (await (await caches.open(k)).keys()).map(r => new URL(r.url).pathname)));
  return lists.flat();
}

/**
 * Saves the page of every member and published study in a fresh snapshot (only the ones not saved yet),
 * and drops saved profile/study pages whose member or study is gone. One run at a time, after a pause so
 * the app finishes loading first.
 */
async function warmFrom(response) {
  if (warming) return;
  warming = true;
  try {
    const snapshot = await response.json();
    await new Promise(resolve => setTimeout(resolve, WARM_DELAY));
    const members = new Set(snapshot.members.map(m => String(m.id)));
    const studies = new Set(snapshot.studies.map(s => String(s.id)));
    const shell = await caches.open(SHELL);
    await Promise.all((await shell.keys()).map(req => {
      const [, kind, id] = new URL(req.url).pathname.match(/^\/(people|studies)\/(\d+)(?:\/edit)?$/) || [];
      return id && !(kind === 'people' ? members : studies).has(id) ? shell.delete(req) : undefined;
    }));
    const pages = [
      ...[...members].map(id => `/people/${id}`),
      ...snapshot.studies.filter(s => s.status === 'published').map(s => `/studies/${s.id}`),
    ];
    await cacheStatic(await cachePages(pages, { onlyNew: true }));
  } catch {
    // best effort: the next snapshot tries again
  } finally {
    warming = false;
  }
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const carried = (await savedPages()).filter(p => !PRECACHE.includes(p));
    const found = await cachePages(PRECACHE, { required: true });
    found.push(...await cachePages(carried));
    await cacheStatic(found);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = (await caches.keys()).filter(k => k.startsWith('ff-'));
    const previousStatic = keys.filter(k => k.startsWith('ff-static-') && k !== STATIC).at(-1);
    const keep = [SHELL, STATIC, API, previousStatic];
    await Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'CLEAR_DATA') {
    generation += 1;
    event.waitUntil(caches.delete(API));
  } else if (data.type === 'CACHE_URLS') {
    const pages = (Array.isArray(data.pages) ? data.pages : []).filter(p => typeof p === 'string' && /^\/(?!\/|api\/)/.test(p));
    const urls = (Array.isArray(data.urls) ? data.urls : []).filter(u => typeof u === 'string');
    event.waitUntil(cachePages(pages, { onlyNew: true }).then(found => cacheStatic([...urls, ...found])).catch(() => undefined));
  }
});

/**
 * Network first. Falls back to the cached copy when the fetch fails, when it takes longer than `wait` ms
 * (the fetch carries on and still updates the cache), or with `serverErrors` when the server answers 5xx.
 * `onSaved(response, late)` runs for each answer that gets cached; `late` = the cached copy was served.
 */
function networkFirst(event, cacheName, { wait, key = event.request, match, serverErrors = false, onSaved }) {
  const { request } = event;
  const gen = generation;
  const id = ++requests;
  newest.set(request.url, id);
  let late = false;
  const network = fetch(request).then(res => {
    if (res.ok && !res.redirected && gen === generation && newest.get(request.url) === id) {
      const copy = res.clone();
      const wasLate = late;
      event.waitUntil(caches.open(cacheName)
        .then(cache => cache.put(key, copy.clone()))
        .then(() => onSaved?.(copy, wasLate))
        .catch(() => undefined));
    }
    return res;
  });
  // Keeps the worker alive for a fetch that outlasts `wait`, so its answer still lands in the cache.
  event.waitUntil(network.catch(() => undefined));
  const cached = () => caches.open(cacheName).then(cache => cache.match(key, match));
  return (async () => {
    let res;
    try {
      res = await within(network, wait, () => { late = true; });
    } catch (err) {
      const hit = await cached();
      if (hit) return hit;
      throw err;
    }
    if (!res) return (await cached()) || network;
    if (serverErrors && res.status >= 500) return (await cached()) || res;
    return res;
  })();
}

/** Hands a fresh API answer that arrived after its cached copy was shown to the open pages. */
async function sendFresh(path, response) {
  const data = await response.json();
  for (const client of await self.clients.matchAll({ type: 'window' })) client.postMessage({ type: 'API_FRESH', key: path, data });
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC)).put(request, response.clone());
  return response;
}

async function navigate(event, path) {
  try {
    return await networkFirst(event, SHELL, { wait: NAV_TIMEOUT, key: path, match: { ignoreSearch: true, ignoreVary: true } });
  } catch {
    return (await caches.match('/offline', { cacheName: SHELL, ignoreVary: true })) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    const path = url.pathname + url.search;
    event.respondWith(networkFirst(event, API, {
      wait: API_TIMEOUT,
      serverErrors: true,
      onSaved: async (response, late) => {
        if (url.pathname === '/api/snapshot') event.waitUntil(warmFrom(response.clone()));
        if (late) await sendFresh(path, response);
      },
    }));
  } else if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === 'navigate') {
    event.respondWith(navigate(event, url.pathname));
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/favicon.ico' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(networkFirst(event, STATIC, { wait: NAV_TIMEOUT }));
  }
});
