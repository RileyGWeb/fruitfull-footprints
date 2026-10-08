'use client';

import { Dialog } from './Dialog';
import s from './Dialog.module.css';

export type ConfirmOptions = { title: string; body?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean };

type Props = ConfirmOptions & {
  open: boolean;
  busy?: boolean;
  layer?: number;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Yes/no dialog. Destructive confirms (`danger`) use the deep clay primary button. */
export function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = 'Cancel', danger, busy, layer, onConfirm, onCancel }: Props) {
  return (
    <Dialog open={open} onClose={onCancel} title={title} layer={layer}>
      {body && <p className={s.body}>{body}</p>}
      <div className="dialog-actions">
        <button type="button" data-autofocus className={`btn btn-ghost ${s.cancel}`} onClick={onCancel}>{cancelLabel}</button>
        {/* aria-disabled, not disabled: a disabled button drops keyboard focus to <body>. */}
        <button type="button" className={`btn btn-primary ${s.submit} ${danger ? s.danger : ''}`} aria-disabled={busy || undefined} onClick={() => { if (!busy) onConfirm(); }}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
