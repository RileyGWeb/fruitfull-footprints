import s from './DateChip.module.css';

type Props = { mon: string; day: number | string; bg: string; fg: string; size?: 46 | 42 };

/** Round month/day chip — 46px (Home, Dates tab) or 42px (profile). */
export function DateChip({ mon, day, bg, fg, size = 46 }: Props) {
  return (
    <div className={`${s.chip} ${size === 42 ? s.sm : ''}`} style={{ background: bg, color: fg }}>
      <span className={s.mon}>{mon}</span>
      <span className={s.day}>{day}</span>
    </div>
  );
}
