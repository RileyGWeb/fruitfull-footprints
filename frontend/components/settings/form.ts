// Pure form logic for the Settings screen (no React), so it can be unit-tested with `npm test`.
import type { PasswordInput, Settings } from '@/lib/types';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

/** A form's errors: one per field, plus `other` for a server message about a field the form doesn't show. */
export type FormErrors<K extends string> = FieldErrors<K | 'other'>;

/** The first message of every 422 field that isn't one of `shown`, joined (so none is swallowed). */
function otherErrors(errors: Record<string, string[]> | undefined, shown: readonly string[]): string | undefined {
  const rest = Object.entries(errors ?? {}).filter(([k, m]) => !shown.includes(k) && m?.[0]).map(([, m]) => m[0]);
  return rest.length ? rest.join(' ') : undefined;
}

// ── group settings ──────────────────────────────────────────────────────────

/** What the inputs hold: everything as typed, the year as text. */
export type SettingsForm = Omit<Settings, 'since_year'> & { since_year: string };
export type SettingsField = keyof SettingsForm;

/** Field order on screen — validation focuses the first field in this order that has a problem. */
export const SETTINGS_FIELDS: SettingsField[] = ['group_name', 'tagline', 'meeting_day', 'meeting_time', 'meeting_place', 'since_year'];

export const toForm = (s: Settings): SettingsForm => ({ ...s, since_year: String(s.since_year) });

export function validateSettings(f: SettingsForm): FieldErrors<SettingsField> {
  const e: FieldErrors<SettingsField> = {};
  if (!f.group_name.trim()) e.group_name = 'The group needs a name.';
  if (!f.meeting_day) e.meeting_day = 'Pick the day you usually meet.';
  if (!f.meeting_time.trim()) e.meeting_time = 'Add a time, like 7pm.';
  if (!f.meeting_place.trim()) e.meeting_place = 'Add where you usually meet.';
  const y = f.since_year.trim();
  if (!/^\d{4}$/.test(y) || Number(y) < 1900 || Number(y) > 2100) e.since_year = 'Add the year you started, like 2023.';
  return e;
}

/** The form as the API wants it: trimmed text, the year as a number. Assumes it validated. */
export function fromForm(f: SettingsForm): Settings {
  return {
    group_name: f.group_name.trim(),
    tagline: f.tagline.trim(),
    meeting_day: f.meeting_day,
    meeting_time: f.meeting_time.trim(),
    meeting_place: f.meeting_place.trim(),
    since_year: Number(f.since_year.trim()),
  };
}

/** Only the settings that changed, so saving never overwrites someone else’s edit to another field. */
export function settingsPatch(f: SettingsForm, base: Settings): Partial<Settings> {
  const next = fromForm(f);
  const patch: Partial<Record<keyof Settings, string | number>> = {};
  for (const k of Object.keys(next) as (keyof Settings)[]) if (next[k] !== base[k]) patch[k] = next[k];
  return patch as Partial<Settings>;
}

export const sameForm = (a: SettingsForm, b: SettingsForm) => SETTINGS_FIELDS.every(k => a[k] === b[k]);

/** Whether Save has anything to send: the form differs from the saved settings once trimmed. */
export const hasChanges = (f: SettingsForm, base: Settings) => Object.keys(settingsPatch(f, base)).length > 0;

/** A 422's `errors` mapped onto the form's fields (first message each); anything else goes in `other`. */
export function settingsServerErrors(errors?: Record<string, string[]>): FormErrors<SettingsField> {
  const e: FormErrors<SettingsField> = {};
  for (const k of SETTINGS_FIELDS) if (errors?.[k]?.[0]) e[k] = errors[k][0];
  const other = otherErrors(errors, SETTINGS_FIELDS);
  if (other) e.other = other;
  return e;
}

// ── password ────────────────────────────────────────────────────────────────

export type PasswordField = keyof PasswordInput;
export const PASSWORD_FIELDS: PasswordField[] = ['current_password', 'password', 'password_confirmation'];
export const EMPTY_PASSWORD: PasswordInput = { current_password: '', password: '', password_confirmation: '' };
export const MIN_PASSWORD = 6;

const TOO_SHORT = `At least ${MIN_PASSWORD} characters, please.`;
const MISMATCH = 'These two don’t match yet.';

export function validatePassword(f: PasswordInput): FieldErrors<PasswordField> {
  const e: FieldErrors<PasswordField> = {};
  if (!f.current_password) e.current_password = 'Type the password you use now.';
  if (!f.password) e.password = 'Choose a new password.';
  else if (f.password.length < MIN_PASSWORD) e.password = TOO_SHORT;
  else if (f.password_confirmation !== f.password) e.password_confirmation = MISMATCH;
  return e;
}

/**
 * A 422 from PUT /api/settings/password mapped onto the fields. `current_password` already reads
 * well (“That isn’t the current password.”); Laravel's stock min/confirmed lines get our wording,
 * a confirmation mismatch shows under the confirm field, and anything else goes in `other`.
 */
export function passwordServerErrors(errors?: Record<string, string[]>): FormErrors<PasswordField> {
  const e: FormErrors<PasswordField> = {};
  const current = errors?.current_password?.[0];
  if (current) e.current_password = current;
  for (const m of errors?.password ?? []) {
    if (/confirm/i.test(m)) e.password_confirmation ??= MISMATCH;
    else e.password ??= /least|min/i.test(m) ? TOO_SHORT : m;
  }
  const confirm = errors?.password_confirmation?.[0];
  if (confirm) e.password_confirmation ??= confirm;
  const other = otherErrors(errors, PASSWORD_FIELDS);
  if (other) e.other = other;
  return e;
}

/** The first field (in on-screen order) that has an error, to move focus there. */
export const firstError = <K extends string>(order: K[], errors: FieldErrors<K>): K | undefined => order.find(k => errors[k]);
