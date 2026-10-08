// Local-time date helpers, ported from the prototype (which pinned today to T0 = 2026-10-07).
// Every relative helper takes an optional `now` so tests (and callers) can fix "today".
import type { MemberDate } from './types.ts';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Local midnight of the current day. */
export function today(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** 'YYYY-MM-DD' (anything after the first 10 chars is ignored) → local midnight. */
export function parseDay(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * ISO timestamp → epoch milliseconds (0 for null). Laravel sends microseconds
 * (“…T19:00:00.000000Z”); they're trimmed to milliseconds, the only precision every engine parses.
 */
export function parseTimestamp(iso: string | null | undefined): number {
  return iso ? Date.parse(iso.replace(/(\.\d{3})\d+/, '$1')) : 0;
}

/** ISO timestamp → the local calendar day it falls on. */
export function toDay(iso: string): Date {
  const d = new Date(parseTimestamp(iso));
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Date → 'YYYY-MM-DD' in local time. */
export function toISODay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Calendar days from a to b, in local time. Times of day are ignored (so `until(d, new Date())` at 3pm
 * still calls today “today”), and the result is rounded so DST shifts don't matter.
 */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((midnight(b) - midnight(a)) / 864e5);
}

export const longDate = (d: Date) => `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
export const shortDate = (d: Date) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
export const capitalize = (s: string) => s.replace(/^./, c => c.toUpperCase());

/** “today” · “yesterday” · “3 days ago” · “last week” · “2 weeks ago” · “last month” · “4 months ago” · “Oct 3, 2024”. */
export function ago(date: Date, now: Date = today()): string {
  const n = daysBetween(date, now);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 7) return `${n} days ago`;
  if (n < 14) return 'last week';
  if (n < 31) return `${Math.floor(n / 7)} weeks ago`;
  if (n < 60) return 'last month';
  if (n < 365) return `${Math.round(n / 30)} months ago`;
  return `${shortDate(date)}, ${date.getFullYear()}`;
}

/** “today” · “tomorrow” · “in 4 days” · “in 2 weeks” · “in 3 months”; past dates fall back to ago(). */
export function until(date: Date, now: Date = today()): string {
  const n = daysBetween(now, date);
  if (n < 0) return ago(date, now);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n < 14) return `in ${n} days`;
  if (n < 60) return `in ${Math.round(n / 7)} weeks`;
  return `in ${Math.round(n / 30)} months`;
}

/** A duration in days → “1 day” · “9 days” · “3 weeks” · “2 months”. */
export function span(days: number): string {
  if (days <= 1) return '1 day';
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
/** month/day in year y; Feb 29 falls back to Feb 28 in common years. */
const onYear = (y: number, month: number, day: number) =>
  new Date(y, month - 1, month === 2 && day === 29 && !isLeap(y) ? 28 : day);

/** The day a remembered date next falls on (on/after `now`); one-time events keep their own year. */
export function nextOccurrence(md: Pick<MemberDate, 'month' | 'day' | 'year' | 'recurring'>, now: Date = today()): Date {
  if (!md.recurring && md.year) return onYear(md.year, md.month, md.day);
  const d = onYear(now.getFullYear(), md.month, md.day);
  return daysBetween(now, d) < 0 ? onYear(now.getFullYear() + 1, md.month, md.day) : d;
}

export const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const;
/** Month index (0–11) → index into SEASONS: Dec–Feb Winter, Mar–May Spring, Jun–Aug Summer, Sep–Nov Fall. */
const seasonIndex = (m: number) => (m === 11 ? 0 : Math.floor((m + 1) / 3));

/** “Fall 2026”. December counts toward that year's Winter; Jan–Feb belong to the previous year's. */
export function seasonOf(date: Date): string {
  const m = date.getMonth();
  const year = m < 2 ? date.getFullYear() - 1 : date.getFullYear();
  return `${SEASONS[seasonIndex(m)]} ${year}`;
}

/** The name of the season after the one `date` is in (“Winter” after Fall). */
export function nextSeasonName(date: Date): string {
  return SEASONS[(seasonIndex(date.getMonth()) + 1) % 4];
}

/** “Good morning” (< 12h) · “Good afternoon” (< 17h) · “Good evening”. */
export function greeting(at: Date = new Date()): string {
  const h = at.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
