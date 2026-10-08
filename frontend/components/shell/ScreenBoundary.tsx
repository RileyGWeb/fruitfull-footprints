'use client';

import Link from 'next/link';
import { catchError, type ErrorInfo } from 'next/error';
import { EmptyState } from '@/components/ui/EmptyState';
import es from '@/components/ui/EmptyState.module.css';

function ScreenError(_props: object, { retry }: ErrorInfo) {
  return (
    <EmptyState
      level={1}
      title="Something went wrong here"
      body="This page hit a snag on our side. Try it again, or head Home — everything else is fine."
      action={
        <span className={es.actions}>
          <button type="button" className={`btn btn-secondary ${es.button}`} onClick={() => retry()}>Try again</button>
          <Link href="/" className={`btn btn-ghost ${es.button} ${es.quiet}`}>Go to Home</Link>
        </span>
      }
    />
  );
}

/**
 * Wraps the screen inside the app chrome: if a screen throws while rendering, this shows in its
 * place (header and tabs stay), and it clears on the next navigation.
 */
export const ScreenBoundary = catchError(ScreenError);
