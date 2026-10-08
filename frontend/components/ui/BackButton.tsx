import Link from 'next/link';
import type { CSSProperties } from 'react';
import { Icon } from './Icon';
import s from './BackButton.module.css';

type Props = { href: string; label: string; className?: string; style?: CSSProperties };

/** “← Everyone” / “← Studies”: a ghost button link. Add `margin-right:auto` via className when it shares a row. */
export function BackButton({ href, label, className, style }: Props) {
  return (
    <Link href={href} className={`btn btn-ghost ${s.back} ${className ?? ''}`} style={style}>
      <Icon name="back" /> {label}
    </Link>
  );
}
