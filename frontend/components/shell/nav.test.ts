import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activeNav, routeTitle } from './nav.ts';

test('activeNav: nested routes light up their tab', () => {
  const cases: [string | null, string | null][] = [
    ['/', 'home'], [null, 'home'],
    ['/people', 'people'], ['/people/dates', 'people'], ['/people/3', 'people'],
    ['/prayer', 'prayer'], ['/prayer/answered', 'prayer'],
    ['/studies', 'studies'], ['/studies/5', 'studies'], ['/studies/new', 'studies'], ['/studies/5/edit', 'studies'],
    ['/settings', null], ['/offline', null], ['/peoplex', null],
  ];
  for (const [path, want] of cases) assert.equal(activeNav(path), want, String(path));
});

test('routeTitle: every route gets its own title label', () => {
  const known = {
    members: [{ id: 1, name: 'Rachel Owens' }],
    studies: [{ id: 5, ref: 'Romans 8', status: 'published' as const }, { id: 6, ref: 'Romans 9', status: 'draft' as const }],
  };
  const cases: [string | null, string | null][] = [
    ['/', null], [null, null],
    ['/people', 'People'], ['/people/dates', 'Dates to remember'], ['/people/1', 'Rachel Owens'], ['/people/99', 'People'],
    ['/prayer', 'Prayer'], ['/prayer/answered', 'Answered prayers'],
    ['/studies', 'Studies'], ['/studies/new', 'New study'], ['/studies/5', 'Romans 8'], ['/studies/99', 'Study'],
    ['/studies/5/edit', 'Editing Romans 8'], ['/studies/6/edit', 'Preparing Romans 9'], ['/studies/99/edit', 'Edit study'],
    ['/settings', 'Settings'], ['/nope', null],
  ];
  for (const [path, want] of cases) assert.equal(routeTitle(path, known), want, String(path));
  assert.equal(routeTitle('/people/1'), 'People'); // before the snapshot loads
});
