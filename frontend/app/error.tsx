'use client';

import { SystemCard } from '@/components/shell/SystemCard';

/**
 * The app's chrome itself failed to render (a screen's own error shows inside the chrome instead —
 * components/shell/ScreenBoundary). Home is a full page load, in case it's what keeps failing.
 */
export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <SystemCard kicker="Something went wrong" title="This didn’t open" body="Something on our side tripped. Try it again, or start over from Home.">
      <button type="button" className={`btn btn-primary ${SystemCard.styles.primary}`} onClick={() => retry()}>Try again</button>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload on purpose */}
      <a href="/" className={`btn btn-ghost ${SystemCard.styles.secondary}`}>Go to Home</a>
    </SystemCard>
  );
}
