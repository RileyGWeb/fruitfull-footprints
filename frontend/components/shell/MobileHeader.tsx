'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import s from './Shell.module.css';

type Props = { groupName: string; onLock: () => void };

/** Mobile (< 760px) header: mark + name, Settings (gap-fill) and Lock. */
export function MobileHeader({ groupName, onLock }: Props) {
  const onSettings = usePathname()?.startsWith('/settings');
  return (
    <header className={s.head}>
      <Link href="/" className={`unstyled ${s.headBrand}`}>
        <span className={s.mark}><Icon name="feetSm" /></span>
        <span className={s.headName}>{groupName}</span>
      </Link>
      <Link href="/settings" title="Settings" aria-label="Settings" aria-current={onSettings ? 'page' : undefined}
        className={`btn btn-icon btn-ghost ${s.headAction} ${onSettings ? s.on : ''}`}>
        <Icon name="settings" />
      </Link>
      <button type="button" title="Lock" aria-label="Lock" onClick={onLock} className={`btn btn-icon btn-ghost ${s.headAction}`}>
        <Icon name="lock" />
      </button>
    </header>
  );
}
