'use client';

import { Check, Copy, Ellipsis, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  isInAppBrowser, isIPad, isSafariOnIOS, promptInstall, useInstallState, type InstallState,
} from '@/components/settings/install';
import { DEFAULT_GROUP } from '@/lib/hooks';
import e from './Entrance.module.css';
import s from './InstallGate.module.css';

/** What this browser is, read once: the user agent doesn't change. (This only renders after hydration.) */
type Where = { inApp: boolean; safari: boolean; ipad: boolean };

/**
 * What a phone or tablet shows in its browser: the one way forward is to put the app on the home screen
 * and open it from there, which is where signing in happens. (The installed app, and computers, never
 * see this: components/shell/AppShell.tsx.)
 *
 * Every step shows what to tap, drawn the way it looks on the phone, because the words alone ("the Share
 * button, under •••") don't help someone who has never added anything to a home screen.
 */
export function InstallGate() {
  const state = useInstallState();
  const [where] = useState<Where>(() => (
    typeof navigator === 'undefined' ? { inApp: false, safari: false, ipad: false } : { inApp: isInAppBrowser(), safari: isSafariOnIOS(), ipad: isIPad() }
  ));
  const ios = state === 'ios';
  // Safari is the one browser whose steps are known: any other on an iPhone, or a browser inside another app, is sent there.
  const elsewhere = where.inApp || (ios && !where.safari);
  const steps = !elsewhere && state !== 'installed' && state !== 'prompt';

  return (
    <main className={e.wrap}>
      <div className={e.sun} />
      <div className={e.moon} />
      <div className={e.trail} aria-hidden>
        <Icon name="feet" />
        <Icon name="feet" />
        <Icon name="feet" />
      </div>
      <section className={`${e.card} ${s.install}`} aria-labelledby="install-title">
        <div className={e.stripe} />
        <div className={e.mark}><Icon name="feetLg" /></div>
        <div className={e.kicker}>Keep it on your phone</div>
        <h1 id="install-title" className={e.title}>{DEFAULT_GROUP.group_name}</h1>
        <p className={`${e.tagline} ${s.lead}`}>
          Add Footprints to your home screen, like any other app. It takes about a minute, and you only do it once.
        </p>
        <Way state={state} where={where} elsewhere={elsewhere} />
        <p className={e.help}>No password yet? Ask a leader in your group.</p>
        {steps && <Trouble safari={ios} />}
        <p className={e.motto}>Growing together, one step at a time.</p>
      </section>
    </main>
  );
}

function Way({ state, where, elsewhere }: { state: InstallState; where: Where; elsewhere: boolean }) {
  if (state === 'installed') return <Done />;
  if (elsewhere) return <OpenElsewhere browser={state === 'ios' ? 'Safari' : 'Chrome'} inApp={where.inApp} />;
  if (state === 'prompt') return <InstallButton />;
  return state === 'ios' ? <SafariSteps ipad={where.ipad} /> : <MenuSteps />;
}

/** iPhone and iPad Safari, as of iOS 26 (and the versions before it, which put the same buttons in the same places). */
function SafariSteps({ ipad }: { ipad: boolean }) {
  return (
    <Steps>
      <Step
        title={<>Tap the <strong>Share</strong> button</>}
        show={<Chip><Share size={26} strokeWidth={2.4} /></Chip>}
      >
        {ipad
          ? 'The square with an arrow pointing up, near the top of Safari.'
          : <>The square with an arrow pointing up, in the bar at the bottom of Safari. Can’t see it? Tap the <strong>More</strong> button (three dots, <Ellipsis className={s.inline} size={16} strokeWidth={2.75} aria-hidden />) first.</>}
      </Step>
      <Step
        title={<>Scroll down and tap <strong>Add to Home Screen</strong></>}
        show={<Chip shape="row"><span>Add to Home Screen</span><SquarePlus size={24} strokeWidth={2.4} /></Chip>}
      >
        Swipe up on the menu that opens until you see it.
      </Step>
      <Step title={<>Tap <strong>Add</strong></>} show={<Chip shape="pill">Add</Chip>}>
        It’s in the top corner. If you see an “Open as Web App” switch, leave it on.
      </Step>
      <Step title={<>Open <strong>Footprints</strong> from your home screen</>} show={<AppIcon />}>
        Close Safari and tap this icon. That’s where you’ll sign in.
      </Step>
    </Steps>
  );
}

