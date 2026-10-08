// Prototype seed data (docs/design/prototype.dc.html) in API shape, for the lib unit tests.
import type { DateKind, Member, MemberDate, StudySummary, Tone } from '../types.ts';

/** The prototype's fixed today: Wednesday, October 7, 2026. */
export const T0 = new Date(2026, 9, 7);

type D = { kind: DateKind; md: string; label?: string; year?: number; once?: boolean };
const PEOPLE: [string, Tone, string[], D[]][] = [
  ['Rachel Owens', 'sage', ['Encouragement', 'Mercy', 'Hospitality'], [{ kind: 'birthday', md: '10-11' }, { kind: 'anniversary', label: 'Rachel & Tom’s anniversary', md: '06-03', year: 2011 }]],
  ['Sarah Lindqvist', 'accent', ['Faith', 'Serving', 'Giving'], [{ kind: 'birthday', md: '03-22' }, { kind: 'event', label: 'Started at St. Luke’s', md: '09-28', year: 2026, once: true }]],
  ['Mike Brennan', 'sand', ['Leadership', 'Teaching', 'Wisdom'], [{ kind: 'birthday', md: '01-09' }, { kind: 'anniversary', label: 'Mike & Lauren’s anniversary', md: '10-18', year: 2010 }, { kind: 'event', label: 'Frank’s knee surgery', md: '10-16', year: 2026, once: true }]],
  ['Michael Ortiz', 'accent', ['Evangelism', 'Prayer', 'Encouragement'], [{ kind: 'birthday', md: '11-02' }, { kind: 'event', label: 'Marathon day', md: '11-08', year: 2026, once: true }]],
  ['Grace Adeyemi', 'sage', ['Hospitality', 'Administration', 'Mercy'], [{ kind: 'birthday', md: '10-22' }, { kind: 'event', label: 'Baby due', md: '11-20', year: 2026, once: true }, { kind: 'anniversary', label: 'Grace & Tunde’s anniversary', md: '08-14', year: 2021 }]],
  ['David Hale', 'sand', ['Knowledge', 'Teaching', 'Shepherding'], [{ kind: 'birthday', md: '02-17' }, { kind: 'event', label: 'Remembering Margaret', md: '05-04' }]],
  ['Hannah Pruitt', 'accent', ['Serving', 'Giving', 'Faith'], [{ kind: 'birthday', md: '12-12' }, { kind: 'anniversary', label: 'Hannah & Caleb’s anniversary', md: '10-28', year: 2023 }, { kind: 'event', label: 'Moving day', md: '10-31', year: 2026, once: true }]],
  ['Ben Carter', 'sage', ['Encouragement', 'Serving'], [{ kind: 'birthday', md: '10-30' }, { kind: 'event', label: 'Ben & Priya’s wedding', md: '04-18', year: 2027, once: true }]],
];

export function members(): Member[] {
  let dateId = 0;
  return PEOPLE.map(([name, tone, gifts, dates], i) => {
    const id = i + 1;
    return {
      id, name, tone, gifts, line: null, family: null, interests: null, good_to_know: null, created_at: '2026-01-01T19:00:00Z',
      dates: dates.map((d): MemberDate => {
        const [month, day] = d.md.split('-').map(Number);
        return { id: ++dateId, member_id: id, kind: d.kind, label: d.label ?? null, month, day, year: d.year ?? null, recurring: !d.once };
      }),
    };
  });
}

export const member = (first: string) => members().find(m => m.name.startsWith(first + ' '))!;

const S: [string, string, string, string, string, 'draft' | 'published'][] = [
  ['Romans', 'Romans 8', 'Life in the Spirit', '2026-10-14', 'Chapter 7 ended with Paul’s honest cry: “Who will deliver me?” Chapter 8 answers it.', 'published'],
  ['Romans', 'Romans 9', 'God’s Purposes', '2026-10-21', 'A hard chapter, honestly. We’ll take it slowly and leave room for questions.', 'draft'],
  ['Romans', 'Romans 7', 'The Conflict Within', '2026-10-07', 'Paul is painfully honest about doing what he doesn’t want to do.', 'published'],
  ['Romans', 'Romans 6', 'Alive in Christ', '2026-09-30', 'If grace covers everything, why not keep sinning?', 'published'],
  ['Romans', 'Romans 5', 'Peace With God', '2026-09-23', 'Justified by faith, we have peace — and a hope that doesn’t disappoint.', 'published'],
  ['Romans', 'Romans 4', 'Faith Like Abraham', '2026-09-16', 'Abraham believed God, and it was counted to him as righteousness.', 'published'],
  ['Romans', 'Romans 3', 'All Have Fallen Short', '2026-09-09', 'The great leveling: no one is righteous on their own.', 'published'],
  ['Romans', 'Romans 2', 'The Heart of the Matter', '2026-09-02', 'God’s kindness is meant to lead us to repentance.', 'published'],
  ['Romans', 'Romans 1', 'Not Ashamed', '2026-08-26', 'The gospel is the power of God for salvation.', 'published'],
  ['James', 'James 5', 'Patient Like a Farmer', '2026-07-29', 'Waiting for rain, praying for the sick.', 'published'],
  ['James', 'James 4', 'Draw Near', '2026-07-22', 'Where quarrels come from.', 'published'],
  ['James', 'James 3', 'Taming the Tongue', '2026-07-15', 'A small spark, a great forest.', 'published'],
  ['James', 'James 2', 'Faith That Works', '2026-07-08', 'Faith without works is dead.', 'published'],
  ['James', 'James 1', 'Joy in Trials', '2026-07-01', 'Count it all joy.', 'published'],
];

/** The prototype's studies plus the demo seeder's 8 Psalms of Ascent (Wednesdays 2026-04-01 → 05-20), meeting_date desc. */
export function studies(): StudySummary[] {
  const psalms = Array.from({ length: 8 }, (_, i): (typeof S)[number] => {
    const d = new Date(2026, 3, 1 + 7 * i);
    const iso = `2026-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return ['Psalms of Ascent', `Psalm ${120 + i}`, `Song of Ascent ${i + 1}`, iso, 'A song for the road.', 'published'];
  }).reverse();
  return [...S, ...psalms].map(([series, ref, title, meeting_date, description, status], i) => ({
    id: i + 1, series, ref, title, passage: ref, meeting_date, location: null, description, status,
    published_at: status === 'published' ? `${meeting_date}T19:00:00Z` : null, verse: null, updated_at: `${meeting_date}T19:00:00Z`,
  }));
}
