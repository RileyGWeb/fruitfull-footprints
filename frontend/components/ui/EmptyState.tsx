import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import s from './EmptyState.module.css';

type Props = {
  title: string;
  body?: ReactNode;
  icon?: IconName;
  action?: ReactNode;
  className?: string;
  /** Heading level of the title (it looks the same at any level): 1 when it's all the page has. */
  level?: 1 | 2 | 3;
};

/** The prototype's quiet empty block (“No active prayer requests”). */
export function EmptyState({ title, body, icon = 'leaf', action, className, level = 3 }: Props) {
  const Heading = `h${level}` as const;
  return (
    <div className={`${s.empty} ${className ?? ''}`}>
      <span className={s.icon}><Icon name={icon} /></span>
      <Heading className={s.title}>{title}</Heading>
      {body && <p className={s.body}>{body}</p>}
      {action && <div className={s.action}>{action}</div>}
    </div>
  );
}
