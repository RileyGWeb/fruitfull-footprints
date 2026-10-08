import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatTitle, setShellTitle } from './title.ts';

test('formatTitle: “{screen} · {group}”, just the group for Home', () => {
  assert.equal(formatTitle('Prayer', 'Fruitfull Footprints'), 'Prayer · Fruitfull Footprints');
  assert.equal(formatTitle('Rachel Owens', 'Wednesday Group'), 'Rachel Owens · Wednesday Group');
  assert.equal(formatTitle(null, 'Wednesday Group'), 'Wednesday Group');
  assert.equal(formatTitle('  ', 'Wednesday Group'), 'Wednesday Group');
  assert.equal(formatTitle('Wednesday Group', 'Wednesday Group'), 'Wednesday Group');
  assert.equal(formatTitle('Prayer', ' '), 'Prayer · Fruitfull Footprints');
});

test('setShellTitle: the route label, or only the group name behind the Entrance', () => {
  const g = globalThis as unknown as { document?: { title: string } };
  g.document = { title: '' };
  setShellTitle('Wednesday Group', 'Studies', false);
  assert.equal(g.document.title, 'Studies · Wednesday Group');
  setShellTitle('Wednesday Group', 'Studies', true);
  assert.equal(g.document.title, 'Wednesday Group');
  delete g.document;
});
