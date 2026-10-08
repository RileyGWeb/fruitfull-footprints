// API resource shapes (docs/SPEC.md §2.3) plus the request bodies the endpoints accept.

export type Tone = 'sage' | 'accent' | 'sand';
export type DateKind = 'birthday' | 'anniversary' | 'event';
export type PrayerStatus = 'active' | 'answered';
export type StudyStatus = 'draft' | 'published';
export type SectionType = 'text' | 'scripture' | 'questions' | 'reflect' | 'prayer';

export type Settings = {
  group_name: string;
  tagline: string;
  meeting_day: string;
  meeting_time: string;
  meeting_place: string;
  since_year: number;
};

export type GroupInfo = {
  group_name: string;
  tagline: string;
  meeting_day: string;
  since_year: number;
  unlocked: boolean;
};

export type MemberDate = {
  id: number;
  member_id: number;
  kind: DateKind;
  label: string | null;
  month: number;
  day: number;
  year: number | null;
  recurring: boolean;
};

export type Member = {
  id: number;
  name: string;
  tone: Tone;
  gifts: string[];
  line: string | null;
  family: string | null;
  interests: string | null;
  good_to_know: string | null;
  dates: MemberDate[];
  created_at: string;
};

export type PrayerUpdate = { id: number; prayer_request_id: number; body: string; created_at: string };

export type Prayer = {
  id: number;
  member_id: number;
  body: string;
  status: PrayerStatus;
  answer: string | null;
  answered_at: string | null;
  created_at: string;
  updates: PrayerUpdate[]; // oldest first
};

export type StudySummary = {
  id: number;
  series: string | null;
  ref: string | null;
  title: string | null;
  passage: string | null;
  meeting_date: string; // YYYY-MM-DD
  location: string | null;
  description: string | null;
  status: StudyStatus;
  published_at: string | null;
  verse: string | null; // text of the first scripture section
  updated_at: string;
};

export type Section = {
  id: string;
  type: SectionType;
  heading?: string | null;
  body?: string;
  ref?: string | null;
  text?: string;
  items?: string[];
};

export type Study = StudySummary & { sections: Section[] };

export type Activity = { id: number; kind: string; text: string; created_at: string };

export type Snapshot = {
  settings: Settings;
  members: Member[]; // join order (created_at, id)
  prayers: Prayer[]; // newest first
  studies: StudySummary[]; // meeting_date desc
  activity: Activity[]; // newest 20
  server_time: string;
};

// ── request bodies ──────────────────────────────────────────────────────────

export type MemberInput = {
  name: string;
  tone?: Tone;
  gifts?: string[];
  line?: string | null;
  family?: string | null;
  interests?: string | null;
  good_to_know?: string | null;
};

/**
 * `date` is YYYY-MM-DD; the server splits it into month/day/year. A recurring date kept without a year
 * can be moved as `--MM-DD` (its year stays null; not accepted with `recurring: false`).
 */
export type DateInput = { kind: DateKind; label?: string | null; date: string; recurring: boolean };

export type PrayerInput = { member_id: number; body: string };
export type PrayerPatch = { member_id?: number; body?: string; answer?: string | null };

/** Sections may omit `id` when new — the server assigns one. */
export type SectionInput = Omit<Section, 'id'> & { id?: string };

export type StudyInput = {
  series?: string | null;
  ref?: string | null;
  title?: string | null;
  passage?: string | null;
  meeting_date: string;
  location?: string | null;
  description?: string | null;
  sections: SectionInput[];
  status: StudyStatus;
  /**
   * PUT only: the `updated_at` the client loaded. If the study has been saved since, the PUT answers
   * 409 `{message, study}` and saves nothing (SPEC §2.4). Left out, the save overwrites.
   */
  expected_updated_at?: string;
};

export type PasswordInput = { current_password: string; password: string; password_confirmation: string };
