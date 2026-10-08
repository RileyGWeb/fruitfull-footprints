import Link from 'next/link';
import type { CSSProperties } from 'react';
import s from './Seg.module.css';

export type SegOption = { label: string; href: string; active: boolean };

type Props = {
  options: SegOption[];
  /** Names the tabs for screen readers (“People views”, “Prayer views”). */
  label?: string;
  /** Horizontal padding of each option: 16 (People) or 18 (Prayer). */
  padX?: number;
  className?: string;
  style?: CSSProperties;
};

/** The prototype's segmented tabs, as links between sibling routes. */
export function Seg({ options, label = 'Views', padX = 16, className, style }: Props) {
  return (
    <nav className={`seg ${s.seg} ${className ?? ''}`} style={style} aria-label={label}>
      {options.map(o => (
        <Link
          key={o.href}
          href={o.href}
          replace
          scroll={false}
          aria-current={o.active ? 'page' : undefined}
          className={`unstyled ${s.opt} ${o.active ? s.active : ''}`}
          style={{ paddingInline: padX }}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}
