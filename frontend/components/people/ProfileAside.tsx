'use client';

import { useDialogs } from '@/components/dialogs';
import { DateChip, Icon } from '@/components/ui';
import { today } from '@/lib/dates';
import { useAccess } from '@/lib/hooks';
import { profileDateRows } from '@/lib/members';
import type { Member } from '@/lib/types';
import { aboutRows } from './people';
import s from './Profile.module.css';

/**
 * The profile's side column: “About {first}” and their “Dates to remember”, plus (for leaders) how they sign in.
 * Changing any of it is for leaders and the person themselves.
 */
export function ProfileAside({ member, first }: { member: Member; first: string }) {
  const dialogs = useDialogs();
  const access = useAccess();
  const canEdit = access.canEditPerson(member.id);
  const about = aboutRows(member);
  const dates = profileDateRows(member, today());

  return (
    <aside className={s.aside}>
      <section className={s.panelCard}>
        <h2 className={s.cardTitle}>About {first}</h2>
        {about.map(r => (
          <div key={r.label}>
            <div className={s.aboutLabel}>{r.label}</div>
            <div className={s.aboutValue}>{r.value}</div>
          </div>
        ))}
        {about.length === 0 && (
          <div className={s.emptyNote}>
            <p className={s.muted}>Family, interests, anything good to know — a few words help everyone remember.</p>
            {canEdit && (
              <button type="button" className={`btn btn-ghost hit ${s.smallAction}`} onClick={() => void dialogs.editPerson(member)}>
                <Icon name="editSm" /> Add a few details
              </button>
            )}
          </div>
        )}
      </section>

      <section className={`${s.panelCard} ${s.datesCard}`}>
        <div className={s.datesHead}>
          <h2 className={s.cardTitle}>Dates to remember</h2>
          {canEdit && (
            <button type="button" className={`btn btn-ghost hit ${s.smallAction} ${s.addDate}`} aria-label={`Add a date for ${first}`} onClick={() => void dialogs.addDate({ memberId: member.id })}>
              <Icon name="plusSm" /> Add
            </button>
          )}
        </div>
        {dates.map(d => {
          const row = (
            <>
              <DateChip mon={d.mon} day={d.day} bg={d.chipBg} fg={d.chipFg} size={42} />
              <div className={s.dateText}>
                <div className={s.dateLabel}>{d.label}</div>
                <div className={s.dateSub}>{d.sub}</div>
              </div>
            </>
          );
          // Only someone who can change a date gets a button; for everyone else it's just a line.
          return canEdit ? (
            <button key={d.key} type="button" className={`unstyled ${s.dateRow}`} aria-label={`${d.label}, ${d.sub}`} onClick={() => void dialogs.editDate(d.date)}>
              {row}
            </button>
          ) : (
            <div key={d.key} className={`${s.dateRow} ${s.dateStatic}`}>{row}</div>
          );
        })}
        {dates.length === 0 && <p className={s.muted}>Birthdays, anniversaries, and big days for {first} will show up here.</p>}
      </section>

      {access.isLeader && (
        <section className={s.panelCard}>
          <h2 className={s.cardTitle}>Signing in</h2>
          <p className={s.muted}>
            {access.isMe(member.id)
              ? 'You open the app with a password of your own.'
              : member.has_login
                ? `${first} opens the app with a password of their own.`
                : `${first} has no password yet, so they can’t open the app.`}
          </p>
          <button type="button" className={`btn btn-ghost hit ${s.smallAction} ${s.signinAction}`} onClick={() => void dialogs.editPerson(member)}>
            <Icon name="editSm" /> {member.has_login ? 'Change password or role' : 'Give a password'}
          </button>
        </section>
      )}
    </aside>
  );
}
