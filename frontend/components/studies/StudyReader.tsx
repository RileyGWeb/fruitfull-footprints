'use client';

import Link from 'next/link';
import { useMemo, type ReactNode } from 'react';
import { BackButton } from '@/components/ui/BackButton';
import { Icon } from '@/components/ui/Icon';
import { NotFound, ScreenState } from '@/components/ui/ScreenState';
import { longDate, parseDay, today } from '@/lib/dates';
import { useSnapshot, useStudy } from '@/lib/hooks';
import { paragraphs, studyKicker } from '@/lib/studies';
import { useDocumentTitle } from '@/lib/title';
import type { StudySummary } from '@/lib/types';
import { readerSections } from './sections';
import { StudySection } from './StudySection';
import r from './StudyReader.module.css';

const isId = (id: string) => /^\d{1,18}$/.test(id);

/** The study reader. Works from SWR's cache offline; the snapshot's summary fills the header while the full study loads. */
export function StudyReader({ id }: { id: string }) {
  const valid = isId(id);
  const { data: study, error, mutate } = useStudy(valid ? id : null);
  const { data: snap } = useSnapshot();
  const now = useMemo(() => today(), []);
  const summary = useMemo(() => snap?.studies.find(s => String(s.id) === id), [snap, id]);
  const sections = useMemo(() => readerSections(study?.sections), [study]);

  const missing = !valid || error?.status === 404;
  const head: StudySummary | undefined = missing ? undefined : study ?? summary;
  const ref = head?.ref?.trim() || 'Untitled';
  // “Romans 8 · Fruitfull Footprints”; NotFound names a missing study itself.
  useDocumentTitle(head ? ref : null);

  if (missing) {
    return (
      <Frame>
        <NotFound
          title="This study isn’t here anymore"
          body="It may have been deleted, or the link is a little off. Everything we’ve studied is still on Studies."
          href="/studies"
          label="Back to Studies"
          icon="book"
        />
      </Frame>
    );
  }

  if (!head) {
    return (
      <Frame>
        <ScreenState
          error={error}
          what="This study"
          onRetry={() => void mutate()}
          level={1}
          loading={
            <div aria-hidden>
              <span className={`${r.skel} ${r.skelKicker}`} />
              <span className={`${r.skel} ${r.skelRef}`} />
              <span className={`${r.skel} ${r.skelTitle}`} />
              <span className={`${r.skel} ${r.skelBlock}`} />
            </div>
          }
        />
      </Frame>
    );
  }

  const fallback = study && !sections.length ? paragraphs(study.description) : [];

  return (
    <Frame id={head.id}>
      <header className={r.head}>
        <div className={r.kicker}>{longDate(parseDay(head.meeting_date))} · {studyKicker(head, now)}</div>
        <h1 className={r.ref}>{ref}</h1>
        {head.title && <div className={r.title}>{head.title}</div>}
        {(head.passage || head.status === 'draft') && (
          <div className={r.tags}>
            {head.passage && <span className={`tag tag-accent-2 ${r.tag}`}>Primary passage · {head.passage}</span>}
            {head.status === 'draft' && <span className={`tag tag-neutral ${r.draftTag}`}>Draft · not published yet</span>}
          </div>
        )}
        <div className={r.rule} aria-hidden />
      </header>

      {study ? (
        <>
          {sections.map(x => <StudySection key={x.id} section={x} />)}
          {fallback.length > 0 && (
            <section className={r.section}>
              {fallback.map((t, i) => <p key={i} className={r.para}>{t}</p>)}
            </section>
          )}
          {sections.length || fallback.length ? (
            <footer className={r.footer}>
              <span className={r.feet}><Icon name="feetSm" /></span>
              <span>Scripture quotations from the World English Bible.</span>
            </footer>
          ) : (
            <p className={r.note}>Nothing’s been written for this one yet.</p>
          )}
        </>
      ) : error && error.status !== 401 ? (
        // A 401 is the shell's to handle (the Entrance is already up): keep the placeholder.
        <div className={r.note}>
          <p className={r.noteText}>
            {error.offline
              ? 'You’re offline, and this study’s notes haven’t been saved on this device yet.'
              : 'The notes for this study didn’t load.'}
          </p>
          {!error.offline && (
            <button type="button" className="btn btn-secondary hit" onClick={() => void mutate()}>Try again</button>
          )}
        </div>
      ) : (
        <span className={`${r.skel} ${r.skelBlock}`} aria-hidden />
      )}
    </Frame>
  );
}

/** The article column with “← Studies” and (for a real study) “Edit”. */
function Frame({ id, children }: { id?: number; children: ReactNode }) {
  return (
    <article className={r.article}>
      <div className={r.bar}>
        <BackButton href="/studies" label="Studies" className={`hit ${r.back}`} />
        {id != null && (
          <Link href={`/studies/${id}/edit`} className={`btn btn-secondary hit ${r.edit}`} aria-label="Edit study">
            <Icon name="editSm" /> Edit
          </Link>
        )}
      </div>
      {children}
    </article>
  );
}
