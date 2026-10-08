import ui from '@/components/ui/Dialog.module.css';

export type Errors = Record<string, string>;

/** A server 422 message under a dialog field (Dialog.module.css .error). Renders nothing without one. */
export function FieldError({ id, text }: { id?: string; text?: string | null }) {
  if (!text) return null;
  return <p id={id} className={ui.error} role="alert">{text}</p>;
}

/** aria-invalid / aria-describedby for a field that may have an error under it. */
export const describedBy = (errorId: string, text?: string | null) =>
  text ? { 'aria-invalid': true as const, 'aria-describedby': errorId } : {};

/** Messages for fields the dialog doesn't show, so none is swallowed. */
export const otherErrors = (errors: Errors, shown: readonly string[]) =>
  Object.entries(errors).filter(([k]) => !shown.includes(k)).map(([, v]) => v).join(' ') || null;

/** Errors without `field` (once it's edited, its message goes). */
export const without = (errors: Errors, field: string): Errors => {
  if (!(field in errors)) return errors;
  const rest = { ...errors };
  delete rest[field];
  return rest;
};

/** Focus the first field (in form order) that has an error. `ids` maps field → input id. */
export function focusFirstError(errors: Errors, ids: Record<string, string>) {
  const field = Object.keys(ids).find(k => errors[k]);
  if (field) document.getElementById(ids[field])?.focus();
}
