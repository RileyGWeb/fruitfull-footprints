'use client';

import { createContext, useContext } from 'react';
import type { ConfirmOptions } from '@/components/ui/ConfirmDialog';
import type { Member, MemberDate, Prayer } from '@/lib/types';

export type Dialogs = {
  /** Screen 12. Resolves with the new request, or null if cancelled. */
  addPrayer(opts?: { memberId?: number }): Promise<Prayer | null>;
  /** Screen 13. Resolves with the answered request, or null for “Not yet”. */
  answerPrayer(prayer: Prayer): Promise<Prayer | null>;
  /** Edit text/person/answer, remove updates, move back to active, delete. */
  editPrayer(prayer: Prayer): Promise<void>;
  /** Screen 09. */
  addDate(opts: { memberId: number }): Promise<MemberDate | null>;
  /** Screen 09 prefilled, with “Remove this date”. */
  editDate(date: MemberDate): Promise<void>;
  /** Creates a member and navigates to their profile. */
  addPerson(): Promise<Member | null>;
  /** Includes “Remove from group” (navigates to /people). */
  editPerson(member: Member): Promise<void>;
  confirm(opts: ConfirmOptions): Promise<boolean>;
};

export const DialogsContext = createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error('useDialogs() must be used inside <DialogsProvider>');
  return ctx;
}
