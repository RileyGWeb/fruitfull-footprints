import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { T0, members, studies } from '../../lib/testing/fixtures.ts';
import type { Activity, Prayer, Settings, Snapshot } from '../../lib/types.ts';
import { homeView, placeLine } from './view.ts';

const settings: Settings = {
  group_name: 'Fruitfull Footprints', tagline: '', meeting_day: 'Wednesday', meeting_time: '7pm', meeting_place: 'Rachel’s porch', since_year: 2023,
};

const ts = (day: string) => `${day}T19:00:00.000000Z`;
const prayer = (id: number, member_id: number, added: string, status: Prayer['status'] = 'active'): Prayer => ({
  id, member_id, body: `Request ${id}`, status, answer: null, answered_at: null, created_at: ts(added), updates: [],
});

// The prototype's PRAYERS / ACTIVITY in snapshot order (newest first, id desc on ties).
const PRAYERS = [
  prayer(3, 7, '2026-10-04'), prayer(2, 3, '2026-10-03'), prayer(4, 2, '2026-09-30'), prayer(1, 2, '2026-09-28'),
  prayer(5, 1, '2026-09-24'), prayer(6, 4, '2026-09-20'), prayer(7, 5, '2026-09-16'), prayer(8, 1, '2026-09-10'),
  prayer(10, 4, '2026-08-20', 'answered'), prayer(9, 2, '2026-08-12', 'answered'),
];
const ACTIVITY: Activity[] = [
  { id: 4, kind: 'study_published', text: 'Romans 8 study notes were published', created_at: ts('2026-10-05') },
  { id: 3, kind: 'prayer_updated', text: 'Sarah’s request has an update', created_at: ts('2026-10-05') },
  { id: 2, kind: 'prayer_added', text: 'New prayer request for Hannah', created_at: ts('2026-10-04') },
  { id: 1, kind: 'prayer_added', text: 'New prayer request for Mike', created_at: ts('2026-10-03') },
  { id: 0, kind: 'member_added', text: 'Ben joined the group', created_at: ts('2026-04-20') },
];

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  settings, members: members(), prayers: PRAYERS, studies: studies(), activity: ACTIVITY, server_time: ts('2026-10-07'), ...over,
});

// The day after meeting night — where the demo seeder puts the live app on 2026-10-08.
const T1 = new Date(2026, 9, 8);

describe('homeView the day after meeting night', () => {
  const v = homeView(snap(), T1);

  test('this week is Romans 8, in 6 days, on Rachel’s porch', () => {
    assert.equal(v.week.study?.ref, 'Romans 8');
    assert.equal(v.week.kicker, 'in 6 days');
    assert.equal(v.week.place, 'Wednesday, October 14 · Rachel’s porch, 7pm');
  });

  test('newest three active prayers, with the active count', () => {
    assert.deepEqual(v.prayers.map(p => [p.name, p.ago]), [['Hannah', '4 days ago'], ['Mike', '5 days ago'], ['Sarah', 'last week']]);
    assert.equal(v.activeCount, 8);
  });

  test('coming up: dates within 45 days, at most five', () => {
    assert.deepEqual(v.coming.map(r => [r.title, r.sub]), [
      ['Rachel’s birthday', 'in 3 days · Sunday'],
      ['Frank’s knee surgery', 'Mike · in 8 days · Friday'],
      ['Mike & Lauren’s anniversary', '16 years · in 10 days · Sunday'],
      ['Grace’s birthday', 'in 2 weeks · Thursday'],
      ['Hannah & Caleb’s anniversary', '3 years · in 3 weeks · Wednesday'],
    ]);
    assert.equal(v.noDates, false);
  });

  test('our group keeps the snapshot (join) order', () => {
    assert.deepEqual(v.members.map(m => m.id), [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('recently: newest four, same-day ties in server order', () => {
    assert.deepEqual(v.activity.map(a => [a.text, a.ago]), [
      ['Romans 8 study notes were published', '3 days ago'],
      ['Sarah’s request has an update', '3 days ago'],
      ['New prayer request for Hannah', '4 days ago'],
      ['New prayer request for Mike', '5 days ago'],
    ]);
  });
});

describe('homeView edge cases', () => {
  test('meeting night: tonight’s study is still “this week”', () => {
    const v = homeView(snap(), T0);
    assert.equal(v.week.study?.ref, 'Romans 7');
    assert.equal(v.week.kicker, 'tonight');
    assert.equal(v.week.place, 'Wednesday, October 7 · Rachel’s porch, 7pm');
  });

  test('a study’s own location wins over the usual place', () => {
    const list = studies().map(s => (s.ref === 'Romans 8' ? { ...s, location: 'The Hales’ backyard' } : s));
    assert.equal(homeView(snap({ studies: list }), T1).week.place, 'Wednesday, October 14 · The Hales’ backyard, 7pm');
  });

  test('no up-next study points at the next meeting night', () => {
    const v = homeView(snap({ studies: studies().filter(s => s.meeting_date < '2026-10-07') }), T0);
    assert.equal(v.week.study, null);
    assert.equal(v.week.kicker, 'tonight');
    const w = homeView(snap({ studies: [] }), T1);
    assert.equal(w.week.kicker, 'in 6 days');
    assert.equal(w.week.place, 'Wednesday, October 14 · Rachel’s porch, 7pm');
  });

  test('an empty group', () => {
    const v = homeView(snap({ members: [], prayers: [], studies: [], activity: [] }), T0);
    assert.deepEqual([v.prayers, v.coming, v.members, v.activity], [[], [], [], []]);
    assert.equal(v.activeCount, 0);
    assert.equal(v.noDates, true);
  });

  test('only a past one-time event: no rows, but the group does have dates', () => {
    const list = members().map(m => ({
      ...m,
      dates: m.id === 3 ? [{ id: 900, member_id: 3, kind: 'event' as const, label: 'Moving day', month: 3, day: 2, year: 2026, recurring: false }] : [],
    }));
    const v = homeView(snap({ members: list }), T1);
    assert.deepEqual(v.coming, []);
    assert.equal(v.noDates, false);
  });

  test('prayers added at the same moment: the newest id first, whatever the snapshot order', () => {
    const same = [prayer(20, 1, '2026-10-06'), prayer(22, 2, '2026-10-06'), prayer(21, 3, '2026-10-06'), prayer(23, 4, '2026-10-01', 'answered')];
    const v = homeView(snap({ prayers: same }), T1);
    assert.deepEqual(v.prayers.map(p => p.prayer.id), [22, 21, 20]);
    assert.equal(v.activeCount, 3);
  });

  test('placeLine leaves out blank parts', () => {
    const d = new Date(2026, 9, 14);
    assert.equal(placeLine(d, 'Rachel’s porch', ''), 'Wednesday, October 14 · Rachel’s porch');
    assert.equal(placeLine(d, '', '7pm'), 'Wednesday, October 14 · 7pm');
    assert.equal(placeLine(d, null, null), 'Wednesday, October 14');
  });
});
