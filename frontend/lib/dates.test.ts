import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ago, capitalize, daysBetween, greeting, longDate, nextOccurrence, nextSeasonName, parseDay, parseTimestamp, seasonOf, shortDate, span, toDay,
  toISODay, today, until,
} from './dates.ts';
import { T0 } from './testing/fixtures.ts';

const plus = (n: number, from = T0) => new Date(from.getFullYear(), from.getMonth(), from.getDate() + n);

describe('parsing and formatting', () => {
  test('parseDay / toISODay round-trip in local time', () => {
    assert.deepEqual(parseDay('2026-10-07'), T0);
    assert.deepEqual(parseDay('2026-10-07T00:00:00.000000Z'), T0);
    assert.equal(toISODay(T0), '2026-10-07');
    assert.equal(toISODay(new Date(2027, 0, 9)), '2027-01-09');
  });

  test('toDay gives the local calendar day of a timestamp', () => {
    const d = toDay(new Date(2026, 9, 7, 23, 30).toISOString());
    assert.deepEqual(d, T0);
  });

  test('today() is local midnight', () => {
    const t = today();
    assert.equal(t.getHours() + t.getMinutes() + t.getSeconds() + t.getMilliseconds(), 0);
  });

  test('daysBetween survives DST changes', () => {
    assert.equal(daysBetween(new Date(2026, 9, 31), new Date(2026, 10, 2)), 2);
    assert.equal(daysBetween(new Date(2026, 2, 7), new Date(2026, 2, 9)), 2);
    assert.equal(daysBetween(T0, plus(-7)), -7);
  });

  test('long / short dates', () => {
    assert.equal(longDate(parseDay('2026-10-14')), 'Wednesday, October 14');
    assert.equal(shortDate(parseDay('2026-10-14')), 'Oct 14');
    assert.equal(capitalize('last week'), 'Last week');
  });
});

describe('ago', () => {
  const cases: [number, string][] = [
    [0, 'today'], [-2, 'today'], [1, 'yesterday'], [2, '2 days ago'], [6, '6 days ago'], [7, 'last week'], [13, 'last week'],
    [14, '2 weeks ago'], [21, '3 weeks ago'], [30, '4 weeks ago'], [31, 'last month'], [59, 'last month'], [60, '2 months ago'],
    [364, '12 months ago'], [365, 'Oct 7, 2025'],
  ];
  for (const [n, want] of cases) test(`${n} days back → ${want}`, () => assert.equal(ago(plus(-n), T0), want));
});

describe('until', () => {
  const cases: [number, string][] = [
    [0, 'today'], [1, 'tomorrow'], [4, 'in 4 days'], [7, 'in 7 days'], [13, 'in 13 days'], [14, 'in 2 weeks'], [15, 'in 2 weeks'],
    [21, 'in 3 weeks'], [59, 'in 8 weeks'], [60, 'in 2 months'], [239, 'in 8 months'], [-3, '3 days ago'], [-7, 'last week'],
  ];
  for (const [n, want] of cases) test(`${n} days ahead → ${want}`, () => assert.equal(until(plus(n), T0), want));
});

test('span', () => {
  assert.equal(span(0), '1 day');
  assert.equal(span(1), '1 day');
  assert.equal(span(13), '13 days');
  assert.equal(span(14), '2 weeks');
  assert.equal(span(17), '2 weeks'); // Ben: Jul 15 → Aug 1
  assert.equal(span(28), '4 weeks'); // Sarah: Aug 12 → Sep 9
  assert.equal(span(60), '2 months');
});

