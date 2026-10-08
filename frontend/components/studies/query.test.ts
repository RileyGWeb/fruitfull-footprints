import assert from 'node:assert/strict';
import { test } from 'node:test';
import { withQuery } from './query.ts';

const BASE = 'http://localhost:3110';

test('puts the trimmed search in ?q=', () => {
  assert.equal(withQuery(`${BASE}/studies`, '  Psalm 12 '), '/studies?q=Psalm+12');
  assert.equal(withQuery(`${BASE}/studies?q=Rom`, 'Romans'), '/studies?q=Romans');
});

test('drops ?q= when the search is blank', () => {
  assert.equal(withQuery(`${BASE}/studies?q=Psalm`, ''), '/studies');
  assert.equal(withQuery(`${BASE}/studies?q=Psalm`, '   '), '/studies');
  assert.equal(withQuery(`${BASE}/studies`, ''), '/studies');
});

test('keeps other params and the hash', () => {
  assert.equal(withQuery(`${BASE}/studies?x=1#previous`, 'hope'), '/studies?x=1&q=hope#previous');
  assert.equal(withQuery(`${BASE}/studies?q=a&x=1`, ''), '/studies?x=1');
});

test('round-trips characters that need escaping', () => {
  const path = withQuery(`${BASE}/studies`, 'faith & works?');
  assert.equal(new URL(path, BASE).searchParams.get('q'), 'faith & works?');
});
