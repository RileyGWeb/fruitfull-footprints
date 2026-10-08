'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { NAV, activeNav } from './nav';
import s from './Shell.module.css';

/** Mobile (< 760px) sticky bottom tab bar. */
export function TabBar() {
  const active = activeNav(usePathname());
  return (
    <nav className={s.tabs} aria-label="Main">
      {NAV.map(n => (
        <Link key={n.key} href={n.href} className={`unstyled ${s.tab} ${active === n.key ? s.on : ''}`} aria-current={active === n.key ? 'page' : undefined}>
          <span className={s.pill}><Icon name={n.icon} /></span>
          <span className={s.tabLabel}>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}
