'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { useDocumentTitle } from '@/lib/title';
import { EmptyState } from './EmptyState';
import type { IconName } from './Icon';
import s from './EmptyState.module.css';

/** A 401 means the shell is already showing the Entrance — nothing to say on the screen itself. */
const isLocked = (e: unknown) => e instanceof ApiError && e.status === 401;

type LoadErrorProps = {
  error: unknown;
  /** What didn't load, as a sentence start: “Prayer requests”, “The studies”, “This study”. */
  what: string;
  onRetry: () => void;
  /**
   * The message's heading level, so the outline doesn't skip one: 2 (default) under the screen's own
   * h1, 1 when it stands in for the whole page (no h1 without the data), 3 inside a section with an h2.
   */
  level?: 1 | 2 | 3;
  className?: string;
};

/** “{what} didn’t load” / “You’re offline”, with Try again. Renders nothing for a 401. */
export function LoadError({ error, what, onRetry, level = 2, className }: LoadErrorProps) {
  if (isLocked(error)) return null;
  const offline = error instanceof ApiError && !!error.offline;
  return (
    <EmptyState
      level={level}
      className={className}
      icon={offline ? 'offline' : 'leaf'}
      title={offline ? 'You’re offline' : `${what} didn’t load`}
      body={offline
        ? 'It hasn’t been saved on this device yet. Once you’re connected it’ll open as usual.'
        : 'Something went wrong on our end. Give it another try in a moment.'}
      action={<button type="button" className={`btn btn-secondary ${s.button}`} onClick={onRetry}>Try again</button>}
    />
  );
}

type ScreenStateProps = Omit<LoadErrorProps, 'error'> & {
  /** The SWR error, if any. */
  error?: unknown;
  /** The screen's own skeleton, shown while loading (and while a 401 hands over to the Entrance). */
  loading?: ReactNode;
};

/**
 * What a screen shows while it has no data yet: its skeleton, or LoadError once the request failed.
 *
 *   if (!data) return <ScreenState error={error} what="Prayer requests" onRetry={() => mutate()} loading={<Skeleton />} level={2} />;
 */
export function ScreenState({ error, loading = null, ...rest }: ScreenStateProps) {
  if (error && !isLocked(error)) return <LoadError error={error} {...rest} />;
  return <>{loading}</>;
}

type NotFoundProps = {
  /** 1 (default) when it stands in for the whole page; 2 or 3 under the screen's own h1. */
  level?: 1 | 2 | 3;
  title?: string;
  body?: ReactNode;
  /** Where the way out goes, and what it says. */
  href?: string;
  label?: string;
  icon?: IconName;
  className?: string;
};

/**
 * The quiet “that isn't here” block, with a way out. Also titles the page “Not found”.
 *
 *   <NotFound title="We couldn’t find that person" body="…" href="/people" label="Back to everyone" icon="users" />
 */
export function NotFound({
  title = 'That page isn’t here',
  body = 'The link may be out of date, or it was moved. Everything else is right where you left it.',
  href = '/',
  label = 'Go to Home',
  icon = 'feet',
  className,
  level = 1,
}: NotFoundProps) {
  useDocumentTitle('Not found');
  return (
    <EmptyState
      level={level}
      className={className}
      icon={icon}
      title={title}
      body={body}
      action={<Link href={href} className={`btn btn-secondary ${s.button}`}>{label}</Link>}
    />
  );
}