describe('nextOccurrence', () => {
  const md = (month: number, day: number, year: number | null = null, recurring = true) => ({ month, day, year, recurring });
  test('later this year', () => assert.deepEqual(nextOccurrence(md(10, 11), T0), new Date(2026, 9, 11)));
  test('today counts as upcoming', () => assert.deepEqual(nextOccurrence(md(10, 7), T0), T0));
  test('already passed → next year', () => assert.deepEqual(nextOccurrence(md(1, 9), T0), new Date(2027, 0, 9)));
  test('recurring with a since-year still recurs', () => assert.deepEqual(nextOccurrence(md(6, 3, 2011), T0), new Date(2027, 5, 3)));
  test('one-time events keep their own (possibly past) date', () => {
    assert.deepEqual(nextOccurrence(md(9, 28, 2026, false), T0), new Date(2026, 8, 28));
    assert.deepEqual(nextOccurrence(md(4, 18, 2027, false), T0), new Date(2027, 3, 18));
  });
  test('Feb 29 falls back to Feb 28 in common years', () => {
    assert.deepEqual(nextOccurrence(md(2, 29), T0), new Date(2027, 1, 28));
    assert.deepEqual(nextOccurrence(md(2, 29), new Date(2027, 5, 1)), new Date(2028, 1, 29));
  });
});

describe('seasons', () => {
  const cases: [Date, string][] = [
    [T0, 'Fall 2026'], [new Date(2026, 6, 15), 'Summer 2026'], [new Date(2026, 3, 1), 'Spring 2026'], [new Date(2026, 2, 1), 'Spring 2026'],
    [new Date(2026, 8, 1), 'Fall 2026'], [new Date(2026, 10, 30), 'Fall 2026'], [new Date(2026, 11, 1), 'Winter 2026'],
    [new Date(2027, 0, 15), 'Winter 2026'], [new Date(2027, 1, 28), 'Winter 2026'], [new Date(2027, 2, 1), 'Spring 2027'],
  ];
  for (const [d, want] of cases) test(`${toISODay(d)} → ${want}`, () => assert.equal(seasonOf(d), want));
  test('next season name', () => {
    assert.equal(nextSeasonName(T0), 'Winter');
    assert.equal(nextSeasonName(new Date(2026, 11, 20)), 'Spring');
    assert.equal(nextSeasonName(new Date(2026, 6, 1)), 'Fall');
  });
});

test('greeting by local hour', () => {
  assert.equal(greeting(new Date(2026, 9, 7, 8)), 'Good morning');
  assert.equal(greeting(new Date(2026, 9, 7, 12)), 'Good afternoon');
  assert.equal(greeting(new Date(2026, 9, 7, 16, 59)), 'Good afternoon');
  assert.equal(greeting(new Date(2026, 9, 7, 19, 12)), 'Good evening');
});

describe('times of day and server timestamps', () => {
  test('toDay accepts Laravel’s microsecond timestamps', () => {
    const iso = new Date(2026, 9, 5, 12, 0).toISOString().replace('.000Z', '.000000Z'); // “…T19:00:00.000000Z” in Phoenix
    assert.deepEqual(toDay(iso), new Date(2026, 9, 5));
  });

  test('parseTimestamp trims microseconds and reads null as 0', () => {
    assert.equal(parseTimestamp('2026-10-05T19:00:00.123456Z'), Date.UTC(2026, 9, 5, 19, 0, 0, 123));
    assert.equal(parseTimestamp('2026-10-05T19:00:00Z'), Date.UTC(2026, 9, 5, 19));
    assert.equal(parseTimestamp(null), 0);
  });

  test('a late-evening UTC timestamp lands on the local day', () => {
    // 2026-10-08T02:30Z is still Oct 7 in the Americas, already Oct 8 east of UTC.
    const d = new Date('2026-10-08T02:30:00.000000Z'.replace(/(\.\d{3})\d+/, '$1'));
    assert.deepEqual(toDay('2026-10-08T02:30:00.000000Z'), new Date(d.getFullYear(), d.getMonth(), d.getDate()));
  });

  test('helpers ignore the time of day of `now` and of the date', () => {
    const afternoon = new Date(2026, 9, 7, 15, 30);
    assert.equal(daysBetween(afternoon, T0), 0);
    assert.equal(daysBetween(new Date(2026, 9, 6, 23, 59), new Date(2026, 9, 7, 0, 1)), 1);
    assert.equal(until(T0, afternoon), 'today');
    assert.equal(until(new Date(2026, 9, 8, 9), afternoon), 'tomorrow');
    assert.equal(ago(new Date(2026, 9, 6, 20), afternoon), 'yesterday');
    assert.deepEqual(nextOccurrence({ month: 10, day: 7, year: null, recurring: true }, afternoon), T0);
  });
});
