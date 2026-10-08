// Mutations: call the endpoint, revalidate the snapshot (and study key), toast, return the result.
// On failure they toast a plain message in the error style (offline included) and rethrow, so forms
// can stay open. Some failures aren't toasted: a 401 (the Entrance is already up), a 422 that names
// fields — the form shows those under its fields (read them with fieldErrors() from lib/api) — and a
// study save's 409 (someone saved it first), which the editor answers with its conflict dialog.
import { useMemo } from 'react';
import { useSWRConfig, type Cache, type ScopedMutator } from 'swr';
import { ApiError, errorMessage, fieldErrors, isConflict } from './api.ts';
import * as ep from './endpoints.ts';
import { firstName } from './members.ts';
import { whenRoute } from './route.ts';
import { toStudyInput } from './studies.ts';
import { showToast, type ToastTone } from './toast.ts';
import type {
  DateInput, Member, MemberInput, PasswordInput, PrayerInput, PrayerPatch, Settings, Snapshot, Study, StudyInput, StudyStatus,
} from './types.ts';

type Toast<T> = string | ((result: T) => string | null) | null;
type Notify = (text: string, opts?: { tone?: ToastTone }) => void;

/** A 401 already sent the app back to the Entrance (ff:locked) — no toast for that. */
const isLocked = (e: unknown) => e instanceof ApiError && e.status === 401;

