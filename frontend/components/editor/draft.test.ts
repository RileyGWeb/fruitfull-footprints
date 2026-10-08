import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Study } from '../../lib/types.ts';
import {
  MAX_SECTION_TEXT, MESSAGES, checkDraft, fieldErrors, fromStudy, hasContent, moveSection, newDraft, newSectionId, sameDraft, toBody, toInput,
  type Draft,
} from './draft.ts';

const romans9: Study = {
  id: 2, series: 'Romans', ref: 'Romans 9', title: 'God’s Purposes', passage: 'Romans 9:1–24', meeting_date: '2026-10-21',
  location: null, description: 'A hard chapter, honestly.', status: 'draft', published_at: null, verse: null,
  updated_at: '2026-10-07T19:00:00.000000Z',
  sections: [
    { id: 's1', type: 'text', heading: 'Opening Thought', body: 'Paul begins with grief.' },
    { id: 's2', type: 'scripture', ref: 'Romans 9:1–2', text: 'I tell the truth in Christ.' },
    { id: 's3', type: 'questions', heading: 'Discussion Questions', items: ['One?', 'Two?'] },
  ],
};

test('newDraft: the three starting sections, each with its own id', () => {
  const d = newDraft('2026-10-28');
  assert.equal(d.date, '2026-10-28');
  assert.deepEqual(d.sections.map(s => [s.type, s.head]), [['text', 'Opening Thought'], ['scripture', ''], ['questions', 'Discussion Questions']]);
  assert.equal(new Set(d.sections.map(s => s.id)).size, 3);
  assert.ok(d.sections.every(s => s.id.length <= 40));
});

test('fromStudy → toInput round-trips a saved study', () => {
  const d = fromStudy(romans9);
  assert.equal(d.series, '', 'a series the ref implies shows as derived');
  assert.equal(d.sections[1].head, 'Romans 9:1–2');
  assert.equal(d.sections[2].body, 'One?\nTwo?');
  const input = toInput(d, 'published');
  assert.equal(input.series, null);
  assert.equal(input.location, null);
  assert.equal(input.status, 'published');
  assert.deepEqual(input.sections, [
    { id: 's1', type: 'text', heading: 'Opening Thought', body: 'Paul begins with grief.' },
    { id: 's2', type: 'scripture', ref: 'Romans 9:1–2', text: 'I tell the truth in Christ.' },
    { id: 's3', type: 'questions', heading: 'Discussion Questions', items: ['One?', 'Two?'] },
  ]);
});

test('fromStudy keeps an explicit series that differs from the derived one', () => {
  assert.equal(fromStudy({ ...romans9, series: 'Psalms of Ascent', ref: 'Psalm 121' }).series, 'Psalms of Ascent');
});

test('sameDraft ignores whitespace and blank question lines, not real edits', () => {
  const a = fromStudy(romans9);
  const b: Draft = { ...a, title: ' God’s Purposes ', sections: a.sections.map(s => (s.type === 'questions' ? { ...s, body: 'One?\n\n Two?\n' } : s)) };
  assert.ok(sameDraft(a, b));
  assert.ok(!sameDraft(a, { ...a, title: 'Something else' }));
  assert.ok(!sameDraft(a, { ...a, sections: moveSection(a.sections, 's2', -1) }));
});

test('moveSection swaps neighbours and ignores moves past the ends', () => {
  const list = fromStudy(romans9).sections;
  assert.deepEqual(moveSection(list, 's2', -1).map(s => s.id), ['s2', 's1', 's3']);
  assert.deepEqual(moveSection(list, 's2', 1).map(s => s.id), ['s1', 's3', 's2']);
  assert.equal(moveSection(list, 's1', -1), list);
  assert.equal(moveSection(list, 's3', 1), list);
});

test('toInput: a draft keeps empty sections, publishing leaves them out', () => {
  const d = newDraft('2026-10-28');
  assert.equal(toInput(d, 'draft').sections.length, 3);
  assert.equal(toInput(d, 'published').sections.length, 0);
  const filled = { ...d, sections: d.sections.map((x, i) => (i === 1 ? { ...x, head: 'John 1:1' } : x)) };
  assert.deepEqual(toInput(filled, 'published').sections.map(x => x.type), ['scripture']);
});

test('hasContent: text matters, a heading alone does not', () => {
  assert.ok(!hasContent({ id: 'x', type: 'text', head: 'Opening Thought', body: '  ' }));
  assert.ok(hasContent({ id: 'x', type: 'text', head: '', body: 'Hi' }));
  assert.ok(hasContent({ id: 'x', type: 'scripture', head: 'John 1:1', body: '' }));
});

