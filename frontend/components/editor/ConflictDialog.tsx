'use client';

import { useEffect, useRef } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import d from '@/components/ui/Dialog.module.css';
import { guardHistory } from '@/lib/historyGuard';
import type { StudyStatus } from '@/lib/types';
import s from './Editor.module.css';

type Props = {
  open: boolean;
  /** The status the refused save asked for, and the study's status now (null if it couldn't be read). */
  next: StudyStatus;
  theirStatus: StudyStatus | null;
  onLoadTheirs: () => void;
  onKeepMine: () => void;
  /** Escape, the backdrop or Back: neither — the changes stay here, unsaved. */
  onClose: () => void;
};

/**
 * A save was refused (409): someone saved the study after this editor loaded it. Three ways out, so
 * that closing the dialog throws nothing away: load their version, keep mine (save over theirs), or
 * close and carry on editing.
 */
export function ConflictDialog({ open, next, theirStatus, onLoadTheirs, onKeepMine, onClose }: Props) {
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  });

  // Back closes it, like the app's other dialogs.
  useEffect(() => {
    if (!open) return;
    const release = guardHistory(() => close.current(), { modal: true });
    return () => void release();
  }, [open]);

  const status = theirStatus && theirStatus !== next
    ? theirStatus === 'published'
      ? ' It’s been published since, so keeping yours also moves it back to drafts.'
      : ' It’s been moved back to drafts since, so keeping yours also publishes it again.'
    : '';

  return (
    <Dialog open={open} onClose={onClose} title="This study was changed somewhere else.">
      <p className={d.body}>
        Someone saved it after you opened it here. Load their version to see what they changed (your changes here will be
        dropped), or keep yours and save over theirs.{status}
      </p>
      <div className={`dialog-actions ${s.conflictActions}`}>
        <button type="button" className={`btn btn-ghost hit ${d.cancel}`} onClick={onLoadTheirs}>Load their version</button>
        <button type="button" className={`btn btn-primary ${d.submit}`} onClick={onKeepMine}>Keep mine</button>
      </div>
    </Dialog>
  );
}
