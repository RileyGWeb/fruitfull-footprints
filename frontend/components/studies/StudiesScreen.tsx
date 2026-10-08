'use client';

import Link from 'next/link';
import { Suspense, useMemo } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ScreenState } from '@/components/ui/ScreenState';
import { toISODay, today } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import { buildPath, draftStudies, upNext } from '@/lib/studies';
import { useDocumentTitle } from '@/lib/title';
import { DraftCard } from './DraftCard';
import { PostedCard } from './PostedCard';
import { StudyArchive } from './StudyArchive';
import { StudyPath } from './StudyPath';
import { UpNextCard } from './UpNextCard';
import s from './Studies.module.css';

/** Studies: up next, drafts, the path so far, and every previous study. */
export function StudiesScreen() {
  const { data, error, isLoading, mutate } = useSnapshot();
  const now = useMemo(() => today(), []);
  const studies = data?.studies;
  useDocumentTitle('Studies');

  const view = useMemo(() => {
    if (!studies) return null;
    const next = upNext(studies, now);
    // Published studies further ahead than “Up next” — otherwise nothing links to them until their week.
    const iso = toISODay(now);
    const later = studies
      .filter(x => x.status === 'published' && x.meeting_date >= iso && x.id !== next?.id)
      .sort((a, b) => a.meeting_date.localeCompare(b.meeting_date));
    return { next, later, drafts: draftStudies(studies), path: buildPath(studies, now) };
  }, [studies, now]);

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.heading}>
          <h1 className={s.h1}>Studies</h1>
          <p className={s.subtitle}>Notes go up a few days early so we can read ahead.</p>
        </div>
        <Link href="/studies/new" className={`btn btn-secondary ${s.newStudy}`}>
          <Icon name="plusSm" /> New study
        </Link>
      </div>

      {view && studies ? (
        <>
          <div className={s.cards}>
            <UpNextCard study={view.next} now={now} />
            {view.later.map(x => <PostedCard key={x.id} study={x} now={now} />)}
            {view.drafts.map(d => <DraftCard key={d.id} study={d} />)}
          </div>
          <StudyPath nodes={view.path} />
          {/* The archive reads ?q= (useSearchParams), which needs a boundary if this is ever prerendered. */}
          <Suspense>
            <StudyArchive studies={studies} now={now} />
          </Suspense>
        </>
      ) : (
        <ScreenState
          // While Try again is in flight, show the skeleton rather than the old error.
          error={isLoading ? null : error}
          what="The studies"
          onRetry={() => void mutate()}
          level={2}
          loading={<div className={s.cards} aria-hidden><div className={s.skeleton} /></div>}
        />
      )}
    </div>
  );
}
