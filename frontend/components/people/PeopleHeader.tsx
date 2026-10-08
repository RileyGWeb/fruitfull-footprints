'use client';

import { useDialogs } from '@/components/dialogs';
import { Icon, Seg } from '@/components/ui';
import { useDocumentTitle } from '@/lib/title';
import { groupLine } from './people';
import s from './People.module.css';

type Props = { tab: 'everyone' | 'dates'; count?: number; meetingDay?: string };

/** “Our group” + count line, “Add person” (gap-fill) and the Everyone / Dates to remember tabs; names the page after the tab. */
export function PeopleHeader({ tab, count, meetingDay }: Props) {
  const { addPerson } = useDialogs();
  useDocumentTitle(tab === 'dates' ? 'Dates to remember' : 'People');
  return (
    <div className={s.header}>
      <div className={s.heading}>
        <h1 className={s.title}>Our group</h1>
        <p className={s.subtitle}>{count == null || !meetingDay ? ' ' : groupLine(count, meetingDay)}</p>
      </div>
      <button type="button" className={`btn btn-secondary ${s.add}`} onClick={() => void addPerson()}>
        <Icon name="plusSm" /> Add person
      </button>
      <Seg
        label="People views"
        options={[
          { label: 'Everyone', href: '/people', active: tab === 'everyone' },
          { label: 'Dates to remember', href: '/people/dates', active: tab === 'dates' },
        ]}
      />
    </div>
  );
}
