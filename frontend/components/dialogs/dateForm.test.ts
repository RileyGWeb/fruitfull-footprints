import assert from 'node:assert/strict';
import { test } from 'node:test';
import { T0 } from '../../lib/testing/fixtures.ts';
import type { DateInput } from '../../lib/types.ts';
import { datePatch, fieldDay, isYearless } from './dateForm.ts';

const margaret = { month: 5, day: 4, year: null }; // David's “Remembering Margaret”: no year kept
const wedding = { month: 6, day: 3, year: 2011 };
const input = (date: string, recurring: boolean): DateInput => ({ kind: 'event', label: 'Remembering Margaret', date, recurring });

test('the field shows this year for a date kept without one', () => {
  assert.equal(fieldDay(margaret, T0), '2026-05-04');
  assert.equal(fieldDay(wedding, T0), '2011-06-03');
  assert.equal(isYearless(margaret), true);
  assert.equal(isYearless(wedding), false);
  assert.equal(isYearless(undefined), false);
  // the field can't hold February 29 in a common year: it shows the next leap year
  assert.equal(fieldDay({ month: 2, day: 29, year: null }, T0), '2028-02-29');
  assert.equal(fieldDay({ month: 2, day: 29, year: 1992 }, T0), '1992-02-29');
});

test('an untouched date is left out, so no year is invented', () => {
  assert.deepEqual(datePatch(margaret, input('2026-05-04', true), '2026-05-04'), { kind: 'event', label: 'Remembering Margaret', recurring: true });
  assert.deepEqual(datePatch(wedding, input('2011-06-03', true), '2011-06-03'), { kind: 'event', label: 'Remembering Margaret', recurring: true });
});

test('a changed date is sent', () => {
  assert.equal(datePatch(wedding, input('2011-06-04', true), '2011-06-03').date, '2011-06-04');
  assert.equal(datePatch(wedding, input('2026-06-04', false), '2011-06-03').date, '2026-06-04'); // now one-time
  // a year picked for a date kept without one is the user's: it's sent
  assert.equal(datePatch(margaret, input('1990-05-04', true), '2026-05-04').date, '1990-05-04');
});

test('a yearless date moved to another day (the filled-in year untouched) stays yearless: --MM-DD', () => {
  assert.deepEqual(datePatch(margaret, input('2026-05-06', true), '2026-05-04'),
    { kind: 'event', label: 'Remembering Margaret', date: '--05-06', recurring: true });
  assert.equal(datePatch(margaret, input('2028-02-29', true), '2028-05-04').date, '--02-29');
  // ...but a date that has a year, or one becoming one-time, always goes in full
  assert.equal(datePatch(wedding, input('2011-07-03', true), '2011-06-03').date, '2011-07-03');
  assert.equal(datePatch(margaret, input('2026-05-06', false), '2026-05-04').date, '2026-05-06');
});

test('switching a yearless date to one-time always sends the date the user picked', () => {
  // even when they picked the very date the field had shown
  assert.equal(datePatch(margaret, input('2026-05-04', false), '2026-05-04').date, '2026-05-04');
  // a date that has its year can switch without one
  assert.equal(datePatch(wedding, input('2011-06-03', false), '2011-06-03').date, undefined);
});
