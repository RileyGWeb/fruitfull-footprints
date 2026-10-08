'use client';

import { useId, useState, type FormEvent } from 'react';
import { ScreenState } from '@/components/ui/ScreenState';
import { ApiError, fieldErrors } from '@/lib/api';
import { useActions } from '@/lib/actions';
import { WEEKDAYS } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import type { Settings } from '@/lib/types';
import { Field, FormError, describe } from './Field';
import {
  SETTINGS_FIELDS, firstError, hasChanges, sameForm, settingsPatch, settingsServerErrors, toForm, validateSettings,
  type FormErrors, type SettingsField,
} from './form';
import s from './settings.module.css';

const TITLE = 'About the group';
const INTRO = 'Shown at the front door and around the app, for everyone.';

/** The group's settings (name, tagline, when and where we meet) → PATCH /api/settings. */
export function GroupCard() {
  const { data, error, mutate } = useSnapshot();
  if (data) return <GroupForm settings={data.settings} />;
  const failed = !!error && error.status !== 401; // a 401 keeps the skeleton: the Entrance is taking over
  return (
    <section className={s.card} aria-busy={!failed || undefined} aria-labelledby="settings-group">
      <h2 id="settings-group" className={s.cardTitle}>{TITLE}</h2>
      <ScreenState error={error} what="The group’s details" onRetry={() => void mutate()} loading={<GroupSkeleton />} level={3} />
    </section>
  );
}

function GroupSkeleton() {
  return (
    <>
      <p className={s.intro}>{INTRO}</p>
      <div className={s.fields} aria-hidden>
        {[true, true, false, false, false, false].map((half, i) => (
          <div key={i} className={half ? s.half : undefined}>
            <div className={s.ghostLabel} />
            <div className={s.ghostInput} />
          </div>
        ))}
      </div>
      <div className={s.actions} aria-hidden>
        <div className={s.ghostButton} />
      </div>
    </>
  );
}

function GroupForm({ settings }: { settings: Settings }) {
  const actions = useActions();
  const id = useId();
  const fid = (k: SettingsField) => `${id}-${k}`;
  // `base` = the saved values this form started from; the patch is only what differs from it.
  const [base, setBase] = useState(settings);
  const [form, setForm] = useState(() => toForm(settings));
  const [errors, setErrors] = useState<FormErrors<SettingsField>>({});
  const [busy, setBusy] = useState(false);
  const dirty = hasChanges(form, base);

  // Someone saved new settings elsewhere: follow along, unless there are unsaved edits here.
  const [seen, setSeen] = useState(settings);
  if (settings !== seen) {
    setSeen(settings);
    if (sameForm(form, toForm(base))) {
      setBase(settings);
      setForm(toForm(settings));
    }
  }

  const set = (k: SettingsField, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const showErrors = (e: FormErrors<SettingsField>) => {
    setErrors(e);
    const first = firstError(SETTINGS_FIELDS, e);
    if (first) document.getElementById(fid(first))?.focus();
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy || !dirty) return; // nothing to save: no empty PATCH
    const invalid = validateSettings(form);
    if (Object.keys(invalid).length) return showErrors(invalid);
    const sent = form;
    setBusy(true);
    try {
      const saved = await actions.updateSettings(settingsPatch(form, base));
      setBase(saved);
      // Typed more while it saved? Keep that (it's still unsaved); otherwise show what was saved.
      setForm(f => (sameForm(f, sent) ? toForm(saved) : f));
      setErrors({});
    } catch (e) {
      // A 422 naming fields isn't toasted — it shows here, under its field. Other failures were toasted.
      if (e instanceof ApiError && fieldErrors(e)) showErrors(settingsServerErrors(e.errors));
    } finally {
      setBusy(false);
    }
  };

  const input = (k: Exclude<SettingsField, 'meeting_day'>, label: string, props: { placeholder: string; maxLength?: number; half?: boolean; inputMode?: 'numeric'; hint?: string }) => (
    <Field id={fid(k)} label={label} error={errors[k]} hint={props.hint} half={props.half}>
      <input
        {...describe(fid(k), errors[k], props.hint)}
        className={`input ${s.control}`}
        value={form[k]}
        onChange={e => set(k, e.target.value)}
        placeholder={props.placeholder}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
        autoComplete="off"
      />
    </Field>
  );

  return (
    <form className={s.card} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.cardTitle}>{TITLE}</h2>
      <p className={s.intro}>{INTRO}</p>
      <div className={s.fields}>
        {input('group_name', 'Group name', { placeholder: 'Fruitfull Footprints', maxLength: 120, half: true })}
        {input('tagline', 'Tagline', { placeholder: 'A private home for our small group.', maxLength: 280, half: true })}
        <Field id={fid('meeting_day')} label="Meeting day" error={errors.meeting_day}>
          <select
            {...describe(fid('meeting_day'), errors.meeting_day)}
            className={`input ${s.control}`}
            value={form.meeting_day}
            onChange={e => set('meeting_day', e.target.value)}
          >
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </Field>
        {input('meeting_time', 'Meeting time', { placeholder: '7pm', maxLength: 40 })}
        {input('meeting_place', 'Usual place', { placeholder: 'Rachel’s porch', maxLength: 160 })}
        {input('since_year', 'Meeting since', { placeholder: '2023', inputMode: 'numeric' })}
      </div>
      <FormError text={errors.other} />
      <div className={s.actions}>
        {/* aria-disabled, not disabled: after a save the button keeps keyboard focus. */}
        <button
          type="submit"
          className={`btn btn-primary ${s.submit} ${dirty || busy ? '' : s.unchanged}`}
          aria-disabled={busy || !dirty || undefined}
        >
          Save
        </button>
      </div>
    </form>
  );
}
