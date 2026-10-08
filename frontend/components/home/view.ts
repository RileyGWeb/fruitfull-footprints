// Home's view of the snapshot: the prototype's renderVals() fields week / homePrayers / coming /
// people / activity, derived for the viewer's local today.
import { ago, longDate, parseDay, toDay, today } from '../../lib/dates.ts';
import { buildDateRows, firstName, type DateRow } from '../../lib/members.ts';
import { activeOf } from '../../lib/prayers.ts';
import { nextMeetingDate, studyKicker, upNext } from '../../lib/studies.ts';
import type { Member, Prayer, Settings, Snapshot, StudySummary } from '../../lib/types.ts';

/** Newest active requests shown on Home. */
export const HOME_PRAYERS = 3;
/** Coming up: dates within this many days… */
export const COMING_DAYS = 45;
/** …at most this many of them. */
export const COMING_MAX = 5;
/** Recently: newest activity lines. */
export const RECENT_MAX = 4;

export type WeekView = {
  /** The up-next study, or null when nothing is published for today onward. */
  study: StudySummary | null;
  /** “in 7 days” · “tomorrow” · “tonight” (for the next meeting night when there's no study). */
  kicker: string;
  /** “Wednesday, October 14 · Rachel’s porch, 7pm”. */
  place: string;
};

export type HomePrayer = { prayer: Prayer; member: Member; name: string; ago: string };
export type HomeActivity = { id: number; text: string; ago: string };

export type HomeView = {
  week: WeekView;
  prayers: HomePrayer[];
  activeCount: number;
  coming: DateRow[];
  /** True when nobody has any dates saved at all (vs. none in the next six weeks, or only past events). */
  noDates: boolean;
  members: Member[];
  activity: HomeActivity[];
};

/** “Wednesday, October 14 · Rachel’s porch, 7pm” — blank place or time parts are left out. */
export function placeLine(day: Date, place: string | null | undefined, time: string | null | undefined): string {
  const where = [place?.trim(), time?.trim()].filter(Boolean).join(', ');
  return [longDate(day), where].filter(Boolean).join(' · ');
}

const newestFirst = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at);

function weekView(studies: StudySummary[], settings: Settings, now: Date): WeekView {
  const study = upNext(studies, now);
  if (study) {
    return {
      study,
      kicker: studyKicker(study, now),
      place: placeLine(parseDay(study.meeting_date), study.location || settings.meeting_place, settings.meeting_time),
    };
  }
  // Nothing posted yet: point at the next regular meeting night instead.
  const meeting_date = nextMeetingDate([], settings, now);
  return { study: null, kicker: studyKicker({ meeting_date }, now), place: placeLine(parseDay(meeting_date), settings.meeting_place, settings.meeting_time) };
}

export function homeView(snap: Snapshot, now: Date = today()): HomeView {
  const byId = new Map(snap.members.map(m => [m.id, m]));
  const active = activeOf(snap.prayers);
  const prayers = active.flatMap(prayer => {
    const member = byId.get(prayer.member_id);
    return member ? [{ prayer, member, name: firstName(member), ago: ago(toDay(prayer.created_at), now) }] : [];
  });
  const rows = buildDateRows(snap.members, now);

  return {
    week: weekView(snap.studies, snap.settings, now),
    prayers: prayers.slice(0, HOME_PRAYERS),
    activeCount: active.length,
    coming: rows.filter(r => r.n <= COMING_DAYS).slice(0, COMING_MAX),
    // Upcoming rows leave out past one-time events, so ask the members themselves.
    noDates: snap.members.every(m => !m.dates?.length),
    members: snap.members,
    // A stable sort keeps the server's id tie-break for same-day timestamps.
    activity: snap.activity
      .slice()
      .sort(newestFirst)
      .slice(0, RECENT_MAX)
      .map(a => ({ id: a.id, text: a.text, ago: ago(toDay(a.created_at), now) })),
  };
}
