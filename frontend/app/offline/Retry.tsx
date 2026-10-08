'use client';

import { useEffect } from 'react';

/** “Try again” reloads the page that couldn't open; so does the connection coming back. */
export function Retry({ className }: { className?: string }) {
  useEffect(() => {
    const reload = () => window.location.reload();
    window.addEventListener('online', reload);
    return () => window.removeEventListener('online', reload);
  }, []);
  return <button type="button" className={className} onClick={() => window.location.reload()}>Try again</button>;
}
