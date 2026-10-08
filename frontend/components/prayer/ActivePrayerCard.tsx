'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { FieldError, describedBy } from '@/components/dialogs/FieldError';
import { Avatar } from '@/components/ui/Avatar';
import { Icon } from '@/components/ui/Icon';
import { useActions } from '@/lib/actions';
import { updateFormError, type ActivePrayerView } from './views';
import c from './ActivePrayerCard.module.css';

type Props = {
  view: ActivePrayerView;
  /** This card's inline “Add update” form is the one open (only one at a time). */
  updating: boolean;
  onUpdatingChange: (open: boolean) => void;
  onAnswer: () => void;
  onEdit: () => void;
};

/** An active request: who it's for, the request, its updates, and the inline update form (screen 11). */
export function ActivePrayerCard({ view, updating, onUpdatingChange, onAnswer, onEdit }: Props) {
  const { prayer, member, first, added, updates } = view;
  const nameId = useId();
  const formId = useId();
  const addRef = useRef<HTMLButtonElement>(null);

  /** Close the form and hand focus back to the button that opened it. */
  const close = () => {
    addRef.current?.focus();
    onUpdatingChange(false);
  };

  return (
    <article className={c.card} aria-labelledby={nameId}>
      <div className={c.head}>
        <Avatar member={member} href={`/people/${member.id}`} className="hit" />
        <div className={c.who}>
          <h2 id={nameId} className={c.name}>{first}</h2>
          <div className={c.meta}>{added}</div>
        </div>
        <button type="button" className={`btn btn-ghost btn-icon ${c.edit}`} onClick={onEdit} aria-label={`Edit ${first}’s request`} title="Edit request">
          <Icon name="edit" />
        </button>
      </div>

      <p className={c.body}>“{prayer.body}”</p>

      {updates.length > 0 && (
        <ul className={c.updates} aria-label="Updates">
          {updates.map(u => (
            <li key={u.id} className={c.update}>
              <span className={c.dot} aria-hidden />
              <span><span className={c.when}>{u.when}</span> — {u.body}</span>
            </li>
          ))}
        </ul>
      )}

      {updating && <UpdateForm id={formId} prayerId={prayer.id} first={first} onClose={close} />}

      <div className={c.actions}>
        <button
          ref={addRef}
          type="button"
          className={`btn btn-secondary ${c.action} hit`}
          aria-expanded={updating}
          aria-controls={updating ? formId : undefined}
          onClick={() => onUpdatingChange(!updating)}
        >
          <Icon name="editSm" /> Add update
        </button>
        <button type="button" className={`btn btn-secondary ${c.action} ${c.answer} hit`} onClick={onAnswer}>
          <Icon name="leafSm" /> Mark answered
        </button>
      </div>
    </article>
  );
}

type FormProps = { id: string; prayerId: number; first: string; onClose: () => void };

/** The inline update textarea. Mounted only while open, so it always starts empty. */
function UpdateForm({ id, prayerId, first, onClose }: FormProps) {
  const actions = useActions();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const errorId = `${id}-err`;

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
  }, []);

  const save = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await actions.addPrayerUpdate(prayerId, body);
      onClose();
    } catch (ex) {
      setBusy(false); // keep what they wrote
      const message = updateFormError(ex);
      if (message) {
        setError(message);
        input.current?.focus();
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void save();
    }
  };

  return (
    <form id={id} className={c.form} onSubmit={save}>
      <textarea
        ref={input}
        className={`input ${c.updateInput}`}
        aria-label={`Update on ${first}’s request`}
        placeholder="What’s changed? Even small news helps."
        value={text}
        onChange={e => { setText(e.target.value); setError(null); }}
        onKeyDown={onKeyDown}
        maxLength={2000}
        {...describedBy(errorId, error)}
      />
      <FieldError id={errorId} text={error} />
      <div className={c.formActions}>
        <button type="button" className={`btn btn-ghost ${c.cancel} hit`} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn btn-primary hit" disabled={!text.trim()} aria-disabled={busy || undefined}>Save update</button>
      </div>
    </form>
  );
}
