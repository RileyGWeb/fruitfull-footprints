// Study helpers: up next, archive, “the path so far”, kickers and defaults for new studies.
import { WEEKDAYS, ago, daysBetween, nextSeasonName, parseDay, seasonOf, toISODay, today, until } from './dates.ts';
import type { Settings, Study, StudyInput, StudySummary } from './types.ts';

export const BIBLE_CHAPTERS: Record<string, number> = {
  Genesis: 50, Exodus: 40, Leviticus: 27, Numbers: 36, Deuteronomy: 34, Joshua: 24, Judges: 21, Ruth: 4,
  '1 Samuel': 31, '2 Samuel': 24, '1 Kings': 22, '2 Kings': 25, '1 Chronicles': 29, '2 Chronicles': 36,
  Ezra: 10, Nehemiah: 13, Esther: 10, Job: 42, Psalms: 150, Psalm: 150, Proverbs: 31, Ecclesiastes: 12,
  'Song of Songs': 8, 'Song of Solomon': 8, Isaiah: 66, Jeremiah: 52, Lamentations: 5, Ezekiel: 48, Daniel: 12,
  Hosea: 14, Joel: 3, Amos: 9, Obadiah: 1, Jonah: 4, Micah: 7, Nahum: 3, Habakkuk: 3, Zephaniah: 3, Haggai: 2,
  Zechariah: 14, Malachi: 4, Matthew: 28, Mark: 16, Luke: 24, John: 21, Acts: 28, Romans: 16,
  '1 Corinthians': 16, '2 Corinthians': 13, Galatians: 6, Ephesians: 6, Philippians: 4, Colossians: 4,
  '1 Thessalonians': 5, '2 Thessalonians': 3, '1 Timothy': 6, '2 Timothy': 4, Titus: 3, Philemon: 1,
  Hebrews: 13, James: 5, '1 Peter': 5, '2 Peter': 3, '1 John': 5, '2 John': 1, '3 John': 1, Jude: 1, Revelation: 22,
};

/** “Romans 9” → “Romans”, “1 John 3:1” → “1 John”; null when the ref is blank. */
export function deriveSeries(ref: string | null | undefined): string | null {
  const s = (ref ?? '').trim().replace(/\s+\d+([:.–-].*)?$/, '').trim();
  return s || null;
}

/** The series a study belongs to (explicit, else derived from its ref). */
export const seriesOf = (s: Pick<StudySummary, 'series' | 'ref'>) => s.series?.trim() || deriveSeries(s.ref) || 'Other studies';

/** Chapter number in a ref like “Romans 8” / “Romans 8:1–17”, else null. */
export function chapterOf(ref: string | null | undefined): number | null {
  const m = (ref ?? '').match(/\s(\d+)(?:[:.–-].*)?$/);
  return m ? Number(m[1]) : null;
}

const published = (studies: StudySummary[]) => studies.filter(s => s.status === 'published');
const byDateAsc = (a: StudySummary, b: StudySummary) => a.meeting_date.localeCompare(b.meeting_date);
const byDateDesc = (a: StudySummary, b: StudySummary) => b.meeting_date.localeCompare(a.meeting_date);

/** The earliest published study meeting today or later — on meeting night, tonight's study is “This week”. */
export function upNext<T extends StudySummary>(studies: T[], now: Date = today()): T | null {
  const iso = toISODay(now);
  return (published(studies) as T[]).filter(s => s.meeting_date >= iso).sort(byDateAsc)[0] ?? null;
}

/** Published studies that met before today, newest first. */
export function pastStudies<T extends StudySummary>(studies: T[], now: Date = today()): T[] {
  const iso = toISODay(now);
  return (published(studies) as T[]).filter(s => s.meeting_date < iso).sort(byDateDesc);
}

/** How many past studies keep their notes saved for reading offline. */
export const OFFLINE_PAST_STUDIES = 12;

/**
 * The studies whose notes are most likely to be opened next, so worth saving for offline reading:
 * every published study still to come (soonest first, up next included), then the most recent past ones.
 */
export function notesToWarm<T extends StudySummary>(studies: T[], now: Date = today(), past = OFFLINE_PAST_STUDIES): T[] {
  const iso = toISODay(now);
  const upcoming = (published(studies) as T[]).filter(s => s.meeting_date >= iso).sort(byDateAsc);
  return [...upcoming, ...pastStudies(studies, now).slice(0, past)];
}

/** Drafts, newest meeting date first. */
export const draftStudies = <T extends StudySummary>(studies: T[]): T[] => studies.filter(s => s.status === 'draft').sort(byDateDesc);

/** “in 7 days” · “tomorrow” · “tonight” · “last week”. */
export function studyKicker(study: Pick<StudySummary, 'meeting_date'>, now: Date = today()): string {
  const d = parseDay(study.meeting_date), n = daysBetween(now, d);
  return n > 0 ? until(d, now) : n === 0 ? 'tonight' : ago(d, now);
}

