'use client';

import { useDocumentTitle } from '@/lib/title';
import { DeviceCard } from './DeviceCard';
import { GroupCard } from './GroupCard';
import { PasswordCard } from './PasswordCard';
import s from './settings.module.css';

/** /settings (gap-fill, SPEC §6): the group's details, the shared password, and this device. */
export function SettingsScreen() {
  useDocumentTitle('Settings');
  return (
    <div className={s.page}>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Settings</h1>
          <p className={s.subtitle}>A few things about how we meet.</p>
        </div>
      </div>
      <GroupCard />
      <div className={s.columns}>
        <div className={s.main}>
          <PasswordCard />
        </div>
        <div className={s.aside}>
          <DeviceCard />
        </div>
      </div>
    </div>
  );
}
