import type { ReactNode } from 'react';
import s from './settings.module.css';

type Props = { id: string; label: string; error?: string; hint?: string; half?: boolean; children: ReactNode };

/** The DS `.field` (label over a pill input) with the Entrance's inline error line under it. */
export function Field({ id, label, error, hint, half, children }: Props) {
  return (
    <div className={`field ${half ? s.half : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <p id={`${id}-err`} className={s.error}>{error}</p> : hint ? <p id={`${id}-hint`} className={s.hint}>{hint}</p> : null}
    </div>
  );
}

/**
 * A server message about something the form has no field for, above its buttons. Announced as it
 * appears, since focus stays on the button that submitted.
 */
export function FormError({ text }: { text?: string }) {
  if (!text) return null;
  return <p className={s.error} role="alert">{text}</p>;
}

/** aria wiring for an input inside <Field>: invalid state + the error (or hint) as its description. */
export function describe(id: string, error?: string, hint?: string) {
  return {
    id,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined,
  } as const;
}
