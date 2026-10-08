// The study editor's form state and how it maps to and from the API (pure; see draft.test.ts).
// Imports are relative with '.ts' so `node --test` can run the unit tests.
import { deriveSeries } from '../../lib/studies.ts';
import type { Section, SectionInput, SectionType, Study, StudyInput, StudyStatus } from '../../lib/types.ts';

/**
 * One study-notes card. `head` is the heading (the ref for scripture); `body` is the text, the
 * verses for scripture, or one question per line. `id` doubles as the React key and is sent to the
 * server, which keeps it, so keys stay stable across saves.
 */
export type DraftSection = { id: string; type: SectionType; head: string; body: string };

export type Draft = {
  ref: string;
  title: string;
  passage: string;
  date: string; // YYYY-MM-DD, '' when cleared
  series: string; // '' → derived from the ref on save
  location: string; // '' → the usual meeting place
  description: string;
  sections: DraftSection[];
};

/**
 * Field → message. Section errors are keyed `section:{id}`; `sections` is the list as a whole; `form`
 * is anything the server rejected that no field on the screen stands for.
 */
export type FieldErrors = Record<string, string>;

const WRITE = 'Write freely — blank lines start new paragraphs.';

/** The prototype's TYPE table, plus the heading a newly added section starts with. */
export const SECTION_KINDS: Record<SectionType, { label: string; heading: string; headPh: string; bodyPh: string; headLabel: string; bodyLabel: string }> = {
  text: { label: 'Section', heading: '', headPh: 'Heading', bodyPh: WRITE, headLabel: 'Section heading', bodyLabel: 'Section text' },
  scripture: { label: 'Scripture', heading: '', headPh: 'Romans 9:1–5', bodyPh: 'Paste the verses…', headLabel: 'Scripture reference', bodyLabel: 'Verses' },
  questions: { label: 'Questions', heading: 'Discussion Questions', headPh: 'Heading', bodyPh: 'One question per line', headLabel: 'Questions heading', bodyLabel: 'Questions, one per line' },
  reflect: { label: 'Reflection', heading: 'Reflection', headPh: 'Heading', bodyPh: WRITE, headLabel: 'Reflection heading', bodyLabel: 'Reflection text' },
  prayer: { label: 'Prayer', heading: 'Closing Prayer', headPh: 'Heading', bodyPh: WRITE, headLabel: 'Prayer heading', bodyLabel: 'Prayer text' },
};

/** The Add buttons, in order. */
export const ADD_ORDER: SectionType[] = ['text', 'scripture', 'questions', 'reflect', 'prayer'];

/** A client id for a new section (≤ 40 chars; the server keeps it). */
export const newSectionId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export const blankSection = (type: SectionType, heading = SECTION_KINDS[type].heading): DraftSection =>
  ({ id: newSectionId(), type, head: heading, body: '' });

/** A new study: Opening Thought, an empty scripture and Discussion Questions. */
export function newDraft(date: string): Draft {
  return {
    ref: '', title: '', passage: '', date, series: '', location: '', description: '',
    sections: [blankSection('text', 'Opening Thought'), blankSection('scripture'), blankSection('questions')],
  };
}

export function fromSection(x: Section): DraftSection {
  if (x.type === 'scripture') return { id: x.id, type: x.type, head: x.ref ?? '', body: x.text ?? '' };
  if (x.type === 'questions') return { id: x.id, type: x.type, head: x.heading ?? '', body: (x.items ?? []).join('\n') };
  return { id: x.id, type: x.type, head: x.heading ?? '', body: x.body ?? '' };
}

/** A saved study → the form. A series that only repeats what the ref implies shows as blank (derived). */
export function fromStudy(s: Study): Draft {
  return {
    ref: s.ref ?? '',
    title: s.title ?? '',
    passage: s.passage ?? '',
    date: s.meeting_date.slice(0, 10),
    series: s.series && s.series !== deriveSeries(s.ref) ? s.series : '',
    location: s.location ?? '',
    description: s.description ?? '',
    sections: s.sections.map(fromSection),
  };
}

const blank = (v: string) => v.trim() || null;
const lines = (v: string) => v.split('\n').map(l => l.trim()).filter(Boolean);

export function toSectionInput(x: DraftSection): SectionInput {
  if (x.type === 'scripture') return { id: x.id, type: x.type, ref: blank(x.head), text: x.body.trim() };
  if (x.type === 'questions') return { id: x.id, type: x.type, heading: blank(x.head), items: lines(x.body) };
  return { id: x.id, type: x.type, heading: blank(x.head), body: x.body.trim() };
}

/**
 * Whether a section has anything to read: text, questions, or (scripture) a ref or verses. Also
 * whether removing it is worth a confirm — a heading alone is cheap to retype.
 */
export const hasContent = (x: DraftSection) => x.body.trim() !== '' || (x.type === 'scripture' && x.head.trim() !== '');

/** The sections a save sends: all of them for a draft; a published study leaves out empty ones. */
export const sectionsToSend = (d: Draft, status: StudyStatus) => (status === 'published' ? d.sections.filter(hasContent) : d.sections);

