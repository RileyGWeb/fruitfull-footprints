'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { useDialogs } from '@/components/dialogs';
import { goBack, guardHistory, leaveTo } from '@/lib/historyGuard';

type Options = {
  /**
   * Puts the unsaved changes somewhere safe on this device before asking; true when they're kept
   * there (the confirm says so — leaving then loses nothing).
   */
  keep: () => boolean;
};

/**
 * While `active` (unsaved changes), asks before the page goes away:
 * - Back (the button, a swipe, Android's back), through the shared history guard (lib/historyGuard):
 *   “Leave” goes on to the page before, “Keep editing” stays.
 * - In-app links (the back link, the tab bar, the top nav), caught in the capture phase on window
 *   before next/link or React sees them.
 * - The header's Lock button (locking clears this device's copy of the changes).
 * - Reload / close: the browser's own prompt.
 *
 * Returns `leave(href, { replace?, scroll? })` for navigating away once saved (leaveTo): a push keeps
 * the editor one Back away; a replace takes the editor's own history entry too, so Back skips it.
 */
export function useLeaveGuard(active: boolean, { keep }: Options) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const keepRef = useRef(keep);
  useEffect(() => {
    keepRef.current = keep;
  });

  useEffect(() => {
    if (!active) return;
    let replaying = false;

    const ask = (why: 'leave' | 'lock') => {
      if (why === 'lock') {
        return confirm({
          title: 'Lock without saving?',
          body: 'Your changes to this study haven’t been saved yet, and locking clears them from this device.',
          confirmLabel: 'Lock',
          cancelLabel: 'Keep editing',
          danger: true,
        });
      }
      const kept = keepRef.current();
      return confirm({
        title: 'Leave without saving?',
        body: kept
          ? 'Your changes haven’t been saved for the group yet. They’ll stay on this device for when you come back.'
          : 'Your changes to this study haven’t been saved yet.',
        confirmLabel: 'Leave',
        cancelLabel: 'Keep editing',
        danger: !kept,
      });
    };

    // Back: the guard entry has been popped; stay guarded while asking (return true). The confirm's own
    // guard puts the entry back, and the shared guard doesn't add a second one on top (lib/historyGuard).
    const unguard = guardHistory(() => {
      void ask('leave').then(ok => {
        if (ok && !goBack()) router.replace('/studies'); // opened straight from a link: nowhere to go back to
      });
      return true;
    });

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onClick = (e: MouseEvent) => {
      if (replaying || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const target = e.target instanceof Element ? e.target : null;

      // The shell's Lock button (TopNav / MobileHeader): ask, then let the original click through.
      const lock = target?.closest('button[aria-label="Lock"]');
      if (lock instanceof HTMLButtonElement) {
        e.preventDefault();
        e.stopPropagation();
        void ask('lock').then(ok => {
          if (!ok) return;
          replaying = true;
          try { lock.click(); } finally { replaying = false; }
        });
        return;
      }

      const a = target?.closest('a[href]');
      if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return; // a full page load: beforeunload covers it
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      void ask('leave').then(ok => {
        if (ok) leaveTo(router, url.pathname + url.search + url.hash);
      });
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('click', onClick, true);
      void unguard();
    };
  }, [active, confirm, router]);

  return useCallback((href: string, opts: { replace?: boolean; scroll?: boolean } = {}) => leaveTo(router, href, opts), [router]);
}
