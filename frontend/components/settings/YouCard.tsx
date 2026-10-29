'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { roleLabel } from '@/lib/access';
import { useSnapshot, useViewer } from '@/lib/hooks';
import s from './settings.module.css';

/** Who is signed in on this device, and the way to their own profile. */
export function YouCard() {
  const viewer = useViewer();
  const { data } = useSnapshot();
  if (!viewer) return null;

  const me = viewer.member_id == null ? undefined : data?.members.find(m => m.id === viewer.member_id);
  const leader = viewer.role === 'leader';

  return (
    <section className={s.card} aria-labelledby="settings-you">
      <h2 id="settings-you" className={s.cardTitle}>You’re signed in</h2>
      {viewer.role === 'super' ? (
        <p className={s.text}>
          As the site admin you can see and change everything, and you’re not listed in the group. Give people their own
          passwords from their profiles.
        </p>
      ) : (
        <>
          <div className={s.who}>
            {me && <Avatar member={me} size={50} />}
            <div className={s.whoText}>
              <div className={s.whoName}>{viewer.name}</div>
              <span className={`tag ${leader ? 'tag-accent' : 'tag-neutral'}`}>{roleLabel(viewer.role)}</span>
            </div>
          </div>
          <p className={s.text}>
            You open the app with a password of your own.{' '}
            {leader ? 'You can change yours, and anyone else’s, from a profile.' : 'A leader can change it for you.'}
          </p>
          <Link href={`/people/${viewer.member_id}`} className={`btn btn-secondary ${s.action}`}>View my profile</Link>
        </>
      )}
    </section>
  );
}
