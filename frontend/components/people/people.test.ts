import assert from 'node:assert/strict';
import { test } from 'node:test';
import { T0, member, members } from '../../lib/testing/fixtures.ts';
import type { Prayer } from '../../lib/types.ts';
import { aboutRows, datesByMonth, groupLine, memberPrayers, personCards, toggleGift } from './people.ts';

const at = (day: string) => `${day}T19:00:00.000000Z`;
const prayer = (id: number, member_id: number, added: string, extra: Partial<Prayer> = {}): Prayer => ({
  id, member_id, body: `Request ${id}`, status: 'active', answer: null, answered_at: null, created_at: at(added), updates: [], ...extra,
});

test('group line', () => {
  assert.equal(groupLine(8, 'Wednesday'), '8 of us, most Wednesdays.');
  assert.equal(groupLine(2, 'Tuesday'), '2 of us, most Tuesdays.');
  // A brand-new group doesn't read “0 of us” / “1 of us”.
  assert.equal(groupLine(1, 'Wednesday'), 'Just one of us so far, most Wednesdays.');
  assert.equal(groupLine(0, 'Wednesday'), 'Meeting most Wednesdays.');
});

test('person cards: join order, prayer counts and the “soon” tag (prototype values at T0)', () => {
  const prayers = [prayer(1, 1, '2026-09-24'), prayer(2, 1, '2026-09-10'), prayer(3, 3, '2026-10-03'), prayer(4, 8, '2026-07-15', { status: 'answered' })];
  const cards = personCards(members(), prayers, T0);
  assert.deepEqual(cards.map(c => c.first), ['Rachel', 'Sarah', 'Mike', 'Michael', 'Grace', 'David', 'Hannah', 'Ben']);
  const by = (f: string) => cards.find(c => c.first === f)!;
  assert.equal(by('Rachel').last, 'Owens');
  assert.equal(by('Rachel').gifts, 'Encouragement · Mercy · Hospitality');
  assert.equal(by('Rachel').prayerLabel, '2 active prayer requests');
  assert.equal(by('Mike').prayerLabel, '1 active prayer request');
  assert.equal(by('Ben').prayerLabel, 'No active requests');
  assert.equal(by('Rachel').soon, 'Birthday in 4 days');
  assert.equal(by('Mike').soon, 'Frank’s knee surgery in 9 days');
  assert.equal(by('Grace').soon, 'Birthday in 2 weeks');
  assert.equal(by('Hannah').soon, 'Anniversary in 3 weeks');
  assert.equal(by('Sarah').soon, null);
  assert.equal(by('Ben').soon, null); // Oct 30 is 23 days out
});

test('dates grouped by month with the year outside the current one', () => {
  const groups = datesByMonth(members(), T0);
  assert.deepEqual(groups.map(g => g.month), [
    'October', 'November', 'December', 'January 2027', 'February 2027', 'March 2027', 'April 2027', 'May 2027', 'June 2027', 'August 2027',
  ]);
  assert.deepEqual(groups[0].items.map(r => r.title), [
    'Rachel’s birthday', 'Frank’s knee surgery', 'Mike & Lauren’s anniversary', 'Grace’s birthday', 'Hannah & Caleb’s anniversary', 'Ben’s birthday', 'Moving day',
  ]);
  assert.equal(groups[0].items[2].sub, '16 years · in 11 days · Sunday');
  // Sarah's one-time “Started at St. Luke’s” (Sep 28, 2026) is past and left out.
  assert.ok(!groups.flatMap(g => g.items).some(r => r.title === 'Started at St. Luke’s'));
});

test('about rows skip blanks', () => {
  assert.deepEqual(aboutRows({ family: 'Married to Tom', interests: '  ', good_to_know: 'Prefers texts' }), [
    { label: 'Family', value: 'Married to Tom' },
    { label: 'Good to know', value: 'Prefers texts' },
  ]);
  assert.deepEqual(aboutRows({ ...member('Ben'), family: null, interests: null, good_to_know: null }), []);
});

test('member prayers: active newest first with capitalised update ages, answered by answered date', () => {
  const prayers = [
    prayer(8, 1, '2026-09-10', { updates: [{ id: 1, prayer_request_id: 8, body: 'Still waiting to hear.', created_at: at('2026-09-24') }] }),
    prayer(5, 1, '2026-09-24'),
    prayer(9, 1, '2026-06-01', { status: 'answered', answered_at: at('2026-07-01'), answer: 'Yes' }),
    prayer(10, 1, '2026-06-02', { status: 'answered', answered_at: at('2026-08-01') }),
    prayer(11, 2, '2026-10-01'),
  ];
  const { active, answered } = memberPrayers(prayers, 1, T0);
  assert.deepEqual(active.map(p => p.prayer.id), [5, 8]);
  assert.equal(active[0].added, 'last week');
  assert.equal(active[1].added, '3 weeks ago');
  assert.deepEqual(active[1].updates, [{ id: 1, ago: 'Last week', body: 'Still waiting to hear.' }]);
  assert.deepEqual(answered.map(p => p.prayer.id), [10, 9]);
  assert.equal(answered[0].answeredAgo, '2 months ago');
  assert.equal(active[0].answeredAgo, '');
});

test('member prayers: an answered request without answered_at counts from when it was added', () => {
  const prayers = [
    prayer(1, 1, '2026-09-30', { status: 'answered', answered_at: null }),
    prayer(2, 1, '2026-06-01', { status: 'answered', answered_at: at('2026-09-01') }),
  ];
  const { answered } = memberPrayers(prayers, 1, T0);
  assert.deepEqual(answered.map(p => p.prayer.id), [1, 2]);
  assert.equal(answered[0].answeredAgo, 'last week');
});

test('toggling gifts keeps the chosen order', () => {
  assert.deepEqual(toggleGift(['Encouragement', 'Serving'], 'Mercy'), ['Encouragement', 'Serving', 'Mercy']);
  assert.deepEqual(toggleGift(['Encouragement', 'Serving'], 'Encouragement'), ['Serving']);
});
