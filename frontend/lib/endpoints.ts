// One typed function per API endpoint (docs/SPEC.md §2.4).
import { api } from './api.ts';
import type {
  DateInput, GroupInfo, Member, MemberDate, MemberInput, PasswordInput, Prayer, PrayerInput, PrayerPatch,
  PrayerUpdate, Settings, Snapshot, Study, StudyInput,
} from './types.ts';

/** SWR keys. */
export const GROUP_KEY = '/api/group';
export const SNAPSHOT_KEY = '/api/snapshot';
export const studyKey = (id: number | string) => `/api/studies/${id}`;

// public
export const getGroup = () => api.get<GroupInfo>(GROUP_KEY);
export const unlock = (password: string) => api.post<{ unlocked: true }>('/api/unlock', { password });
export const lock = () => api.post<void>('/api/lock');

// snapshot & settings
export const getSnapshot = () => api.get<Snapshot>(SNAPSHOT_KEY);
export const updateSettings = (patch: Partial<Settings>) => api.patch<Settings>('/api/settings', patch);
export const changePassword = (input: PasswordInput) => api.put<void>('/api/settings/password', input);

// members
export const createMember = (input: MemberInput) => api.post<Member>('/api/members', input);
export const updateMember = (id: number, patch: Partial<MemberInput>) => api.patch<Member>(`/api/members/${id}`, patch);
export const deleteMember = (id: number) => api.del(`/api/members/${id}`);

// dates to remember
export const createDate = (memberId: number, input: DateInput) => api.post<MemberDate>(`/api/members/${memberId}/dates`, input);
export const updateDate = (id: number, patch: Partial<DateInput>) => api.patch<MemberDate>(`/api/dates/${id}`, patch);
export const deleteDate = (id: number) => api.del(`/api/dates/${id}`);

// prayer
export const createPrayer = (input: PrayerInput) => api.post<Prayer>('/api/prayers', input);
export const updatePrayer = (id: number, patch: PrayerPatch) => api.patch<Prayer>(`/api/prayers/${id}`, patch);
export const deletePrayer = (id: number) => api.del(`/api/prayers/${id}`);
/** `answer` omitted → an already-answered request keeps its note; `null`/'' clears it. */
export const answerPrayer = (id: number, answer?: string | null) =>
  api.post<Prayer>(`/api/prayers/${id}/answer`, answer === undefined ? {} : { answer: answer || null });
export const reopenPrayer = (id: number) => api.post<Prayer>(`/api/prayers/${id}/reopen`);
export const createPrayerUpdate = (prayerId: number, body: string) => api.post<PrayerUpdate>(`/api/prayers/${prayerId}/updates`, { body });
export const deletePrayerUpdate = (id: number) => api.del(`/api/prayer-updates/${id}`);

// studies
export const getStudy = (id: number | string) => api.get<Study>(studyKey(id));
export const createStudy = (input: StudyInput) => api.post<Study>('/api/studies', input);
/** Full replace. With `expected_updated_at`, a study saved somewhere else since then is refused: ApiError 409, `data.study` = theirs. */
export const updateStudy = (id: number, input: StudyInput) => api.put<Study>(`/api/studies/${id}`, input);
export const deleteStudy = (id: number) => api.del(`/api/studies/${id}`);
