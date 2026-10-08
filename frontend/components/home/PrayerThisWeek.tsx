'use client';

import Link from 'next/link';
import { useDialogs } from '@/components/dialogs';
import { Avatar, Icon } from '@/components/ui';
import type { HomePrayer } from './view';
import s from './PrayerThisWeek.module.css';

type Props = { prayers: HomePrayer[]; activeCount: number; canAdd: boolean };

/** The newest active requests, each with the person's avatar (→ profile), and a way to the full list. */
export function PrayerThisWeek({ prayers, activeCount, canAdd }: Props) {
  const dialogs = useDialogs();
  return (
    <section className={s.section} aria-labelledby="home-prayer">
      <div className={s.head}>
        <h2 id="home-prayer" className={s.heading}>Prayer this week</h2>
        <Link href="/prayer" className={`btn btn-ghost hit ${s.ghost}`}>View all</Link>
      </div>

      {prayers.length > 0 ? (
        <>
          <ul className={s.list}>
            {prayers.map(({ prayer, member, name, ago }) => (
              <li key={prayer.id} className={s.card}>
                <Avatar member={member} href={`/people/${member.id}`} title={member.name} className="hit" />
                <div className={s.body}>
                  <div className={s.meta}>
                    <strong className={s.name}>{name}</strong>
                    <span className={s.ago}>{ago}</span>
                  </div>
                  <p className={s.text}>{prayer.body}</p>
                </div>
              </li>
            ))}
          </ul>
          {/* The count is its own flex item, so the button's 6px gap sets it apart as in the design. */}
          <Link href="/prayer" className={`btn btn-secondary hit ${s.all}`}>
            {activeCount === 1 ? 'View' : 'View all'} <span>{activeCount}</span> {activeCount === 1 ? 'prayer request' : 'prayer requests'}
          </Link>
        </>
      ) : (
        <>
          <div className={s.empty}>
            <span className={s.emptyIcon}><Icon name="leafSm" /></span>
            <div className={s.body}>
              <strong className={s.emptyTitle}>No active prayer requests</strong>
              <p className={s.emptyText}>A quiet season is something to be thankful for.</p>
            </div>
          </div>
          {canAdd && (
            <button type="button" className={`btn btn-secondary hit ${s.all}`} onClick={() => void dialogs.addPrayer()}>
              <Icon name="plusSm" />
              Add a request
            </button>
          )}
        </>
      )}
    </section>
  );
}
