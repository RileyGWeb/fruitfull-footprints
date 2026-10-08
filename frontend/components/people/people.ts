// Pure view logic for the People screens (the prototype's renderVals(): people / datesByMonth / pr).
import { MONTHS, ago, toDay, today } from '../../lib/dates.ts';
import { buildDateRows, firstName, giftLine, lastName, prayerCountLabel, soonLabel, type DateRow } from '../../lib/members.ts';
import { activeOf, answeredAt, answeredOf, updateWhen } from '../../lib/prayers.ts';
import type { Member, Prayer } from '../../lib/types.ts';

/** “8 of us, most Wednesdays.” — worded for a group that's only just starting, too. */
export function groupLine(count: number, meetingDay: string): string {
  if (count === 0) return `Meeting most ${meetingDay}s.`;
  if (count === 1) return `Just one of us so far, most ${meetingDay}s.`;
  return `${count} of us, most ${meetingDay}s.`;
}

export type PersonCardView = {
  member: Member;
  first: string;
  last: string;
  gifts: string;
  line: string | null;
  prayerLabel: string;
  soon: string | null;
};

/** One card per member, in the snapshot's (join) order. */
export function personCards(members: Member[], prayers: Prayer[], now: Date = today()): PersonCardView[] {
  const active = new Map<number, number>();
  for (const p of prayers) if (p.status === 'active') active.set(p.member_id, (active.get(p.member_id) ?? 0) + 1);
  return members.map(m => ({
    member: m,
    first: firstName(m),
    last: lastName(m),
    gifts: giftLine(m),
    line: m.line?.trim() || null,
    prayerLabel: prayerCountLabel(active.get(m.id) ?? 0),
    soon: soonLabel(m, now),
  }));
}

export type MonthGroup = { key: string; month: string; items: DateRow[] };

/** Dates tab: the next year of remembered dates, grouped by month (“January 2027” outside this year). */
export function datesByMonth(members: Member[], now: Date = today()): MonthGroup[] {
  const groups: MonthGroup[] = [];
  for (const r of buildDateRows(members, now)) {
    if (r.n > 365) continue;
    const y = r.on.getFullYear();
    const month = MONTHS[r.on.getMonth()] + (y !== now.getFullYear() ? ` ${y}` : '');
    let g = groups.find(x => x.month === month);
    if (!g) groups.push((g = { key: `${y}-${r.on.getMonth()}`, month, items: [] }));
    g.items.push(r);
  }
  return groups;
}

/** The profile's “About” rows — only the ones that have something in them. */
export function aboutRows(m: Pick<Member, 'family' | 'interests' | 'good_to_know'>): { label: string; value: string }[] {
  return ([['Family', m.family], ['Interests', m.interests], ['Good to know', m.good_to_know]] as const)
    .map(([label, v]) => ({ label, value: v?.trim() ?? '' }))
    .filter(r => r.value);
}

export type PrayerView = {
  prayer: Prayer;
  added: string; // “last week”
  updates: { id: number; ago: string; body: string }[]; // ago capitalised: “Last week”
  answeredAgo: string;
};

const view = (p: Prayer, now: Date): PrayerView => ({
  prayer: p,
  added: ago(toDay(p.created_at), now),
  updates: p.updates.map(u => ({ id: u.id, ago: updateWhen(u, now), body: u.body })),
  answeredAgo: p.status === 'answered' ? ago(toDay(answeredAt(p)), now) : '',
});

/** A member's requests: active newest first, answered most recently answered first. */
export function memberPrayers(prayers: Prayer[], memberId: number, now: Date = today()) {
  return {
    active: activeOf(prayers, memberId).map(p => view(p, now)),
    answered: answeredOf(prayers, memberId).map(p => view(p, now)),
  };
}

/** Add or remove one gift, keeping the order they were chosen in. */
export const toggleGift = (gifts: string[], g: string) => (gifts.includes(g) ? gifts.filter(x => x !== g) : [...gifts, g]);
