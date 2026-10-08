'use client';

import Link from 'next/link';
import { useDialogs } from '@/components/dialogs';
import { Avatar, Icon } from '@/components/ui';
import { firstName } from '@/lib/members';
import type { Member } from '@/lib/types';
import s from './OurGroup.module.css';

/** Everyone's avatar and first name; each opens their profile. */
export function OurGroup({ members }: { members: Member[] }) {
  const dialogs = useDialogs();
  return (
    <section className={s.section} aria-labelledby="home-group">
      <div className={s.head}>
        <h2 id="home-group" className={s.heading}>Our group</h2>
        <Link href="/people" className={`btn btn-ghost hit ${s.ghost}`}>View everyone</Link>
      </div>
      {members.length > 0 ? (
        <ul className={s.grid}>
          {members.map(m => (
            <li key={m.id}>
              <Link href={`/people/${m.id}`} title={m.name} aria-label={m.name} className={`unstyled ${s.person}`}>
                <Avatar member={m} size={50} />
                <span className={s.first}>{firstName(m)}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <>
          <p className={s.empty}>No one’s been added yet. Start with whoever comes on meeting nights.</p>
          <button type="button" className={`btn btn-secondary hit ${s.add}`} onClick={() => void dialogs.addPerson()}>
            <Icon name="plusSm" />
            Add person
          </button>
        </>
      )}
    </section>
  );
}
