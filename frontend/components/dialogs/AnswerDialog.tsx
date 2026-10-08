'use client';

import { useId, useState, type FormEvent } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import ui from '@/components/ui/Dialog.module.css';
import { Icon } from '@/components/ui/Icon';
import { useActions } from '@/lib/actions';
import { fieldErrors } from '@/lib/api';
import type { Prayer } from '@/lib/types';
import { FieldError, describedBy, focusFirstError, otherErrors, type Errors } from './FieldError';
import d from './dialogs.module.css';

type Props = { prayer: Prayer; layer?: number; onDone: (p: Prayer | null) => void };

/** Prototype screen 13: “Mark as answered”. */
export function AnswerDialog({ prayer, layer, onDone }: Props) {
  const actions = useActions();
  const id = useId();
  const ids = { answer: `${id}-answer` };
  const [answer, setAnswer] = useState(prayer.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      onDone(await actions.answerPrayer(prayer.id, answer));
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
    <Dialog open layer={layer} onClose={() => onDone(null)} title="Mark as answered" icon={<div className={d.leaf}><Icon name="leaf" /></div>}>
      <form className={d.form} onSubmit={submit}>
        <p className={ui.body}>“{prayer.body}”</p>
        <div className="field">
          <label htmlFor={ids.answer}>How did it turn out? (optional)</label>
          <textarea id={ids.answer} className={`input ${d.answer}`} placeholder="A sentence or two for us to look back on." value={answer}
            onChange={e => { setAnswer(e.target.value); setErrors({}); }} maxLength={2000}
            {...describedBy(`${ids.answer}-err`, errors.answer)} />
        </div>
        <FieldError id={`${ids.answer}-err`} text={errors.answer} />
        <FieldError text={otherErrors(errors, ['answer'])} />
        <div className="dialog-actions">
          <button type="button" className={`btn btn-ghost ${ui.cancel}`} onClick={() => onDone(null)}>Not yet</button>
          <button type="submit" className={`btn btn-primary ${ui.submit} ${ui.sage}`} aria-disabled={busy || undefined}>Mark answered</button>
        </div>
      </form>
    </Dialog>
  );
}
