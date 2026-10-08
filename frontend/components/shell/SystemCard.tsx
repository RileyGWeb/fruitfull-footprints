import type { ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import s from './SystemCard.module.css';

type Props = { kicker: string; title: string; body: ReactNode; children?: ReactNode };

/**
 * A whole-page notice in the /offline page's style, for when the app itself can't be shown: the
 * group can't be reached, or the app hit an error. `children` are the actions — use the classes on
 * SystemCard.styles (`primary` for a btn-primary, `secondary` for a btn-ghost).
 */
export function SystemCard({ kicker, title, body, children }: Props) {
  return (
    <main className={s.wrap}>
      <div className={s.sun} />
      <div className={s.card}>
        <span className={s.mark}><Icon name="feetLg" /></span>
        <div className={s.kicker}>{kicker}</div>
        <h1 className={s.title}>{title}</h1>
        <p className={s.body}>{body}</p>
        {children && <div className={s.actions}>{children}</div>}
      </div>
    </main>
  );
}

SystemCard.styles = s;
