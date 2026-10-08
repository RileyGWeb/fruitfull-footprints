import Link from 'next/link';
import { longDate, parseDay } from '@/lib/dates';
import { studyKicker } from '@/lib/studies';
import type { StudySummary } from '@/lib/types';
import s from './Studies.module.css';

/**
 * Gap-fill: a published study further ahead than “Up next” (notes posted two weeks early). Without this
 * card it would be unreachable until the week before. Same shape as a draft card, solid instead of dashed.
 */
export function PostedCard({ study, now }: { study: StudySummary; now: Date }) {
  return (
    <section className={`${s.draft} ${s.posted}`} aria-labelledby={`posted-${study.id}`}>
      <span className={`tag tag-accent-2 ${s.draftTag}`}>Read ahead · {studyKicker(study, now)}</span>
      <h2 id={`posted-${study.id}`} className={s.draftRef}>{study.ref}</h2>
      {study.title && <div className={s.draftTitle}>{study.title}</div>}
      <div className={s.draftDate}>{longDate(parseDay(study.meeting_date))}</div>
      <Link
        href={`/studies/${study.id}`}
        className={`btn btn-secondary hit ${s.keepWriting}`}
        aria-label={`Read study ${study.ref ?? ''}`.trim()}
      >
        Read study
      </Link>
    </section>
  );
}
