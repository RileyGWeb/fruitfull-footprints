import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BIBLE_CHAPTERS, archiveGroups, buildPath, chapterOf, deriveSeries, draftStudies, nextMeetingDate, paragraphs, pastStudies, seriesOf,
  notesToWarm, studyKicker, toStudyInput, upNext, verseOf,
} from './studies.ts';
import { T0, studies } from './testing/fixtures.ts';
import type { StudySummary } from './types.ts';

const all = studies();
const T1 = new Date(2026, 9, 8); // the day after meeting night
const byRef = (ref: string) => all.find(s => s.ref === ref)!;

describe('series', () => {
  test('deriveSeries strips a trailing chapter/verse', () => {
    assert.equal(deriveSeries('Romans 9'), 'Romans');
    assert.equal(deriveSeries('Romans 8:1–17'), 'Romans');
    assert.equal(deriveSeries('1 John 3:1'), '1 John');
    assert.equal(deriveSeries('Psalm 120'), 'Psalm');
    assert.equal(deriveSeries('Song of Songs 2'), 'Song of Songs');
    assert.equal(deriveSeries('Ruth'), 'Ruth');
    assert.equal(deriveSeries('  '), null);
    assert.equal(deriveSeries(null), null);
  });

  test('seriesOf prefers the explicit series', () => {
    assert.equal(seriesOf({ series: 'Psalms of Ascent', ref: 'Psalm 121' }), 'Psalms of Ascent');
    assert.equal(seriesOf({ series: null, ref: '1 John 3' }), '1 John');
    assert.equal(seriesOf({ series: ' ', ref: null }), 'Other studies');
  });

  test('chapterOf', () => {
    assert.equal(chapterOf('Romans 8'), 8);
    assert.equal(chapterOf('Romans 8:1–17'), 8);
    assert.equal(chapterOf('1 John 3:1'), 3);
    assert.equal(chapterOf('1 John'), null);
    assert.equal(BIBLE_CHAPTERS.Romans, 16);
  });
});

describe('up next / past / drafts', () => {
  test('upNext is the earliest published study today or later (drafts skipped)', () => {
    assert.equal(upNext(all, T0)?.ref, 'Romans 7'); // meeting night: tonight's study is “This week”
    assert.equal(upNext(all, T1)?.ref, 'Romans 8');
    assert.equal(upNext(all, new Date(2026, 9, 6))?.ref, 'Romans 7');
    assert.equal(upNext(all, new Date(2026, 9, 15)), null); // Romans 9 is only a draft
  });

  test('pastStudies: published, met before today, newest first', () => {
    assert.equal(pastStudies(all, T0)[0].ref, 'Romans 6');
    const past = pastStudies(all, T1);
    assert.equal(past[0].ref, 'Romans 7');
    assert.equal(past.length, 7 + 5 + 8);
    assert.ok(past.every(s => s.status === 'published'));
  });

  test('drafts', () => assert.deepEqual(draftStudies(all).map(s => s.ref), ['Romans 9']));

  test('notesToWarm: every published study to come, soonest first, then the 12 latest past ones — no drafts', () => {
    const later = { ...byRef('Romans 8'), id: 99, ref: 'Romans 10', meeting_date: '2026-10-28' };
    const refs = notesToWarm([later, ...all], T0).map(s => s.ref);
    assert.deepEqual(refs.slice(0, 3), ['Romans 7', 'Romans 8', 'Romans 10']); // tonight's counts as to come
    assert.deepEqual(refs.slice(3), ['Romans 6', 'Romans 5', 'Romans 4', 'Romans 3', 'Romans 2', 'Romans 1',
      'James 5', 'James 4', 'James 3', 'James 2', 'James 1', 'Psalm 127']);
    assert.ok(!refs.includes('Romans 9')); // a draft
    assert.deepEqual(notesToWarm(all, new Date(2027, 0, 1), 2).map(s => s.ref), ['Romans 8', 'Romans 7']);
    assert.deepEqual(notesToWarm([], T0), []);
  });

  test('studyKicker', () => {
    assert.equal(studyKicker(byRef('Romans 8'), T0), 'in 7 days');
    assert.equal(studyKicker(byRef('Romans 7'), T0), 'tonight');
    assert.equal(studyKicker(byRef('Romans 6'), T0), 'last week');
    assert.equal(studyKicker(byRef('Romans 9'), T0), 'in 2 weeks');
  });
});

