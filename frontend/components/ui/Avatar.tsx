import Link from 'next/link';
import type { CSSProperties } from 'react';
import { avatarStyle, initials } from '@/lib/members';
import type { Member } from '@/lib/types';
import s from './Avatar.module.css';

/** The prototype's avatar sizes → initials font size. */
const FONT: Record<number, number> = { 42: 15, 50: 17, 58: 20, 104: 36 };

type Props = {
  member: Pick<Member, 'id' | 'name' | 'tone'>;
  size?: number;
  fontSize?: number;
  /** Renders a <Link> when set, a <button> when onClick is set, else a <span>. */
  href?: string;
  onClick?: () => void;
  title?: string;
  className?: string;
  style?: CSSProperties;
};

/** Initials on a tone-tinted blob (`BLOBS[(member.id - 1) % 4]`). */
export function Avatar({ member, size = 42, fontSize, href, onClick, title, className, style }: Props) {
  const a = avatarStyle(member);
  const props = {
    className: `${s.avatar} ${href || onClick ? 'unstyled' : ''} ${className ?? ''}`,
    title,
    style: {
      width: size, height: size, borderRadius: a.blob, background: a.bg, color: a.fg,
      fontSize: fontSize ?? FONT[size] ?? Math.round(size * 0.35), cursor: href || onClick ? 'pointer' : undefined, ...style,
    },
  };
  const ini = initials(member);
  if (href) return <Link href={href} aria-label={title ?? member.name} {...props}>{ini}</Link>;
  if (onClick) return <button type="button" onClick={onClick} aria-label={title ?? member.name} {...props}>{ini}</button>;
  return <span aria-hidden {...props}>{ini}</span>;
}
