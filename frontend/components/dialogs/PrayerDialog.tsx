'use client';

import { useId, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import ui from '@/components/ui/Dialog.module.css';
import { useActions } from '@/lib/actions';
import { fieldErrors } from '@/lib/api';
import { useSnapshot } from '@/lib/hooks';
import type { Prayer } from '@/lib/types';
import { FieldError, describedBy, focusFirstError, otherErrors, without, type Errors } from './FieldError';
import d from './dialogs.module.css';

type Props = { memberId?: number; layer?: number; onDone: (p: Prayer | null) => void };

/** Prototype screen 12: “Add a prayer request”. */
export function PrayerDialog({ memberId, layer, onDone }: Props) {
  const members = useSnapshot().data?.members ?? [];
  const actions = useActions();
  const id = useId();
  const ids = { member_id: `${id}-for`, body: `${id}-text` };
  const [picked, setPicked] = useState<number | null>(memberId ?? null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const personId = picked ?? members[0]?.id ?? null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || personId == null || busy) return;
    setBusy(true);
    try {
      onDone(await actions.addPrayer({ member_id: personId, body }));
    } catch (ex) {
      setBusy(false);
      const fe = fieldErrors(ex);
      if (fe) {
        setErrors(fe);
        focusFirstError(fe, ids);
      }
    }
  };

  return (
    <Dialog open layer={layer} onClose={() => onDone(null)} title="Add a prayer request">
      <form className={d.form} onSubmit={submit}>
        {members.length === 0 ? (
          <p className={d.empty}>Add someone to the group first — every request is for someone.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor={ids.member_id}>For</label>
              <select id={ids.member_id} className={`input ${d.select}`} value={personId ?? ''}
                onChange={e => { setPicked(Number(e.target.value)); setErrors(x => without(x, 'member_id')); }}
                {...describedBy(`${ids.member_id}-err`, errors.member_id)}>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <FieldError id={`${ids.member_id}-err`} text={errors.member_id} />
          </>
        )}
        <div className="field">
          <label htmlFor={ids.body}>Request</label>
          <textarea id={ids.body} className={`input ${d.request}`} placeholder="In their words, if you can." value={text}
            onChange={e => { setText(e.target.value); setErrors(x => without(x, 'body')); }} maxLength={2000}
            {...describedBy(`${ids.body}-err`, errors.body)} />
        </div>
        <FieldError id={`${ids.body}-err`} text={errors.body} />
        <FieldError text={otherErrors(errors, ['member_id', 'body'])} />
        <div className="dialog-actions">
          <button type="button" className={`btn btn-ghost ${ui.cancel}`} onClick={() => onDone(null)}>Cancel</button>
          <button type="submit" className={`btn btn-primary ${ui.submit}`} disabled={!text.trim() || personId == null} aria-disabled={busy || undefined}>Add request</button>
        </div>
      </form>
    </Dialog>
  );
}
