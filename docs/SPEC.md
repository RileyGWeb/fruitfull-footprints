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
- **Auth = a password per person, two roles.** Everyone signs in with a password of their own, typed by a
  leader (8–64 characters, nobody else's; the password alone says who they are). A person is a **member** or a
  **leader**; a hidden **super admin** (a bcrypt hash in the server's environment, no profile) can do everything
  and is how the first leaders get logins. No author attribution. Lock = log out. What each role may do is §2.1a.
  (This replaced the first design, one password shared by the whole group.)
- **Phones get the install screen first.** A phone or tablet in a browser tab sees only “add it to your home
  screen”; the app is opened from there and signed in to there. Computers and the installed app go to sign-in.
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
so the API is same-origin: no CORS, session cookie set on the frontend origin. Local logins (the demo
data, `DemoSeeder::LOGINS`): Rachel `footprints` and Mike `mike-leads` (leaders), Sarah `sarah-member` (a member);
the local super admin is `SUPER_ADMIN_PASSWORD_HASH` in `backend/.env`.

Screenshot tool for visual checks against the refs: `node tools/shot.mjs --url /prayer --out
/tmp/x.png [--viewport desktop] [--full] [--scroll 300] [--fill "<selector>=<text>"] [--click
"<selector>"]` (unlocks the gate automatically; prints page and console errors). Compare with the
matching `docs/design/refs/*.png` by reading both images.

---------------------------------------------------------------------------------------------------

## 2. Backend (Laravel 13, PHP ≥ 8.3, Postgres)

### 2.1 Auth & sessions
- All API routes live in `routes/api.php` under prefix `/api` and run through the **`web`
  middleware group** (cookies, session, CSRF). No Sanctum, no `User` model, no `users` /
  `password_reset_tokens` / `personal_access_tokens` tables (keep `sessions`, `cache`, `jobs`): a person's login
  lives on their `members` row (§2.2), and the super admin's in the environment.
- Session driver `database`, lifetime 525600 min (a year — it's a “remember this device” app).
- CSRF: Laravel's standard `XSRF-TOKEN` cookie; the client echoes it in `X-XSRF-TOKEN`. Any GET
  through the web group (e.g. `GET /api/group`) sets the cookie.
- Sign in: `POST /api/unlock {password}` → `App\Services\Logins::attempt`: the password (trimmed) is looked up
  by a keyed hash (HMAC-SHA256 with the app key; `members.password_lookup`, unique), the person's bcrypt hash
  confirms it, and failing both it is checked against the super admin's hash (`config('group.super_admin_hash')`,
  from `SUPER_ADMIN_PASSWORD_HASH`). A miss costs one bcrypt check, as a hit does. Then `session()->regenerate()`
  and the session stores `ff_unlocked = true` with either `ff_member_id` + `ff_auth_version`, or `ff_super` (a
  fingerprint of the super admin hash). Throttled by the named `unlock` limiter, which counts wrong passwords
  only: 10/minute and 30/hour per client (IPv4 address or IPv6 /64), 100/hour for everyone together; 429 JSON with
  `Retry-After` (model and rationale: `docs/contracts/backend.md`).
- `group.unlocked` middleware (alias) on every other route: 401 `{"message":"Locked"}` unless a **viewer**
  resolves from the session on that request: the person still exists, still has a login, and their
  `auth_version` equals the session's (so a new or removed password, or a removed person, signs that person out
  on every device); or the super admin with the current hash's fingerprint. The `leader` middleware (alias) is
  the same check plus 403 `{"message":"You don’t have access to do that."}` for a member. Role is read on every
  request, never kept in the session, so promoting or demoting counts at once.
- Lock: `POST /api/lock` → `session()->invalidate()` + `regenerateToken()` → 204.
- Trust proxies `127.0.0.1`/`::1` (plus `TRUSTED_PROXIES` env); the client IP is the rightmost
  untrusted `X-Forwarded-For` entry. Next's rewrite proxy forwards the browser's
  `X-Forwarded-For` verbatim and adds none, so production must put a reverse proxy in front of
  Next that appends the socket address (`backend/README.md`); otherwise clients pick their own.
- `php artisan ff:prune-sessions` (scheduled daily) removes sessions idle ≥ 24h that aren't signed in with a
  login that still works (same test as the gate), so cookie-less requests can't grow `sessions`.

### 2.1a Who may do what

Everyone signed in reads everything except draft studies, which members never see (a draft is a 404 to them, and
absent from their snapshot).

| | Member | Leader | Super admin |
|---|---|---|---|
| Read people, dates, prayer, activity, published studies | ✓ | ✓ | ✓ |
| Read draft studies | | ✓ | ✓ |
| Add a prayer request (for anyone) or an update on one | ✓ | ✓ | ✓ |
| Edit, answer, reopen, delete a request, or remove an update | only requests about them | ✓ | ✓ |
| Move a request to someone else | | ✓ | ✓ |
| Edit a profile and its dates (name, color, gifts, about rows) | only their own | ✓ any | ✓ |
| Add or remove people; give a role or a password; take a login away | | ✓ (not themselves) | ✓ |
| Write, publish, edit, delete studies | | ✓ | ✓ |
| Change the group's settings | | ✓ | ✓ |

Rules behind the table live in `backend/app/Policies` (`MemberPolicy`, `PrayerRequestPolicy`, `StudyPolicy`),
asked through `Viewer::can()` / `authorize()`; the `leader` route gate covers settings, adding and removing people,
logins and writing studies. A leader can't step down, remove or take the login of themselves (they can change
their own password); the super admin is nobody's profile, so none of that applies to them. A member who sends
`role` or `password` is refused outright (403), not ignored.

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