describe('buildPath (“The path so far”)', () => {
  test('on meeting night the current chapter is tonight\'s', () => {
    assert.equal(buildPath(all, T0)[2].n, 'chapter 7 of 16');
  });

  test('matches the prototype the day after T0', () => {
    assert.deepEqual(buildPath(all, T1).map(b => [b.name, b.when, b.n, b.state]), [
      ['Psalms of Ascent', 'Spring 2026', '8 studies', 'done'],
      ['James', 'Summer 2026', '5 studies', 'done'],
      ['Romans', 'Fall 2026', 'chapter 8 of 16', 'current'],
      ['What’s next?', 'Winter', 'we’ll decide together', 'next'],
    ]);
  });

  test('node colours', () => {
    const [done, , current, next] = buildPath(all, T0);
    assert.deepEqual([done.dot, done.ring], ['var(--color-accent-2-500)', 'var(--color-accent-2-200)']);
    assert.deepEqual([current.dot, current.ring], ['var(--color-accent)', 'var(--color-accent-200)']);
    assert.deepEqual([next.dot, next.ring], ['var(--color-neutral-300)', 'transparent']);
  });

  test('no up-next study: the latest series is current, counted “so far”', () => {
    const path = buildPath(all.filter(s => s.ref !== 'Romans 8'), T1);
    assert.deepEqual(path[2].n, '7 studies so far');
    assert.equal(path[2].state, 'current');
  });

  test('a current series that is not a Bible book is counted', () => {
    const psalms = all.filter(s => s.series === 'Psalms of Ascent');
    const path = buildPath(psalms, new Date(2026, 4, 1));
    assert.equal(path[0].n, '8 studies so far');
  });

  test('a series published ahead that hasn\'t met yet stays off the path', () => {
    const early: StudySummary = { ...byRef('James 1'), id: 99, series: null, ref: 'Psalm 1', title: 'Two paths', meeting_date: '2026-10-28' };
    assert.deepEqual(buildPath([...all, early], T1).map(b => [b.name, b.state]), [
      ['Psalms of Ascent', 'done'],
      ['James', 'done'],
      ['Romans', 'current'],
      ['What’s next?', 'next'],
    ]);
    // ...and joins once it has met (Romans ended, so Psalm is the series in progress)
    const later = buildPath([...all.filter(s => s.series !== 'Romans'), early], new Date(2026, 9, 29));
    assert.deepEqual(later.map(b => [b.name, b.n, b.state]).at(-2), ['Psalm', '1 study so far', 'current']);
  });

  test('a done series counts only the studies that have met', () => {
    const ahead: StudySummary = { ...byRef('James 5'), id: 98, ref: 'James 6', meeting_date: '2026-12-02' };
    assert.equal(buildPath([...all, ahead], T1)[1].n, '5 studies');
  });

  test('a new series starting next week is already the current node', () => {
    const fresh: StudySummary = { ...byRef('James 1'), id: 97, series: 'Ruth', ref: 'Ruth 1', meeting_date: '2026-10-14' };
    const path = buildPath([...all.filter(s => s.series !== 'Romans'), fresh], T1);
    assert.deepEqual(path.at(-2) && [path.at(-2)!.name, path.at(-2)!.n, path.at(-2)!.state], ['Ruth', 'chapter 1 of 4', 'current']);
  });

  test('empty', () => assert.deepEqual(buildPath([], T0), []));
});

describe('archiveGroups', () => {
  test('groups past studies by series, newest first, with the series season', () => {
    const groups = archiveGroups(all, T1);
    assert.deepEqual(groups.map(g => [g.series, g.when, g.items.length]), [
      ['Romans', 'Fall 2026', 7],
      ['James', 'Summer 2026', 5],
      ['Psalms of Ascent', 'Spring 2026', 8],
    ]);
    assert.equal(groups[0].items[0].ref, 'Romans 7');
  });

  test('search matches ref, title or description (case-insensitive)', () => {
    assert.deepEqual(archiveGroups(all, T0, 'TONGUE').flatMap(g => g.items.map(s => s.ref)), ['James 3']);
    assert.deepEqual(archiveGroups(all, T0, 'faith').flatMap(g => g.items.map(s => s.ref)), ['Romans 5', 'Romans 4', 'James 2']);
    assert.deepEqual(archiveGroups(all, T0, 'romans 1').flatMap(g => g.items.map(s => s.ref)), ['Romans 1']);
    assert.deepEqual(archiveGroups(all, T0, 'nothing like this'), []);
  });
});

describe('nextMeetingDate', () => {
  test('a week after the latest study (drafts count)', () => assert.equal(nextMeetingDate(all, { meeting_day: 'Wednesday' }, T0), '2026-10-28'));
  test('no studies → the next meeting day (today counts)', () => {
    assert.equal(nextMeetingDate([], { meeting_day: 'Wednesday' }, T0), '2026-10-07');
    assert.equal(nextMeetingDate([], { meeting_day: 'Sunday' }, T0), '2026-10-11');
    assert.equal(nextMeetingDate([], null, new Date(2026, 9, 8)), '2026-10-14');
  });
  test('stale studies fall back to the meeting day', () => {
    const old = all.filter(s => s.series === 'James');
    assert.equal(nextMeetingDate(old, { meeting_day: 'Tuesday' }, T0), '2026-10-13');
  });
});

test('small helpers', () => {
  assert.deepEqual(paragraphs('One.\n\n  Two.\n \nThree.'), ['One.', 'Two.', 'Three.']);
  assert.deepEqual(paragraphs(null), []);
  const s: StudySummary = { ...byRef('Romans 8'), verse: 'There is therefore now no condemnation…' };
  assert.equal(verseOf(s), 'There is therefore now no condemnation…');
  assert.equal(verseOf({ verse: null, description: 'Desc' }), 'Desc');
  const input = toStudyInput({ ...s, meeting_date: '2026-10-14T00:00:00Z', sections: [] });
  assert.equal(input.meeting_date, '2026-10-14');
  assert.equal(input.status, 'published');
});
