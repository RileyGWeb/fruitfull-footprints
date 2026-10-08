import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApiError, OFFLINE_MESSAGE } from '../../lib/api.ts';
import { T0, members } from '../../lib/testing/fixtures.ts';
import type { Prayer } from '../../lib/types.ts';
import { activePrayers, answeredPrayers, updateFormError } from './views.ts';

const at = (day: string) => `${day}T19:00:00.000000Z`;
let updateId = 0;

/** The prototype's PRAYERS (member ids 1–8 in prototype order), in snapshot shape. */
const P: [number, number, string, string, string | null, string | null, [string, string][]][] = [
  [1, 2, 'Pray for peace and confidence as I settle into my new job.', '2026-09-28', null, null, [['2026-10-05', 'First full week done. Tired but grateful.']]],
  [2, 3, 'Prayer for my dad’s knee surgery on the 16th, and for the recovery after.', '2026-10-03', null, null, []],
  [3, 7, 'Wisdom as we finish packing and sign the new lease.', '2026-10-04', null, null, []],
  [4, 2, 'Please pray for my mom’s upcoming appointment.', '2026-09-30', null, null, []],
  [5, 1, 'Eli is struggling with his new teacher.', '2026-09-24', null, null, []],
  [6, 4, 'Staying healthy through the last month of training.', '2026-09-20', null, null, []],
  [7, 5, 'Healthy last weeks of pregnancy.', '2026-09-16', null, null, [['2026-09-30', 'Doctor says everything looks good so far.']]],
  [8, 1, 'Tom’s job — his team is being restructured.', '2026-09-10', null, null, [['2026-09-24', 'Still waiting to hear. Keeping him in prayer.']]],
  [9, 2, 'Hearing back about the St. Luke’s position.', '2026-08-12', '2026-09-09', 'Got the offer. Starting September 28.', []],
  [10, 4, 'Pray for my sister Dani’s job interview.', '2026-08-20', '2026-09-02', 'She got the job.', []],
  [11, 6, 'My scans next week.', '2026-08-05', '2026-08-19', 'Everything came back clear.', []],
  [12, 8, 'Courage to propose — and that she says yes!', '2026-07-15', '2026-08-01', 'She said yes.', []],
  [13, 7, 'Safe travel to see Caleb’s grandparents.', '2026-07-01', '2026-07-14', null, []],
];

const prayers = (): Prayer[] =>
  P.map(([id, member_id, body, added, answeredOn, answer, updates]) => ({
    id, member_id, body,
    status: answeredOn ? 'answered' : 'active',
    answer, answered_at: answeredOn && at(answeredOn), created_at: at(added),
    updates: updates.map(([day, text]) => ({ id: ++updateId, prayer_request_id: id, body: text, created_at: at(day) })),
  }));

test('active requests: newest first, “Added … · Mon D”, capitalised update ages', () => {
  const views = activePrayers(prayers(), members(), T0);
  assert.deepEqual(views.map(v => v.first), ['Hannah', 'Mike', 'Sarah', 'Sarah', 'Rachel', 'Michael', 'Grace', 'Rachel']);
  assert.equal(views[0].added, 'Added 3 days ago · Oct 4');
  assert.equal(views[2].added, 'Added last week · Sep 30');
  assert.equal(views[5].added, 'Added 2 weeks ago · Sep 20');
  assert.deepEqual(views[3].updates.map(u => u.when), ['2 days ago']);
  assert.deepEqual(views[6].updates.map(u => u.when), ['Last week']);
});

test('a request added over a year ago names the date once', () => {
  const old = { ...prayers()[4], created_at: at('2025-03-02'), updates: [] };
  assert.equal(activePrayers([old], members(), T0)[0].added, 'Added Mar 2, 2025');
});

test('answered requests: most recently answered first, with ago and the span carried', () => {
  const views = answeredPrayers(prayers(), members(), T0);
  assert.deepEqual(views.map(v => [v.first, v.answeredAgo, v.carried]), [
    ['Sarah', '4 weeks ago', '4 weeks'],
    ['Michael', 'last month', '13 days'],
    ['David', 'last month', '2 weeks'],
    ['Ben', '2 months ago', '2 weeks'],
    ['Hannah', '3 months ago', '13 days'],
  ]);
});

test('requests for someone no longer in the snapshot are skipped, ties keep newest id first', () => {
  const list = prayers().filter(p => p.status === 'active').map(p => ({ ...p, created_at: at('2026-10-01') }));
  const views = activePrayers(list, members().filter(m => m.id !== 1), T0);
  assert.deepEqual(views.map(v => v.prayer.id), [7, 6, 4, 3, 2, 1]);
});

test('the inline update form shows a 422 under its field, and leaves other failures to the toast', () => {
  const tooLong = new ApiError(422, 'The body field must not be greater than 2000 characters.', {
    body: ['The body field must not be greater than 2000 characters.'],
  });
  assert.equal(updateFormError(tooLong), 'The body field must not be greater than 2000 characters.');
  assert.equal(updateFormError(new ApiError(422, 'Nope', { prayer: ['That request was answered.'] })), 'That request was answered.');
  assert.equal(updateFormError(new ApiError(422, 'Nope', {})), null);
  assert.equal(updateFormError(new ApiError(404, 'Not found')), null);
  assert.equal(updateFormError(new ApiError(0, OFFLINE_MESSAGE, undefined, true)), null);
  assert.equal(updateFormError(new Error('boom')), null);
});