(Older databases may still hold `password_hash` and `password_version` rows from when everyone shared one
password. Nothing reads them, and the seeder leaves them alone.)

`members`
| col | type | rules |
|---|---|---|
| id | bigint pk | |
| name | string(120) | required |
| tone | string | `sage` \| `accent` \| `sand` (default: cycle by count) |
| gifts | jsonb array of strings | each ∈ `GIFTS` list (§5), unique, ≤ 14 |
| line | string(280) null | one-line description (“Hosts most weeks…”) |
| family, interests, good_to_know | text null (≤ 1000) | the profile “About” rows |
| role | string(10), default `member` | `member` \| `leader`; not mass-assignable |
| password_hash | string null | bcrypt of their password; null = can't sign in; never serialized |
| password_lookup | string(64) null, unique | HMAC-SHA256 of the (trimmed) password keyed by `APP_KEY`; finds the person at sign-in |
| auth_version | unsigned int, default 1 | +1 whenever the password changes or is removed; sessions hold the value they signed in with |
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
- Errors: 422 `{message, errors:{field:[msg]}}`, 401 `{message:"Locked"}`, 403 `{message}` (not allowed, §2.1a), 404, 409 (stale study save, §2.4), 419 (CSRF), 429.
  422 field messages are plain copy meant to show under the field (“Keep it under 2,000
  characters.”), with no field names or paths; a few keep Laravel's wording because the client
  matches on it (`docs/contracts/backend.md`).

