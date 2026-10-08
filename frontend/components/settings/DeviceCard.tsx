'use client';

import { Download, Share, SquarePlus } from 'lucide-react';
import { useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLock } from '@/lib/hooks';
import { promptInstall, useInstallState } from './install';
import s from './settings.module.css';

/** Install helper + “Lock this device” (the header's Lock, with words around it). */
export function DeviceCard() {
  return (
    <section className={s.card} aria-labelledby="settings-device">
      <h2 id="settings-device" className={s.cardTitle}>On this device</h2>
      <InstallRow />
      <LockRow />
    </section>
  );
}

const OPENS = 'it opens like any other app, and what you last looked at stays readable offline.';

function InstallRow() {
  const state = useInstallState();
  const [busy, setBusy] = useState(false);
  if (state === 'unknown' || state === 'standalone') return null;

  const install = async () => {
    if (busy) return;
    setBusy(true);
    await promptInstall();
    setBusy(false);
  };

  return (
    <div className={s.row}>
      <div className={s.label}>Install the app</div>
      {state === 'installed' && <p className={s.text}>Installed. You’ll find it with your other apps.</p>}
      {state === 'prompt' && (
        <>
          <p className={s.text}>Install it and {OPENS}</p>
          <button type="button" className={`btn btn-secondary ${s.rowAction}`} onClick={install} aria-disabled={busy || undefined}>
            <Download size={15} strokeWidth={2.75} aria-hidden /> Install
          </button>
        </>
      )}
      {state === 'ios' && (
        <>
          <p className={s.text}>Add it to your home screen and {OPENS}</p>
          <ol className={s.steps}>
            <li className={s.step}>
              <span className={s.num} aria-hidden>1</span>
              <span>Tap <Share className={s.glyph} size={17} strokeWidth={2.75} aria-hidden /><strong>Share</strong> in the toolbar, or under <strong>•••</strong></span>
            </li>
            <li className={s.step}>
              <span className={s.num} aria-hidden>2</span>
              <span>Choose <SquarePlus className={s.glyph} size={17} strokeWidth={2.75} aria-hidden /><strong>Add to Home Screen</strong></span>
            </li>
          </ol>
        </>
      )}
      {state === 'manual' && (
        <p className={s.text}>
          Install it and {OPENS} Look in your browser’s menu for <strong>Install</strong>, <strong>Add to Home Screen</strong> or <strong>Add to Dock</strong>.
        </p>
      )}
    </div>
  );
}

function LockRow() {
  // The header's Lock: locks this device straight away (even offline) and goes Home, behind the Entrance.
  const lock = useLock();

  return (
    <div className={s.row}>
      <div className={s.label}>Lock</div>
      <p className={s.text}>On a shared or borrowed phone? Lock it, and the group password is needed to open it again.</p>
      <button type="button" className={`btn btn-secondary ${s.rowAction}`} onClick={() => void lock()}>
        <Icon name="lock" /> Lock this device
      </button>
    </div>
  );
}
