'use client';

import { useId, useMemo, useState } from 'react';
import { useDialogs } from '@/components/dialogs';
import { Avatar, BackButton, Icon, NotFound, ScreenState } from '@/components/ui';
import { today } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import { GIFTS, firstName } from '@/lib/members';
import { useDocumentTitle } from '@/lib/title';
import type { Member, Prayer } from '@/lib/types';
import { ProfileSkeleton } from './LoadStates';
import { ProfileAside } from './ProfileAside';
import { ProfilePrayers } from './ProfilePrayers';
import { memberPrayers } from './people';
import { useGiftEditor } from './useGiftEditor';
import s from './Profile.module.css';

/** /people/[id] — prototype screen 04 (with the gift editor of screen “gifts”). */
export function Profile({ id }: { id: string }) {
  const { data, error, mutate, isValidating } = useSnapshot();
  const member = data?.members.find(m => String(m.id) === id);
  useDocumentTitle(member?.name);

  // Keyed so the gift panel closes when moving between profiles.
  if (data && member) return <ProfileView key={member.id} member={member} prayers={data.prayers} />;

  return (
    <div className={s.screen}>
      <BackButton href="/people" label="Everyone" className="hit" />
      {/* A cached snapshot may predate this person: only call them missing once the fresh one is in. */}
      {data && !isValidating ? (
        <NotFound
          title="We couldn’t find that person"
          body="They may have been removed from the group, or the link is out of date."
          href="/people"
          label="Back to everyone"
          icon="users"
        />
      ) : (
        <ScreenState error={data ? undefined : error} what="This profile" onRetry={() => void mutate()} loading={<ProfileSkeleton />} level={1} />
      )}
    </div>
  );
}

function ProfileView({ member, prayers }: { member: Member; prayers: Prayer[] }) {
  const dialogs = useDialogs();
  const [editingGifts, setEditingGifts] = useState(false);
  const { gifts, toggle } = useGiftEditor(member);
  const panelId = useId();
  const first = firstName(member);
  const mine = useMemo(() => memberPrayers(prayers, member.id, today()), [prayers, member.id]);

  return (
    <div className={s.screen}>
      <div className={s.top}>
        <BackButton href="/people" label="Everyone" className="hit" />
        <button type="button" className={`btn btn-secondary hit ${s.edit}`} aria-label={`Edit ${first}`} onClick={() => void dialogs.editPerson(member)}>
          <Icon name="editSm" /> Edit
        </button>
      </div>

      <div className={s.header}>
        <Avatar member={member} size={104} />
        <div className={s.info}>
          <h1 className={s.name}>{member.name}</h1>
          <div className={s.gifts}>
            {gifts.map(g => <span key={g} className={`tag tag-accent-2 ${s.gift}`}>{g}</span>)}
            <button
              type="button"
              className={`btn btn-ghost hit ${s.giftToggle}`}
              aria-expanded={editingGifts}
              aria-controls={editingGifts ? panelId : undefined}
              onClick={() => setEditingGifts(v => !v)}
            >
              <Icon name="editSm" /> {editingGifts ? 'Done' : 'Edit gifts'}
            </button>
          </div>
        </div>
        <button type="button" className={`btn btn-primary ${s.addPrayer}`} onClick={() => void dialogs.addPrayer({ memberId: member.id })}>
          <Icon name="plus" /> Add prayer request
        </button>
      </div>

      {editingGifts && (
        <div id={panelId} className={s.panel} role="group" aria-label={`${first}’s spiritual gifts`}>
          <div className={s.panelHint}>Tap to add or remove {first}’s spiritual gifts.</div>
          <div className={s.options}>
            {GIFTS.map(g => (
              <button key={g} type="button" className={`unstyled ${s.option}`} aria-pressed={gifts.includes(g)} onClick={() => toggle(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={s.body}>
        <ProfilePrayers first={first} active={mine.active} answered={mine.answered} />
        <ProfileAside member={member} first={first} />
      </div>
    </div>
  );
}
