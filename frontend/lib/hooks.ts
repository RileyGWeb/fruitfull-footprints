import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { clearAllLocal } from '../components/editor/localDraft.ts';
import { ApiError, LOCK_EVENT, fetcher } from './api.ts';
import * as ep from './endpoints.ts';
import { hasPendingLock, isLockedOut, setLockedOut, setPendingLock, subscribeGate } from './gate.ts';
import { leaveTo } from './historyGuard.ts';
import type { GroupInfo, Snapshot, Study } from './types.ts';

/** Gate copy used until /api/group answers. */
export const DEFAULT_GROUP: GroupInfo = {
  group_name: 'Fruitfull Footprints',
  tagline: 'A private home for our small group.',
  meeting_day: 'Wednesday',
  since_year: 2023,
  unlocked: false,
};

/** The one snapshot every screen derives from. */
export function useSnapshot() {
  return useSWR<Snapshot, ApiError>(ep.SNAPSHOT_KEY, fetcher);
}

/** A full study (with sections); pass null/undefined to skip. */
export function useStudy(id: number | string | null | undefined) {
  return useSWR<Study, ApiError>(id == null || id === '' ? null : ep.studyKey(id), fetcher);
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

/** navigator.onLine, live. Always true during SSR. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/**
 * - `locked`: the Entrance (the server said so, a 401, or a Lock the server hasn't heard yet).
 * - `unreachable`: /api/group failed (offline or a server error) and nothing is cached — we can't tell
 *   whether this device is unlocked, so it isn't asked for the password.
 */
export type GateStatus = 'loading' | 'locked' | 'unlocked' | 'unreachable';

/** Clears every cached API response except the gate's own. */
export const clearDataCache = () => globalMutate(key => key !== ep.GROUP_KEY, undefined, { revalidate: false });

/** Tells the service worker to drop its offline copy of API responses (on Lock and on lock-out). */
export function clearOfflineData(): void {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  const msg = { type: 'CLEAR_DATA' };
  if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage(msg);
  else navigator.serviceWorker.getRegistration().then(r => r?.active?.postMessage(msg)).catch(() => undefined);
}

const lockedGate = (g: GroupInfo | undefined): GroupInfo => ({ ...(g ?? DEFAULT_GROUP), unlocked: false });

let flushing: Promise<boolean> | null = null;

/** Sends a Lock made offline (POST /api/lock). Resolves true once the server has it. */
export function flushPendingLock(): Promise<boolean> {
  if (!hasPendingLock()) return Promise.resolve(false);
  flushing ??= ep.lock().then(
    async () => {
      // Keep the gate shut while it's re-read: a cached /api/group may still say unlocked.
      await globalMutate(ep.GROUP_KEY, lockedGate, { revalidate: false });
      setPendingLock(false);
      void globalMutate(ep.GROUP_KEY);
      return true;
    },
    () => false,
  ).finally(() => { flushing = null; });
  return flushing;
}

/** After a lock-out ends (password entered, or the gate says unlocked again): show the app and refresh its data. */
export function endLockout(): void {
  if (!isLockedOut()) return;
  setLockedOut(false);
  void globalMutate(key => key !== ep.GROUP_KEY);
}

/**
 * Gate state from GET /api/group. An error after a successful load keeps the last known state; with
 * nothing cached, a 401/4xx reads as locked and offline/5xx as unreachable.
 */
export function useGroup() {
  // isPaused: false — the gate keeps checking even while the rest of the app is paused behind the Entrance.
  const { data, error, mutate } = useSWR<GroupInfo, ApiError>(ep.GROUP_KEY, fetcher, { isPaused: () => false });
  const pendingLock = useSyncExternalStore(subscribeGate, hasPendingLock, () => false);
  const status: GateStatus = pendingLock ? 'locked'
    : data ? (data.unlocked ? 'unlocked' : 'locked')
    : error ? (error.status === 0 || error.status >= 500 ? 'unreachable' : 'locked')
    : 'loading';
  const group = data ?? DEFAULT_GROUP;

  // A Lock made offline reaches the server as soon as it can.
  useEffect(() => {
    if (!pendingLock) return;
    const send = () => void flushPendingLock();
    send();
    window.addEventListener('online', send);
    return () => window.removeEventListener('online', send);
  }, [pendingLock]);

  const unlock = useCallback(async (password: string) => {
    await flushing; // a Lock still on its way mustn't land after this unlock
    await ep.unlock(password);
    setPendingLock(false);
    await mutate();
    endLockout();
  }, [mutate]);

  /**
   * Lock this device: everything is put away here first (open dialogs, SWR data, the service worker's
   * API copy) and the Entrance shows, then POST /api/lock — right away, or once back online. Never throws.
   */
  const lock = useCallback(async () => {
    setPendingLock(true);
    window.dispatchEvent(new Event(LOCK_EVENT));
    clearAllLocal(); // the editor's kept copies, even when no editor has opened since the page loaded
    clearOfflineData();
    await clearDataCache();
    await mutate(lockedGate, { revalidate: false });
    await flushPendingLock();
  }, [mutate]);

  /** A 401 elsewhere: shut the gate now (no flash of “didn't load” screens), then confirm with the server. */
  const markLocked = useCallback(() => mutate(lockedGate, { revalidate: true }), [mutate]);

  const refresh = useCallback(() => mutate(), [mutate]);

  return { group, status, error, unlock, lock, markLocked, refresh };
}

/** The Lock button: locks (see useGroup().lock) and goes Home, behind the Entrance. */
export function useLock(): () => Promise<void> {
  const { lock } = useGroup();
  const router = useRouter();
  return useCallback(async () => {
    await lock();
    leaveTo(router, '/', { replace: true });
  }, [lock, router]);
}
