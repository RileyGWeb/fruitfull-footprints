'use client';

import { useEffect, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import { today } from '@/lib/dates';
import { SNAPSHOT_KEY, studyKey } from '@/lib/endpoints';
import { isLockedOut } from '@/lib/gate';
import { useOnline } from '@/lib/hooks';
import { notesToWarm } from '@/lib/studies';
import type { Snapshot, StudySummary } from '@/lib/types';

const enabled = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';

/** The service worker's API cache (`API` in public/sw.js). */
const API_CACHE = 'ff-api';
/** Let the screen finish loading first, then one study at a time with a pause between fetches. */
const START_DELAY = 4000;
const GAP = 1500;

/** Whether a service worker controls this page (on a first visit, not until it has installed). */
const isControlled = () => typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller;
const subscribeControl = (onChange: () => void) => {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return () => {};
  navigator.serviceWorker.addEventListener('controllerchange', onChange);
  return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange);
};

type Idle = { cancel: () => void };
/** requestIdleCallback where there is one (not Safari), else the next task. */
function whenIdle(fn: () => void): Idle {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fn, { timeout: 5000 });
    return { cancel: () => window.cancelIdleCallback(id) };
  }
  const id = window.setTimeout(fn, 0);
  return { cancel: () => window.clearTimeout(id) };
}

/** Whether the worker already holds this version of the study (the snapshot's `updated_at`). */
async function saved(s: StudySummary): Promise<boolean> {
  const hit = await caches.match(studyKey(s.id), { cacheName: API_CACHE, ignoreVary: true });
  if (!hit) return false;
  const body = (await hit.json().catch(() => null)) as { updated_at?: string } | null;
  return body?.updated_at === s.updated_at;
}

/**
 * Saves study notes for reading offline. Opening a study saves its notes anyway; this gets the ones
 * most likely to be read before they're opened: every upcoming published study and the 12 latest past
 * ones (lib/studies notesToWarm). Each goes through the service worker (GET /api/studies/{id}), which
 * keeps the copy — one at a time, when the browser is idle, skipping copies that are already current.
 * Only while online and controlled by the worker (production builds), and only behind the gate; the
 * first failure stops the round, and the next change to the snapshot, the connection coming back or
 * the worker taking control starts another.
 */
export function WarmNotes() {
  const { data } = useSWR<Snapshot>(SNAPSHOT_KEY);
  const studies = data?.studies;
  const online = useOnline();
  const controlled = useSyncExternalStore(subscribeControl, isControlled, () => false);

  useEffect(() => {
    if (!enabled || !studies || !online || !controlled || typeof caches === 'undefined') return;
    const queue = notesToWarm(studies, today());
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: Idle | undefined;
    const ready = () => !stopped && navigator.onLine && !!navigator.serviceWorker.controller && !isLockedOut();

    const step = async () => {
      const study = queue.shift();
      if (!study || !ready()) return;
      let fetched = false;
      try {
        if (!(await saved(study))) {
          fetched = true;
          // The same request the reader makes (lib/api), so the worker's copy is the one it finds.
          const res = await fetch(studyKey(study.id), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          });
          if (!res.ok) return; // locked, gone or failing: leave the rest for next time
        }
      } catch {
        return; // the connection went
      }
      later(fetched ? GAP : 0); // only fetches need spacing out
    };
    const later = (ms: number) => {
      timer = setTimeout(() => {
        idle = whenIdle(() => void step());
      }, ms);
    };

    later(START_DELAY);
    return () => {
      stopped = true;
      clearTimeout(timer);
      idle?.cancel();
    };
  }, [studies, online, controlled]);

  return null;
}
