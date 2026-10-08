'use client';

import { Icon } from '@/components/ui/Icon';
import { useOnline } from '@/lib/hooks';
import s from './OfflineBanner.module.css';

/** Shown under the header while the device is offline. Write buttons stay enabled; failures toast. */
export function OfflineBanner() {
  if (useOnline()) return null;
  return (
    <div className={s.wrap} role="status">
      <div className={s.banner}>
        <Icon name="offline" />
        <span>You’re offline — showing what was saved. Changes need a connection.</span>
      </div>
    </div>
  );
}
