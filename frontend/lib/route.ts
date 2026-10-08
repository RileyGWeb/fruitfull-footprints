// The route on screen, as React last committed it. Providers reports each new pathname from a layout
// effect — once the new screen is in the DOM, before the browser paints it — so work that has to land
// together with a navigation (a cache edit, where focus goes) can run in that same frame instead of
// watching the address bar.

type Waiter = { test: (pathname: string) => boolean; run: () => void; timer: ReturnType<typeof setTimeout> };

let committed: string | null = null;
const waiters = new Set<Waiter>();

function finish(w: Waiter) {
  if (!waiters.delete(w)) return;
  clearTimeout(w.timer);
  try {
    w.run();
  } catch (e) {
    console.error(e); // one failed callback mustn't break the commit it runs in
  }
}

/** Providers calls this from a layout effect with every newly committed pathname. */
export function routeCommitted(pathname: string): void {
  committed = pathname;
  for (const w of [...waiters]) if (w.test(pathname)) finish(w);
}

/**
 * Runs `fn` in the commit that puts a route passing `test` on screen, before it is painted — straight
 * away if the route on screen already passes (or nothing reports commits, outside the app) — and
 * after `timeout` ms regardless, in case that route never comes.
 */
export function whenRoute(test: (pathname: string) => boolean, fn: () => void, timeout = 3000): void {
  if (committed === null || test(committed)) return fn();
  const w: Waiter = { test, run: fn, timer: setTimeout(() => finish(w), timeout) };
  waiters.add(w);
}
