import s from './LoadStates.module.css';

/** Quiet placeholders while the first snapshot loads — same shapes as the real thing, no motion. */
export function CardsSkeleton() {
  return (
    <div className={s.grid} aria-hidden>
      {[0, 1, 2, 3].map(i => <div key={i} className={`${s.block} ${s.card}`} />)}
    </div>
  );
}

export function RowsSkeleton() {
  return (
    <div className={s.rows} aria-hidden>
      <div className={`${s.bar} ${s.month}`} />
      {[0, 1, 2, 3, 4].map(i => <div key={i} className={`${s.block} ${s.row}`} />)}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className={s.profile} aria-hidden>
      <div className={s.profileHead}>
        <div className={`${s.block} ${s.avatar}`} />
        <div className={s.lines}>
          <div className={`${s.bar} ${s.name}`} />
          <div className={`${s.bar} ${s.tags}`} />
        </div>
      </div>
      <div className={`${s.block} ${s.prayer}`} />
    </div>
  );
}
