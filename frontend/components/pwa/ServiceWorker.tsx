'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSWRConfig } from 'swr';
import { GROUP_KEY, SNAPSHOT_KEY } from '@/lib/endpoints';

const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';

/** New with every `next build` (next.config.ts), so each deploy registers, and installs, a fresh worker. */
const SW_URL = `/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID || 'dev')}`;

// Chromium fires `beforeinstallprompt` once per page load, usually before anyone opens Settings: keep it
// (and whether the app got installed) for Settings' “Install the app” (components/settings/install.ts).
if (typeof window !== 'undefined') {
  const w = window as Window & { ffInstall?: { prompt: Event | null; installed: boolean } };
  w.ffInstall ??= { prompt: null, installed: false };
  window.addEventListener('beforeinstallprompt', e => { w.ffInstall!.prompt = e; });
  window.addEventListener('appinstalled', () => { w.ffInstall = { prompt: null, installed: true }; });
}

/** The /_next/static assets this page has loaded so far (scripts, styles, fonts). */
function loadedAssets(): string[] {
  const fromTags = [...document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>('script[src], link[href]')]
    .map(el => ('src' in el && el.src) || ('href' in el && el.href) || '');
  const fromPerf = performance.getEntriesByType('resource').map(e => e.name);
  return [...new Set([...fromTags, ...fromPerf])].filter(u => {
    try {
      const url = new URL(u, location.href);
      return url.origin === location.origin && url.pathname.startsWith('/_next/static/');
    } catch {
      return false;
    }
  });
}

type FreshMessage = { type: 'API_FRESH'; key: string; data: unknown };

/**
 * Registers the service worker (production builds, or dev with NEXT_PUBLIC_ENABLE_SW=1) and keeps it
 * supplied: every page opened while online is handed to it with the assets loaded so far, so the page
 * opens offline later (in-app navigations never reach the worker as page loads). On a first visit it
 * refetches the gate + snapshot once the worker takes control, so they land in the offline cache too,
 * and an API answer the worker gets after it already showed its cached copy (slow connection) replaces
 * that copy here. In plain dev it unregisters any worker left over from a production run on the origin.
 */
export function ServiceWorker() {
  const { mutate } = useSWRConfig();
  const pathname = usePathname();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const sw = navigator.serviceWorker;
    if (!enabled) {
      sw.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => undefined);
      return;
    }
    // Data fetched before the worker took control (first visit) isn't in its cache yet.
    const onControl = () => {
      void mutate(GROUP_KEY);
      void mutate(SNAPSHOT_KEY);
    };
    const onMessage = (e: MessageEvent<FreshMessage>) => {
      if (e.data?.type === 'API_FRESH' && typeof e.data.key === 'string') void mutate(e.data.key, e.data.data, { revalidate: false });
    };
    if (!sw.controller) sw.addEventListener('controllerchange', onControl, { once: true });
    sw.addEventListener('message', onMessage);
    sw.startMessages();
    sw.register(SW_URL, { scope: '/', updateViaCache: 'none' }).catch(() => undefined);
    return () => {
      sw.removeEventListener('controllerchange', onControl);
      sw.removeEventListener('message', onMessage);
    };
  }, [mutate]);

  // The worker skips pages it already has, so this costs one page fetch per new page.
  useEffect(() => {
    if (!enabled || !('serviceWorker' in navigator) || !navigator.onLine || pathname === '/offline') return;
    let cancelled = false;
    navigator.serviceWorker.ready.then(reg => {
      if (!cancelled) reg.active?.postMessage({ type: 'CACHE_URLS', urls: loadedAssets(), pages: [pathname] });
    }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
