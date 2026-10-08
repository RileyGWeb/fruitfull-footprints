'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { DateChip, EmptyState, ScreenState } from '@/components/ui';
import { MONTHS, today } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import { RowsSkeleton } from './LoadStates';
import { PeopleHeader } from './PeopleHeader';
import { datesByMonth } from './people';
import s from './People.module.css';

/** /people/dates — the next twelve months of birthdays, anniversaries and life events, by month. */
export function DatesToRemember() {
  const { data, error, mutate } = useSnapshot();
  const groups = useMemo(() => (data ? datesByMonth(data.members, today()) : []), [data]);

  let body;
  if (!data) body = <ScreenState error={error} what="The group" onRetry={() => void mutate()} loading={<RowsSkeleton />} level={2} />;
  else if (!groups.length) {
    body = (
      <EmptyState
        level={2}
        title="No dates yet"
        body="Add birthdays and anniversaries from someone’s profile, and they’ll show up here."
      />
    );
  } else {
    body = groups.map(g => (
      <div key={g.key} className={s.month}>
        <h2 className={s.monthName}>{g.month}</h2>
        {g.items.map(r => (
          <Link key={r.key} href={`/people/${r.member.id}`} className={`unstyled ${s.row}`} aria-label={`${r.title}, ${MONTHS[r.on.getMonth()]} ${r.on.getDate()}, ${r.sub}`}>
            <DateChip mon={r.mon} day={r.day} bg={r.chipBg} fg={r.chipFg} />
            <div className={s.rowText}>
              <div className={s.rowTitle}>{r.title}</div>
              <div className={s.rowSub}>{r.sub}</div>
            </div>
            <span className={`tag tag-neutral ${s.kind}`}>{r.kindLabel}</span>
          </Link>
        ))}
      </div>
    ));
  }

  return (
    <div className={s.screen}>
      <PeopleHeader tab="dates" count={data?.members.length} meetingDay={data?.settings.meeting_day} />
      <div className={s.dates}>
        <p className={s.intro}>Birthdays, anniversaries, and the big moments in each other’s lives — so no one gets missed.</p>
        {body}
      </div>
    </div>
  );
}
