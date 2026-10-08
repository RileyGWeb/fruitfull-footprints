import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { longDate, parseDay } from '@/lib/dates';
import type { StudySummary } from '@/lib/types';
import s from './Studies.module.css';

/** A dashed draft card: only shows up here on Studies until it's published. */
export function DraftCard({ study }: { study: StudySummary }) {
  const ref = study.ref?.trim() || 'Untitled';
  return (
    <section className={s.draft} aria-labelledby={`draft-${study.id}`}>
      <span className={`tag tag-neutral ${s.draftTag}`}>Draft · only visible here</span>
      <h2 id={`draft-${study.id}`} className={s.draftRef}>{ref}</h2>
      {study.title && <div className={s.draftTitle}>{study.title}</div>}
      <div className={s.draftDate}>For {longDate(parseDay(study.meeting_date))}</div>
      <Link
        href={`/studies/${study.id}/edit`}
        className={`btn btn-secondary hit ${s.keepWriting}`}
        aria-label={`Keep writing ${ref}`}
      >
        <Icon name="editSm" /> Keep writing
      </Link>
    </section>
  );
}
