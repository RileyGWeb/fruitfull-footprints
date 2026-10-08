// The date dialog's rules, kept pure for the tests. Relative imports with .ts for node --test.
import type { DateInput, MemberDate } from '../../lib/types.ts';

const p2 = (n: number) => String(n).padStart(2, '0');

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * The value the date field shows for a stored date. A date kept without a year (a birthday nobody gave
 * the year for) shows this year — or, for February 29, the next leap year — because the field needs
 * one. That year is for display only and is never sent as the date's year (see datePatch).
 */
export function fieldDay(md: Pick<MemberDate, 'month' | 'day' | 'year'>, now: Date): string {
  let year = md.year ?? now.getFullYear();
  if (md.year == null && md.month === 2 && md.day === 29) while (!isLeap(year)) year++;
  return `${year}-${p2(md.month)}-${p2(md.day)}`;
}

/** True when this stored date has no year: switching it to one-time needs the user to pick the full date. */
export const isYearless = (md: Pick<MemberDate, 'year'> | undefined) => !!md && md.year == null;

/**
 * The PATCH body for an edited date. `date` goes only when the user changed it, so a date kept without
 * a year doesn't gain the year the field filled in. A yearless date that keeps repeating, moved to
 * another day with that filled-in year left as it was, goes as `--MM-DD` and stays yearless; picking
 * a different year gives it that year. Switching a yearless date to one-time always sends the full
 * date — the dialog has asked for it by then.
 */
export function datePatch(stored: Pick<MemberDate, 'year'>, input: DateInput, shownDay: string): Partial<DateInput> {
  const yearless = isYearless(stored);
  if (yearless && !input.recurring) return input;
  const rest: Partial<DateInput> = { ...input };
  delete rest.date;
  if (input.date === shownDay) return rest;
  if (yearless && input.date.slice(0, 4) === shownDay.slice(0, 4)) return { ...rest, date: `--${input.date.slice(5)}` };
  return input;
}
