# Frontend foundation contract

Verified export surface of `frontend/lib` and `frontend/components` (written by the foundation reviewer; kept up to date through the later fix passes). SPEC.md section 3 is the design; this is the as-built detail. ★ = new or changed since the first build.

FOUNDATION CONTRACT (frontend/), verified by review. Import with '@/…'. Inside lib/, files import each other relatively WITH '.ts' extensions (for the node test runner); screens use '@/lib/x'. `npm test` runs node --test on "lib/**/*.test.ts" and "components/**/*.test.ts", so screens may add pure-logic *.test.ts next to their code (use lib/testing/fixtures.ts: T0 = new Date(2026,9,7), members(), member(first), studies()).

Barrels: use only '@/components/ui' and '@/components/dialogs'. ★ The shell, pwa and providers barrels are gone; import those pieces from their files (e.g. '@/components/shell/AppShell', '@/components/pwa/OfflineBanner').

GLOBAL NOTES FOR SCREENS
- All screens are client components ('use client'). cacheComponents is OFF: pages unmount on navigation, and useParams()/usePathname() need no Suspense. Pages render only client-side after the gate (AppShell shows a splash during SSR), so don't read window/localStorage during render anyway.
- AppShell's <main id="main"> already supplies max-width 1160, margin auto and padding clamp(14px,3vw,28px) / max(clamp(18px,4vw,40px), env(safe-area-inset-left|right)) / 48px. Render the screen's top-level div directly. A screen that throws while rendering is caught inside <main> (ScreenBoundary), so the header and tabs stay.
- Breakpoint: @media (max-width: 759.98px) is mobile, (min-width: 760px) is desktop. Replace the prototype's cqi with vw.
- globals.css loads first, so a module class beats a DS class of equal specificity. Traps:
  - DS `.btn-primary:hover/:active` (0,2,0) override a module background, so add your own `.x:hover,.x:active` rules.
  - DS `textarea.input{min-height:90px}` beats `.x`, so write `textarea.x`.
  - `.radio .dot` radius needs an inline style.
- `.unstyled` is the prototype's all:unset (zero specificity via :where, keeps cursor:pointer and box-sizing border-box). Put it on <button>/<Link>, then style with a module class. `:where(a)` is color accent-700, hover accent-800 (zero specificity).
- ★ Global helpers in app/globals.css:
  - `.hit`: an invisible 44px touch target (::after, inset -5px) around a 34–36px control, e.g. `className="btn btn-icon btn-ghost hit"`. It uses ::after, so not for elements that draw their own. Use it instead of per-module copies.
  - `.sr-only`: hidden on screen, read by screen readers.
  - `.btn[aria-disabled='true']`: the busy look. Busy buttons use aria-disabled (and ignore clicks), not disabled, so keyboard focus stays on them.
  - `--ff-tabbar-h` (74px). On mobile, `html { scroll-padding-bottom }` keeps focused/scrolled-to elements clear of the tab bar; don't add per-screen scroll-margin for that.
  - Focus ring: 2px `--color-accent-600`. Headings and <main> focused programmatically (tabindex -1) show no ring.
  - On coarse pointers every `.input` is at least 16px (stops iOS zoom); fine pointers keep the design's sizes.
  - `html[data-ff-locked]` (set while locked out) stops page scroll.
