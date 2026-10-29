'use client';

import { useAccess } from '@/lib/hooks';
import { useDocumentTitle } from '@/lib/title';
import { DeviceCard } from './DeviceCard';
import { GroupCard } from './GroupCard';
import { YouCard } from './YouCard';
import s from './settings.module.css';

/**
 * /settings (gap-fill, SPEC §6): who you're signed in as, this device, and (for leaders) the group's
 * details. Everyone has a password of their own, so there's no shared one to change here.
 */
export function SettingsScreen() {
  useDocumentTitle('Settings');
  const { isLeader } = useAccess();
  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Settings</h1>
          <p className={s.subtitle}>{isLeader ? 'A few things about how we meet.' : 'Your sign-in, and this device.'}</p>
        </div>
      </div>
      {isLeader && <GroupCard />}
      <div className={s.columns}>
        <div className={s.main}>
          <YouCard />
        </div>
        <div className={s.aside}>
          <DeviceCard />
        </div>
      </div>
    </div>
  );
}
