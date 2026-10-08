'use client';

import { Icon } from '@/components/ui/Icon';
import type { AnsweredPrayerView } from './views';
import a from './AnsweredPrayerCard.module.css';

type Props = { view: AnsweredPrayerView; onEdit: () => void };

/** An answered request: when, how it turned out, what was asked, and how long we carried it. */
export function AnsweredPrayerCard({ view, onEdit }: Props) {
  const { prayer, first, answeredAgo, carried } = view;
  return (
    <article className={a.card}>
      <span className={a.blob} aria-hidden />
      {/* Two flex items, as in the prototype, so the gap after “·” matches the design. On a narrow
          card they wrap as whole phrases (never “Answered” / “·”) under the label, beside the leaf. */}
      <div className={a.kicker}>
        <Icon name="leafSm" />
        <span className={a.label}>
          <span>Answered ·</span>
          <span>{answeredAgo}</span>
        </span>
      </div>
      {prayer.answer && <p className={a.answer}>{prayer.answer}</p>}
      <p className={a.asked}>{first} asked: “{prayer.body}”</p>
      <span className={a.carried}>Prayed over for {carried}</span>
      <button type="button" className={`btn btn-ghost btn-icon ${a.edit}`} onClick={onEdit} aria-label={`Edit ${first}’s answered request`} title="Edit request">
        <Icon name="edit" />
      </button>
    </article>
  );
}
