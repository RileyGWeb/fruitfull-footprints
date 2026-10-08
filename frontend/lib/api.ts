// Same-origin JSON client for the Laravel API (proxied by Next at /api/*).

export const OFFLINE_MESSAGE = 'You’re offline — try again when you’re connected.';
/** Window event: a 401 — this device was locked from elsewhere (password changed, Lock in another tab). */
export const LOCKED_EVENT = 'ff:locked';
/** Window event: this device's own Lock button — whatever is open gets put away. */
export const LOCK_EVENT = 'ff:lock';

export class ApiError extends Error {
  status: number;
  errors?: Record<string, string[]>;
  offline?: boolean;
  /** The response body as parsed (null when it wasn't JSON), e.g. a 409's `{message, study}`. */
  data?: unknown;
  constructor(status: number, message: string, errors?: Record<string, string[]>, offline?: boolean, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
    this.offline = offline;
    this.data = data;
  }
}

/** A message fit for a toast: the first validation error, the server message, or a plain fallback. */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.offline) return OFFLINE_MESSAGE;
    const first = e.errors && Object.values(e.errors)[0]?.[0];
    return first || e.message;
  }
  return 'Something went wrong — try again in a moment.';
}

/**
 * A 422 with field messages → the first message for each field (`{ date: 'A one-time date needs a year.' }`),
 * for showing under the fields. null for anything else (offline, 5xx, a 422 without fields).
 */
export function fieldErrors(e: unknown): Record<string, string> | null {
  if (!(e instanceof ApiError) || e.status !== 422 || !e.errors) return null;
  const out: Record<string, string> = {};
  for (const [field, messages] of Object.entries(e.errors)) if (messages?.[0]) out[field] = messages[0];
  return Object.keys(out).length ? out : null;
}

/** A 409: what was being saved was changed somewhere else first. The server's answer is in `e.data`. */
export const isConflict = (e: unknown): e is ApiError => e instanceof ApiError && e.status === 409;

function xsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const c = document.cookie.split('; ').find(x => x.startsWith('XSRF-TOKEN='));
  return c ? decodeURIComponent(c.slice('XSRF-TOKEN='.length)) : null;
}

const url = (path: string) => (path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`);

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (method !== 'GET') {
    const token = xsrfToken();
    if (token) headers['X-XSRF-TOKEN'] = token;
  }
  let res: Response;
  try {
    res = await fetch(url(path), { method, headers, credentials: 'same-origin', body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, OFFLINE_MESSAGE, undefined, true);
  }

  if (res.status === 419 && !retried) {
    // CSRF token expired: any GET through the web group re-seeds the cookie.
    await fetch(url('/api/group'), { credentials: 'same-origin', headers: { Accept: 'application/json' } }).catch(() => null);
    return request<T>(method, path, body, true);
  }
  if (res.status === 204) return undefined as T;

  const data = (res.headers.get('content-type') ?? '').includes('json') ? await res.json().catch(() => null) : null;
  if (res.ok) return data as T;

  if (res.status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event(LOCKED_EVENT));
  const message =
    res.status === 429 ? 'Too many tries — wait a minute and try again.'
    : res.status === 419 ? 'This page was open a long time — try that again.'
    : res.status === 404 ? 'That isn’t here anymore — it may have been removed.'
    : res.status === 401 ? 'Locked'
    : (res.status === 409 || res.status === 422 || res.status === 503) && data?.message ? data.message
    : 'Something went wrong — try again in a moment.';
  throw new ApiError(res.status, message, data?.errors, undefined, data);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T = void>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};

/** SWR fetcher: the key is the API path. */
export const fetcher = <T>(path: string) => api.get<T>(path);
