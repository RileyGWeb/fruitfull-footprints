import Link from 'next/link';
import { DateChip } from '@/components/ui';
import type { DateRow } from '@/lib/members';
import s from './ComingUp.module.css';

type Props = { rows: DateRow[]; noDates: boolean };

/** Birthdays, anniversaries and life events in the next six weeks; each row opens that person. */
export function ComingUp({ rows, noDates }: Props) {
  return (
    <section className={s.card} aria-labelledby="home-coming">
      <div className={s.head}>
        <h2 id="home-coming" className={s.heading}>Coming up</h2>
        <Link href="/people/dates" className={`btn btn-ghost hit ${s.ghost}`}>All dates</Link>
      </div>
      {rows.length > 0 ? (
        <ul className={s.list}>
          {rows.map(r => (
            <li key={r.key}>
              <Link href={`/people/${r.member.id}`} className={`unstyled ${s.row}`}>
                <DateChip mon={r.mon} day={r.day} bg={r.chipBg} fg={r.chipFg} />
                <div className={s.text}>
                  <div className={s.title}>{r.title}</div>
                  <div className={s.sub}>{r.sub}</div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>
          {noDates ? 'Birthdays and anniversaries will show up here once they’re added to someone’s profile.' : 'Nothing in the next six weeks.'}
        </p>
      )}
    </section>
  );
}
