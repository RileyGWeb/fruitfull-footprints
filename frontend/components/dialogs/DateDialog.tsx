'use client';

import { useId, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import ui from '@/components/ui/Dialog.module.css';
import { radioGroup } from '@/components/ui/radioGroup';
import { useActions } from '@/lib/actions';
import { fieldErrors } from '@/lib/api';
import { toISODay, today } from '@/lib/dates';
import { KIND } from '@/lib/members';
import type { DateInput, DateKind, MemberDate } from '@/lib/types';
import { useDialogs } from './context';
import { datePatch, fieldDay, isYearless } from './dateForm';
import { FieldError, describedBy, focusFirstError, otherErrors, without, type Errors } from './FieldError';
import d from './dialogs.module.css';

const KINDS: DateKind[] = ['birthday', 'anniversary', 'event'];
const PLACEHOLDER: Record<DateKind, string> = {
  birthday: 'Birthday',
  anniversary: 'e.g. Grace & Tunde’s anniversary',
  event: 'e.g. Graduation, new job, moving day',
};

type Props = { memberId: number; date?: MemberDate; layer?: number; onDone: (d: MemberDate | null) => void };

/** Prototype screen 09: “A date to remember” (add, or edit with remove when `date` is given). */
export function DateDialog({ memberId, date, layer = 0, onDone }: Props) {
  const actions = useActions();
  const { confirm } = useDialogs();
  const id = useId();
  const ids = { label: `${id}-label`, date: `${id}-date` };
  const yearless = isYearless(date);
  const initialDay = date ? fieldDay(date, today()) : toISODay(today());
  const [kind, setKind] = useState<DateKind>(date?.kind ?? 'event');
  const [label, setLabel] = useState(date?.label ?? '');
  const [day, setDay] = useState(initialDay);
  const [repeat, setRepeat] = useState(date?.recurring ?? false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const clear = (field: string) => setErrors(e => without(e, field));

  // A date kept without a year can't become one-time on a year we made up: the field empties and asks.
  const setRepeating = (on: boolean) => {
    setRepeat(on);
    clear('recurring');
    if (!yearless) return;
    if (!on && day === initialDay) setDay('');
    if (on && !day) setDay(initialDay);
  };
  const radio = radioGroup(KINDS, kind, k => { setKind(k); clear('kind'); setRepeating(k !== 'event'); });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!day || busy) return;
    const input: DateInput = { kind, label: kind === 'birthday' ? null : label.trim() || null, date: day, recurring: repeat };
    setBusy(true);
    try {
      onDone(await (date ? actions.updateDate(date.id, datePatch(date, input, initialDay)) : actions.addDate(memberId, input)));
    } catch (ex) {
      setBusy(false);
      const fe = fieldErrors(ex);
      if (fe) {
        setErrors(fe);
        focusFirstError(fe, ids);
      }
    }
  };

  const remove = async () => {
    if (!date || busy || !(await confirm({ title: 'Remove this date?', confirmLabel: 'Remove', danger: true }))) return;
    setBusy(true);
    try {
      await actions.deleteDate(date.id);
      onDone(null);
    } catch {
      setBusy(false);
    }
  };

  const askYear = yearless && !repeat;

  return (
    <Dialog open layer={layer} onClose={() => onDone(null)} title="A date to remember">
      <form className={d.form} onSubmit={submit}>
        <div className={d.kinds} role="radiogroup" aria-label="Kind of date">
          {KINDS.map(k => (
            <button
              key={k}
              type="button"
              {...radio(k)}
              className={`unstyled ${d.kind}`}
              style={kind === k ? { background: KIND[k].bg, color: KIND[k].fg } : undefined}
            >
              {KIND[k].label}
            </button>
          ))}
        </div>
        {kind !== 'birthday' && (
          <>
            <div className="field">
              <label htmlFor={ids.label}>What is it?</label>
              <input id={ids.label} className={`input ${d.control}`} placeholder={PLACEHOLDER[kind]} value={label}
                onChange={e => { setLabel(e.target.value); clear('label'); }} maxLength={160} {...describedBy(`${ids.label}-err`, errors.label)} />
            </div>
            <FieldError id={`${ids.label}-err`} text={errors.label} />
          </>
        )}
        <div className="field">
          <label htmlFor={ids.date}>Date</label>
          <input id={ids.date} className={`input ${d.control}`} type="date" required value={day}
            onChange={e => { setDay(e.target.value); clear('date'); }}
            aria-invalid={errors.date ? true : undefined} aria-describedby={errors.date || askYear ? `${ids.date}-note` : undefined} />
        </div>
        {errors.date
          ? <FieldError id={`${ids.date}-note`} text={errors.date} />
          : askYear && <p id={`${ids.date}-note`} className={d.hint}>It was saved without a year — pick the full date it happens.</p>}
        <label className={`radio ${d.repeat}`}>
          <input type="checkbox" checked={repeat} onChange={e => setRepeating(e.target.checked)} />
          <span className="dot" style={{ borderRadius: 6, background: repeat ? 'var(--color-accent)' : 'transparent' }} />
          Remember it every year
        </label>
        <FieldError text={otherErrors(errors, ['label', 'date'])} />
        {date && <button type="button" className={`btn btn-ghost ${ui.quiet}`} onClick={remove} aria-disabled={busy || undefined}>Remove this date</button>}
        <div className="dialog-actions">
          <button type="button" className={`btn btn-ghost ${ui.cancel}`} onClick={() => onDone(null)}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${ui.submit}`} disabled={!day} aria-disabled={busy || undefined}>Save date</button>
        </div>
      </form>
    </Dialog>
  );
}
