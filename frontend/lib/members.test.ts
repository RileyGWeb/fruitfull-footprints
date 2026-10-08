import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BLOBS, GIFTS, KIND, TONES, avatarStyle, buildDateRows, dateTitle, firstName, giftLine, initials, lastName, nextTone, prayerCountLabel,
  profileDateRows, soonLabel,
} from './members.ts';
import { T0, member, members } from './testing/fixtures.ts';

test('names and initials', () => {
  assert.equal(firstName('Rachel Owens'), 'Rachel');
  assert.equal(lastName({ name: 'Mary Ann Smith' }), 'Ann Smith');
  assert.equal(initials('Rachel Owens'), 'RO');
  assert.equal(initials('mary ann smith'), 'MS');
  assert.equal(initials('Cher'), 'C');
});

test('avatar style uses the tone and BLOBS[(id - 1) % 4] (first member gets the first blob, like the prototype)', () => {
  assert.deepEqual(avatarStyle({ id: 7, tone: 'sand' }), { bg: TONES.sand.bg, fg: 'var(--color-neutral-800)', blob: BLOBS[2] });
  assert.equal(avatarStyle({ id: 1, tone: 'sage' }).blob, BLOBS[0]);
  assert.equal(avatarStyle({ id: 5, tone: 'sage' }).blob, BLOBS[0]);
});

test('constants', () => {
  assert.equal(GIFTS.length, 14);
  assert.equal(KIND.event.label, 'Life event');
  assert.deepEqual([0, 1, 2, 3].map(nextTone), ['sage', 'accent', 'sand', 'sage']);
  assert.equal(giftLine(member('Rachel')), 'Encouragement · Mercy · Hospitality');
  assert.deepEqual([0, 1, 3].map(prayerCountLabel), ['No active requests', '1 active prayer request', '3 active prayer requests']);
});

test('dateTitle', () => {
  assert.equal(dateTitle(member('Rachel'), { kind: 'birthday', label: null }), 'Rachel’s birthday');
  assert.equal(dateTitle('Ben Carter', { kind: 'event', label: null }), 'Life event');
  assert.equal(dateTitle('Ben Carter', { kind: 'anniversary', label: 'Ben & Priya’s anniversary' }), 'Ben & Priya’s anniversary');
});

describe('buildDateRows (Home “Coming up”, as in desktop-home)', () => {
  const rows = buildDateRows(members(), T0);

  test('first five rows match the design', () => {
    assert.deepEqual(rows.slice(0, 5).map(r => [r.title, r.sub, r.mon, r.day, r.kindLabel]), [
      ['Rachel’s birthday', 'in 4 days · Sunday', 'OCT', 11, 'Birthday'],
      ['Frank’s knee surgery', 'Mike · in 9 days · Friday', 'OCT', 16, 'Life event'],
      ['Mike & Lauren’s anniversary', '16 years · in 11 days · Sunday', 'OCT', 18, 'Anniversary'],
      ['Grace’s birthday', 'in 2 weeks · Thursday', 'OCT', 22, 'Birthday'],
      ['Hannah & Caleb’s anniversary', '3 years · in 3 weeks · Wednesday', 'OCT', 28, 'Anniversary'],
    ]);
  });

  test('rows carry member, date, days-until and chip colours', () => {
    const r = rows[0];
    assert.equal(r.member.name, 'Rachel Owens');
    assert.equal(r.n, 4);
    assert.deepEqual(r.on, new Date(2026, 9, 11));
    assert.equal(r.key, `${r.member.id}-${r.date.id}`);
    assert.deepEqual([r.chipBg, r.chipFg], [KIND.birthday.bg, KIND.birthday.fg]);
  });

  test('sorted soonest first; past one-time events dropped', () => {
    assert.ok(rows.every((r, i) => i === 0 || rows[i - 1].n <= r.n));
    assert.ok(!rows.some(r => r.title === 'Started at St. Luke’s'));
  });

  test('“1 year” is singular', () => {
    const m = { ...member('Ben'), dates: [{ id: 99, member_id: 8, kind: 'anniversary' as const, label: 'A', month: 10, day: 9, year: 2025, recurring: true }] };
    assert.equal(buildDateRows([m], T0)[0].sub, '1 year · in 2 days · Friday');
  });

  test('no “0 years” before a first anniversary', () => {
    const m = { ...member('Ben'), dates: [{ id: 99, member_id: 8, kind: 'anniversary' as const, label: 'A', month: 10, day: 9, year: 2026, recurring: true }] };
    assert.equal(buildDateRows([m], T0)[0].sub, 'in 2 days · Friday');
  });
});

test('soonLabel (People card tag)', () => {
  assert.equal(soonLabel(member('Rachel'), T0), 'Birthday in 4 days');
  assert.equal(soonLabel(member('Mike'), T0), 'Frank’s knee surgery in 9 days');
  assert.equal(soonLabel(member('Hannah'), T0), 'Anniversary in 3 weeks');
  assert.equal(soonLabel(member('David'), T0), null);
});

describe('profileDateRows', () => {
  test('Rachel: birthday has no “since”, anniversary does', () => {
    assert.deepEqual(profileDateRows(member('Rachel'), T0).map(r => [r.label, r.sub, r.mon, r.day]), [
      ['Birthday', 'October 11 · in 4 days', 'OCT', 11],
      ['Rachel & Tom’s anniversary', 'June 3 · since 2011 · in 8 months', 'JUN', 3],
    ]);
  });

  test('Sarah: past one-time events come last', () => {
    assert.deepEqual(profileDateRows(member('Sarah'), T0).map(r => [r.label, r.sub]), [
      ['Birthday', 'March 22 · in 6 months'],
      ['Started at St. Luke’s', 'September 28 · last week'],
    ]);
  });

  test('a birthday with a birth year never shows “since”', () => {
    const m = { ...member('Ben'), dates: [{ id: 1, member_id: 8, kind: 'birthday' as const, label: null, month: 10, day: 30, year: 1994, recurring: true }] };
    assert.equal(profileDateRows(m, T0)[0].sub, 'October 30 · in 3 weeks');
  });

  test('recurring events with a year show “since”', () => {
    const m = { ...member('David'), dates: [{ id: 1, member_id: 6, kind: 'event' as const, label: 'Remembering Margaret', month: 5, day: 4, year: 2022, recurring: true }] };
    assert.equal(profileDateRows(m, T0)[0].sub, 'May 4 · since 2022 · in 7 months');
  });
});
