'use client';

import { usePathname } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LOCK_EVENT } from '@/lib/api';
import { guardHistory } from '@/lib/historyGuard';
import { AnswerDialog } from './AnswerDialog';
import { DialogsContext, type Dialogs } from './context';
import { DateDialog } from './DateDialog';
import { EditPrayerDialog } from './EditPrayerDialog';
import { PersonDialog } from './PersonDialog';
import { PrayerDialog } from './PrayerDialog';
import type { Member, MemberDate, Prayer } from '@/lib/types';

type Entry = { id: number; render: (layer: number) => ReactNode; cancel: () => void };

/**
 * Promise-based dialogs (`useDialogs()`), stacked so a dialog can open a confirm on top of itself.
 *
 * - Back (button, swipe, Android back) closes the top dialog as a cancel instead of leaving the page.
 * - Every dialog closes as cancelled if the page changes underneath it, or on this device's own Lock.
 * - A lock-out from elsewhere (ff:locked) leaves them open — hidden behind the Entrance, with what
 *   was typed — so the save can be tried again after the password.
 */
export function DialogsProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Entry[]>([]);
  const stackRef = useRef<Entry[]>([]);
  const seq = useRef(0);
  const pathname = usePathname();
  const shownPath = useRef(pathname);

  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const closeAll = useCallback(() => [...stackRef.current].reverse().forEach(e => e.cancel()), []);

  useEffect(() => {
    window.addEventListener(LOCK_EVENT, closeAll);
    return () => window.removeEventListener(LOCK_EVENT, closeAll);
  }, [closeAll]);

  useEffect(() => {
    if (shownPath.current === pathname) return;
    shownPath.current = pathname;
    closeAll();
  }, [pathname, closeAll]);

  /** `cancelled` is what the promise resolves with if the dialog is closed from outside (Back, Lock, navigation). */
  const open = useCallback(<T,>(cancelled: T, render: (done: (value: T) => void, layer: number) => ReactNode) =>
    new Promise<T>(resolve => {
      const id = ++seq.current;
      let settled = false;
      const done = (value: T) => {
        if (settled) return;
        settled = true;
        setStack(s => s.filter(e => e.id !== id));
        // Resolve once its history entry is off, so a caller that navigates next doesn't race it.
        void release().then(() => resolve(value));
      };
      const release = guardHistory(() => done(cancelled), { modal: true });
      setStack(s => [...s, { id, render: layer => render(done, layer), cancel: () => done(cancelled) }]);
    }), []);

  const dialogs = useMemo<Dialogs>(() => ({
    addPrayer: opts => open<Prayer | null>(null, (done, layer) => <PrayerDialog memberId={opts?.memberId} layer={layer} onDone={done} />),
    answerPrayer: prayer => open<Prayer | null>(null, (done, layer) => <AnswerDialog prayer={prayer} layer={layer} onDone={done} />),
    editPrayer: prayer => open<void>(undefined, (done, layer) => <EditPrayerDialog prayer={prayer} layer={layer} onDone={() => done()} />),
    addDate: ({ memberId }) => open<MemberDate | null>(null, (done, layer) => <DateDialog memberId={memberId} layer={layer} onDone={done} />),
    editDate: date => open<void>(undefined, (done, layer) => <DateDialog memberId={date.member_id} date={date} layer={layer} onDone={() => done()} />),
    addPerson: () => open<Member | null>(null, (done, layer) => <PersonDialog layer={layer} onDone={done} />),
    editPerson: member => open<void>(undefined, (done, layer) => <PersonDialog member={member} layer={layer} onDone={() => done()} />),
    confirm: opts => open<boolean>(false, (done, layer) => (
      <ConfirmDialog open {...opts} layer={layer} onConfirm={() => done(true)} onCancel={() => done(false)} />
    )),
  }), [open]);

  return (
    <DialogsContext.Provider value={dialogs}>
      {children}
      {stack.map((e, i) => <Fragment key={e.id}>{e.render(i)}</Fragment>)}
    </DialogsContext.Provider>
  );
}
