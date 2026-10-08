// Prayer page view models — the prototype's renderVals() activePrayers / answeredPrayers / pv().
// Relative imports with .ts extensions so `npm test` (node --test) can load this file directly.
import { fieldErrors } from '../../lib/api.ts';
import { ago, daysBetween, shortDate, span, toDay, today } from '../../lib/dates.ts';
import { firstName } from '../../lib/members.ts';
import { activeOf, answeredAt, answeredOf, updateWhen } from '../../lib/prayers.ts';
import type { Member, Prayer } from '../../lib/types.ts';

export type UpdateView = { id: number; when: string; body: string };

export type ActivePrayerView = {
  prayer: Prayer;
  member: Member;
  first: string;
  /** “Added 3 days ago · Oct 4” (over a year old: “Added Mar 2, 2025”) */
  added: string;
  updates: UpdateView[];
};

export type AnsweredPrayerView = {
  prayer: Prayer;
  member: Member;
  first: string;
  /** “4 weeks ago” */
  answeredAgo: string;
  /** “Prayed over for {carried}” — “13 days”, “4 weeks” */
  carried: string;
};

const byId = (members: Member[]) => new Map(members.map(m => [m.id, m]));

/** Active requests, newest first, with “Added …” and their update history (oldest first, as sent). */
export function activePrayers(prayers: Prayer[], members: Member[], now: Date = today()): ActivePrayerView[] {
  const people = byId(members);
  return activeOf(prayers).flatMap(prayer => {
    const member = people.get(prayer.member_id);
    if (!member) return [];
    const added = toDay(prayer.created_at);
    const when = ago(added, now);
    return [{
      prayer,
      member,
      first: firstName(member),
      // Past a year ago() is already the date (“Mar 2, 2025”), so don't repeat it.
      added: when.startsWith(shortDate(added)) ? `Added ${when}` : `Added ${when} · ${shortDate(added)}`,
      updates: (prayer.updates ?? []).map(u => ({ id: u.id, when: updateWhen(u, now), body: u.body })),
    }];
  });
}

/** Answered requests, most recently answered first, with how long the group carried each one. */
export function answeredPrayers(prayers: Prayer[], members: Member[], now: Date = today()): AnsweredPrayerView[] {
  const people = byId(members);
  return answeredOf(prayers).flatMap(prayer => {
    const member = people.get(prayer.member_id);
    if (!member) return [];
    const answered = toDay(answeredAt(prayer));
    return [{
      prayer,
      member,
      first: firstName(member),
      answeredAgo: ago(answered, now),
      carried: span(Math.max(0, daysBetween(toDay(prayer.created_at), answered))),
    }];
  });
}

/**
 * What the inline “Add update” form shows under its field when saving fails with a 422 (the action
 * doesn't toast those): the body's message, else whichever field the server named. null for any other
 * failure — the action already toasted it.
 */
export function updateFormError(e: unknown): string | null {
  const fe = fieldErrors(e);
  return fe ? (fe.body ?? Object.values(fe)[0]) : null;
}