/** Chrome and friends on Android, and anything else that hasn't offered an install button. */
function MenuSteps() {
  return (
    <Steps>
      <Step
        title={<>Open your browser’s <strong>menu</strong></>}
        show={<Chip><EllipsisVertical size={26} strokeWidth={2.4} /></Chip>}
      >
        Usually three dots, at the top or bottom right.
      </Step>
      <Step
        title={<>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong></>}
        show={<Chip shape="row"><span>Install app</span></Chip>}
      >
        It can take a moment to show up.
      </Step>
      <Step title={<>Open <strong>Footprints</strong> from your home screen</>} show={<AppIcon />}>
        Tap this icon. That’s where you’ll sign in.
      </Step>
    </Steps>
  );
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
    <>
      <button type="button" className={`btn btn-primary btn-block ${e.open} ${s.button}`} onClick={install} aria-disabled={busy || undefined}>
        Install the app
      </button>
      <p className={s.after}>Your phone asks once more. Then open Footprints from your home screen to sign in.</p>
    </>
  );
}

function Done() {
  return (
    <div className={s.done} role="status">
      <span className={s.doneText}>
        <Icon name="leafSm" />
        <span>It’s on your phone now. Open Footprints from your home screen to sign in.</span>
      </span>
      <AppIcon />
    </div>
  );
}

/** A browser that can't add the app (another app's, or on an iPhone anything but Safari): copy the link and open the right one. */
function OpenElsewhere({ browser, inApp }: { browser: 'Safari' | 'Chrome'; inApp: boolean }) {
  const [copied, setCopied] = useState<boolean | null>(null);
  const copy = async () => setCopied(await copyLink());
  return (
    <div className={s.elsewhere}>
      <p className={s.notice}>
        {inApp ? 'You’re in another app’s browser, which can’t add this to your home screen. ' : `Adding this to your home screen works from ${browser}. `}
        Copy the link, open {browser}, and paste it into the address bar. The steps will show up there.
      </p>
      <button type="button" className={`btn btn-primary btn-block ${e.open} ${s.button}`} onClick={() => void copy()}>
        {copied ? <><Check size={18} strokeWidth={2.75} aria-hidden /> Link copied</> : <><Copy size={18} strokeWidth={2.75} aria-hidden /> Copy link</>}
      </button>
      <p className={s.after} role="status">
        {copied === true && `Now open ${browser} and paste it in.`}
        {copied === false && `Couldn’t copy it. In ${browser}, type ${window.location.host}`}
      </p>
    </div>
  );
}

/** The short answers to what goes wrong, for whoever is stuck. Closed until asked for, so the steps stay in view. */
function Trouble({ safari }: { safari: boolean }) {
  return (
    <details className={s.trouble}>
      <summary className={s.troubleTitle}>Something not right?</summary>
      <div className={s.troubleBody}>
        {safari ? (
          <>
            <p><strong>I can’t find Add to Home Screen.</strong> Make sure you’re in Safari, the blue compass app. In the Share menu, keep swiping up to see the rest of the list.</p>
            <p><strong>It opened in Safari, not full screen.</strong> Touch and hold the icon, remove it, and add it again. This time leave “Open as Web App” switched on.</p>
          </>
        ) : (
          <p><strong>I can’t find Install app.</strong> Try Chrome. Some browsers don’t offer it.</p>
        )}
        <p><strong>This page is still here after I added it.</strong> That’s normal. The page can’t sign you in; the icon on your home screen can.</p>
      </div>
    </details>
  );
}

async function copyLink(): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(window.location.href);
    return true;
  } catch {
    return false;
  }
}

const Steps = ({ children }: { children: ReactNode }) => <ol className={s.steps}>{children}</ol>;

/** A numbered step: what to do, what it looks like on the phone, and one line more. */
function Step({ title, show, children }: { title: ReactNode; show: ReactNode; children: ReactNode }) {
  return (
    <li className={s.step}>
      <span className={s.num} aria-hidden />
      <p className={s.stepTitle}>{title}</p>
      <div className={s.show}>
        {show}
        <p className={s.help}>{children}</p>
      </div>
    </li>
  );
}

/** A drawing of the thing to tap, as it looks on the phone. The words beside it say the same, so it's hidden from screen readers. */
function Chip({ children, shape }: { children: ReactNode; shape?: 'row' | 'pill' }) {
  return <span className={`${s.chip} ${shape === 'row' ? s.chipRow : ''} ${shape === 'pill' ? s.chipPill : ''}`} aria-hidden>{children}</span>;
}

/** The icon the home screen gets (the apple-touch-icon), so there's something to look for there. */
function AppIcon() {
  return (
    <span className={s.appIcon} aria-hidden>
      <span className={s.appImage} style={{ backgroundImage: 'url(/icons/apple-touch-icon.png)' }} />
      <span className={s.appName}>Footprints</span>
    </span>
  );
}
