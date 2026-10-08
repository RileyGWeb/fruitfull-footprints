'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore, type MouseEvent, type ReactNode } from 'react';
import useSWR from 'swr';
import { OfflineBanner } from '@/components/pwa/OfflineBanner';
import { WarmNotes } from '@/components/pwa/WarmNotes';
import { focusLandmark } from '@/components/ui/focus';
import { Icon } from '@/components/ui/Icon';
import { LOCKED_EVENT } from '@/lib/api';
import * as ep from '@/lib/endpoints';
import { isLockedOut, setLockedOut, subscribeGate } from '@/lib/gate';
import { clearOfflineData, endLockout, useGroup, useLock, type GateStatus } from '@/lib/hooks';
import { setShellTitle } from '@/lib/title';
import type { Snapshot } from '@/lib/types';
import { Entrance } from './Entrance';
import { MobileHeader } from './MobileHeader';
import { routeTitle } from './nav';
import { ScreenBoundary } from './ScreenBoundary';
import { SystemCard } from './SystemCard';
import { TabBar } from './TabBar';
import { TopNav } from './TopNav';
import s from './Shell.module.css';

/**
 * The gate (splash → Entrance) and, once unlocked, the app chrome around every screen.
 *
 * Locked from elsewhere while open (a 401: the password changed, or Lock in another tab) the app stays
 * mounted — hidden and inert — under the Entrance, so an open dialog or a half-written study is still
 * there after the password. This device's own Lock puts everything away instead.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { group, status, unlock, markLocked, refresh } = useGroup();
  const onLock = useLock();
  const lockedOut = useSyncExternalStore(subscribeGate, isLockedOut, () => false);
  const statusRef = useRef<GateStatus>(status);
  const lastFocus = useRef<HTMLElement | null>(null);
  const appShown = status === 'unlocked' || lockedOut;
  const gated = status !== 'unlocked';

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Any 401 from the API means this device was locked out: drop the service worker's copy, shut the
  // gate straight away (no flash of “didn't load” screens) and keep the app as it is under the Entrance.
  useEffect(() => {
    const onLocked = () => {
      clearOfflineData();
      if (statusRef.current !== 'unlocked' || isLockedOut()) return;
      lastFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setLockedOut(true);
      void markLocked();
    };
    window.addEventListener(LOCKED_EVENT, onLocked);
    return () => window.removeEventListener(LOCKED_EVENT, onLocked);
  }, [markLocked]);

  // Through the Entrance (the password, or the server saying this device is fine): carry on where we
  // were — the control that had focus before a lock-out, else the screen's heading.
  const cameThroughEntrance = useRef(false);
  useEffect(() => {
    if (status === 'locked') cameThroughEntrance.current = true;
    if (status !== 'unlocked') return;
    if (lockedOut) return endLockout(); // shows the app (and its dialogs) again; focus follows on that render
    if (!cameThroughEntrance.current) return;
    cameThroughEntrance.current = false;
    const back = lastFocus.current;
    lastFocus.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
    if (!back || document.activeElement !== back) focusLandmark();
  }, [status, lockedOut]);

  if (status === 'loading') return <Splash />;

  if (!appShown) {
    return (
      <>
        <ShellTitle groupName={group.group_name} gated />
        {status === 'unreachable' ? <Unreachable onRetry={() => void refresh()} /> : <Entrance group={group} onUnlock={unlock} />}
      </>
    );
  }

  return (
    <>
      <ShellTitle groupName={group.group_name} gated={gated} />
      {!gated && <WarmNotes />}
      <div className={s.shell} inert={gated} aria-hidden={gated || undefined}>
        <a href="#main" className={s.skip} onClick={skipToContent}>Skip to content</a>
        <TopNav groupName={group.group_name} onLock={onLock} />
        <MobileHeader groupName={group.group_name} onLock={onLock} />
        <OfflineBanner />
        <main id="main" className={s.main}>
          <ScreenBoundary>{children}</ScreenBoundary>
        </main>
        <TabBar />
      </div>
      {gated && (
        <div className={s.gate}>
          <Entrance group={group} onUnlock={unlock} lockedOut />
        </div>
      )}
    </>
  );
}

/** Handled here rather than by the #main fragment, which would add a history entry (and a popstate). */
function skipToContent(e: MouseEvent) {
  e.preventDefault();
  focusLandmark({ scroll: true });
}

/** document.title for the route (the screen can refine it with useDocumentTitle); just the group name at the gate. */
function ShellTitle({ groupName, gated }: { groupName: string; gated: boolean }) {
  const pathname = usePathname();
  const { data } = useSWR<Snapshot>(gated ? null : ep.SNAPSHOT_KEY);
  const label = routeTitle(pathname, data);
  useEffect(() => {
    setShellTitle(groupName, label, gated);
  }, [groupName, label, gated]);
  return null;
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <SystemCard kicker="Can’t connect" title="We can’t reach the group just now" body="Check your connection, or give it a moment — it’ll open as usual once we’re through.">
      <button type="button" className={`btn btn-primary ${SystemCard.styles.primary}`} onClick={onRetry}>Try again</button>
    </SystemCard>
  );
}

export function Splash() {
  return (
    <main className={s.splash} aria-busy="true">
      <span className="sr-only">Loading…</span>
      <span className={s.mark}><Icon name="feetLg" /></span>
    </main>
  );
}