/** The form → the body POST/PUT /api/studies expects (full replace). */
export function toInput(d: Draft, status: StudyStatus): StudyInput {
  return {
    series: blank(d.series),
    ref: blank(d.ref),
    title: blank(d.title),
    passage: blank(d.passage),
    meeting_date: d.date,
    location: blank(d.location),
    description: blank(d.description),
    sections: sectionsToSend(d, status).map(toSectionInput),
    status,
  };
}

/**
 * A save's body with the optimistic-concurrency check (SPEC §2.4): `expected` is the `updated_at` the
 * form was loaded from (or last saved as). The server answers 409 if someone has saved since. Without
 * it (a new study, or “Keep mine” after a conflict) the save overwrites.
 */
export function toBody(d: Draft, status: StudyStatus, expected: string | null): StudyInput {
  const input = toInput(d, status);
  return expected ? { ...input, expected_updated_at: expected } : input;
}

/** Same study once saved? (Ignores whitespace and blank question lines, which the server drops.) */
export const sameDraft = (a: Draft, b: Draft) => a === b || JSON.stringify(toInput(a, 'draft')) === JSON.stringify(toInput(b, 'draft'));

export function moveSection(list: DraftSection[], id: string, dir: -1 | 1): DraftSection[] {
  const i = list.findIndex(x => x.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = list.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Server limits (SPEC §2.2): sections per study, questions per section, characters per section string. */
export const MAX_SECTIONS = 60;
export const MAX_QUESTIONS = 40;
export const MAX_SECTION_TEXT = 20000;

const tooLong = (max: number) => `That’s a little long — keep it under ${max.toLocaleString('en-US')} characters.`;

export const MESSAGES = {
  ref: 'Add the passage before publishing.',
  title: 'Add a title before publishing.',
  date: 'Pick the date we’ll meet.',
  dateRange: 'Pick a date between 1900 and 2200.',
  sections: `A study can hold up to ${MAX_SECTIONS} sections.`,
  questions: `Up to ${MAX_QUESTIONS} questions fit in one section — try splitting them.`,
  sectionText: tooLong(MAX_SECTION_TEXT),
};

/** Whether any string this section sends (heading or ref; text, verses or one question) is over the limit. */
const sectionTooLong = (x: DraftSection) =>
  x.head.trim().length > MAX_SECTION_TEXT
  || (x.type === 'questions' ? lines(x.body).some(q => q.length > MAX_SECTION_TEXT) : x.body.trim().length > MAX_SECTION_TEXT);

/** What the server would reject, checked before sending: a date always; a passage and title to publish; the size limits. */
export function checkDraft(d: Draft, status: StudyStatus): FieldErrors {
  const e: FieldErrors = {};
  if (status === 'published' && !d.ref.trim()) e.ref = MESSAGES.ref;
  if (status === 'published' && !d.title.trim()) e.title = MESSAGES.title;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) e.meeting_date = MESSAGES.date;
  else if (d.date < '1900-01-01' || d.date > '2200-12-31') e.meeting_date = MESSAGES.dateRange;
  if (sectionsToSend(d, status).length > MAX_SECTIONS) e.sections = MESSAGES.sections;
  for (const x of d.sections) {
    if (x.type === 'questions' && lines(x.body).length > MAX_QUESTIONS) e[`section:${x.id}`] = MESSAGES.questions;
    else if (sectionTooLong(x)) e[`section:${x.id}`] = MESSAGES.sectionText;
  }
  return e;
}

function friendly(field: string, msg: string): string {
  if (field === 'meeting_date') return /between/i.test(msg) ? MESSAGES.dateRange : MESSAGES.date;
  if ((field === 'ref' || field === 'title') && /required/i.test(msg)) return MESSAGES[field];
  const chars = msg.match(/greater than (\d+) characters/);
  if (chars) return tooLong(Number(chars[1]));
  const items = msg.match(/more than (\d+) items/);
  if (items) return field === 'sections' ? MESSAGES.sections : MESSAGES.questions;
  return msg; // every other server message is already plain copy (backend ValidationMessagesTest)
}

/** The form fields in screen order, for focusing the first one with an error. */
export const FIELD_ORDER = ['ref', 'title', 'passage', 'meeting_date', 'series', 'location', 'description'] as const;

const ON_SCREEN = new Set<string>([...FIELD_ORDER, 'sections']);

/**
 * A 422's `errors` → messages per form field. `sections.3.items` points at the fourth section of
 * the list that was sent, so pass that list. Keys no field stands for (`status`,
 * `expected_updated_at`) go to `form`, so nothing the server said is dropped.
 */
export function fieldErrors(errors: Record<string, string[]>, sent: DraftSection[]): FieldErrors {
  const out: FieldErrors = {};
  for (const [key, msgs] of Object.entries(errors)) {
    const m = key.match(/^sections\.(\d+)/);
    const field = m ? (sent[Number(m[1])] ? `section:${sent[Number(m[1])].id}` : 'sections') : ON_SCREEN.has(key) ? key : 'form';
    if (!out[field] && msgs?.[0]) out[field] = friendly(field, msgs[0]);
  }
  return out;
}
