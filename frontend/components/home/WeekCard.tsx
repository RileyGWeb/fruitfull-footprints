import Link from 'next/link';
import type { WeekView } from './view';
import s from './WeekCard.module.css';

/** “This week”: the up-next study on the sage card, or a nudge to prepare one. */
export function WeekCard({ week }: { week: WeekView }) {
  const { study } = week;
  return (
    <section className={s.card} aria-labelledby="home-week">
      <div className={s.blobTop} aria-hidden />
      <div className={s.blobBottom} aria-hidden />
      <div className={s.inner}>
        <div className={s.kicker}>This week · {week.kicker}</div>
        {study ? (
          <>
            <h2 id="home-week" className={s.ref}>{study.ref}</h2>
            {study.title && <div className={s.title}>{study.title}</div>}
            <div className={s.place}>{week.place}</div>
            {study.description && <p className={s.desc}>{study.description}</p>}
            <div className={s.actions}>
              <Link href={`/studies/${study.id}`} className={`btn btn-primary ${s.open}`}>Read study notes</Link>
            </div>
          </>
        ) : (
          <>
            <h2 id="home-week" className={`${s.ref} ${s.refQuiet}`}>No study posted yet</h2>
            <div className={s.place}>{week.place}</div>
            <p className={s.desc}>Whoever’s leading can put the notes together here. They’ll show up for everyone once they’re published.</p>
            <div className={s.actions}>
              <Link href="/studies/new" className={`btn btn-primary ${s.open}`}>Prepare a study</Link>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
