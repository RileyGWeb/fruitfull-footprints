'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { NAV, activeNav } from './nav';
import s from './Shell.module.css';

type Props = { groupName: string; onLock: () => void };

/** Desktop (≥ 760px) header: brand, the four sections, Settings (gap-fill) and Lock. */
export function TopNav({ groupName, onLock }: Props) {
  const path = usePathname();
  const active = activeNav(path);
  const onSettings = path?.startsWith('/settings');
  return (
    <header className={s.topBar}>
      <nav className={s.top} aria-label="Main">
        <Link href="/" className={`unstyled ${s.brand}`}>
          <span className={s.mark}><Icon name="feet" /></span>
          <span className={s.brandName}>{groupName}</span>
        </Link>
        {NAV.map(n => (
          <Link key={n.key} href={n.href} className={`unstyled ${s.item} ${active === n.key ? s.on : ''}`} aria-current={active === n.key ? 'page' : undefined}>
            {n.label}
          </Link>
        ))}
        <Link href="/settings" title="Settings" aria-label="Settings" aria-current={onSettings ? 'page' : undefined}
          className={`btn btn-icon btn-secondary ${s.topAction} ${s.gear} ${onSettings ? s.on : ''}`}>
          <Icon name="settings" />
        </Link>
        <button type="button" title="Lock" aria-label="Lock" onClick={onLock} className={`btn btn-icon btn-secondary ${s.topAction}`}>
          <Icon name="lock" />
        </button>
      </nav>
    </header>
  );
}
