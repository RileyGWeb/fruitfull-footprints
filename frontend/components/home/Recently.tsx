import type { HomeActivity } from './view';
import s from './Recently.module.css';

/** The newest few things that happened in the group. */
export function Recently({ activity }: { activity: HomeActivity[] }) {
  return (
    <section className={s.section} aria-labelledby="home-recent">
      <h2 id="home-recent" className={s.heading}>Recently</h2>
      {activity.length > 0 ? (
        <ul className={s.list}>
          {activity.map(a => (
            <li key={a.id} className={s.row}>
              <span className={s.dot} aria-hidden />
              <span className={s.text}>{a.text}</span>
              <span className={s.ago}>{a.ago}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.empty}>Nothing yet. New prayer requests, updates and studies will show up here.</p>
      )}
    </section>
  );
}
