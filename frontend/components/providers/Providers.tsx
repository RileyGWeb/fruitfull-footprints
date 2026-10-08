'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect, type ReactNode } from 'react';
import { SWRConfig, type SWRConfiguration } from 'swr';
import { DialogsProvider } from '@/components/dialogs/DialogsProvider';
import { ServiceWorker } from '@/components/pwa/ServiceWorker';
import { Toaster } from '@/components/ui/Toast';
import { ApiError, fetcher } from '@/lib/api';
import { isLockedOut } from '@/lib/gate';
import { routeCommitted } from '@/lib/route';

const swr: SWRConfiguration = {
  fetcher,
  // Behind the Entrance after a lock-out every request would 401; wait (the gate's own key opts out).
  isPaused: isLockedOut,
  // Retry only server hiccups (5xx), a few times with backoff; offline/4xx wait for focus/reconnect.
  onErrorRetry: (err, _key, _config, revalidate, { retryCount }) => {
    if (err instanceof ApiError && err.status < 500) return;
    if (retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount }), 2000 * 2 ** retryCount);
  },
};

/**
 * Reports each route as React commits it (lib/route.ts): a layout effect runs once the new screen is
 * in the DOM and before the browser paints it, so what waits on it lands in the same frame.
 */
function RouteCommits() {
  const pathname = usePathname();
  useLayoutEffect(() => routeCommitted(pathname), [pathname]);
  return null;
}

/** SWR, dialogs, toasts and service-worker registration for the whole app. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={swr}>
      <RouteCommits />
      <DialogsProvider>{children}</DialogsProvider>
      <Toaster />
      <ServiceWorker />
    </SWRConfig>
  );
}
