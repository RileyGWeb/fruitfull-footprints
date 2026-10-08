// “Install the app”: what this browser can do, as a tiny external store for useSyncExternalStore.
//  - standalone → already running as the installed app (the helper hides)
//  - prompt     → Chromium handed us a `beforeinstallprompt` event; our button replays it
//  - ios        → iOS has no prompt; explain Share → Add to Home Screen
//  - manual     → anything else; point at the browser menu
//  - installed  → accepted from our button (or `appinstalled` fired) in this tab
import { useSyncExternalStore } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};

export type InstallState = 'unknown' | 'standalone' | 'installed' | 'prompt' | 'ios' | 'manual';

const STANDALONE = '(display-mode: standalone)';

/**
 * Chromium fires `beforeinstallprompt` once per page load, usually while someone is still on Home, so
 * components/pwa/ServiceWorker.tsx (loaded on every page) keeps it on `window.ffInstall`. We read that
 * and keep listening ourselves (same fields), so a later event or `appinstalled` still updates the card.
 * The browser's own install UI is left alone; our button replays the same event.
 */
type Stash = { prompt: BeforeInstallPromptEvent | null; installed: boolean };
const stash = (): Stash => ((window as Window & { ffInstall?: Stash }).ffInstall ??= { prompt: null, installed: false });

const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', e => {
    stash().prompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    Object.assign(stash(), { prompt: null, installed: true });
    emit();
  });
}
start();

function subscribe(cb: () => void) {
  start();
  listeners.add(cb);
  const mq = window.matchMedia(STANDALONE);
  mq.addEventListener('change', cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener('change', cb);
  };
}

const isStandalone = () =>
  window.matchMedia(STANDALONE).matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone / iPod / iPad — iPadOS reports itself as a Mac, so also a Mac with a touch screen. */
const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

function getSnapshot(): InstallState {
  if (isStandalone()) return 'standalone';
  const { prompt, installed } = stash();
  if (installed) return 'installed';
  if (prompt) return 'prompt';
  if (isIOS()) return 'ios';
  return 'manual';
}

const getServerSnapshot = (): InstallState => 'unknown';

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Shows the browser's install sheet (a prompt event can only be used once). True if accepted. */
export async function promptInstall(): Promise<boolean> {
  const s = stash();
  const e = s.prompt;
  if (!e) return false;
  s.prompt = null;
  try {
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') s.installed = true;
    return outcome === 'accepted';
  } catch {
    return false;
  } finally {
    emit();
  }
}
