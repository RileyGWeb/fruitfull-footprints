'use client';

import { Share, SquarePlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import { isInAppBrowser, promptInstall, useInstallState, type InstallState } from '@/components/settings/install';
import { DEFAULT_GROUP } from '@/lib/hooks';
import e from './Entrance.module.css';
import s from './InstallGate.module.css';

const OPEN = 'Open Footprints from your home screen';

/**
 * What a phone or tablet shows in its browser: the one way forward is to put the app on the home screen
 * and open it from there, which is where signing in happens. (The installed app, and computers, never
 * see this: components/shell/AppShell.tsx.)
 */
export function InstallGate() {
  const state = useInstallState();
  // Read once on the client: the user agent doesn't change, and this only renders after hydration.
  const [inApp] = useState(() => typeof navigator !== 'undefined' && isInAppBrowser());

  return (
    <main className={e.wrap}>
      <div className={e.sun} />
      <div className={e.moon} />
      <div className={e.trail} aria-hidden>
        <Icon name="feet" />
        <Icon name="feet" />
        <Icon name="feet" />
      </div>
      <section className={e.card} aria-labelledby="install-title">
        <div className={e.stripe} />
        <div className={e.mark}><Icon name="feetLg" /></div>
        <div className={e.kicker}>Keep it on your phone</div>
        <h1 id="install-title" className={e.title}>{DEFAULT_GROUP.group_name}</h1>
        <p className={`${e.tagline} ${s.lead}`}>
          This is an app, not a website. Add it to your home screen, then open it from there and sign in with your password.
        </p>
        {inApp ? <InAppNotice /> : <Way state={state} />}
        <p className={e.motto}>Growing together, one step at a time.</p>
      </section>
    </main>
  );
}

function Way({ state }: { state: InstallState }) {
  switch (state) {
    case 'installed':
      return (
        <p className={s.done} role="status">
          <span className={s.doneIcon}><Icon name="leafSm" /></span>
          <span>It’s on your phone now. {OPEN} to sign in.</span>
        </p>
      );
    case 'prompt':
      return <InstallButton />;
    case 'ios':
      return (
        <Steps>
          <Step>Tap <Share className={s.glyph} size={18} strokeWidth={2.75} aria-hidden /><strong>Share</strong> in the toolbar, or under <strong>•••</strong></Step>
          <Step>Choose <SquarePlus className={s.glyph} size={18} strokeWidth={2.75} aria-hidden /><strong>Add to Home Screen</strong>, then <strong>Add</strong></Step>
          <Step>{OPEN} to sign in</Step>
        </Steps>
      );
    default:
      return (
        <Steps>
          <Step>Open your browser’s menu, usually <strong>⋮</strong> or <strong>•••</strong></Step>
          <Step>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong></Step>
          <Step>{OPEN} to sign in</Step>
        </Steps>
      );
  }
}

/** Chromium has the install sheet ready: one button. */
function InstallButton() {
  const [busy, setBusy] = useState(false);
  const install = async () => {
    if (busy) return;
    setBusy(true);
    await promptInstall();
    setBusy(false);
  };
  return (
    <button type="button" className={`btn btn-primary btn-block ${e.open} ${s.install}`} onClick={install} aria-disabled={busy || undefined}>
      Install the app
    </button>
  );
}

function InAppNotice() {
  return (
    <p className={s.notice} role="status">
      You’re in another app’s browser, which can’t add this to your home screen. Open this page in Safari or Chrome first,
      and the steps will show up here.
    </p>
  );
}

const Steps = ({ children }: { children: ReactNode }) => <ol className={s.steps}>{children}</ol>;

/** Numbered by the list, drawn as the circles of Settings' install steps. */
function Step({ children }: { children: ReactNode }) {
  return (
    <li className={s.step}>
      <span className={s.num} aria-hidden />
      <span>{children}</span>
    </li>
  );
}
