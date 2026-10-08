// Member helpers: gifts, avatar tones/blobs, date-kind colours and the "dates to remember" rows.
import { MONTHS, WEEKDAYS, ago, daysBetween, nextOccurrence, today, until } from './dates.ts';
import type { DateKind, Member, MemberDate, Tone } from './types.ts';

export const GIFTS = ['Encouragement', 'Mercy', 'Hospitality', 'Teaching', 'Serving', 'Giving', 'Leadership', 'Wisdom', 'Faith', 'Prayer', 'Administration', 'Shepherding', 'Knowledge', 'Evangelism'];

/** Avatar fills: a soft highlight + a darker speck over the tone's 200 step. */
export const TONES: Record<Tone, { bg: string; fg: string }> = {
  accent: { bg: 'radial-gradient(circle at 30% 26%, var(--color-accent-100) 0 20%, transparent 21%), radial-gradient(circle at 78% 82%, var(--color-accent-300) 0 14%, transparent 15%), var(--color-accent-200)', fg: 'var(--color-accent-800)' },
  sage: { bg: 'radial-gradient(circle at 30% 26%, var(--color-accent-2-100) 0 20%, transparent 21%), radial-gradient(circle at 78% 82%, var(--color-accent-2-300) 0 14%, transparent 15%), var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)' },
  sand: { bg: 'radial-gradient(circle at 30% 26%, var(--color-neutral-100) 0 20%, transparent 21%), radial-gradient(circle at 78% 82%, var(--color-neutral-400) 0 14%, transparent 15%), var(--color-neutral-300)', fg: 'var(--color-neutral-800)' },
};
/** Order new members cycle through (and the tone picker shows). */
export const TONE_ORDER: Tone[] = ['sage', 'accent', 'sand'];

export const BLOBS = ['58% 42% 52% 48% / 46% 54% 46% 54%', '44% 56% 40% 60% / 56% 44% 58% 42%', '50% 50% 42% 58% / 60% 40% 60% 40%', '62% 38% 54% 46% / 48% 58% 42% 52%'];

export const KIND: Record<DateKind, { label: string; bg: string; fg: string }> = {
  birthday: { label: 'Birthday', bg: 'var(--color-accent-200)', fg: 'var(--color-accent-800)' },
  anniversary: { label: 'Anniversary', bg: 'var(--color-accent-2-200)', fg: 'var(--color-accent-2-800)' },
  event: { label: 'Life event', bg: 'var(--color-neutral-300)', fg: 'var(--color-neutral-800)' },
};

type Named = Pick<Member, 'name'> | string;
const nameOf = (m: Named) => (typeof m === 'string' ? m : m.name).trim();

export const firstName = (m: Named) => nameOf(m).split(/\s+/)[0] ?? '';
export const lastName = (m: Named) => nameOf(m).split(/\s+/).slice(1).join(' ');
/** First + last initial (“RO” for Rachel Owens). */
export function initials(m: Named): string {
  const w = nameOf(m).split(/\s+/).filter(Boolean);
  return ((w[0]?.[0] ?? '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}

export function avatarStyle(m: Pick<Member, 'id' | 'tone'>): { bg: string; fg: string; blob: string } {
  const t = TONES[m.tone] ?? TONES.sand;
  return { bg: t.bg, fg: t.fg, blob: BLOBS[Math.abs(m.id - 1) % 4] };
}

/** Tone for the next new member: cycles sage → accent → sand by member count. */
export const nextTone = (count: number): Tone => TONE_ORDER[count % TONE_ORDER.length];

/** “Rachel’s birthday”, or the date's own label. */
export const dateTitle = (m: Named, d: Pick<MemberDate, 'kind' | 'label'>) =>
  d.kind === 'birthday' ? `${firstName(m)}’s birthday` : d.label || KIND[d.kind].label;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const chip = (on: Date) => ({ mon: MONTHS[on.getMonth()].slice(0, 3).toUpperCase(), day: on.getDate() });

export type DateRow = {
  key: string;
  member: Member;
  date: MemberDate;
  on: Date;
  n: number; // days until `on`
  title: string;
  sub: string;
  mon: string; // “OCT”
  day: number;
  chipBg: string;
  chipFg: string;
  kindLabel: string;
};

function dateRow(member: Member, date: MemberDate, now: Date): DateRow {
  const on = nextOccurrence(date, now), k = KIND[date.kind];
  let sub = `${until(on, now)} · ${WEEKDAYS[on.getDay()]}`;
  // “16 years · in 11 days”; a first anniversary still to come (or a year that's later than this one) just gets the date.
  const years = date.year ? on.getFullYear() - date.year : 0;
  if (date.kind === 'anniversary' && years > 0) sub = `${plural(years, 'year')} · ${sub}`;
  if (date.kind === 'event') sub = `${firstName(member)} · ${sub}`;
  return { key: `${member.id}-${date.id}`, member, date, on, n: daysBetween(now, on), title: dateTitle(member, date), sub, ...chip(on), chipBg: k.bg, chipFg: k.fg, kindLabel: k.label };
}

/** Every upcoming remembered date (today onward) across members, soonest first. */
export function buildDateRows(members: Member[], now: Date = today()): DateRow[] {
  return members
    .flatMap(m => (m.dates ?? []).map(d => dateRow(m, d, now)))
    .filter(r => r.n >= 0)
    .sort((a, b) => a.n - b.n);
}

/** People-card tag for the soonest date within 21 days: “Birthday in 4 days”, “Moving day in 3 weeks”. */
export function soonLabel(member: Member, now: Date = today()): string | null {
  const r = buildDateRows([member], now).find(x => x.n <= 21);
  if (!r) return null;
  return `${r.date.kind === 'event' ? r.title : r.kindLabel} ${until(r.on, now)}`;
}

export type ProfileDateRow = {
  key: string;
  date: MemberDate;
  on: Date;
  n: number;
  label: string;
  sub: string;
  mon: string;
  day: number;
  chipBg: string;
  chipFg: string;
  kindLabel: string;
};

/** The profile's “Dates to remember” list: upcoming first, then past one-time events. */
export function profileDateRows(member: Member, now: Date = today()): ProfileDateRow[] {
  return (member.dates ?? [])
    .map(d => {
      const on = nextOccurrence(d, now), k = KIND[d.kind], n = daysBetween(now, on);
      const since = d.year && d.recurring && d.kind !== 'birthday' ? ` · since ${d.year}` : '';
      return {
        key: String(d.id), date: d, on, n,
        label: d.kind === 'birthday' ? 'Birthday' : d.label || k.label,
        sub: `${MONTHS[on.getMonth()]} ${on.getDate()}${since} · ${n < 0 ? ago(on, now) : until(on, now)}`,
        ...chip(on), chipBg: k.bg, chipFg: k.fg, kindLabel: k.label,
      };
    })
    .sort((a, b) => Number(a.n < 0) - Number(b.n < 0) || a.n - b.n);
}

/** “Encouragement · Mercy · Hospitality”. */
export const giftLine = (m: Pick<Member, 'gifts'>) => m.gifts.join(' · ');

/** “No active requests” · “1 active prayer request” · “3 active prayer requests”. */
export const prayerCountLabel = (n: number) =>
  n === 0 ? 'No active requests' : n === 1 ? '1 active prayer request' : `${n} active prayer requests`;