Resource shapes (also the TypeScript types in `frontend/lib/types.ts`):
```ts
type Settings = { group_name: string; tagline: string; meeting_day: string; meeting_time: string;
                  meeting_place: string; since_year: number };
type Role = 'member'|'leader';
type Viewer = { role: Role|'super'; member_id: number|null; name: string|null };
type GroupInfo = { group_name: string; tagline: string; meeting_day: string; since_year: number;
                   unlocked: boolean; viewer: Viewer|null /* who is signed in on this device */ };
type MemberDate = { id: number; member_id: number; kind: 'birthday'|'anniversary'|'event';
                    label: string|null; month: number; day: number; year: number|null; recurring: boolean };
type Member = { id: number; name: string; tone: 'sage'|'accent'|'sand'; role: Role; gifts: string[];
                line: string|null; family: string|null; interests: string|null; good_to_know: string|null;
                dates: MemberDate[]; created_at: string;
                has_login?: boolean /* can they sign in? only leaders are told */ };
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

Public (web group, no sign-in):
| Method & path | Body | Response |
|---|---|---|
| `GET /api/group` | — | `GroupInfo` (also seeds the XSRF cookie) |
| `POST /api/unlock` | `{password}` | 200 `{unlocked:true, viewer:Viewer}` · 422 `{message:"Try that once more.", errors:{password:[…]}}` · 429 · 503 `{message}` if no one can sign in yet (no super admin hash and no one with a login) |
| `POST /api/lock` | — | 204 |

Signed in (`group.unlocked`); who may call each is §2.1a (L = `leader` gate, S = self or a leader, M = a leader or
the person a request is about):
| Method & path | Body | Response |
|---|---|---|
| `GET /api/snapshot` | — | `Snapshot` (members get published studies only) |
| `PATCH /api/settings` (L) | any subset of `Settings` | `Settings` |
| `POST /api/members` (L) | `{name, tone?, gifts?, line?, family?, interests?, good_to_know?, role?, password?}` | 201 `Member` (logs `member_added`) |
| `PATCH /api/members/{id}` (S) | any subset of the above; `role` and `password` (leaders only) | `Member`; a new `password` signs that person out elsewhere (not this device, if it's theirs); 422 on a leader's own `role` stepping down |
| `DELETE /api/members/{id}` (L, not self) | — | 204 (cascades dates, prayers, updates) |
| `DELETE /api/members/{id}/login` (L, not self) | — | `Member`; their password goes and they're signed out everywhere |
| `POST /api/members/{id}/dates` (S) | `{kind, label?, date:"YYYY-MM-DD"\|"--MM-DD", recurring}` | 201 `MemberDate` (server splits `date` into month/day/year; `--MM-DD` = a recurring date kept without a year, so `year` is null and Feb 29 is fine) |
| `PATCH /api/dates/{id}` (S) | `{kind?, label?, date?, recurring?}` | `MemberDate` |
| `DELETE /api/dates/{id}` (S) | — | 204 |
| `POST /api/prayers` | `{member_id, body}` | 201 `Prayer` (logs `prayer_added`) |
| `PATCH /api/prayers/{id}` (M) | `{member_id?, body?, answer?}` (`member_id` to another person: leaders only) | `Prayer` (`answer` only meaningful when answered) |
| `DELETE /api/prayers/{id}` (M) | — | 204 |
| `POST /api/prayers/{id}/answer` (M) | `{answer?}` | `Prayer`; active→answered sets `answered_at=now` and logs; if already answered just updates `answer` |
| `POST /api/prayers/{id}/reopen` (M) | — | `Prayer`; back to active, clears `answer` + `answered_at` |
| `POST /api/prayers/{id}/updates` | `{body}` | 201 `PrayerUpdate` (logs `prayer_updated`, touches the prayer) |
| `DELETE /api/prayer-updates/{id}` (M, of its request) | — | 204 |
| `GET /api/studies/{id}` | — | `Study` (404 for a draft, to a member) |
| `POST /api/studies` (L) | `{series?, ref?, title?, passage?, meeting_date, location?, description?, sections, status}` | 201 `Study` |
| `PUT /api/studies/{id}` (L) | same as POST (full replace), plus optional `expected_updated_at` | `Study`; draft→published sets `published_at` + logs `study_published`; published→draft clears `published_at` · 409 `{message:"This study was changed somewhere else.", study: Study}` when `expected_updated_at` is sent and isn't the current `updated_at` (nothing changes) |
| `DELETE /api/studies/{id}` (L) | — | 204 |

A person's `password`: 8–64 characters once trimmed, not one of a short list of very common ones (or one letter
repeated), and not already someone else's (or the super admin's), since it alone identifies them; 422 under
`password` otherwise. It's stored only as a bcrypt hash and a keyed lookup, never sent back.

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
- `DatabaseSeeder`: writes missing settings defaults and nothing else (no logins; the deploy runs it every
  time). Idempotent.
- `DemoSeeder` (`php artisan migrate:fresh --seed --seeder=DemoSeeder`): runs `DatabaseSeeder`,
  then loads the prototype's `MEMBERS`, `PRAYERS`, `STUDIES`, `ACTIVITY` **verbatim** (same text,
  same curly quotes), plus 8 published *Psalms of Ascent* studies (series `Psalms of Ascent`,
  refs `Psalm 120`…`Psalm 127`, sensible titles/descriptions/sections, Wednesdays 2026-04-01 →
  2026-05-20), and three logins (`DemoSeeder::LOGINS`: Rachel and Mike leaders, Sarah a member). Every absolute date (prayer added/updated/answered, study meeting dates, one-time
  events, activity) is shifted by `floor(days(2026-10-07 → today) / 7) * 7` days so the demo always
  sits in the same place relative to today and Wednesdays stay Wednesdays. Recurring month/day
  dates are not shifted. Timestamps are set at 19:00 UTC on their date. The Romans 8 draft-vs-
  published states, the Romans 9 draft, `verse`, and update histories must match the prototype.
- `php artisan ff:login {member} {--role=} {--password=} {--remove}` gives a person (by id or full name) a
  password (prompts if omitted and no `--role`), changes their role, or takes their login away; applies the same
  password rules as the API and signs that person out elsewhere.

### 2.6 Tests
PHPUnit feature tests against `fruitfull_test` (Postgres) covering every endpoint: lock gate,
sign-in ok/wrong/throttled/nobody-can-yet, lock, a changed password or role taking effect, the permission
matrix of §2.1a for members, leaders and the super admin, every CRUD
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
- All app screens are client components; the gate is client-side (`GET /api/group`). Two gates, in order: on a
  phone or tablet in a browser tab, the **install screen** (`components/shell/InstallGate.tsx`) and nothing else;
  then the **Entrance** (a password, nothing else). The signed-in person's role comes with `GET /api/group`
  (`viewer`), and screens hide what that role can't do (`lib/access.ts`); the server refuses it regardless.
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
| (gate, phones) | Install screen: how to add the app to the home screen, nothing else | — | none (the Entrance's card; Settings' install steps) |
| (gate) | Entrance / password | — | `01 Entrance` · `mobile-01-entrance`, `desktop-entrance` |
| `/` | Home | Home | `02 Home` · `mobile-02`, `-03`, `mobile-full-02`, `desktop-home` |
| `/people` | People — Everyone | People | `03 People` · `mobile-04`, `desktop-people` |
| `/people/dates` | People — Dates to remember | People | `mobile-05`, `desktop-dates` |
| `/people/[id]` | Profile (+ gift editing) | People | `04 Profile` · `mobile-06/07/08`, `desktop-profile-rachel` |
| `/prayer` | Prayer — Active | Prayer | `05 Prayer` · `mobile-10/11/15`, `desktop-prayer` |
| `/prayer/answered` | Prayer — Answered | Prayer | `mobile-14`, `desktop-answered` |
| `/studies` | Studies (up next, drafts, path, archive) | Studies | `06 Studies` · `mobile-16/17`, `desktop-studies` |
| `/studies/[id]` | Study reader | Studies | `07 Study` · `mobile-18/19/20`, `desktop-study` |
| `/studies/new` | Editor (new), leaders only (“That one’s for leaders” otherwise) | Studies | `08 Edit study` · `mobile-21`, `desktop-editor` |
| `/studies/[id]/edit` | Editor (existing), leaders only | Studies | same |
| `/settings` | Settings (gap-fill): who you are, this device; for leaders, the group's details | — | none — compose from DS pieces |
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

`lib/access.ts` — `accessFor(viewer)` → `{role, memberId, isLeader, isSuper, isMe(id), canEditPerson(id),
canManagePrayer(prayer)}` and `roleLabel(role)`: the rules of §2.1a as the screens need them, only to hide
controls that would be refused (the server decides). Hooks: `useViewer()`, `useAccess()` (`lib/hooks.ts`).

`lib/api.ts` — `api.get/post/put/patch/del<T>(path, body?)`; JSON in/out; `credentials:
'same-origin'`; sends `X-XSRF-TOKEN` (decoded `XSRF-TOKEN` cookie) on non-GET; on 419 refreshes
the cookie via `GET /api/group` and retries once; on 401 dispatches a `ff:locked` window event
(`LOCKED_EVENT`; this device's own Lock dispatches `ff:lock`, `LOCK_EVENT`). Throws
`ApiError {status, message, errors?, data?}` (`data` = the parsed body, e.g. a 409's `{message,
study}`); network failure → `ApiError` with `status: 0` and `offline: true`. `fieldErrors(e)` →
`{field: firstMessage}` for a 422 with field errors, else null; `isConflict(e)` for a 409.

`lib/endpoints.ts` — one typed function per endpoint in §2.4. `unlock(password)` → `{unlocked, viewer}`;
`removeLogin(id)` → `Member`.

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
with a 5xx and nothing is cached; plus `unlock`, `lock`, `markLocked`, `refresh`; an answer that says unlocked
without a `viewer`, as an older saved copy would, counts as locked), `useViewer()`, `useAccess()`, `useLock()` (the
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
| removeLogin | `{First} can’t sign in anymore` |
| saveStudy (draft) | `Draft saved` |
| saveStudy (publish from draft) | `Published — everyone can read it now` |
| saveStudy (published, edited) | `Changes saved` |
| unpublishStudy | `Moved back to drafts` |
| deleteStudy | `Study deleted` |
| updateSettings | `Settings saved` |

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
addPerson(): Promise<Member | null>               // navigates to the new profile; leaders only
editPerson(member: Member): Promise<void>         // a leader's: includes “Signing in” (role, password, “Remove sign-in”) and “Remove from group” (navigates to /people); a member's own: the profile fields only
confirm(opts: { title: string; body?: string; confirmLabel: string; cancelLabel?: string; danger?: boolean }): Promise<boolean>
```
Prayer, answer and date dialogs match prototype screens 12, 13, 09 exactly. Back closes the top
dialog as a cancel; a route change or this device's Lock cancels them all; the promise resolves
once the dialog's history entry is gone, so navigating next is safe. 422s show under the field.
The date dialog sends `date` only when it changed; a yearless recurring date moved to another day
(the year the field filled in left as it was) goes as `--MM-DD` and stays yearless.

