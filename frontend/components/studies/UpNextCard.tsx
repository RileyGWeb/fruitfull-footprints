import Link from 'next/link';
import { longDate, parseDay } from '@/lib/dates';
import { studyKicker, verseOf } from '@/lib/studies';
import type { StudySummary } from '@/lib/types';
import s from './Studies.module.css';

type Props = { study: StudySummary | null; now: Date };

/** The big sand “Up next” card — or, with nothing published ahead, the same card inviting someone to prepare one. */
export function UpNextCard({ study, now }: Props) {
  if (!study) {
    return (
      <section className={s.week} aria-labelledby="up-next-empty">
        <div className={s.weekBlob} aria-hidden />
        <div className={s.weekKicker}>Up next</div>
        <h2 id="up-next-empty" className={s.weekEmptyTitle}>No study posted yet</h2>
        <p className={s.weekEmptyBody}>Nothing’s been published for the weeks ahead. Whoever’s leading next can start the notes here.</p>
        <Link href="/studies/new" className={`btn btn-primary ${s.read}`}>Prepare a study</Link>
      </section>
    );
  }

  const verse = verseOf(study);
  return (
    <section className={s.week} aria-labelledby={`up-next-${study.id}`}>
      <div className={s.weekBlob} aria-hidden />
      <div className={s.weekKicker}>Up next · {studyKicker(study, now)}</div>
      <h2 id={`up-next-${study.id}`} className={s.weekRef}>{study.ref}</h2>
      {study.title && <div className={s.weekTitle}>{study.title}</div>}
      <div className={s.weekDate}>{longDate(parseDay(study.meeting_date))}</div>
      {verse ? <blockquote className={s.weekVerse}>“{verse}”</blockquote> : <div className={s.weekVerse} aria-hidden />}
      <Link href={`/studies/${study.id}`} className={`btn btn-primary ${s.read}`}>Read study</Link>
    </section>
  );
}