/** The line under a study on Studies: its verse, else its description. */
export const verseOf = (s: Pick<StudySummary, 'verse' | 'description'>) => s.verse || s.description || '';

/** Splits body text into paragraphs on blank lines. */
export const paragraphs = (text: string | null | undefined) => (text ?? '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

const countStudies = (n: number) => (n === 1 ? '1 study' : `${n} studies`);
const median = (list: StudySummary[]) => parseDay(list.slice().sort(byDateAsc)[Math.floor((list.length - 1) / 2)].meeting_date);

export type PathNode = {
  key: string;
  name: string;
  when: string; // “Fall 2026” (or “Winter” for the final node)
  n: string; // “5 studies” · “chapter 8 of 16” · “we’ll decide together”
  state: 'done' | 'current' | 'next';
  dot: string;
  ring: string;
};

const NODE_COLORS = {
  done: { dot: 'var(--color-accent-2-500)', ring: 'var(--color-accent-2-200)' },
  current: { dot: 'var(--color-accent)', ring: 'var(--color-accent-200)' },
  next: { dot: 'var(--color-neutral-300)', ring: 'transparent' },
};

/** Groups published studies by series, in order of each series' first meeting. */
function seriesGroups(studies: StudySummary[]) {
  const groups = new Map<string, StudySummary[]>();
  for (const s of published(studies).sort(byDateAsc)) {
    const k = seriesOf(s);
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  return groups;
}

/**
 * “The path so far”: one node per series, the current one highlighted, then “What’s next?”. A series
 * that hasn't met yet (published early, not up next) isn't on the path until it starts.
 */
export function buildPath(studies: StudySummary[], now: Date = today()): PathNode[] {
  const groups = seriesGroups(studies);
  if (!groups.size) return [];
  const iso = toISODay(now);
  const next = upNext(studies, now);
  const current = next ? seriesOf(next) : seriesOf(published(studies).sort(byDateDesc)[0]);
  const nodes: PathNode[] = [...groups].flatMap(([name, list]): PathNode[] => {
    if (name === current) {
      const total = BIBLE_CHAPTERS[name], ch = next ? chapterOf(next.ref) : null;
      const n = total && ch ? `chapter ${ch} of ${total}` : `${countStudies(list.length)} so far`;
      return [{ key: name, name, when: seasonOf(median(list)), n, state: 'current', ...NODE_COLORS.current }];
    }
    const met = list.filter(s => s.meeting_date < iso);
    if (!met.length) return [];
    return [{ key: name, name, when: seasonOf(median(met)), n: countStudies(met.length), state: 'done', ...NODE_COLORS.done }];
  });
  return [...nodes, { key: '__next', name: 'What’s next?', when: nextSeasonName(now), n: 'we’ll decide together', state: 'next', ...NODE_COLORS.next }];
}

export type ArchiveGroup<T extends StudySummary = StudySummary> = { key: string; series: string; when: string; items: T[] };

/** “Previous studies”: past published studies grouped by series (newest first), filtered by a search query. */
export function archiveGroups<T extends StudySummary>(studies: T[], now: Date = today(), query = ''): ArchiveGroup<T>[] {
  const q = query.trim().toLowerCase();
  const seasons = new Map([...seriesGroups(studies)].map(([k, list]) => [k, seasonOf(median(list))]));
  const out: ArchiveGroup<T>[] = [];
  for (const s of pastStudies(studies, now)) {
    if (q && !`${s.ref ?? ''} ${s.title ?? ''} ${s.description ?? ''}`.toLowerCase().includes(q)) continue;
    const series = seriesOf(s);
    let g = out.find(x => x.series === series);
    if (!g) out.push((g = { key: series, series, when: seasons.get(series) ?? '', items: [] }));
    g.items.push(s);
  }
  return out;
}

/** Default meeting date for a new study ('YYYY-MM-DD'): a week after the latest study, else the next meeting day. */
export function nextMeetingDate(studies: StudySummary[], settings: Pick<Settings, 'meeting_day'> | null | undefined, now: Date = today()): string {
  const latest = studies.slice().sort(byDateDesc)[0];
  if (latest) {
    const d = parseDay(latest.meeting_date);
    d.setDate(d.getDate() + 7);
    if (daysBetween(now, d) >= 0) return toISODay(d);
  }
  const wd = WEEKDAYS.indexOf(settings?.meeting_day ?? 'Wednesday');
  const d = new Date(now);
  d.setDate(d.getDate() + ((wd < 0 ? 3 : wd) - d.getDay() + 7) % 7);
  return toISODay(d);
}

/** A full study → the body PUT /api/studies/{id} expects (full replace). */
export function toStudyInput(s: Study): StudyInput {
  return {
    series: s.series, ref: s.ref, title: s.title, passage: s.passage, meeting_date: s.meeting_date.slice(0, 10),
    location: s.location, description: s.description, sections: s.sections, status: s.status,
  };
}
