// Prayer list selectors shared by the Prayer page and profiles (each screen keeps its own labels).
import { ago, capitalize, parseTimestamp, toDay, today } from './dates.ts';
import type { Prayer, PrayerUpdate } from './types.ts';

/** Newest first by the given timestamp, then by id (newest first) so ties stay stable. */
export const byNewest = (key: (p: Prayer) => string | null) => (a: Prayer, b: Prayer) =>
  parseTimestamp(key(b)) - parseTimestamp(key(a)) || b.id - a.id;

/** When a request was answered; one without `answered_at` counts from when it was added. */
export const answeredAt = (p: Pick<Prayer, 'answered_at' | 'created_at'>) => p.answered_at ?? p.created_at;

const mine = (p: Prayer, memberId?: number) => memberId == null || p.member_id === memberId;

/** Active requests (everyone's, or one member's), newest first. */
export function activeOf(prayers: Prayer[], memberId?: number): Prayer[] {
  return prayers.filter(p => p.status === 'active' && mine(p, memberId)).sort(byNewest(p => p.created_at));
}

/** Answered requests (everyone's, or one member's), most recently answered first. */
export function answeredOf(prayers: Prayer[], memberId?: number): Prayer[] {
  return prayers.filter(p => p.status === 'answered' && mine(p, memberId)).sort(byNewest(answeredAt));
}

/** An update's “when”, as cards show it: “Last week”, “3 days ago” → “3 days ago” capitalised. */
export const updateWhen = (u: Pick<PrayerUpdate, 'created_at'>, now: Date = today()) => capitalize(ago(toDay(u.created_at), now));