`components/shell/` — `AppShell` (install screen on a phone's browser tab, else gate → splash / “We can’t reach the group just now” /
Entrance / app chrome with a skip link and `<main id="main">`), desktop `TopNav`, mobile
`MobileHeader` + `TabBar`, `ScreenBoundary` (a screen that throws keeps the chrome),
`SystemCard` (whole-page notices: unreachable, `app/error.tsx`, `app/global-error.tsx`), `InstallGate`
(a phone's browser tab: the install screen, below). Header actions: Settings gear (gap-fill) then Lock. On a 401 (`ff:locked`: the password changed, or Lock
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
- **Install screen** (`components/shell/InstallGate.tsx`, `useMustInstall()` in `components/settings/install.ts`):
  a phone or tablet (by user agent, plus an iPad posing as a Mac by its touch screen) whose page isn't running as
  the installed app (`display-mode` standalone / fullscreen / minimal-ui / window-controls-overlay, or iOS
  `navigator.standalone`) shows only this: one **Install the app** button where the browser has offered the install
  sheet (`beforeinstallprompt`), the Share → Add to Home Screen steps on iOS, the browser-menu steps elsewhere, a
  “you're in another app's browser, open this in Safari or Chrome” note inside Facebook, Instagram and friends, and
  “It's on your phone now” once installed. Nothing on it signs in, whatever the URL (deep links included). Known
  only on the client, so the server render and first paint are the splash. Computers never see it.
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
  (the design's “Only you can see this” isn't true: every leader sees drafts, and no member does). Existing studies get
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
- **Who sees what** (§2.1a). Members: no *Add person*, no *Edit* / *Edit gifts* / date controls on anyone
  else's profile, *Mark answered* and the request pencil only on requests about them, no *New study* /
  *Prepare a study* / drafts / *Edit* on a study (the editor routes say “That one's for leaders”), no group
  details in Settings. Everyone: *Add prayer request* and *Add update*. People cards and profiles are tagged
  **Leader**, and **You** on the signed-in person's own; leaders also get a **Signing in** card on each profile
  (has a password or not, a way to change it or the role). Settings shows **You're signed in** (name, role, a way to
  the profile; for the super admin, a line saying so) and **On this device** to everyone.
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
- Profile: `Edit` (btn-secondary with pencil, top-right, like the study reader) → `editPerson`, for leaders
  and the person themselves.
  Person dialog: name, tone picker (three avatar blobs previewing the initials), one-line
  description, Family, Interests, Good to know. For leaders, a quiet **Signing in** section follows: **Role**
  (Member / Leader pills; not on their own profile) and **Password** (typed, visible, 8–64 characters, with the
  server's reason under the field when it's too short, too common or someone else's; blank keeps the current
  one) and, for someone who has one, a quiet “Remove sign-in” → confirm (“They stay in the group, but can’t open
  the app until you give them a new password.”); edit mode adds a quiet “Remove from group” (not on their own
  profile) → confirm (“Their prayer requests and dates will be removed too.”).
- Prayer cards (Prayer page + Profile): small ghost icon button (pencil) at the card's top-right →
  `editPrayer`.
- Settings page (`/settings`, gear in the header): for leaders a sand card with group name, tagline, meeting
  day (select), time, usual place, since year → Save; for everyone “You're signed in” (who, their role, a link to
  their profile) beside “On this device” (install helper, Lock). There is no password to change here: each
  person's is set by a leader on their profile. Heading style like other pages: H1 “Settings” + muted subtitle.
- Confirmations use `ConfirmDialog`; destructive confirm buttons are `btn-primary` with
  `--color-accent-700` background.
