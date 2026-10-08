# Fruitfull Footprints — build spec

A private PWA for one small group: people, prayer, Bible studies. Laravel API (`backend/`) +
Next.js App Router client (`frontend/`) + Postgres. This file is the contract every part of the
build follows. When code and this file disagree, fix one of them; don't silently diverge.

**Source of truth for look & behaviour:** `docs/design/prototype.dc.html` (the Claude Design
prototype: template markup with inline styles in the top half, all state logic + seed data in the
`<script data-dc-script>` at the bottom). Reference renders of every designed screen are in
`docs/design/refs/` (`mobile-NN-*.png` = 390×844 @2x frames exactly as designed, `mobile-full-*`
= the same screen's full scroll length, `desktop-*` = 1280 wide). The phone status bar (“7:12”,
notch) in the mobile refs is frame chrome — never build it. Design tokens/classes:
`docs/design/organic-styles.css`.

Decisions already made with the owner (don't re-litigate):
- **Auth = one shared group password.** No user accounts, no author attribution. Lock = log out.
- **Fill CRUD gaps in-style.** Everything gets create/read/update/delete, using the design's
  visual language, even where the prototype shows no UI (see “Gap-fill UI” below).
- **Demo data is opt-in** (`DemoSeeder`); a fresh install has only settings + password.
- **PWA, read-only offline:** installable; app shell + last-fetched data readable offline;
  writes need a connection.

Today in the prototype is fixed (`T0 = 2026-10-07`); the real app always uses the viewer's local
today. The demo seeder shifts all absolute dates so the demo always looks like the design.

---------------------------------------------------------------------------------------------------

## 1. Local dev topology

| Piece | Where | Port |
|---|---|---|
| Postgres 17 (`docker compose up -d`) | db `fruitfull` (dev), `fruitfull_test` (tests); user/pass `fruitfull`/`fruitfull` | 127.0.0.1:5490 (loopback only) |
| Laravel (`php artisan serve --port=8110`) | `backend/` | 8110 |
| Next.js (`npm run dev -- --port 3110`) | `frontend/` | 3110 |

Postgres is published on loopback only (`127.0.0.1:5490:5432` in `docker-compose.yml`), because
its credentials are in the repo. The browser only ever talks to Next (http://localhost:3110).
`frontend/next.config.ts` rewrites `/api/:path*` → `${BACKEND_URL:-http://127.0.0.1:8110}/api/:path*`,
so the API is same-origin: no CORS, session cookie set on the frontend origin. Local group
password: `footprints` (`GROUP_PASSWORD` in `backend/.env`).

Screenshot tool for visual checks against the refs: `node tools/shot.mjs --url /prayer --out
/tmp/x.png [--viewport desktop] [--full] [--scroll 300] [--fill "<selector>=<text>"] [--click
"<selector>"]` (unlocks the gate automatically; prints page and console errors). Compare with the
matching `docs/design/refs/*.png` by reading both images.

---------------------------------------------------------------------------------------------------

## 2. Backend (Laravel 13, PHP ≥ 8.3, Postgres)

### 2.1 Auth & sessions
- All API routes live in `routes/api.php` under prefix `/api` and run through the **`web`
  middleware group** (cookies, session, CSRF). No Sanctum, no `User` model, no `users` /
  `password_reset_tokens` / `personal_access_tokens` tables (keep `sessions`, `cache`, `jobs`).
- Session driver `database`, lifetime 525600 min (a year — it's a “remember this device” app).
- CSRF: Laravel's standard `XSRF-TOKEN` cookie; the client echoes it in `X-XSRF-TOKEN`. Any GET
  through the web group (e.g. `GET /api/group`) sets the cookie.
- Unlock: `POST /api/unlock {password}` → `Hash::check` against the stored hash →
  `session()->regenerate()`, store `ff_unlocked = true` and `ff_pw_version = <current version>`.
  Throttled by the named `unlock` limiter, which counts wrong passwords only: 10/minute and
  30/hour per client (IPv4 address or IPv6 /64), 100/hour for everyone together; 429 JSON with
  `Retry-After` (model and rationale: `docs/contracts/backend.md`).
- `group.unlocked` middleware (alias) on every other route: 401 `{"message":"Locked"}` unless the
  session is unlocked **and** its `ff_pw_version` equals the current `password_version` setting
  (changing the password locks every other device out).
- Lock: `POST /api/lock` → `session()->invalidate()` + `regenerateToken()` → 204.
- Trust proxies `127.0.0.1`/`::1` (plus `TRUSTED_PROXIES` env); the client IP is the rightmost
  untrusted `X-Forwarded-For` entry. Next's rewrite proxy forwards the browser's
  `X-Forwarded-For` verbatim and adds none, so production must put a reverse proxy in front of
  Next that appends the socket address (`backend/README.md`); otherwise clients pick their own.
- `php artisan ff:prune-sessions` (scheduled daily) removes sessions idle ≥ 24h that aren't
  unlocked with the current password version, so cookie-less requests can't grow `sessions`.

### 2.2 Tables

`settings` — key/value. `key` string PK, `value` jsonb. Keys & defaults:

| key | default | notes |
|---|---|---|
| `group_name` | `Fruitfull Footprints` | |
| `tagline` | `A private home for our small group.` | entrance subtitle |
| `meeting_day` | `Wednesday` | one of Sunday…Saturday |
| `meeting_time` | `7pm` | free text |
| `meeting_place` | `Rachel’s porch` | default study location |
| `since_year` | `2023` | int |
| `password_hash` | — | never serialized |
| `password_version` | `1` | int, bumped on change |

`members`
| col | type | rules |
|---|---|---|
| id | bigint pk | |
| name | string(120) | required |
| tone | string | `sage` \| `accent` \| `sand` (default: cycle by count) |
| gifts | jsonb array of strings | each ∈ `GIFTS` list (§5), unique, ≤ 14 |
| line | string(280) null | one-line description (“Hosts most weeks…”) |
| family, interests, good_to_know | text null (≤ 1000) | the profile “About” rows |
| timestamps | | |

`member_dates` — dates to remember
| col | type | rules |
|---|---|---|
| id | bigint pk | |
| member_id | fk → members, cascade delete | |
| kind | string | `birthday` \| `anniversary` \| `event` |
| label | string(160) null | null for birthdays |
| month | smallint 1–12 | |
| day | smallint 1–31 | valid for month (Feb 29 allowed) |
| year | smallint null | birth/since year, or the year a one-time event happens |
| recurring | bool, default true | false ⇒ one-time event; year required |
| timestamps | | |

`prayer_requests`
| col | type | rules |
|---|---|---|
| id | bigint pk | |
| member_id | fk → members, cascade delete | the person the request is *for* |
| body | text | required, ≤ 2000 |
| status | string | `active` \| `answered` |
| answer | text null | ≤ 2000 |
| answered_at | timestamp null | |
| timestamps | | `created_at` = “Added …” |

`prayer_updates` — id, `prayer_request_id` fk cascade, `body` text (≤ 2000), timestamps.

`studies`
| col | type | rules |
|---|---|---|
| id | bigint pk | |
| series | string(120) null | e.g. `Romans`, `Psalms of Ascent`; if blank on save, derived from `ref` by stripping a trailing chapter/verse (`/\s+\d+([:.–-].*)?$/`): `Romans 9` → `Romans`, `1 John 3:1` → `1 John`; null if `ref` blank |
| ref | string(120) null | e.g. `Romans 8` — required when published |
| title | string(160) null | required when published |
| passage | string(160) null | primary passage, e.g. `Romans 8:1–17` |
| meeting_date | date | required |
| location | string(160) null | overrides `meeting_place` for that night |
| description | text null (≤ 2000) | “Short description — shows on the home page” |
| sections | jsonb array | see below, ≤ 60 items |
| status | string | `draft` \| `published` |
| published_at | timestamp null | set on draft→published, cleared on →draft |
| timestamps | | |

Section objects (validated by type; unknown keys dropped; each may carry a client `id` string ≤ 40
chars which is preserved, otherwise the server assigns one):
```
{ "id": "s1", "type": "text",      "heading": "Opening Thought",      "body": "para\n\npara" }
{ "id": "s2", "type": "scripture", "ref": "Romans 8:1–2",             "text": "There is therefore…" }
{ "id": "s3", "type": "questions", "heading": "Discussion Questions", "items": ["…", "…"] }
{ "id": "s4", "type": "reflect",   "heading": "Application",          "body": "…" }
{ "id": "s5", "type": "prayer",    "heading": "Closing Prayer",       "body": "…" }
```
Strings ≤ 20000 chars; `items` ≤ 40 strings (blank lines trimmed out server-side).

`activities` — id, `kind` string, `text` string(255), timestamps. Written by the server only:

| kind | when | text |
|---|---|---|
| `study_published` | study goes draft→published (or created published) | `{ref} study notes were published` |
| `prayer_added` | request created | `New prayer request for {First}` |
| `prayer_updated` | update added | `{First}’s request has an update` |
| `prayer_answered` | active→answered | `{First}’s prayer was marked answered` |
| `member_added` | member created | `{First} joined the group` |

`{First}` = first word of the member's name. Use the typographic apostrophe `’` everywhere in copy.

### 2.3 JSON conventions
- Bare JSON (call `JsonResource::withoutWrapping()`), snake_case keys, ids are numbers.
- Date-only values `YYYY-MM-DD`; timestamps ISO-8601 UTC (Laravel default serialization).
- Errors: 422 `{message, errors:{field:[msg]}}`, 401 `{message:"Locked"}`, 404, 409 (stale study save, §2.4), 419 (CSRF), 429.
  422 field messages are plain copy meant to show under the field (“Keep it under 2,000
  characters.”), with no field names or paths; a few keep Laravel's wording because the client
  matches on it (`docs/contracts/backend.md`).

Resource shapes (also the TypeScript types in `frontend/lib/types.ts`):
```ts
type Settings = { group_name: string; tagline: string; meeting_day: string; meeting_time: string;
                  meeting_place: string; since_year: number };
type GroupInfo = { group_name: string; tagline: string; meeting_day: string; since_year: number;
                   unlocked: boolean };
type MemberDate = { id: number; member_id: number; kind: 'birthday'|'anniversary'|'event';
                    label: string|null; month: number; day: number; year: number|null; recurring: boolean };
type Member = { id: number; name: string; tone: 'sage'|'accent'|'sand'; gifts: string[];
                line: string|null; family: string|null; interests: string|null; good_to_know: string|null;
                dates: MemberDate[]; created_at: string };
type PrayerUpdate = { id: number; prayer_request_id: number; body: string; created_at: string };
type Prayer = { id: number; member_id: number; body: string; status: 'active'|'answered';
                answer: string|null; answered_at: string|null; created_at: string;
                updates: PrayerUpdate[] /* oldest first */ };
type StudySummary = { id: number; series: string|null; ref: string|null; title: string|null;
                      passage: string|null; meeting_date: string; location: string|null;
                      description: string|null; status: 'draft'|'published'; published_at: string|null;
                      verse: string|null /* text of first scripture section */; updated_at: string };
type Section = { id: string; type: 'text'|'scripture'|'questions'|'reflect'|'prayer';
                 heading?: string|null; body?: string; ref?: string|null; text?: string; items?: string[] };
type Study = StudySummary & { sections: Section[] };
type Activity = { id: number; kind: string; text: string; created_at: string };
type Snapshot = { settings: Settings; members: Member[] /* join order: created_at, id */; prayers: Prayer[] /* newest first */;
                  studies: StudySummary[] /* meeting_date desc */; activity: Activity[] /* newest 20 */;
                  server_time: string };
```

### 2.4 Endpoints

Public (web group, no unlock):
| Method & path | Body | Response |
|---|---|---|
| `GET /api/group` | — | `GroupInfo` (also seeds the XSRF cookie) |
| `POST /api/unlock` | `{password}` | 200 `{unlocked:true}` · 422 `{message:"Try that once more.", errors:{password:[…]}}` · 429 · 503 `{message}` if no password is configured |
| `POST /api/lock` | — | 204 |

Unlocked only (`group.unlocked`):
| Method & path | Body | Response |
|---|---|---|
| `GET /api/snapshot` | — | `Snapshot` |
| `PATCH /api/settings` | any subset of `Settings` | `Settings` |
| `PUT /api/settings/password` | `{current_password, password, password_confirmation}` (min 6) | 204; bumps `password_version`; *this* session stays unlocked |
| `POST /api/members` | `{name, tone?, gifts?, line?, family?, interests?, good_to_know?}` | 201 `Member` (logs `member_added`) |
| `PATCH /api/members/{id}` | any subset of the above | `Member` |
| `DELETE /api/members/{id}` | — | 204 (cascades dates, prayers, updates) |
| `POST /api/members/{id}/dates` | `{kind, label?, date:"YYYY-MM-DD"\|"--MM-DD", recurring}` | 201 `MemberDate` (server splits `date` into month/day/year; `--MM-DD` = a recurring date kept without a year, so `year` is null and Feb 29 is fine) |
| `PATCH /api/dates/{id}` | `{kind?, label?, date?, recurring?}` | `MemberDate` |
| `DELETE /api/dates/{id}` | — | 204 |
| `POST /api/prayers` | `{member_id, body}` | 201 `Prayer` (logs `prayer_added`) |
| `PATCH /api/prayers/{id}` | `{member_id?, body?, answer?}` | `Prayer` (`answer` only meaningful when answered) |
| `DELETE /api/prayers/{id}` | — | 204 |
| `POST /api/prayers/{id}/answer` | `{answer?}` | `Prayer`; active→answered sets `answered_at=now` and logs; if already answered just updates `answer` |
| `POST /api/prayers/{id}/reopen` | — | `Prayer`; back to active, clears `answer` + `answered_at` |
| `POST /api/prayers/{id}/updates` | `{body}` | 201 `PrayerUpdate` (logs `prayer_updated`, touches the prayer) |
| `DELETE /api/prayer-updates/{id}` | — | 204 |
| `GET /api/studies/{id}` | — | `Study` |
| `POST /api/studies` | `{series?, ref?, title?, passage?, meeting_date, location?, description?, sections, status}` | 201 `Study` |
| `PUT /api/studies/{id}` | same as POST (full replace), plus optional `expected_updated_at` | `Study`; draft→published sets `published_at` + logs `study_published`; published→draft clears `published_at` · 409 `{message:"This study was changed somewhere else.", study: Study}` when `expected_updated_at` is sent and isn't the current `updated_at` (nothing changes) |
| `DELETE /api/studies/{id}` | — | 204 |

Validation when `status = published`: `ref` and `title` required. `meeting_date` always required.
`meeting_date` and a full member-date `date` must fall in 1900-01-01…2200-12-31. A one-time date
needs a year: a save that would leave a member date `recurring:false` without one (a `--MM-DD`
with `recurring:false`, or a PATCH whose missing half comes from the stored date) is 422
`errors.date` “A one-time date needs a year.”

Optimistic concurrency for studies: the editor sends back the `updated_at` it loaded as
`expected_updated_at` (any ISO-8601 form of the same instant). If the study has been saved since,
the PUT answers 409 with the current `Study` and saves nothing. Leaving the field out overwrites
(“keep mine”). Precision is whole seconds; the check runs under a row lock.

### 2.5 Seeding & commands
- `DatabaseSeeder`: writes missing settings defaults; if no password is set and `GROUP_PASSWORD`
  env is non-empty, sets it. Idempotent.
- `DemoSeeder` (`php artisan migrate:fresh --seed --seeder=DemoSeeder`): runs `DatabaseSeeder`,
  then loads the prototype's `MEMBERS`, `PRAYERS`, `STUDIES`, `ACTIVITY` **verbatim** (same text,
  same curly quotes), plus 8 published *Psalms of Ascent* studies (series `Psalms of Ascent`,
  refs `Psalm 120`…`Psalm 127`, sensible titles/descriptions/sections, Wednesdays 2026-04-01 →
  2026-05-20). Every absolute date (prayer added/updated/answered, study meeting dates, one-time
  events, activity) is shifted by `floor(days(2026-10-07 → today) / 7) * 7` days so the demo always
  sits in the same place relative to today and Wednesdays stay Wednesdays. Recurring month/day
  dates are not shifted. Timestamps are set at 19:00 UTC on their date. The Romans 8 draft-vs-
  published states, the Romans 9 draft, `verse`, and update histories must match the prototype.
- `php artisan ff:password {--password=}` sets the group password (prompts if omitted), bumps
  `password_version`.

### 2.6 Tests
PHPUnit feature tests against `fruitfull_test` (Postgres) covering every endpoint: lock gate,
unlock ok/wrong/throttled/no-password, lock, password change locking other sessions, every CRUD
path incl. validation failures, activity logging rules, series derivation, section sanitising,
snapshot shape/ordering, cascades, and that `DemoSeeder` runs and produces the expected counts.
`ValidationMessagesTest` pins every 422 message word for word (§2.3). End-to-end coverage is
Playwright in `frontend/e2e` (`npm run e2e`, mobile + desktop, against the dev stack).

---------------------------------------------------------------------------------------------------

## 3. Frontend (Next.js 16 App Router, React 19, TypeScript)

**Read `frontend/AGENTS.md` first: this Next.js differs from your training data — check
`frontend/node_modules/next/dist/docs/` before using any Next API.**

- No Tailwind. Global stylesheet `app/globals.css` = the Organic tokens/classes
  (`docs/design/organic-styles.css` minus its font `@import`) + app base styles. Screen styles go
  in CSS Modules next to their components. Use the DS classes (`btn btn-primary`, `btn-secondary`,
  `btn-ghost`, `btn-icon`, `input`, `field`, `tag tag-*`, `seg`, `dialog*`) exactly like the
  prototype does.
- Fonts via `next/font/google`: Caprasimo 400 + Figtree 400/600/700, exposed as CSS vars that feed
  `--font-heading` / `--font-body`.
- Icons: `lucide-react` with `strokeWidth={2.75}` (footprints mark 2.25), sizes as in the
  prototype's `ICONS` table. Mapping: home→`House`, users→`Users`, heart→`Heart`, book→`BookOpen`,
  leaf→`Leaf`, plus→`Plus`, back→`ArrowLeft`, search→`Search`, edit→`Pencil`, lock→`Lock`,
  x→`X`, feet→`Footprints`, settings→`Settings`.
- Data: `swr`. One snapshot key (`/api/snapshot`) feeds every screen; derive views on the client
  exactly like the prototype's `renderVals()`. Full studies via `/api/studies/{id}`.
- All app screens are client components; the gate is client-side (`GET /api/group`).
- Port the prototype's markup and inline styles 1:1 into CSS Modules: same font sizes, radii,
  paddings, colours, gaps. `style-hover="…"` → `:hover`. `all:unset` buttons → the global
  `.unstyled` reset class. Replace `cqi` units with `vw` (the shell is full-width; do **not** use
  `container-type`).
- Breakpoint: **< 760px = mobile** (compact header + sticky bottom tab bar), ≥ 760px = desktop top
  nav. Do it with CSS media queries (no JS width checks → no hydration flash).
- Dialogs and toasts render through a portal to `document.body`.
- Mobile: 44px+ targets, `viewport-fit=cover`, bottom bar padded with
  `env(safe-area-inset-bottom)`, header with `env(safe-area-inset-top)`.

### 3.1 Routes
| Route | Screen | Nav tab | Prototype screen / refs |
|---|---|---|---|
| (gate) | Entrance / password | — | `01 Entrance` · `mobile-01-entrance`, `desktop-entrance` |
| `/` | Home | Home | `02 Home` · `mobile-02`, `-03`, `mobile-full-02`, `desktop-home` |
| `/people` | People — Everyone | People | `03 People` · `mobile-04`, `desktop-people` |
| `/people/dates` | People — Dates to remember | People | `mobile-05`, `desktop-dates` |
| `/people/[id]` | Profile (+ gift editing) | People | `04 Profile` · `mobile-06/07/08`, `desktop-profile-rachel` |
| `/prayer` | Prayer — Active | Prayer | `05 Prayer` · `mobile-10/11/15`, `desktop-prayer` |
| `/prayer/answered` | Prayer — Answered | Prayer | `mobile-14`, `desktop-answered` |
| `/studies` | Studies (up next, drafts, path, archive) | Studies | `06 Studies` · `mobile-16/17`, `desktop-studies` |
| `/studies/[id]` | Study reader | Studies | `07 Study` · `mobile-18/19/20`, `desktop-study` |
| `/studies/new` | Editor (new) | Studies | `08 Edit study` · `mobile-21`, `desktop-editor` |
| `/studies/[id]/edit` | Editor (existing) | Studies | same |
| `/settings` | Settings (gap-fill) | — | none — compose from DS pieces |
| `/offline` | Offline fallback page | — | none |
| (any other URL) | `app/not-found.tsx`: “That page isn’t here” in the app chrome, behind the gate | — | none |

Seg tabs (People: Everyone / Dates to remember; Prayer: Active · N / Answered · N) are links
between the sibling routes, styled exactly like the prototype's `.seg` buttons.

### 3.2 File ownership (parallel build — stay in your lane)
| Owner | Files |
|---|---|
| foundation | `package.json`, `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `app/layout.tsx`, `app/globals.css`, `app/manifest.ts`, `app/(app)/layout.tsx`, `app/offline/**`, `components/{shell,ui,dialogs,pwa,providers}/**`, `lib/**`, `public/**`, `scripts/**` |
| home | `app/(app)/page.tsx`, `components/home/**` |
| people | `app/(app)/people/**`, `components/people/**` |
| prayer | `app/(app)/prayer/**`, `components/prayer/**` |
| studies | `app/(app)/studies/page.tsx`, `app/(app)/studies/[id]/page.tsx`, `components/studies/**` |
| editor | `app/(app)/studies/new/**`, `app/(app)/studies/[id]/edit/**`, `components/editor/**` |
| settings | `app/(app)/settings/**`, `components/settings/**` |

Screen owners never edit foundation files. If a foundation piece is genuinely broken and blocks
you, make the smallest possible surgical `Edit` (never rewrite the file) and list it in your
final report. Don't add dependencies.

### 3.3 Foundation contracts (what screens import)

`lib/types.ts` — the types in §2.3.

`lib/api.ts` — `api.get/post/put/patch/del<T>(path, body?)`; JSON in/out; `credentials:
'same-origin'`; sends `X-XSRF-TOKEN` (decoded `XSRF-TOKEN` cookie) on non-GET; on 419 refreshes
the cookie via `GET /api/group` and retries once; on 401 dispatches a `ff:locked` window event
(`LOCKED_EVENT`; this device's own Lock dispatches `ff:lock`, `LOCK_EVENT`). Throws
`ApiError {status, message, errors?, data?}` (`data` = the parsed body, e.g. a 409's `{message,
study}`); network failure → `ApiError` with `status: 0` and `offline: true`. `fieldErrors(e)` →
`{field: firstMessage}` for a 422 with field errors, else null; `isConflict(e)` for a 409.

`lib/endpoints.ts` — one typed function per endpoint in §2.4.

`lib/dates.ts` — local-time helpers, ported from the prototype: `today()`, `parseDay('YYYY-MM-DD')`,
`toDay(isoTimestamp)` (local calendar day), `parseTimestamp(iso)` (epoch ms, Laravel microseconds
trimmed, 0 for null), `toISODay(date)`, `daysBetween(a,b)`,
`ago(date)`, `until(date)`, `span(days)`, `longDate(date)` (“Wednesday, October 14”),
`shortDate(date)` (“Oct 14”), `MONTHS`, `WEEKDAYS`, `nextOccurrence(memberDate, today)`,
`seasonOf(date)` (“Fall 2026”; Dec counts toward that year's Winter), `nextSeasonName(date)`,
`greeting(at)` (“Good morning”), `capitalize`.

`lib/members.ts` — `GIFTS` (§5), `TONES`, `BLOBS`, `KIND` (label/bg/fg per date kind),
`firstName`, `lastName`, `initials`, `avatarStyle(member)` → `{bg, fg, blob}` (blob =
`BLOBS[(member.id - 1) % 4]`), `dateTitle(member, d)`, `buildDateRows(members, today)` → rows sorted by
days-until (`{key, member, date: MemberDate, on: Date, n, title, sub, mon, day, chipBg, chipFg,
kindLabel}`; `sub` exactly as the prototype's `dateRow`), `profileDateRows(member, today)` (the
prototype's `pDates`, “since YYYY” only for anniversaries/recurring events, never birthdays).

`lib/studies.ts` — `upNext(studies, today)` (earliest **published** study with
`meeting_date >= today` — on meeting night, tonight's study is “This week”), `pastStudies(studies, today)` (published, `meeting_date < today`, newest
first), `studyKicker(study, today)` (`in 7 days` / `tonight` / `last week`…), `buildPath(studies,
today)` (“The path so far”: one node per series ordered by first meeting date, season = season of
the series' median date, completed → `N studies` (only studies that have met count, and a series
that hasn't met yet is left off unless it is current), current (series of up-next, else latest) →
`chapter C of T` when the series is a Bible book in `BIBLE_CHAPTERS` and the up-next ref has a
chapter number, otherwise `N studies so far`; then a final node `What’s next?` · next season name ·
`we’ll decide together`), `archiveGroups(studies, today, query)`, `BIBLE_CHAPTERS`,
`nextMeetingDate(studies, settings, today)` (latest study date + 7, else next `meeting_day`),
`deriveSeries(ref)`, `notesToWarm(studies, today)` (every upcoming published study, then the 12
latest past ones: the notes worth saving for offline reading, §3.4).

`lib/prayers.ts` — `activeOf(prayers, memberId?)` (active, newest first), `answeredOf(prayers,
memberId?)` (by `answered_at`, else `created_at`, newest first), `byNewest`, `answeredAt`,
`updateWhen(update, now)` (“Last week”).

`lib/hooks.ts` — `useSnapshot()` (SWR), `useStudy(id)`, `useOnline()`, `useGroup()` (gate state:
`loading` / `locked` / `unlocked` / `unreachable` — the last when `/api/group` fails offline or
with a 5xx and nothing is cached; plus `unlock`, `lock`, `markLocked`, `refresh`), `useLock()` (the
Lock button: lock, then go Home with `leaveTo(…, {replace: true})`). `lock()` locks locally first
and never throws: open dialogs close, the editor's kept copies, the SW's API copy and the SWR cache
are cleared, the Entrance shows, and `POST /api/lock` is sent now or once back online (a pending
flag in localStorage keeps the Entrance up across reloads, and in other tabs, until the password is
entered). Gate flags outside React live in `lib/gate.ts`.

`lib/title.ts` — `useDocumentTitle(label)`: `document.title` is “{label} · {group name}”; the shell
sets a default per route (`components/shell/nav.ts` `routeTitle`), behind the Entrance it is just
the group name. Screens don't export `metadata.title`.

`lib/historyGuard.ts` — Back asks whatever is in front first: an open dialog closes as a cancel,
and a page guard (the editor's unsaved changes) can ask before leaving. `useHistoryGuard(active,
onBack)`, `goBack()`, `leaveTo(router, href, {replace?, scroll?})` (a replace also takes the
guarded page's own entry), `navigating()`, `historySettled()`, `guardHistory()`. `lib/route.ts`
lets work wait for the commit that puts a route on screen (`whenRoute`), reported by Providers.

`lib/actions.ts` — `useActions()` returns async functions that call the endpoint, revalidate the
snapshot (and study key when relevant), show the toast, and return the result. On failure they
rethrow and toast a plain message in the error style (`lib/toast.ts` tone `error`: neutral pill,
no leaf, role=alert; offline: “You’re offline — try again when you’re connected.”), except:
a 401 (the Entrance is already up); a 422 that names fields, which the form shows inline under the
field (`fieldErrors`; the gift toggles, with no field to show it under, still toast); and a
`saveStudy` 409 (`isConflict`), which the editor answers with its conflict dialog. Toast texts (no
exclamation marks, ever):

| action | toast |
|---|---|
| addPrayer | `Added — we’ll be praying` |
| addPrayerUpdate | `Update added` |
| answerPrayer | `Answered. Thank God.` (leaf sprout animation) |
| reopenPrayer | `Moved back to active` |
| updatePrayer | `Request updated` |
| deletePrayer | `Request deleted` |
| deletePrayerUpdate | `Update removed` |
| addDate / updateDate | `Date saved` |
| deleteDate | `Date removed` |
| addMember | `{First} is in the group` |
| updateMember (incl. gifts) | `Saved` (gifts: no toast) |
| deleteMember | `Removed {First}` |
| saveStudy (draft) | `Draft saved` |
| saveStudy (publish from draft) | `Published — everyone can read it now` |
| saveStudy (published, edited) | `Changes saved` |
| unpublishStudy | `Moved back to drafts` |
| deleteStudy | `Study deleted` |
| updateSettings | `Settings saved` |
| changePassword | `Password changed` |

`components/ui/` — `Avatar` (member, size), `DateChip` (mon, day, bg, fg, size), `Seg`
(options `{label, href, active}`, `label` for screen readers), `Icon` re-exports, `Toast`
(`useToast().show(text, {tone?})`), `Dialog` (portal, backdrop click/Escape closes, focus trap that
never drops focus to `<body>`, focus restored to the trigger or else the page heading — the new
page's when it closed for a `leaveTo`, e.g. “Remove from group” → `/people` — `.dialog`
styling from the prototype), `ConfirmDialog`, `EmptyState` (`level` for the heading), `BackButton`,
`ScreenState` / `LoadError` / `NotFound` (loading, failed and missing screens; `level` for the
heading, so the outline never skips one: 2 under the screen's own h1, 1 when the screen has no h1
without its data — a profile, the reader, the editor; `NotFound` defaults to 1), `focusLandmark()`,
`radioGroup()` (roving-tabindex radio buttons). Global classes: `.hit` (invisible 44px target),
`.sr-only`; busy buttons are `aria-disabled`, not `disabled`, so focus stays on them.

`components/dialogs/` — `DialogsProvider` + `useDialogs()`:
```ts
addPrayer(opts?: { memberId?: number }): Promise<Prayer | null>
answerPrayer(prayer: Prayer): Promise<Prayer | null>
editPrayer(prayer: Prayer): Promise<void>        // edit text/person/answer, remove updates, reopen, delete
addDate(opts: { memberId: number }): Promise<MemberDate | null>
editDate(date: MemberDate): Promise<void>        // includes “Remove this date”
addPerson(): Promise<Member | null>               // navigates to the new profile
editPerson(member: Member): Promise<void>         // includes “Remove from group” (navigates to /people)
confirm(opts: { title: string; body?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean }): Promise<boolean>
```
Prayer, answer and date dialogs match prototype screens 12, 13, 09 exactly. Back closes the top
dialog as a cancel; a route change or this device's Lock cancels them all; the promise resolves
once the dialog's history entry is gone, so navigating next is safe. 422s show under the field.
The date dialog sends `date` only when it changed; a yearless recurring date moved to another day
(the year the field filled in left as it was) goes as `--MM-DD` and stays yearless.

`components/shell/` — `AppShell` (gate → splash / “We can’t reach the group just now” /
Entrance / app chrome with a skip link and `<main id="main">`), desktop `TopNav`, mobile
`MobileHeader` + `TabBar`, `ScreenBoundary` (a screen that throws keeps the chrome),
`SystemCard` (whole-page notices: unreachable, `app/error.tsx`, `app/global-error.tsx`). Header
actions: Settings gear (gap-fill) then Lock. On a 401 (`ff:locked`: the password changed, or Lock
in another tab) the app stays mounted, inert and hidden under an Entrance that explains why; open
dialogs and a half-written study keep their input, and carry on after the password.
`components/pwa/` — `OfflineBanner`, `ServiceWorker`, `WarmNotes` (§3.4). The shell, providers and
pwa have no barrels; import from the files.

### 3.4 PWA
- `app/manifest.ts`: name `Fruitfull Footprints`, short_name `Footprints`, start_url `/`,
  display `standalone`, background & theme `#f5ead8`, icons 192/512 (`any`) + 512 `maskable`.
- Icons (`public/icons/`): the footprints mark in cream on deep sage (`#56633f`), generated by
  `scripts/generate-icons.mjs` and committed; plus `apple-touch-icon.png` (180) and favicon.
- `public/sw.js` (hand-written):
  - **Saved pages:** install precaches `/`, `/people`, `/people/dates`, `/prayer`,
    `/prayer/answered`, `/studies`, `/studies/new`, `/settings`, `/offline` with the static assets
    they load. Every page opened while online is saved too (`{type:'CACHE_URLS'}` from the page on
    each route change), and each fresh snapshot saves every profile and published study page in
    the background (and drops saved ones whose member or study is gone).
  - **Warmed notes:** the page (`components/pwa/WarmNotes.tsx`, behind the gate, online and
    worker-controlled only) fetches through the worker, one at a time when idle, the notes of every
    upcoming published study and the 12 latest past ones (skipping copies already current), so they
    read offline before anyone has opened them.
  - **Strategies:** `/_next/static/**` cache-first. Navigations network-first → saved page →
    `/offline`; a saved page is served when the network takes over 3s. `GET /api/*` network-first;
    a cached copy is served when the network takes over 4s or answers 5xx, and a late answer still
    updates the cache and reaches the page
    (`{type:'API_FRESH', key, data}`, applied to SWR). Never cache non-GET or 4xx.
    `{type:'CLEAR_DATA'}` (sent on Lock and on a lock-out) deletes the API cache.
  - **Versioning:** `ServiceWorker.tsx` registers `/sw.js?v=<NEXT_PUBLIC_BUILD_ID>` (a fresh id per
    `next build`, from `next.config.ts`; `FF_BUILD_ID` overrides it), so every deploy installs a new
    worker that re-saves its pages and drops the old shell — no manual version bump. The API cache
    (`ff-api`) survives deploys. Registered only in production builds (or with
    `NEXT_PUBLIC_ENABLE_SW=1`).
- `next.config.ts` sends security headers on every Next response (CSP without `script-src`,
  `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy`) and no
  `X-Powered-By`. External images, fonts, frames or fetches need a CSP change.
- `/offline` reloads itself when the connection comes back.
- `OfflineBanner`: “You’re offline — showing what was saved. Changes need a connection.” Write
  buttons stay enabled; failures toast the offline message.

---------------------------------------------------------------------------------------------------

## 4. Screen behaviour notes (beyond what the prototype makes obvious)

- **Home greeting:** “Good morning/afternoon/evening, friends.” by local hour (<12, <17, else).
- **Home “This week” card:** `upNext`; kicker `This week · {until}`; place line
  `{longDate} · {study.location ?? settings.meeting_place}, {settings.meeting_time}`. If there is
  no up-next study: same sage card with “No study posted yet” and a `Prepare a study` button →
  `/studies/new`.
- **Home “Prayer this week”:** newest 3 active; “View all N prayer requests”. Coming up: date
  rows with `n <= 45`, max 5. Our group: all members. Recently: newest 4 activities.
- **People:** “{N} of us, most {meeting_day}s.” Dates tab: rows with `n <= 365` grouped by month
  (append the year when it isn't the current year).
- **People card “soon” tag:** earliest date row within 21 days → `Birthday in 4 days` /
  `Anniversary in 11 days` / `{event title} in 3 weeks`.
- **Profile:** dates list (upcoming first, then past one-time events); tapping a row opens
  `editDate`. “Add prayer request” → `addPrayer({memberId})`. Gift editing is the prototype's
  inline toggle panel (PATCH `gifts`, optimistic).
- **Prayer:** active sorted newest first; inline “Add update” textarea per card (screen 11);
  “Mark answered” → `answerPrayer`; answered tab grid sorted by `answered_at` desc with
  “Prayed over for {span}”.
- **Studies:** drafts show as dashed cards (“Draft · only visible here”); search filters past
  published studies by ref/title/description, and is kept in the URL (`/studies?q=`, written with
  `history.replaceState`) so Back from a study restores it.
- **Editor:** heading `New study` / `Preparing {ref}` (draft) / `Editing {ref}` (published).
  Fields: Passage (= `ref`), Title, Primary passage, Meeting date, plus gap-fill **Series** and
  **Where** (placeholder = the derived series / `settings.meeting_place`), and the description.
  Section kinds: Section, Scripture, Questions, Reflection, **Prayer** (gap-fill), each with
  move up/down + remove. Sticky footer exactly as designed; hint copy for drafts is
  “Drafts only show up here on Studies. Publish whenever it’s ready — days early is great.”
  (the design's “Only you can see this” isn't true with a shared password). Existing studies get
  a quiet “Delete study” (confirm) and, when published, “Move back to drafts”. New study defaults:
  `nextMeetingDate`, sections = Opening Thought text, empty scripture, Discussion Questions.
  A new study's first save moves to its edit URL; publishing navigates to the reader. Either way
  a new study's blank editor is replaced in history (`leaveTo` with `replace`), so Back skips it.
  ⌘S / Ctrl+S saves in place. Unsaved changes: Back (the history guard) and in-app links ask
  first (“Leave without saving?”), the header Lock asks “Lock without saving?”, and reload/close
  get the browser's prompt. The writing is kept on the device (`localStorage`
  `ff:editor-draft:{id|new}`), restored with a quiet notice next time; it goes once saved, undone,
  discarded or deleted, and on this device's Lock. Saves send `expected_updated_at`; a 409 opens
  a conflict dialog: Load their version (from the 409's `study`), Keep mine (saves again without
  the field), or close it and keep editing.
- **Lock:** close open dialogs, tell the SW to clear its API cache, clear the SWR cache and the
  editor's kept copies, show the Entrance and go Home, then `POST /api/lock` (straight away, or
  once back online — the device stays locked meanwhile, across reloads). A lock-out from elsewhere
  (401) keeps the app mounted under the Entrance instead, so nothing typed is lost.

## 5. Constants

`GIFTS = ['Encouragement','Mercy','Hospitality','Teaching','Serving','Giving','Leadership','Wisdom','Faith','Prayer','Administration','Shepherding','Knowledge','Evangelism']`

Voice: plain and warm; human dates (“Added 3 days ago”, “in 7 days”, “Prayed over for 3 weeks”);
no exclamation marks, no clichés. Scripture: World English Bible.

## 6. Gap-fill UI (not in the prototype — build in the same visual language)
- People header: `+ Add person` (btn-secondary, like Studies' `New study`) → `addPerson`.
- Profile: `Edit` (btn-secondary with pencil, top-right, like the study reader) → `editPerson`.
  Person dialog: name, tone picker (three avatar blobs previewing the initials), one-line
  description, Family, Interests, Good to know; edit mode adds a quiet “Remove from group” →
  confirm (“Their prayer requests and dates will be removed too.”).
- Prayer cards (Prayer page + Profile): small ghost icon button (pencil) at the card's top-right →
  `editPrayer`.
- Settings page (`/settings`, gear in the header): sand card with group name, tagline, meeting
  day (select), time, usual place, since year → Save; second card “Change password” (current,
  new, confirm). Heading style like other pages: H1 “Settings” + muted subtitle.
- Confirmations use `ConfirmDialog`; destructive confirm buttons are `btn-primary` with
  `--color-accent-700` background.
