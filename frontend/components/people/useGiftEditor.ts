'use client';

import { useCallback, useRef, useState } from 'react';
import { useActions } from '@/lib/actions';
import type { Member } from '@/lib/types';
import { toggleGift } from './people';

/**
 * The inline gift panel's state. Each tap shows at once (local draft + the foundation's optimistic,
 * silent `updateMember({gifts})`), and saves are serialised: one PATCH in flight at a time, always
 * sending the latest set, so quick taps can't land on the server out of order.
 */
export function useGiftEditor(member: Pick<Member, 'id' | 'gifts'>) {
  const actions = useActions();
  const [draft, setDraft] = useState<string[] | null>(null);
  const pending = useRef<string[] | null>(null);
  const saving = useRef(false);
  const gifts = draft ?? member.gifts;

  const flush = useCallback(async () => {
    if (saving.current || !pending.current) return;
    saving.current = true;
    try {
      while (pending.current) {
        const next = pending.current;
        pending.current = null;
        await actions.updateMember(member.id, { gifts: next });
      }
      setDraft(null);
    } catch {
      // The action already toasted and rolled the snapshot back; show what the server has.
      pending.current = null;
      setDraft(null);
    } finally {
      saving.current = false;
    }
  }, [actions, member.id]);

  const toggle = useCallback((g: string) => {
    const next = toggleGift(gifts, g);
    setDraft(next);
    pending.current = next;
    void flush();
  }, [gifts, flush]);

  return { gifts, toggle };
}
