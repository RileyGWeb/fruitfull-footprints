'use client';

import { useId, useState, type FormEvent } from 'react';
import { ApiError, fieldErrors } from '@/lib/api';
import { useActions } from '@/lib/actions';
import type { PasswordInput } from '@/lib/types';
import { Field, FormError, describe } from './Field';
import {
  EMPTY_PASSWORD, MIN_PASSWORD, PASSWORD_FIELDS, firstError, passwordServerErrors, validatePassword,
  type FormErrors, type PasswordField,
} from './form';
import s from './settings.module.css';

const FIELDS: [PasswordField, string, 'current-password' | 'new-password', string?][] = [
  ['current_password', 'Current password', 'current-password'],
  ['password', 'New password', 'new-password', `At least ${MIN_PASSWORD} characters.`],
  ['password_confirmation', 'New password again', 'new-password'],
];

/** The one shared group password → PUT /api/settings/password. This device stays unlocked. */
export function PasswordCard() {
  const actions = useActions();
  const id = useId();
  const fid = (k: PasswordField) => `${id}-${k}`;
  const [form, setForm] = useState<PasswordInput>(EMPTY_PASSWORD);
  const [errors, setErrors] = useState<FormErrors<PasswordField>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: PasswordField, v: string) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  const showErrors = (e: FormErrors<PasswordField>) => {
    setErrors(e);
    const first = firstError(PASSWORD_FIELDS, e);
    if (first) document.getElementById(fid(first))?.focus();
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    const invalid = validatePassword(form);
    if (Object.keys(invalid).length) return showErrors(invalid);
    setBusy(true);
    try {
      await actions.changePassword(form);
      setForm(EMPTY_PASSWORD);
      setErrors({});
    } catch (e) {
      // A 422 naming fields isn't toasted — it shows here, under its field. Other failures were toasted.
      if (e instanceof ApiError && fieldErrors(e)) showErrors(passwordServerErrors(e.errors));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={s.card} onSubmit={submit} noValidate aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className={s.cardTitle}>Change password</h2>
      <p className={s.intro}>
        We all share one. Changing it locks every other phone and computer until they type the new one{'\u00a0'}— so pass it along.
      </p>
      <div className={s.pair}>
        {FIELDS.map(([k, label, autoComplete, hint]) => (
          <Field key={k} id={fid(k)} label={label} error={errors[k]} hint={hint}>
            <input
              {...describe(fid(k), errors[k], hint)}
              className={`input ${s.control}`}
              type="password"
              autoComplete={autoComplete}
              value={form[k]}
              onChange={e => set(k, e.target.value)}
            />
          </Field>
        ))}
      </div>
      <FormError text={errors.other} />
      <div className={s.actions}>
        {/* aria-disabled, not disabled: the button keeps keyboard focus while it saves. */}
        <button type="submit" className={`btn btn-primary ${s.submit}`} aria-disabled={busy || undefined}>Change password</button>
      </div>
    </form>
  );
}
