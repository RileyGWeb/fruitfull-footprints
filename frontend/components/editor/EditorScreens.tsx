'use client';

import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { NotFound, ScreenState } from '@/components/ui/ScreenState';
import { useSnapshot, useStudy } from '@/lib/hooks';
import { nextMeetingDate } from '@/lib/studies';
import type { Study } from '@/lib/types';
import { StudyEditor } from './StudyEditor';
import s from './Editor.module.css';

/** A study id as the API routes accept it; anything else never reaches the API. */
const isStudyId = (id: string | undefined) => /^\d{1,18}$/.test(id ?? '');

/** /studies/new — starts a week after the latest study (or on the next meeting day). */
export function NewStudyScreen() {
  const { data, error } = useSnapshot();
  if (!data && !error) return <Frame busy><EditorSkeleton /></Frame>;
  // Without a snapshot (offline, nothing cached) you can still start writing; saving needs a connection.
  return (
    <StudyEditor
      defaultDate={nextMeetingDate(data?.studies ?? [], data?.settings ?? null)}
      meetingPlace={data?.settings.meeting_place ?? ''}
    />
  );
}

/** /studies/[id]/edit */
export function EditStudyScreen() {
  const { id } = useParams<{ id: string }>();
  const valid = isStudyId(id);
  const { data, error, mutate } = useStudy(valid ? id : null);
  const meetingPlace = useSnapshot().data?.settings.meeting_place ?? '';

  // The editor owns its form once it opens: later revalidations (or the cache being cleared on
  // delete) must not reset or unmount it.
  const [study, setStudy] = useState<Study | null>(null);
  if (data && data.id !== study?.id) setStudy(data);

  if (study) return <StudyEditor key={study.id} study={study} meetingPlace={meetingPlace} />;
  if (!valid || error?.status === 404) {
    return (
      <Frame>
        <NotFound
          title="This study isn’t here anymore"
          body="It may have been deleted, or the link is a little off. Everything else is still on Studies."
          href="/studies"
          label="Back to Studies"
          icon="book"
        />
      </Frame>
    );
  }
  return (
    <Frame busy={!error || error.status === 401}>
      <ScreenState error={error} what="This study" onRetry={() => void mutate()} loading={<EditorSkeleton />} level={1} />
    </Frame>
  );
}

/** The page column with just the back link, around a loading, failed or missing study. */
function Frame({ busy, children }: { busy?: boolean; children: ReactNode }) {
  return (
    <div className={s.page} aria-busy={busy || undefined}>
      <div className={s.top}>
        <BackButton href="/studies" label="Studies" className={`${s.back} hit`} />
      </div>
      {children}
    </div>
  );
}

/** A quiet placeholder while the study loads; it only fades in if loading takes a moment. */
function EditorSkeleton() {
  return (
    <div className={s.skeleton} aria-hidden>
      <div className={s.skelTitle} />
      <div className={s.skelCard} />
    </div>
  );
}
