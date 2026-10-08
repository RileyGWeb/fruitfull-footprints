'use client';

import './globals.css';
import { SystemCard } from '@/components/shell/SystemCard';

/** Last resort: the root layout itself failed, so this brings its own document (and styles). */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body>
        <title>Something went wrong · Fruitfull Footprints</title>
        <SystemCard kicker="Something went wrong" title="This didn’t open" body="Something on our side tripped. Try it again, or start over from Home.">
          <button type="button" className={`btn btn-primary ${SystemCard.styles.primary}`} onClick={() => retry()}>Try again</button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- a full reload on purpose */}
          <a href="/" className={`btn btn-ghost ${SystemCard.styles.secondary}`}>Go to Home</a>
        </SystemCard>
      </body>
    </html>
  );
}