test('checkDraft: publishing needs a passage and a title; every save needs a date', () => {
  const d = newDraft('2026-10-28');
  assert.deepEqual(checkDraft(d, 'draft'), {});
  assert.deepEqual(Object.keys(checkDraft(d, 'published')), ['ref', 'title']);
  assert.deepEqual(Object.keys(checkDraft({ ...d, date: '' }, 'draft')), ['meeting_date']);
  const many = { ...d, sections: [...d.sections, ...Array.from({ length: 60 }, () => ({ ...d.sections[0], id: newSectionId(), body: 'x' }))] };
  assert.deepEqual(Object.keys(checkDraft(many, 'draft')), ['sections']);
  const q = d.sections[2];
  const long = { ...d, sections: [{ ...q, body: Array.from({ length: 41 }, (_, i) => `Q${i}?`).join('\n\n') }] };
  assert.deepEqual(Object.keys(checkDraft(long, 'draft')), [`section:${q.id}`]);
});

test('fieldErrors maps server keys to fields and section ids, in plain words', () => {
  const sent = fromStudy(romans9).sections;
  const e = fieldErrors({
    ref: ['The ref field is required when status is published.'],
    title: ['The title field must not be greater than 160 characters.'],
    'sections.2.items': ['The sections.2.items field must not have more than 40 items.'],
    'sections.9.body': ['Nope.'],
  }, sent);
  assert.equal(e.ref, 'Add the passage before publishing.');
  assert.equal(e.title, 'That’s a little long — keep it under 160 characters.');
  assert.equal(e['section:s3'], 'Up to 40 questions fit in one section — try splitting them.');
  assert.equal(e.sections, 'Nope.');
});

test('checkDraft: meeting dates outside 1900–2200 are caught before the server sees them', () => {
  const d = newDraft('2026-10-28');
  assert.equal(checkDraft({ ...d, date: '0001-01-01' }, 'draft').meeting_date, 'Pick a date between 1900 and 2200.');
  assert.equal(checkDraft({ ...d, date: '2201-01-01' }, 'draft').meeting_date, 'Pick a date between 1900 and 2200.');
  assert.deepEqual(checkDraft({ ...d, date: '1900-01-01' }, 'draft'), {});
  assert.deepEqual(checkDraft({ ...d, date: '2200-12-31' }, 'draft'), {});
});

test('checkDraft: section text over 20,000 characters is caught under its card, in plain words', () => {
  const d = newDraft('2026-10-28');
  const [text, verses, questions] = d.sections;
  const over = 'x'.repeat(MAX_SECTION_TEXT + 1);
  const at = (patch: Partial<typeof text>, x = text) => checkDraft({ ...d, sections: [{ ...x, ...patch }] }, 'draft')[`section:${x.id}`];
  assert.equal(at({ body: over }), 'That’s a little long — keep it under 20,000 characters.');
  assert.equal(at({ head: over }, verses), MESSAGES.sectionText);
  assert.equal(at({ body: `${'y'.repeat(MAX_SECTION_TEXT)}\nshort?` }, questions), undefined, 'questions count one line at a time');
  assert.equal(at({ body: `${over}\nshort?` }, questions), MESSAGES.sectionText);
  assert.equal(at({ body: `  ${'x'.repeat(MAX_SECTION_TEXT)}  ` }), undefined, 'measured as sent (trimmed)');
});

test('toBody sends the version the form was based on, unless overwriting', () => {
  const d = fromStudy(romans9);
  assert.equal(toBody(d, 'draft', romans9.updated_at).expected_updated_at, '2026-10-07T19:00:00.000000Z');
  assert.ok(!('expected_updated_at' in toBody(d, 'draft', null)));
  assert.deepEqual({ ...toBody(d, 'published', 'x'), expected_updated_at: undefined }, { ...toInput(d, 'published'), expected_updated_at: undefined });
});

test('fieldErrors: what no field stands for goes to `form`; section errors show the server’s plain copy', () => {
  const sent = fromStudy(romans9).sections;
  const e = fieldErrors({
    status: ['The selected status is invalid.'],
    expected_updated_at: ['The expected updated at field must be a valid date.'],
    meeting_date: ['Pick a date between 1900 and 2200.'],
    'sections.0.body': ['This needs to be text.'],
  }, sent);
  assert.equal(e.form, 'The selected status is invalid.');
  assert.equal(e.meeting_date, 'Pick a date between 1900 and 2200.');
  assert.equal(e['section:s1'], 'This needs to be text.');
  assert.equal(fieldErrors({ meeting_date: ['The meeting date field is required.'] }, sent).meeting_date, 'Pick the date we’ll meet.');
});
