'use client';

import { useId } from 'react';
import { useDialogs } from '@/components/dialogs';
import { Icon } from '@/components/ui';
import type { Prayer } from '@/lib/types';
import type { PrayerView } from './people';
import s from './Profile.module.css';

type Props = { first: string; active: PrayerView[]; answered: PrayerView[] };

/** The profile's “Prayer requests” column: active cards, then the answered ones. */
export function ProfilePrayers({ first, active, answered }: Props) {
  const dialogs = useDialogs();
  const headingId = useId();
  const textId = (p: Prayer) => `${headingId}-p${p.id}`;
  const edit = (p: Prayer) => void dialogs.editPrayer(p);

  return (
    <section className={s.prayers} aria-labelledby={headingId}>
      <h2 id={headingId} className={s.sectionTitle}>Prayer requests</h2>

      {active.length === 0 && (
        <div className={s.quiet}>
          <strong>Nothing active right now</strong>
          When {first} shares something, add it here so we remember to pray.
        </div>
      )}

      {active.map(v => (
        <article key={v.prayer.id} className={s.card}>
          <div>
            <EditButton describedBy={textId(v.prayer)} onClick={() => edit(v.prayer)} />
            <p id={textId(v.prayer)} className={s.text}>{v.prayer.body}</p>
          </div>
          {v.updates.map(u => (
            <div key={u.id} className={s.update}>
              <span className={s.dot} />
              <span><strong>Update {u.ago}:</strong> {u.body}</span>
            </div>
          ))}
          <div className={s.cardFoot}>
            <span className={s.added}>Added {v.added}</span>
            <button type="button" className={`btn btn-secondary hit ${s.answer}`} onClick={() => void dialogs.answerPrayer(v.prayer)}>
              <Icon name="leafSm" /> Mark answered
            </button>
          </div>
        </article>
      ))}

      {answered.length > 0 && (
        <>
          <h3 className={s.answeredTitle}>Answered</h3>
          {answered.map(v => (
            <article key={v.prayer.id} className={s.answeredCard}>
              <p id={textId(v.prayer)} className={s.answeredText}>{v.prayer.body}</p>
              {v.prayer.answer && <p className={s.answerNote}>{v.prayer.answer}</p>}
              <div className={s.answeredFoot}>
                <span className={s.answeredWhen}>Answered {v.answeredAgo}</span>
                <EditButton inline describedBy={textId(v.prayer)} onClick={() => edit(v.prayer)} />
              </div>
            </article>
          ))}
        </>
      )}
    </section>
  );
}

/**
 * Gap-fill: the quiet pencil → edit / remove / reopen. Floats in an active card's top-right corner;
 * `inline` puts it at the end of the compact answered card's “Answered …” line instead.
 */
function EditButton({ inline, describedBy, onClick }: { inline?: boolean; describedBy: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-icon hit ${s.pencil} ${inline ? s.pencilInline : ''}`}
      aria-label="Edit request"
      aria-describedby={describedBy}
      title="Edit request"
      onClick={onClick}
    >
      <Icon name="editSm" />
    </button>
  );
}
