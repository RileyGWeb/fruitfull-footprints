import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { activeOf, answeredAt, answeredOf, byNewest, updateWhen } from './prayers.ts';
import { T0 } from './testing/fixtures.ts';
import type { Prayer } from './types.ts';

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString().replace('.000Z', '.000000Z');
const prayer = (id: number, member_id: number, status: Prayer['status'], created: string, answered: string | null = null): Prayer =>
  ({ id, member_id, body: `#${id}`, status, answer: null, answered_at: answered, created_at: created, updates: [] });

const LIST: Prayer[] = [
  prayer(1, 1, 'active', at(2026, 9, 1)),
  prayer(2, 2, 'active', at(2026, 10, 2)),
  prayer(3, 1, 'active', at(2026, 10, 2)), // same day as #2: the newer id goes first
  prayer(4, 1, 'answered', at(2026, 6, 1), at(2026, 9, 20)),
  prayer(5, 2, 'answered', at(2026, 8, 1), at(2026, 10, 1)),
  prayer(6, 1, 'answered', at(2026, 9, 25), null), // no answered_at: counts from when it was added
];

describe('prayers', () => {
  test('activeOf: newest first, ties by id, optionally one member', () => {
    assert.deepEqual(activeOf(LIST).map(p => p.id), [3, 2, 1]);
    assert.deepEqual(activeOf(LIST, 1).map(p => p.id), [3, 1]);
    assert.deepEqual(activeOf(LIST, 9), []);
  });

  test('answeredOf: most recently answered first, answered_at falling back to created_at', () => {
    assert.deepEqual(answeredOf(LIST).map(p => p.id), [5, 6, 4]);
    assert.deepEqual(answeredOf(LIST, 1).map(p => p.id), [6, 4]);
    assert.equal(answeredAt(LIST[5]), LIST[5].created_at);
  });

  test('byNewest reads Laravel microsecond timestamps', () => {
    const a = prayer(7, 1, 'active', '2026-10-05T19:00:00.000001Z');
    const b = prayer(8, 1, 'active', '2026-10-05T19:00:00.999999Z');
    assert.deepEqual([a, b].sort(byNewest(p => p.created_at)).map(p => p.id), [8, 7]);
  });

  test('updateWhen is the capitalised ago()', () => {
    assert.equal(updateWhen({ created_at: at(2026, 9, 30) }, T0), 'Last week');
    assert.equal(updateWhen({ created_at: at(2026, 10, 7) }, T0), 'Today');
  });
});
