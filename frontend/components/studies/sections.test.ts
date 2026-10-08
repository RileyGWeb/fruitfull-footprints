import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readerSections } from './sections.ts';
import type { Section } from '../../lib/types.ts';

test('splits bodies on blank lines and keeps every kind in order', () => {
  const sections: Section[] = [
    { id: 'a', type: 'text', heading: 'Opening Thought', body: 'One.\n\n  \nTwo.' },
    { id: 'b', type: 'scripture', ref: 'Romans 8:1–2', text: 'There is therefore now no condemnation…' },
    { id: 'c', type: 'questions', heading: 'Discussion Questions', items: ['First?', '  ', 'Second?'] },
    { id: 'd', type: 'reflect', heading: 'Application', body: 'Write it on a card.' },
    { id: 'e', type: 'prayer', heading: 'Closing Prayer', body: 'Amen.' },
  ];
  assert.deepEqual(readerSections(sections), [
    { id: 'a', type: 'text', heading: 'Opening Thought', paras: ['One.', 'Two.'] },
    { id: 'b', type: 'scripture', ref: 'Romans 8:1–2', paras: ['There is therefore now no condemnation…'] },
    { id: 'c', type: 'questions', heading: 'Discussion Questions', items: ['First?', 'Second?'] },
    { id: 'd', type: 'reflect', heading: 'Application', paras: ['Write it on a card.'] },
    { id: 'e', type: 'prayer', heading: 'Closing Prayer', paras: ['Amen.'] },
  ]);
});

test('leaves out sections with nothing to read', () => {
  const sections: Section[] = [
    { id: 'a', type: 'text', heading: '  ', body: '' },
    { id: 'b', type: 'scripture', ref: 'Romans 9', text: '   ' },
    { id: 'c', type: 'questions', heading: 'Discussion Questions', items: [] },
    { id: 'd', type: 'reflect', heading: 'Application', body: '' },
    { id: 'e', type: 'text', heading: 'Things to Notice', body: '' },
  ];
  assert.deepEqual(readerSections(sections), [{ id: 'e', type: 'text', heading: 'Things to Notice', paras: [] }]);
  assert.deepEqual(readerSections(null), []);
});

test('blank headings and refs become null', () => {
  const [t, s] = readerSections([
    { id: 'a', type: 'text', heading: null, body: 'Just a paragraph.' },
    { id: 'b', type: 'scripture', ref: '', text: 'Verse.' },
  ]);
  assert.equal(t.type === 'text' && t.heading, null);
  assert.equal(s.type === 'scripture' && s.ref, null);
});