/** The actions, bound to an SWR cache + mutate (useActions passes the app's; tests pass their own). */
export function createActions(cache: Cache, mutate: ScopedMutator, notify: Notify = showToast) {
  const refresh = (...keys: string[]) =>
    Promise.all([ep.SNAPSHOT_KEY, ...keys].map(k => mutate(k))).catch(() => undefined);

  const fail = (e: unknown) => {
    if (!isLocked(e)) notify(errorMessage(e), { tone: 'error' });
  };

  /** `quiet`: failures the caller shows itself, besides a 422 with field errors (never toasted). */
  async function run<T>(
    call: () => Promise<T>, toast: Toast<T>, after: (result: T) => unknown = () => refresh(), quiet?: (e: unknown) => boolean,
  ): Promise<T> {
    try {
      const result = await call();
      await after(result);
      const text = typeof toast === 'function' ? toast(result) : toast;
      if (text) notify(text);
      return result;
    } catch (e) {
      if (!fieldErrors(e) && !quiet?.(e)) fail(e);
      throw e;
    }
  }

  const snapshot = () => cache.get(ep.SNAPSHOT_KEY)?.data as Snapshot | undefined;
  const statusOf = (id: number): StudyStatus | null =>
    (cache.get(ep.studyKey(id))?.data as Study | undefined)?.status ?? snapshot()?.studies.find(s => s.id === id)?.status ?? null;
  const storeStudy = async (s: Study) => {
    await mutate(ep.studyKey(s.id), s, { revalidate: false });
    await refresh();
  };

  /** Gifts-only patches are optimistic and silent (a failure rolls back and toasts); anything else toasts “Saved”. */
  async function updateMember(id: number, patch: Partial<MemberInput>): Promise<Member> {
    if (!(Object.keys(patch).length === 1 && Array.isArray(patch.gifts))) return run(() => ep.updateMember(id, patch), 'Saved');
    const swap = (cur: Snapshot | undefined, fn: (m: Member) => Member) =>
      cur && { ...cur, members: cur.members.map(m => (m.id === id ? fn(m) : m)) };
    let saved: Member | undefined;
    try {
      await mutate<Snapshot>(ep.SNAPSHOT_KEY, async cur => {
        saved = await ep.updateMember(id, patch);
        return swap(cur, () => saved!);
      }, {
        optimisticData: cur => swap(cur, m => ({ ...m, gifts: patch.gifts! })) as Snapshot,
        rollbackOnError: true,
        revalidate: false,
      });
      return saved!;
    } catch (e) {
      fail(e); // the gift panel has no field to show a 422 under
      throw e;
    }
  }

  /**
   * Takes a removed member (and their requests) out of the cached snapshot, so /people doesn't list
   * them until the refetch lands. Waits until their profile has been left, so it doesn't flash “not
   * found” on the way out — and no longer: the edit lands in the commit that puts the next screen up,
   * before it is painted (lib/route.ts).
   */
  const forgetMember = (id: number) =>
    whenRoute(path => path !== `/people/${id}`, () => {
      void mutate<Snapshot>(ep.SNAPSHOT_KEY, cur => cur && {
        ...cur,
        members: cur.members.filter(m => m.id !== id),
        prayers: cur.prayers.filter(p => p.member_id !== id),
      }, { revalidate: true }).catch(() => undefined);
    });

  return {
    // prayer
    addPrayer: (input: PrayerInput) => run(() => ep.createPrayer(input), 'Added — we’ll be praying'),
    updatePrayer: (id: number, patch: PrayerPatch) => run(() => ep.updatePrayer(id, patch), 'Request updated'),
    deletePrayer: (id: number) => run(() => ep.deletePrayer(id), 'Request deleted'),
    /** `answer` blank → no note (clears one on an already-answered request); omitted → keeps any note. */
    answerPrayer: (id: number, answer?: string | null) =>
      run(() => ep.answerPrayer(id, answer === undefined ? undefined : answer?.trim() || null), 'Answered. Thank God.'),
    reopenPrayer: (id: number) => run(() => ep.reopenPrayer(id), 'Moved back to active'),
    addPrayerUpdate: (prayerId: number, body: string) => run(() => ep.createPrayerUpdate(prayerId, body), 'Update added'),
    deletePrayerUpdate: (id: number) => run(() => ep.deletePrayerUpdate(id), 'Update removed'),

    // dates to remember
    addDate: (memberId: number, input: DateInput) => run(() => ep.createDate(memberId, input), 'Date saved'),
    updateDate: (id: number, patch: Partial<DateInput>) => run(() => ep.updateDate(id, patch), 'Date saved'),
    deleteDate: (id: number) => run(() => ep.deleteDate(id), 'Date removed'),

    // people
    addMember: (input: MemberInput) => run(() => ep.createMember(input), m => `${firstName(m)} is in the group`),
    updateMember,
    /** Doesn't wait for the snapshot refetch, so callers can navigate away first. */
    deleteMember: (member: Pick<Member, 'id' | 'name'>) =>
      run(() => ep.deleteMember(member.id), `Removed ${firstName(member)}`, () => forgetMember(member.id)),

    // studies
    /**
     * Create (no id) or replace (id). Toast follows the status change: draft saved / published / changes
     * saved / moved back. With `expected_updated_at`, a 409 (saved somewhere else since) is rethrown
     * untoasted, with the current study in `e.data.study`, for the caller's conflict dialog.
     */
    saveStudy: (input: StudyInput, id?: number) => {
      const prev = id == null ? null : statusOf(id);
      const toast = input.status === 'draft'
        ? (prev === 'published' ? 'Moved back to drafts' : 'Draft saved')
        : (prev === 'published' ? 'Changes saved' : 'Published — everyone can read it now');
      return run(() => (id == null ? ep.createStudy(input) : ep.updateStudy(id, input)), toast, storeStudy, isConflict);
    },
    unpublishStudy: (study: Study) =>
      run(() => ep.updateStudy(study.id, { ...toStudyInput(study), status: 'draft' }), 'Moved back to drafts', storeStudy),
    deleteStudy: (id: number) =>
      run(() => ep.deleteStudy(id), 'Study deleted', async () => {
        await mutate(ep.studyKey(id), undefined, { revalidate: false });
        void refresh();
      }),

    // settings
    updateSettings: (patch: Partial<Settings>) => run(() => ep.updateSettings(patch), 'Settings saved', () => refresh(ep.GROUP_KEY)),
    changePassword: (input: PasswordInput) => run(() => ep.changePassword(input), 'Password changed', () => undefined),
  };
}

export type Actions = ReturnType<typeof createActions>;

/** All write actions, bound to the SWR cache. Stable across renders. */
export function useActions(): Actions {
  const { cache, mutate } = useSWRConfig();
  return useMemo(() => createActions(cache, mutate), [cache, mutate]);
}
