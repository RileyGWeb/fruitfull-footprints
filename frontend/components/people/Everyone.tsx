'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useDialogs } from '@/components/dialogs';
import { Avatar, EmptyState, Icon, ScreenState } from '@/components/ui';
import { today } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import { CardsSkeleton } from './LoadStates';
import { PeopleHeader } from './PeopleHeader';
import { personCards, type PersonCardView } from './people';
import s from './People.module.css';

/** /people — “Our group”: one card per member, in join order. */
export function Everyone() {
  const { data, error, mutate } = useSnapshot();
  const { addPerson } = useDialogs();
  const cards = useMemo(() => (data ? personCards(data.members, data.prayers, today()) : []), [data]);

  let body;
  if (!data) body = <ScreenState error={error} what="The group" onRetry={() => void mutate()} loading={<CardsSkeleton />} level={2} />;
  else if (!cards.length) {
    body = (
      <EmptyState
        level={2}
        icon="users"
        title="No one here yet"
        body="Add the first person, and the group starts to fill in from there."
        action={<button type="button" className={`btn btn-secondary ${s.add}`} onClick={() => void addPerson()}><Icon name="plusSm" /> Add person</button>}
      />
    );
  } else {
    body = <div className={s.grid}>{cards.map(c => <PersonCard key={c.member.id} card={c} />)}</div>;
  }

  return (
    <div className={s.screen}>
      <PeopleHeader tab="everyone" count={data?.members.length} meetingDay={data?.settings.meeting_day} />
      {body}
    </div>
  );
}

function PersonCard({ card: c }: { card: PersonCardView }) {
  return (
    <Link href={`/people/${c.member.id}`} className={`unstyled ${s.card}`}>
      <div className={s.who}>
        <Avatar member={c.member} size={58} />
        <div className={s.names}>
          <div className={s.first}>{c.first}</div>
          {c.last && <div className={s.last}>{c.last}</div>}
        </div>
      </div>
      {c.gifts && <div className={s.gifts}>{c.gifts}</div>}
      {c.line && <p className={s.line}>{c.line}</p>}
      <div className={s.tags}>
        <span className="tag tag-neutral">{c.prayerLabel}</span>
        {c.soon && <span className="tag tag-accent">{c.soon}</span>}
      </div>
    </Link>
  );
}
