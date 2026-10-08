// Back (the browser button, a swipe, Alt+←, Android's back) asks whatever is in front first: the top
// dialog closes as a cancel; an editor with unsaved changes can ask before the page goes. While any
// guard is active, one extra same-URL history entry (“the guard entry”) sits on top of the page's own
// entry. Back pops it, the guard's onBack runs, and the page stays where it is.
import { useEffect, useRef } from 'react';
import { isLockedOut } from './gate.ts';
import { whenRoute } from './route.ts';

/** Return true to stay guarded (e.g. while asking “Leave without saving?”); otherwise the guard is done. */
export type BackHandler = () => boolean | void;
type Guard = { onBack: BackHandler; modal: boolean };
type NavigateOptions = { scroll?: boolean };
type Router = { push(href: string, opts?: NavigateOptions): void; replace(href: string, opts?: NavigateOptions): void };

const guards: Guard[] = [];
let token: string | null = null; // the guard entry we own (null: none)
let expecting: 'pop' | 'leave' | null = null; // a traversal we started ourselves
let settling: Promise<void> | null = null; // ...resolving once it has landed
let settle: (() => void) | null = null;
let expectTimer: ReturnType<typeof setTimeout> | undefined;
let listening = false;
let arriving: Promise<void> | null = null; // a leaveTo whose screen hasn't been committed yet
const settled = () => settling ?? Promise.resolve();

const isGuardEntry = () => token !== null && window.history.state?.ffGuard === token;

function pushEntry() {
  token = Math.random().toString(36).slice(2, 10);
  // Next's patched pushState copies its router state onto the entry, so going Back to the page's own
  // entry restores the same route and nothing visible changes.
  window.history.pushState({ ffGuard: token }, '');
}

function traverse(kind: 'pop' | 'leave', delta: number): Promise<void> {
  expecting = kind;
  settling = new Promise(resolve => { settle = resolve; });
  clearTimeout(expectTimer);
  expectTimer = setTimeout(landed, 1000); // in case the browser had nowhere to go
  window.history.go(delta);
  return settling;
}

function landed() {
  expecting = null;
  clearTimeout(expectTimer);
  const done = settle;
  settle = null;
  settling = null;
  done?.();
}

const remove = (g: Guard) => {
  const i = guards.indexOf(g);
  if (i >= 0) guards.splice(i, 1);
  return i >= 0;
};

/** Dialogs (modal) answer Back before page guards such as the editor, whatever order they came in. */
const topGuard = () => [...guards].reverse().find(g => g.modal) ?? guards[guards.length - 1];

function onPopState() {
  if (expecting) {
    const was = expecting;
    landed();
    if (was === 'pop' && guards.length && !isGuardEntry()) pushEntry(); // a guard arrived mid-pop
    return;
  }
  if (token === null || isGuardEntry()) return; // not ours, or Forward back onto our entry
  token = null; // Back took the guard entry off
  if (isLockedOut()) return pushEntry(); // the Entrance is up: Back leaves the hidden page alone
  const g = topGuard();
  if (!g) return;
  if (!g.onBack()) remove(g);
  // A confirm opened straight from onBack has already pushed its entry; one is enough.
  if (guards.length && !isGuardEntry()) pushEntry();
}

/**
 * Takes the guard entry back off once the last guard is gone. Resolves when history has settled, so
 * whatever navigates next (a link after “Leave”, a tab switch after saving) can't race the pop.
 */
function release(g: Guard): Promise<void> {
  if (!remove(g) || guards.length || expecting) return settled();
  const owned = isGuardEntry();
  token = null;
  return owned ? traverse('pop', -1) : settled();
}

/**
 * Catch Back while something is in front of the page. The newest modal guard (a dialog) goes first,
 * then the newest page guard. Returns release(): call it when the dialog closes / the page is saved;
 * it takes the guard entry back off when it was the last guard, and resolves once history has settled.
 */
export function guardHistory(onBack: BackHandler, opts: { modal?: boolean } = {}): () => Promise<void> {
  if (typeof window === 'undefined') return () => Promise.resolve();
  if (!listening) {
    listening = true;
    window.addEventListener('popstate', onPopState);
  }
  const g: Guard = { onBack, modal: !!opts.modal };
  guards.push(g);
  if (!expecting && !isGuardEntry()) pushEntry();
  return () => release(g);
}

/** Hook form of guardHistory for page-level guards: active while `active` is true. */
export function useHistoryGuard(active: boolean, onBack: BackHandler): void {
  const handler = useRef(onBack);
  useEffect(() => {
    handler.current = onBack;
  });
  useEffect(() => {
    if (!active) return;
    const release = guardHistory(() => handler.current());
    return () => void release();
  }, [active]);
}

/** Leaving the page: every guard on it is done. True when the guard entry was current (and is now ours to replace). */
function leavePage(): boolean {
  guards.length = 0;
  const owned = !expecting && isGuardEntry();
  token = null;
  return owned;
}

/** Marks `href` as on its way until its screen has been committed (see navigating()), 10s at most. */
function expectArrival(href: string) {
  const path = new URL(href, window.location?.href ?? 'http://localhost').pathname;
  const p: Promise<void> = new Promise(resolve => whenRoute(at => at === path, resolve, 10_000));
  arriving = p;
  void p.then(() => {
    if (arriving === p) arriving = null;
  });
}

/**
 * Navigate away from a guarded page, or right after closing a dialog. A push takes over the guard
 * entry (router.replace) instead of pushing past it, so Back from `href` returns to this page in one
 * step; a replace steps off the guard entry first and then replaces the page's own entry, so Back
 * from `href` skips this page. If the entry is being popped, navigates once that has landed.
 */
export function leaveTo(router: Router, href: string, opts: { replace?: boolean; scroll?: boolean } = {}): void {
  const nav = opts.scroll === undefined ? undefined : { scroll: opts.scroll };
  const go = () => (opts.replace ? router.replace(href, nav) : router.push(href, nav));
  if (typeof window === 'undefined') return go();
  expectArrival(href);
  if (leavePage()) {
    if (!opts.replace) return router.replace(href, nav);
    void traverse('pop', -1).then(go);
  } else if (settling) void settling.then(go);
  else go();
}

/**
 * The navigation the last leaveTo started, until its screen has been committed (10s at most);
 * null when none is under way. A dialog that closes as the page goes waits for it before placing focus.
 */
export const navigating = (): Promise<void> | null => arriving;

/** Resolves when no history change of ours is in flight (e.g. before navigating right after a guard was released). */
export const historySettled = (): Promise<void> => settled();

/**
 * “Leave” after a guarded Back: drops every guard and goes back past the guard entry to the page
 * before. Returns false when there's no page before (opened from a link) so the caller can navigate
 * somewhere sensible instead.
 */
export function goBack(): boolean {
  if (typeof window === 'undefined' || expecting) return false;
  const delta = leavePage() ? -2 : -1;
  const index = (window as { navigation?: { currentEntry?: { index: number } | null } }).navigation?.currentEntry?.index;
  if (index != null && index + delta < 0) return false;
  void traverse('leave', delta);
  return true;
}
