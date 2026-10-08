'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { ApiError, errorMessage } from '@/lib/api';
import type { GroupInfo } from '@/lib/types';
import s from './Entrance.module.css';

type Props = {
  group: GroupInfo;
  onUnlock: (password: string) => Promise<void>;
  /** Shown over the app after this device was locked from elsewhere: says why, and that nothing was lost. */
  lockedOut?: boolean;
};

/** Prototype screen 01: the shared-password gate. */
export function Entrance({ group, onUnlock, lockedOut }: Props) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const title = useRef<HTMLHeadingElement>(null);

  // Appearing over the app: take focus (the field on a keyboard device; the heading on touch, so no
  // keyboard pops up), since what had it is now hidden.
  useEffect(() => {
    if (!lockedOut) return;
    const fine = window.matchMedia('(pointer: fine)').matches;
    (fine ? input.current : title.current)?.focus({ preventScroll: true });
  }, [lockedOut]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!pw.trim()) return setErr('Try that once more.');
    setBusy(true);
    try {
      await onUnlock(pw);
    } catch (ex) {
      setErr(ex instanceof ApiError && ex.status === 422 ? 'Try that once more.' : errorMessage(ex));
    } finally {
      setBusy(false);
    }
  };

  const describedBy = [lockedOut ? 'ff-pw-why' : '', err ? 'ff-pw-err' : ''].filter(Boolean).join(' ') || undefined;

  return (
    <main className={s.wrap}>
      <div className={s.sun} />
      <div className={s.moon} />
      <div className={s.trail} aria-hidden>
        <Icon name="feet" />
        <Icon name="feet" />
        <Icon name="feet" />
      </div>
      <form className={s.card} onSubmit={submit}>
        <div className={s.stripe} />
        <div className={s.mark}><Icon name="feetLg" /></div>
        <div className={s.kicker}>{group.meeting_day} nights · since {group.since_year}</div>
        <h1 ref={title} tabIndex={-1} className={s.title}>{group.group_name}</h1>
        <p className={s.tagline}>{group.tagline}</p>
        {lockedOut && (
          <p id="ff-pw-why" className={s.why} role="status">
            This device was locked — the group password may have changed. Anything you were in the middle of is still here.
          </p>
        )}
        <div className="field">
          <label htmlFor="ff-pw">Group password</label>
          <input
            ref={input}
            id="ff-pw"
            className={`input ${s.input}`}
            type="password"
            autoComplete="current-password"
            placeholder="Shared password"
            value={pw}
            onChange={e => { setPw(e.target.value); setErr(null); }}
            aria-invalid={err ? true : undefined}
            aria-describedby={describedBy}
          />
        </div>
        {err && <div id="ff-pw-err" role="alert" className={s.error}>{err}</div>}
        <button type="submit" className={`btn btn-primary btn-block ${s.open}`} aria-disabled={busy || undefined}>Open</button>
        <p className={s.motto}>Growing together, one step at a time.</p>
      </form>
    </main>
  );
}
