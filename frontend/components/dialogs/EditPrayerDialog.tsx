'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import ui from '@/components/ui/Dialog.module.css';
import { Icon } from '@/components/ui/Icon';
import { useActions } from '@/lib/actions';
import { fieldErrors } from '@/lib/api';
import { ago, toDay } from '@/lib/dates';
import { useSnapshot } from '@/lib/hooks';
import type { Prayer } from '@/lib/types';
import { useDialogs } from './context';
import { FieldError, describedBy, focusFirstError, otherErrors, without, type Errors } from './FieldError';
import d from './dialogs.module.css';

type Props = { prayer: Prayer; layer?: number; onDone: () => void };

/** Gap-fill: edit a request's person/text/answer, remove updates, move back to active, delete. */
export function EditPrayerDialog({ prayer, layer = 0, onDone }: Props) {
  const snap = useSnapshot().data;
  const members = snap?.members ?? [];
  const live = snap?.prayers.find(p => p.id === prayer.id) ?? prayer;
  const actions = useActions();
  const { confirm } = useDialogs();
  const id = useId();
  const ids = { member_id: `${id}-for`, body: `${id}-text`, answer: `${id}-answer` };
  const updatesRef = useRef<HTMLUListElement>(null);
  const [memberId, setMemberId] = useState(prayer.member_id);
  const [body, setBody] = useState(prayer.body);
  const [answer, setAnswer] = useState(prayer.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const answered = live.status === 'answered';
  const clear = (field: string) => setErrors(e => without(e, field));

  const attempt = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      onDone();
    } catch (ex) {
      setBusy(false);
      const fe = fieldErrors(ex);
      if (fe) {
        setErrors(fe);
        focusFirstError(fe, ids);
      }
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim() || busy) return;
    attempt(() => actions.updatePrayer(prayer.id, { member_id: memberId, body: body.trim(), ...(answered ? { answer: answer.trim() || null } : {}) }));
  };

  const removeUpdate = async (updateId: number, index: number) => {
    if (!(await confirm({ title: 'Remove this update?', confirmLabel: 'Remove', danger: true }))) return;
    try {
      await actions.deletePrayerUpdate(updateId);
    } catch {
      return;
    }
    // Its × is gone: keep focus in the list (the next update, else the one before), else on the request.
    requestAnimationFrame(() => {
      const buttons = updatesRef.current?.querySelectorAll<HTMLElement>('button') ?? [];
      const next = buttons[Math.min(index, buttons.length - 1)] ?? document.getElementById(ids.body);
      next?.focus({ preventScroll: true });
    });
  };

  const reopen = async () => {
    if (busy) return;
    const ok = await confirm({
      title: 'Move back to active?',
      body: live.answer ? 'The note about how it turned out will be cleared.' : undefined,
      confirmLabel: 'Move back',
    });
    if (ok) attempt(() => actions.reopenPrayer(prayer.id));
  };

  const remove = async () => {
    if (busy) return;
    const ok = await confirm({ title: 'Delete this request?', body: 'It will be gone for everyone, along with its updates.', confirmLabel: 'Delete', danger: true });
    if (ok) attempt(() => actions.deletePrayer(prayer.id));
  };

  return (
    <Dialog open layer={layer} onClose={onDone} title="Edit request">
      <form className={d.form} onSubmit={submit}>
        <div className="field">
          <label htmlFor={ids.member_id}>For</label>
          <select id={ids.member_id} className={`input ${d.select}`} value={memberId}
            onChange={e => { setMemberId(Number(e.target.value)); clear('member_id'); }}
            {...describedBy(`${ids.member_id}-err`, errors.member_id)}>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <FieldError id={`${ids.member_id}-err`} text={errors.member_id} />
        <div className="field">
          <label htmlFor={ids.body}>Request</label>
          <textarea id={ids.body} className={`input ${d.request}`} value={body}
            onChange={e => { setBody(e.target.value); clear('body'); }} maxLength={2000}
            {...describedBy(`${ids.body}-err`, errors.body)} />
        </div>
        <FieldError id={`${ids.body}-err`} text={errors.body} />
        {answered && (
          <>
            <div className="field">
              <label htmlFor={ids.answer}>How did it turn out?</label>
              <textarea id={ids.answer} className={`input ${d.answer}`} placeholder="A sentence or two for us to look back on." value={answer}
                onChange={e => { setAnswer(e.target.value); clear('answer'); }} maxLength={2000}
                {...describedBy(`${ids.answer}-err`, errors.answer)} />
            </div>
            <FieldError id={`${ids.answer}-err`} text={errors.answer} />
          </>
        )}
        {live.updates.length > 0 && (
          <div className="field">
            <label id={`${id}-updates`}>Updates</label>
            <ul ref={updatesRef} className={d.updates} aria-labelledby={`${id}-updates`}>
              {live.updates.map((u, i) => {
                const when = ago(toDay(u.created_at));
                return (
                  <li key={u.id} className={d.update}>
                    <span className={d.dot} />
                    <span><strong style={{ fontWeight: 600 }}>Update {when}:</strong> {u.body}</span>
                    <button type="button" title="Remove update" aria-label={`Remove the update from ${when}`} className={`btn btn-icon btn-ghost ${d.remove}`} onClick={() => removeUpdate(u.id, i)}>
                      <Icon name="x" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <FieldError text={otherErrors(errors, ['member_id', 'body', 'answer'])} />
        <div className={d.quietRow}>
          {answered && <button type="button" className={`btn btn-ghost ${ui.quiet}`} onClick={reopen} aria-disabled={busy || undefined}><Icon name="leafSm" /> Move back to active</button>}
          <button type="button" className={`btn btn-ghost ${ui.quiet}`} onClick={remove} aria-disabled={busy || undefined}>Delete this request</button>
        </div>
        <div className="dialog-actions">
          <button type="button" className={`btn btn-ghost ${ui.cancel}`} onClick={onDone}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${ui.submit}`} disabled={!body.trim()} aria-disabled={busy || undefined}>Save</button>
        </div>
      </form>
    </Dialog>
  );
}