- Animations: use the global classes `ff-toast` / `ff-sprout` (CSS Modules would hash keyframe names). Under reduced motion the toast only fades.
- Copy: typographic apostrophe ’, no exclamation marks.
- Every date helper takes an optional `now` (default today()). Passing new Date() is safe: day math ignores the time of day.
- The /api proxy target (BACKEND_URL, default http://127.0.0.1:8110) is baked in at `next build`; dev reads it at start.
- ★ Titles: document.title is “{label} · {group name}”, set on the client by the shell (lib/title.ts + components/shell/nav.ts routeTitle). Screens refine it with useDocumentTitle; don't export `metadata.title` from (app) page.tsx files (Next would overwrite the client title on navigation).
- ★ Validation errors: a 422 that names fields is not toasted (see lib/actions.ts); show it under the field (`fieldErrors(e)` from lib/api). Other failures toast in the error style.
- ★ Navigation after a dialog: dialog promises resolve only once the dialog's history entry has been popped, so `await dialogs.x(); router.push(...)` is safe. When leaving a page that holds a history guard, use `leaveTo` (lib/historyGuard.ts).
- ★ Conflicts: a study save sent with `expected_updated_at`, when someone has saved the study since, answers 409; `saveStudy` rethrows it untoasted, and the caller checks `isConflict(e)` (lib/api) and reads theirs from `e.data.study`.

lib/types.ts — exactly SPEC §2.3:
- Tone = 'sage'|'accent'|'sand'; DateKind = 'birthday'|'anniversary'|'event'; PrayerStatus = 'active'|'answered'; StudyStatus = 'draft'|'published'; SectionType = 'text'|'scripture'|'questions'|'reflect'|'prayer'.
- Settings, GroupInfo, MemberDate, Member, PrayerUpdate, Prayer, StudySummary, Section, Study, Activity, Snapshot. Snapshot.members are in join order (created_at, then id), prayers newest first, studies by meeting_date desc, activity the newest 20.
- Inputs:
  - MemberInput {name; tone?; gifts?; line?; family?; interests?; good_to_know?}
  - DateInput {kind; label?: string|null; date: string; recurring} — `date` is 'YYYY-MM-DD', or ★ '--MM-DD' to move a recurring date kept without a year (its year stays null; refused with recurring:false).
  - PrayerInput {member_id; body}
  - PrayerPatch {member_id?; body?; answer?: string|null}
  - SectionInput = Omit<Section,'id'> & {id?}
  - StudyInput {series?; ref?; title?; passage?; meeting_date; location?; description?; sections: SectionInput[]; status; ★ expected_updated_at?} — `expected_updated_at` (PUT only) is the `updated_at` the client loaded; see lib/endpoints.
  - PasswordInput {current_password; password; password_confirmation}

lib/api.ts:
- OFFLINE_MESSAGE = 'You’re offline — try again when you’re connected.'
- LOCKED_EVENT = 'ff:locked' — a 401: this device was locked from elsewhere (password changed, Lock in another tab).
- ★ LOCK_EVENT = 'ff:lock' — this device's own Lock button; whatever is open gets put away.
- class ApiError extends Error {status: number; errors?: Record<string,string[]>; offline?: boolean; ★ data?: unknown} — `data` is the parsed response body (null when it wasn't JSON), e.g. a 409's `{message, study}`.
- errorMessage(e: unknown): string — offline message, else first validation error, else e.message, else 'Something went wrong — try again in a moment.'
- ★ fieldErrors(e: unknown): Record<field, firstMessage> | null — for a 422 with field errors; null for anything else.
- ★ isConflict(e: unknown): e is ApiError — a 409 (saved somewhere else first); the server's answer is in `e.data`.
- api.get<T>(path), api.post<T>(path, body?), api.put<T>(path, body?), api.patch<T>(path, body?), api.del<T=void>(path, body?).
  - path may include or omit the '/api' prefix; same-origin JSON.
  - X-XSRF-TOKEN (decoded XSRF-TOKEN cookie) on non-GET.
  - 419 → GET /api/group, then one retry.
  - 401 → window 'ff:locked' event + throws.
  - Network failure → ApiError{status: 0, offline: true}.
  - 204 → undefined.
  - Messages: 429 'Too many tries — wait a minute and try again.'; 419 'This page was open a long time — try that again.'; 404 'That isn’t here anymore — it may have been removed.'; 409/422/503 the server's message; other failures the plain fallback.
- fetcher<T>(path) for SWR.

lib/endpoints.ts:
- Keys: GROUP_KEY = '/api/group'; SNAPSHOT_KEY = '/api/snapshot'; studyKey(id: number|string).
- Gate: getGroup(): Promise<GroupInfo>; unlock(password): Promise<{unlocked:true}>; lock(): Promise<void>.
- getSnapshot(): Promise<Snapshot>; updateSettings(patch: Partial<Settings>): Promise<Settings>; changePassword(input: PasswordInput): Promise<void>.
- Members: createMember(input: MemberInput): Promise<Member>; updateMember(id: number, patch: Partial<MemberInput>): Promise<Member>; deleteMember(id).
- Dates: createDate(memberId, input: DateInput): Promise<MemberDate>; updateDate(id, patch: Partial<DateInput>): Promise<MemberDate>; deleteDate(id).
- Prayers:
  - createPrayer(input: PrayerInput): Promise<Prayer>; updatePrayer(id, patch: PrayerPatch): Promise<Prayer>; deletePrayer(id).
  - answerPrayer(id, answer?: string|null): Promise<Prayer> — omitted keeps an existing note on an already-answered request; null or '' clears it.
  - reopenPrayer(id): Promise<Prayer>; createPrayerUpdate(prayerId, body: string): Promise<PrayerUpdate>; deletePrayerUpdate(id).
- Studies: getStudy(id: number|string): Promise<Study>; createStudy(input: StudyInput): Promise<Study>; updateStudy(id, input: StudyInput): Promise<Study>; deleteStudy(id).
- ★ Study saves and conflicts (docs/contracts/backend.md, STUDY SAVES AND CONFLICTS): updateStudy sends `expected_updated_at` when the StudyInput has it; a study saved somewhere else since then is refused with ApiError 409, `isConflict(e)`, `e.data = {message, study}` (their current Study). The editor's components/editor/draft.ts `toBody(draft, status, expected)` adds the field; actions.saveStudy rethrows the 409 untoasted; StudyEditor opens its ConflictDialog with `e.data.study` (Load their version / Keep mine, which re-saves without the field / close keeps editing).

lib/dates.ts:
- Constants: MONTHS; WEEKDAYS; SEASONS = ['Winter','Spring','Summer','Fall'].
- Parsing and formatting:
  - today(): Date (local midnight).
  - parseDay('YYYY-MM-DD…'): Date (local midnight, no TZ shift).
  - ★ parseTimestamp(iso|null|undefined): number — epoch ms; trims Laravel's microseconds; 0 for null.
  - toDay(isoTimestamp): Date (local calendar day; accepts Laravel microseconds).
  - toISODay(date): 'YYYY-MM-DD' (local).
  - daysBetween(a, b): number (local calendar days, DST-safe).
  - longDate(d) 'Wednesday, October 14'; shortDate(d) 'Oct 14'; capitalize(s).
- Relative wording:
  - ago(date, now?): 'today' (n≤0) / 'yesterday' / 'N days ago' (<7) / 'last week' (<14) / 'N weeks ago' (floor, <31) / 'last month' (<60) / 'N months ago' (round /30, <365) / 'Oct 3, 2024'.
  - until(date, now?): 'today' / 'tomorrow' / 'in N days' (<14) / 'in N weeks' (round, <60) / 'in N months' (round /30); past dates fall back to ago.
  - span(days): '1 day' (≤1) / 'N days' / 'N weeks' / 'N months'.
- nextOccurrence(md: {month, day, year, recurring}, now?): Date — on/after today; one-time events keep their own year (may be past); Feb 29 → Feb 28 in common years.
- seasonOf(date): 'Fall 2026' (Dec counts toward that year's Winter; Jan–Feb toward the previous year's). nextSeasonName(date): 'Winter'.
- greeting(at = new Date()): 'Good morning' (<12) / 'Good afternoon' (<17) / 'Good evening'.

lib/members.ts:
- Constants: GIFTS (14, SPEC §5); TONES: Record<Tone,{bg,fg}>; TONE_ORDER: Tone[] = ['sage','accent','sand']; BLOBS (4 radii); KIND: Record<DateKind,{label,bg,fg}> (Birthday / Anniversary / Life event).
- Names: firstName(m: {name}|string); lastName(m); initials(m) (first + last initial, uppercase).
- avatarStyle(m: {id,tone}): {bg, fg, blob} (blob = BLOBS[(id - 1) % 4], so member 1 gets the first blob, as in the prototype); nextTone(count): Tone.
- dateTitle(m, d: {kind,label}): 'Rachel’s birthday' | label | kind label.
- type DateRow = {key, member, date: MemberDate, on: Date, n, title, sub, mon: 'OCT', day, chipBg, chipFg, kindLabel}.
- buildDateRows(members, now?): DateRow[] — only n >= 0, soonest first; sub exactly as the prototype's dateRow, e.g. '16 years · in 11 days · Sunday', 'Mike · in 9 days · Friday', 'in 4 days · Sunday'. ★ An anniversary before its first year (or with a later year) has no 'N years' part (never '0 years').
- soonLabel(member, now?): string|null — 'Birthday in 4 days' / 'Anniversary in 3 weeks' / '{event title} in 9 days', soonest within 21 days.
- type ProfileDateRow = {key, date, on, n, label, sub, mon, day, chipBg, chipFg, kindLabel}.
- profileDateRows(member, now?): ProfileDateRow[] — the prototype's pDates; sub like 'June 3 · since 2011 · in 8 months'; 'since YYYY' only on recurring non-birthdays; upcoming first, then past one-time events.
- giftLine(m): 'A · B · C'; prayerCountLabel(n): 'No active requests' | '1 active prayer request' | 'N active prayer requests'.

★ lib/prayers.ts — prayer list selectors shared by the Prayer page and profiles:
- activeOf(prayers, memberId?): Prayer[] — active, newest first (ties by id, newest first).
- answeredOf(prayers, memberId?): Prayer[] — answered, by answered_at (else created_at), newest first.
- byNewest(key: (p) => string|null) — comparator; answeredAt(p) — answered_at ?? created_at; updateWhen(u, now?) — 'Last week', '3 days ago' (capitalised ago).
- e.g. `activeOf(snapshot.prayers, member.id).map(p => view(p, now))`.

lib/studies.ts:
- BIBLE_CHAPTERS: Record<string,number>; deriveSeries(ref): string|null; seriesOf(s: {series,ref}): string ('Other studies' fallback); chapterOf(ref): number|null.
- upNext<T extends StudySummary>(studies: T[], now?): T|null — earliest PUBLISHED with meeting_date >= today (on meeting night, tonight's study is “This week”).
- pastStudies(studies, now?): T[] — published, meeting_date < today, newest first. draftStudies(studies): T[] — newest first.
- studyKicker(study, now?): 'in 7 days' | 'tomorrow' | 'tonight' | 'last week' …
- verseOf(s: {verse,description}): string; paragraphs(text): string[] (split on blank lines).
- type PathNode = {key, name, when, n, state: 'done'|'current'|'next', dot, ring}.
- buildPath(studies, now?): PathNode[] — at T0: Psalms of Ascent · Spring 2026 · 8 studies / James · Summer 2026 · 5 studies / Romans · Fall 2026 · chapter 8 of 16 (current) / What’s next? · Winter · we’ll decide together. Returns [] with no published studies. ★ A series that hasn't met yet (published early, not current) isn't on the path; done nodes count (and take their season from) only studies that have met.
- type ArchiveGroup<T> = {key, series, when, items: T[]}. archiveGroups(studies, now?, query = ''): ArchiveGroup<T>[] — past published grouped by series, newest first; query matches ref/title/description, case-insensitive.
- nextMeetingDate(studies, settings: {meeting_day}|null, now?): 'YYYY-MM-DD' — latest study (drafts included) + 7, else the next meeting_day on/after today.
- toStudyInput(study: Study): StudyInput.
- ★ notesToWarm(studies, now?, past = OFFLINE_PAST_STUDIES (12)): T[] — the notes most likely to be read next, saved for offline reading (components/pwa/WarmNotes): every published study meeting today or later (soonest first, up next included), then the `past` most recent past published ones. No drafts.

lib/hooks.ts:
- DEFAULT_GROUP: GroupInfo.
- useSnapshot(): SWRResponse<Snapshot, ApiError> (key SNAPSHOT_KEY). useStudy(id: number|string|null|undefined): SWRResponse<Study, ApiError>. useOnline(): boolean.
- ★ type GateStatus = 'loading'|'locked'|'unlocked'|'unreachable'. 'unreachable' = /api/group failed (offline or 5xx) with nothing cached, so the shell shows “We can’t reach the group just now” with Try again instead of asking for the password. An error after a successful load keeps the last known state.
- clearDataCache(): Promise — drops every SWR key except the gate. clearOfflineData(): void — tells the service worker to drop its API cache ({type:'CLEAR_DATA'}).
- useGroup(): {group: GroupInfo (DEFAULT_GROUP until loaded or if unreachable), status: GateStatus, error, unlock(password): Promise<void>, lock(): Promise<void>, ★ markLocked(), refresh()}.
  - ★ lock() locks locally first and never throws: sets a pending-lock flag (localStorage, followed across tabs), dispatches LOCK_EVENT (open dialogs close), clears the editor's kept copies (`ff:editor-draft:*`), the SW API copy and the SWR cache, shuts the gate, then sends POST /api/lock — now, or on the next 'online' event. The Entrance stays up across reloads until the password is entered.
  - ★ markLocked(): shut the gate at once after a 401, then re-check with the server.
  - unlock(password) waits for a Lock still in flight, then unlocks, clears the pending flag and ends a lock-out (data revalidates).
- ★ useLock(): () => Promise<void> — the Lock button: lock(), then go Home (leaveTo, replace). Use it instead of hand-rolling lock().then(router.replace) + toast.
- ★ flushPendingLock(): Promise<boolean> — sends an offline Lock; true once the server has it. endLockout(): void — after a lock-out ends, show the app and revalidate its data.

★ lib/gate.ts — gate flags outside React (plain TS), read by the shell, dialogs, SWR and the history guard:
- isLockedOut() / setLockedOut(v) — locked from elsewhere (a 401) while the app was open; sets html[data-ff-locked].
- hasPendingLock() / setPendingLock(v) — a Lock the server hasn't heard yet (localStorage 'ff:pending-lock').
- subscribeGate(listener) — for useSyncExternalStore; also follows the pending flag across tabs.

lib/actions.ts — useActions(): Actions (stable). ★ createActions(cache, mutate, notify?) is the same thing bound to a given SWR cache (for tests).
- Each call runs the endpoint, revalidates the snapshot (and the study key where relevant), toasts, and returns the result.
- On failure it rethrows. ★ It toasts errorMessage in the error tone (the offline text when offline) except for a 401 (the Entrance is already up) and a 422 whose `errors` name fields: the caller shows those inline via fieldErrors(e). Gift toggles (updateMember with {gifts} only) still toast a 422, as the gift panel has no field to show it under.
- Prayers:
  - addPrayer(input: PrayerInput): Promise<Prayer> 'Added — we’ll be praying'; updatePrayer(id, patch: PrayerPatch): Promise<Prayer> 'Request updated'; deletePrayer(id): Promise<void> 'Request deleted'.
  - answerPrayer(id, answer?: string|null): Promise<Prayer> 'Answered. Thank God.' — blank sends null; undefined keeps an existing note.
  - reopenPrayer(id): Promise<Prayer> 'Moved back to active'; addPrayerUpdate(prayerId, body): Promise<PrayerUpdate> 'Update added'; deletePrayerUpdate(id): Promise<void> 'Update removed'.
- Dates: addDate(memberId, input: DateInput): Promise<MemberDate> 'Date saved'; updateDate(id, patch: Partial<DateInput>): Promise<MemberDate> 'Date saved'; deleteDate(id) 'Date removed'.
- Members:
  - addMember(input: MemberInput): Promise<Member> '{First} is in the group'.
  - updateMember(id, patch: Partial<MemberInput>): Promise<Member> 'Saved'. A {gifts}-only patch is optimistic and silent; use it for the gift toggle panel.
  - deleteMember(member: {id,name}): Promise<void> 'Removed {First}' (doesn't wait for the refetch). ★ The member and their requests are dropped from the cached snapshot in the commit that puts the next screen up (lib/route.ts), before it paints: the profile never flashes “not found”, and /people never shows them, not even for a frame.
- Studies:
  - saveStudy(input: StudyInput, id?: number): Promise<Study> — POST without id, PUT with id. Toast by transition: 'Draft saved' / 'Published — everyone can read it now' / 'Changes saved' / published→draft 'Moved back to drafts'. Stores the study key. ★ A 409 (sent with `expected_updated_at`, saved somewhere else since) is rethrown untoasted, like a 422 with field errors: the caller shows its conflict dialog from `e.data.study`.
  - unpublishStudy(study: Study): Promise<Study> 'Moved back to drafts'; deleteStudy(id): Promise<void> 'Study deleted'.
- Settings: updateSettings(patch: Partial<Settings>): Promise<Settings> 'Settings saved' (also refreshes the gate); changePassword(input: PasswordInput): Promise<void> 'Password changed'.
- type Actions.
- Example: `try { await actions.addPrayerUpdate(id, body) } catch (e) { const fe = fieldErrors(e); if (fe) setError(fe.body ?? Object.values(fe)[0]) }`

★ lib/toast.ts — the toast store (plain TS); components/ui/Toast renders it:
- type ToastTone = 'success'|'error'. showToast(text, {tone?}) — 'success' (default) is the prototype's sage pill with the sprouting leaf, 2.9s, announced politely; 'error' is a neutral-800 pill with no leaf, 4.5s, announced via role=alert. One toast at a time; a repeat of the same text is announced again.
- TOAST_MS, getToast(), subscribeToast(listener).

★ lib/title.ts:
- useDocumentTitle(label: string|null|undefined): void — document.title = '{label} · {group name}'; the newest mounted call wins; null/undefined (still loading) keeps the shell's default for the route. e.g. `useDocumentTitle(member?.name)`.
- formatTitle(label, groupName); DEFAULT_GROUP_NAME; setShellTitle(groupName, label, gated) (shell only). Behind the Entrance the title is just the group name. It watches <head>, so a metadata <title> Next hoists after a client navigation (seen on `next dev`) can't replace it.
- The shell's defaults (components/shell/nav.ts routeTitle): Home → group name only; People, Dates to remember, the member's name; Prayer, Answered prayers; Studies, New study, the study ref, 'Preparing {ref}' / 'Editing {ref}'; Settings.

★ lib/historyGuard.ts — Back (button, swipe, Alt+←, Android back) asks whatever is in front first:
- While any guard is active, one extra same-URL history entry sits on top of the page's entry. Back pops it and runs the guard's onBack; the page stays. Open dialogs (modal guards) always answer before page guards, whatever order they registered in. Behind the lock-out Entrance, Back leaves the hidden page alone.
- useHistoryGuard(active: boolean, onBack: () => boolean|void) — while active, Back runs onBack instead of leaving. Return true to stay guarded (e.g. while asking).
- goBack(): boolean — after a guarded Back (“Leave”), steps past the guard entry to the page before. false when there is no page before (deep link): navigate somewhere yourself.
- leaveTo(router, href, {replace?, ★ scroll?}) — use instead of router.push/replace when leaving a guarded page or navigating straight after a dialog closes. A push takes over the guard entry (one Back returns here); ★ a replace first steps off the guard entry, then replaces the page's own entry (Back skips the page, e.g. Lock from an editor with unsaved changes, or a new study's editor once saved). Waits for a pop in flight.
- ★ navigating(): Promise<void> | null — the navigation the last leaveTo started, until its screen has been committed (lib/route.ts; 10s at most); null when none is under way. Dialog waits for it before placing focus.
- historySettled(): Promise<void>. guardHistory(onBack, {modal?}) → release(): Promise<void> (low-level; DialogsProvider uses it).
- A guard's onBack may open a confirm straight away (the confirm's guard puts the entry back; no second entry is added).
- Example (components/editor/useLeaveGuard.ts does the same with guardHistory, and also catches in-app links, the header Lock and beforeunload):
  ```ts
  useHistoryGuard(dirty, () => { void ask().then(ok => { if (ok && !goBack()) router.replace('/studies'); }); return true; });
  if (ok) leaveTo(router, url);                                   // a link click after confirming
  leaveTo(router, `/studies/${id}/edit`, { replace: true });      // a save that replaces the URL while guarded
  ```

★ lib/route.ts — the route as React last committed it. components/providers/Providers.tsx reports each new pathname from a layout effect (after the new screen is in the DOM, before it is painted):
- routeCommitted(pathname) (Providers only).
- whenRoute(test, fn, timeout = 3000) — runs `fn` in the commit that puts a route passing `test(pathname)` on screen (straight away if the current one passes, or when nothing reports commits, e.g. in node tests), and after `timeout` regardless. Used by actions.deleteMember (the cache edit) and leaveTo (navigating()).

components/ui (barrel '@/components/ui'):
- Avatar({member: {id,name,tone}, size = 42, fontSize?, href? (→ Link), onClick? (→ button), title?, className?, style?}). Font sizes: 42→15, 50→17, 58→20, 104→36.
- DateChip({mon, day, bg, fg, size?: 46|42}).
- Seg({options: SegOption[] = {label, href, active}[], ★ label = 'Views', padX = 16 (use 18 on Prayer), className?, style?}) — a <nav aria-label={label}> of Links (replace, scroll={false}, aria-current on the active one) styled as the prototype .seg. Pass label 'People views' / 'Prayer views'. ★ Each option has a 44px+ hit area on mobile and an unclipped focus ring.
- Icon({name: IconName, size?, strokeWidth?, ...LucideProps}).
  - ICONS presets: home/users/heart/book 20 (2.75), feet 20 (2.25), feetSm 17, feetLg 28, leaf 24, leafSm 16, plus 18, plusSm 15, back 17, search 16, edit/editSm 14 (2.5), lock 17 (2.5), settings 17 (2.5), x 16, up/down 15, offline 15.
  - type IconName. Re-exports House, Users, Heart, BookOpen, Leaf, Plus, ArrowLeft, Search, Pencil, Lock, X, Footprints, Settings, WifiOff, ArrowUp, ArrowDown.
- Toasts: Toaster (already mounted by Providers; don't mount another), showToast(text, ★ {tone?}), useToast(): {show(text, ★ opts?)}.
- Dialog({open, onClose, title: ReactNode, icon?, children, className?, layer?}); type DialogProps.
  - Portals to body; backdrop click and Escape close; focus trap and restore; scroll lock; aria-modal/labelledby. On fine pointers the first field (or `data-autofocus`) gets focus; on touch the dialog itself does.
  - ★ Stacked dialogs: only the top one answers Escape/Tab and holds focus. Focus never falls out to <body> (a removed or disabled control's focus comes back inside). On close, focus returns to the trigger if it still exists, else the dialog below, else the page's h1 / <main> (focusLandmark). ★ Closed while a leaveTo is under way (e.g. “Remove from group” → /people), it waits until the new screen is committed (historyGuard navigating()) and does that there, unless something has taken focus meanwhile. While locked out the dialog is hidden and inert, and keeps its input.
  - `.dialog` is 460px on --color-bg, padding 26, title 24px. Put fields in a flex column with gap var(--space-3) and end with <div className="dialog-actions">. Long content wraps anywhere.
  - Classes in '@/components/ui/Dialog.module.css': cancel (ghost neutral-800), submit (min-height 44, padding-inline 20), danger (accent-700 primary), sage (accent-2-700 primary), quiet (small ghost destructive row, 44px target), body (15px neutral-800 p), error (a field message).
- ConfirmDialog({open, title, body?, confirmLabel, cancelLabel?, danger?, busy?, layer?, onConfirm, onCancel}); type ConfirmOptions = {title, body?, confirmLabel, cancelLabel?, danger?}. ★ busy sets aria-disabled on the confirm button.
- EmptyState({title, body?, icon?: IconName = 'leaf', action?, className?, ★ level?: 1|2|3 = 3}) — the heading level changes, the look doesn't.
- ★ ScreenState({error?, what, onRetry, loading?, level?, className?}) — the screen's skeleton (`loading`) while loading or on a 401, LoadError otherwise. `if (!data) return <ScreenState error={error} what="Prayer requests" onRetry={() => mutate()} loading={<Skeleton/>} level={2} />`.
- ★ LoadError({error, what, onRetry, level = 2, className?}) — '{what} didn’t load' or 'You’re offline', with a 44px Try again; nothing for a 401. `level` is the heading level, so the outline never skips one: 2 under the screen's own h1 (Home, People, Prayer, Studies), 1 when the screen has no h1 without its data (a profile, the reader, the editor), 3 inside a section with an h2 (Settings' group card).
- ★ NotFound({title?, body?, href = '/', label = 'Go to Home', icon = 'feet', level = 1, className?}) — EmptyState with a btn-secondary link; titles the page 'Not found'. Use level 2 or 3 under the screen's own h1. e.g. `<NotFound title="We couldn’t find that person" body="…" href="/people" label="Back to everyone" icon="users" />`.
- ★ focusLandmark({scroll?}) — focuses the screen's h1, else <main> (made focusable on demand, no ring). Use it when the focused control goes away (a card moved, a request deleted).
- ★ radioGroup(values, value, onChange) → (option) => props — role=radio, aria-checked, roving tabIndex, arrows/Home/End select and move focus. Wrap the buttons in role="radiogroup" with a label.
- BackButton({href, label, className?, style?}).

components/dialogs ('@/components/dialogs'):
- DialogsProvider (mounted by Providers); useDialogs(): Dialogs = {
  - addPrayer(opts?: {memberId?: number}): Promise<Prayer|null>
  - answerPrayer(prayer: Prayer): Promise<Prayer|null>
  - editPrayer(prayer: Prayer): Promise<void> (person/text/answer, remove updates, move back to active, delete)
  - addDate(opts: {memberId: number}): Promise<MemberDate|null>
  - editDate(date: MemberDate): Promise<void> (incl. ★ “Remove this date” → confirm “Remove this date?” → toast 'Date removed')
  - addPerson(): Promise<Member|null> (navigates to /people/{id})
  - editPerson(member: Member): Promise<void> (incl. 'Remove from group' → confirm → /people)
  - confirm(opts: ConfirmOptions): Promise<boolean> (Cancel has initial focus) }
- Dialogs perform their own actions and toasts; screens just await.
- ★ Closing from outside resolves as cancelled (null / undefined / false):
  - Back closes the top dialog (one per Back when stacked); the promise resolves after its history entry is popped, so navigating next is safe.
  - A pathname change, or this device's own Lock (LOCK_EVENT), cancels every open dialog.
  - A lock-out from elsewhere (ff:locked) does NOT close them: they wait hidden behind the Entrance with what was typed, and the save can be tried again after the password.
- ★ 422s show inline under the field (aria-invalid/aria-describedby, focus on the first invalid field), plus a line for fields the dialog doesn't show. Helpers in components/dialogs/FieldError.tsx: FieldError, describedBy, otherErrors, without, focusFirstError.
- ★ Busy submit buttons use aria-disabled (disabled only for empty input), so focus stays on them after a failed save.
- ★ The date dialog sends `date` only when it changed; turning “every year” off on a date stored without a year asks for the full date (components/dialogs/dateForm.ts). A yearless date that keeps repeating, moved to another day with the shown year left as it is, is sent as `--MM-DD` and stays yearless (a year the user picks is kept); its field shows this year, or the next leap year for February 29.
- Also exported from their own files: PrayerDialog, AnswerDialog, EditPrayerDialog, DateDialog, PersonDialog.

components/shell (import from the files):
- AppShell({children}) — the gate: Splash while loading → ★ the 'unreachable' SystemCard → Entrance → TopNav (in a <header>) + MobileHeader + OfflineBanner + <main id="main"> + TabBar, with a “Skip to content” link. Sets document.title (ShellTitle).
  - ★ On ff:locked (a 401) it clears the SW API copy, shuts the gate at once (markLocked) and keeps the app mounted but inert and aria-hidden under an overlay Entrance that says why (“This device was locked — the group password may have changed. Anything you were in the middle of is still here.”). SWR is paused meanwhile. After the password, data revalidates and focus returns to where it was.
  - ★ The header Lock calls useLock(): everything is put away locally first (see lib/hooks lock()).
- Splash() (a <main> with hidden 'Loading…'); Entrance({group: GroupInfo, onUnlock(password): Promise<void>, ★ lockedOut?}); TopNav({groupName, onLock}); MobileHeader({groupName, onLock}); TabBar(). Header gear, lock and brand row are 44px targets.
- ★ ScreenBoundary — catchError boundary inside <main>: a screen that throws shows “Something went wrong here” with Try again / Go to Home, and the chrome stays.
- ★ SystemCard({kicker, title, body, children}) — a whole-page notice in the /offline page's style (unreachable, app/error.tsx, app/global-error.tsx); action classes SystemCard.styles.primary / .secondary.
- nav.ts: NAV: {key, label, href, icon}[]; activeNav(path): NavKey|null (/people/3 → people, /studies/5/edit → studies, /settings → null); type NavKey; ★ routeTitle(path, snapshot?) (see lib/title.ts).

components/pwa (import from the files):
- OfflineBanner() — 'You’re offline — showing what was saved. Changes need a connection.'
- ★ WarmNotes() — mounted by AppShell behind the gate: while online and controlled by the worker, saves the notes most likely to be read offline (lib/studies notesToWarm: every upcoming published study and the 12 latest past ones) by fetching GET /api/studies/{id} through the worker, one at a time when idle (1.5s between fetches, starting 4s after load), skipping studies whose saved copy in `ff-api` already has the snapshot's `updated_at`. Not while locked out; the first failed fetch ends the round. Reruns when the snapshot changes, the connection returns or the worker takes control.
- ★ ServiceWorker() — registers `/sw.js?v=<NEXT_PUBLIC_BUILD_ID>` (scope '/', updateViaCache 'none') in production or with NEXT_PUBLIC_ENABLE_SW=1, so every deploy installs a fresh worker; unregisters stale workers in plain dev. On every route change while online it posts {type:'CACHE_URLS', pages: [pathname], urls: <loaded /_next/static assets>} so the page opens offline later. It applies the worker's {type:'API_FRESH', key, data} messages to SWR (mutate(key, data, {revalidate:false})). On a first visit it refetches the gate and snapshot once the worker takes control. Also keeps `beforeinstallprompt` for Settings' install row.

components/providers/Providers.tsx: Providers({children}) — SWRConfig (fetcher; 5xx-only retry with backoff; ★ isPaused while locked out — the gate's own key opts out), ★ route commits (lib/route.ts), DialogsProvider, Toaster, ServiceWorker.

★ public/sw.js (hand-written; versioned per build):
- Caches: ff-shell-<build>, ff-static-<build> (the previous build's static cache is kept one deploy, for tabs still on it), ff-api (constant; survives deploys; cleared by {type:'CLEAR_DATA'}).
- Install precaches '/', '/people', '/people/dates', '/prayer', '/prayer/answered', '/studies', '/studies/new', '/settings', '/offline' (all required, or the old worker stays) with the static assets they load, refetches every page the previous worker had saved, and reuses an older build's copy of unchanged static files. CSS url() fonts are cached too.
- Pages opened while online are saved (CACHE_URLS, only pages not saved yet). Each fresh /api/snapshot also saves, in the background, the page of every member and every published study, and prunes saved /people|studies/{id}(/edit) pages whose id is gone. ★ The notes of upcoming and recent studies are fetched through it by the page (components/pwa/WarmNotes), so they open offline before anyone has read them.
- Navigations: network-first with a 3s timeout when a saved copy exists → saved page → /offline. /_next/static: cache-first. /icons, favicon and manifest: network-first (3s) into the static cache. GET /api/*: network-first with a 4s timeout when a cached copy exists, 5xx falls back to the cached copy; a late answer still updates the cache and is posted to the page as API_FRESH. 4xx (401 included) is never cached. Non-GET is never cached. Nothing fetched before a Lock is saved after it.
- No RSC caching: offline soft navigations fall back to a full navigation, which the worker serves from the saved page.

★ next.config.ts:
- One build id per `next build` (env FF_BUILD_ID overrides it; it must change with every deploy), used as Next's generateBuildId and inlined as NEXT_PUBLIC_BUILD_ID.
- poweredByHeader false. Every Next response carries a CSP without script-src (base-uri/form-action 'self', frame-ancestors/object-src 'none', img-src 'self' data: blob:, font-src 'self' data:, connect-src 'self' (+ ws: wss: in dev), manifest-src/worker-src 'self'), X-Frame-Options DENY, nosniff, Referrer-Policy same-origin and a Permissions-Policy. Adding iframes, external images/fonts or cross-origin fetches means extending the CSP. Proxied /api responses keep only Laravel's headers.

★ app/ (outside the screens):
- app/(app)/layout.tsx wraps every screen in AppShell; its metadata is only the server-rendered title.
- app/not-found.tsx renders <AppShell><NotFound/></AppShell> (gated, in the chrome, with Go to Home).
- app/error.tsx and app/global-error.tsx are SystemCards with Try again / Go to Home.
- app/offline/page.tsx: Try again reloads, and so does the window 'online' event.
