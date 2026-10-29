# Backend contract

Session/CSRF flow and routes as built (written by the backend reviewer). SPEC.md section 2 is the design; this is the as-built detail.

SESSION AND CSRF FLOW (browser to Next on :3110, which proxies /api/* to Laravel on :8110). Verified live with curl on :8112.
1. `GET /api/group`, sent with `credentials: 'same-origin'`, sets two cookies:
   - `fruitfull-footprints-session`: httpOnly, SameSite=Lax, one-year lifetime.
   - `XSRF-TOKEN`: readable by JS, encrypted, URL-encoded.
   Any GET through /api sets them again.
2. On every non-GET request, send:
   - `X-XSRF-TOKEN: decodeURIComponent(<current XSRF-TOKEN cookie>)`
   - `Content-Type: application/json`
   - `Accept: application/json`
   Read the cookie fresh before each write. The token rotates on POST /api/unlock and POST /api/lock, so an old token then gets 419.
   Laravel 13 also accepts `Sec-Fetch-Site: same-origin` with no token (framework default).
   A request with no matching token and no same-origin header gets 419 `{"message":"CSRF token mismatch."}`. This covers no header, `same-site` and `cross-site`. On 419: call GET /api/group, then retry once.
3. `POST /api/unlock {password}` returns:
   - 200 `{unlocked:true, viewer:{role, member_id, name}}`. The session id and token are regenerated; the session stores ff_unlocked=true and who signed in (see ACCESS below).
   - 422 `{"message":"Try that once more.","errors":{"password":["Try that once more."]}}`: no one has that password. Blank or not text is the same.
   - ★ 429 `{"message":"Too Many Attempts."}` with `Retry-After` once the `unlock` limiter trips. Only wrong passwords count. See UNLOCK THROTTLING below.
   - 503 `{message}` when no one can sign in yet: no super admin hash configured and no person has a login.
4. Gated routes return 401 `{"message":"Locked"}` unless the session holds a login that still works (ACCESS). The 401 comes before any 403 or 404. A session from the time everyone shared one password (ff_pw_version, no person) is a 401.
5. `POST /api/lock` returns 204. It invalidates the session and rotates the token.
6. There is no password change endpoint any more (`PUT /api/settings/password` is gone): a person's password is set by a leader on `POST /api/members` or `PATCH /api/members/{id}`, and removed with `DELETE /api/members/{id}/login`.

ROUTES (all under /api; ids must be numeric, `[0-9]{1,18}`, anything else is 404)
Public:
- GET /api/group → GroupInfo (`viewer`: {role, member_id, name} or null)
- POST /api/unlock
- POST /api/lock → 204

Gated (signed in). Marks: (L) leaders only, by the `leader` route gate (403 for a member); (S) the person themselves or a leader; (M) a leader or the person the request is about; see ACCESS.
- GET /api/snapshot → Snapshot (members: published studies only)
- PATCH /api/settings (L) → Settings
- POST /api/members (L) → 201 Member
- PATCH /api/members/{id} (S) → Member
- DELETE /api/members/{id} (L, not yourself) → 204
- DELETE /api/members/{id}/login (L, not yourself) → Member
- POST /api/members/{id}/dates (S) → 201 MemberDate
- PATCH /api/dates/{id} (S) → MemberDate
- DELETE /api/dates/{id} (S) → 204
- POST /api/prayers → 201 Prayer
- PATCH /api/prayers/{id} (M; moving it to another person: leaders) → Prayer
- DELETE /api/prayers/{id} (M) → 204
- POST /api/prayers/{id}/answer (M) → Prayer
- POST /api/prayers/{id}/reopen (M) → Prayer
- POST /api/prayers/{id}/updates → 201 PrayerUpdate
- DELETE /api/prayer-updates/{id} (M, of its request) → 204
- GET /api/studies/{id} → Study (404 for a draft, to a member)
- POST /api/studies (L) → 201 Study
- PUT /api/studies/{id} (L) → Study · ★ 409 `{message, study}` (see STUDY SAVES AND CONFLICTS)
- DELETE /api/studies/{id} (L) → 204

Errors: 422 `{message, errors:{field:[msg]}}`, 401, ★ 403 `{"message":"You don’t have access to do that."}` (every 403 says exactly this), 404 `{message}`, 405, ★ 409, 419, 429, 503.

ACCESS (people with logins of their own; roles)
- A person (`members` row) has `role` (`member` or `leader`) and, optionally, a login: `password_hash` (bcrypt) + `password_lookup` (HMAC-SHA256 of the trimmed password keyed with `APP_KEY`, unique) + `auth_version`. The hidden super admin is not a row: `config('group.super_admin_hash')`, from env `SUPER_ADMIN_PASSWORD_HASH`.
- The password alone says who signs in. `Logins::attempt` finds the person by the lookup, confirms with bcrypt, and otherwise tries the super admin hash; a miss costs one bcrypt check, the same as a hit. A hash in the environment that isn't bcrypt (a mangled `$`) is logged and matches nobody, instead of breaking sign-in for all. Passwords are case sensitive and trimmed (a phone keyboard's trailing space doesn't matter). After `APP_KEY` changes, every person's password has to be set again (the lookup is keyed by it); the super admin's is unaffected.
- Session keys: `ff_unlocked`, then `ff_member_id` + `ff_auth_version` for a person, or `ff_super` (a 32-character fingerprint of the super admin hash) for the super admin. A new sign-in clears the others, so one device is one person at a time. The viewer is resolved on every request (one query), so: a changed role counts at once; a new or removed password raises `auth_version` and every other device of that person gets 401 (the device that set its own password is kept signed in); a removed person's sessions get 401; a new super admin hash signs the super admin out.
- Passwords (`Logins::passwordProblem`, one source for the API and `ff:login`): trimmed length 8–64 characters and at most 72 bytes (bcrypt reads no more); not in a short list of very common passwords (including the app's own name) and not one character repeated; not another person's or the super admin's. Messages (422 under `password`): “Use at least 8 characters.”, “Keep it under 64 characters.”, “That one’s too easy to guess. Try something longer or less common.”, “Someone else already uses that password. Try another.”, “This needs to be text.”. A clash that slips past the check (two leaders setting the same one at once) is caught by the unique index and reported the same way.
- Who may do what is `backend/app/Policies` (`MemberPolicy`: create/update/delete/manageLogin/removeLogin; `PrayerRequestPolicy`: manage/reassign; `StudyPolicy`: view/create/update/delete), asked through `Viewer::can()` / `authorize()`; the super admin passes every one as a leader who is nobody's profile. Form requests authorize before they validate, so a forbidden save is 403, never 422.
  - Members: `PATCH /members/{self}` for the profile fields; dates of their own profile; requests and updates on any request; manage requests about them (not move them); read published studies. Sending `role` or `password` as a member is a 403, even with no other change.
  - A leader can't `DELETE` themselves, can't remove their own login, and can't `PATCH` their own `role` to `member` (422 `errors.role`: “You can’t step down yourself. Ask another leader.”). They can set their own password.
  - `MemberResource` adds `role` for everyone and `has_login` for leaders only; nothing derived from a password ever leaves the server.
- `php artisan ff:login {member} {--role=} {--password=} {--remove}` does the same from the server.
- The `leader` middleware looks the viewer up itself (it doesn't rely on running after `group.unlocked`) and, like `group.unlocked`, answers before route model binding: `DELETE /api/members/999999` is 401 signed out, 403 as a member, 404 as a leader.

REFINEMENTS TO SPEC 2.3 / 2.4 (★ = changed in this review)
- Timestamps look like `2026-10-05T19:00:00.000000Z` (UTC, microseconds). `meeting_date` is YYYY-MM-DD.
- `verse`: an excerpt of the first non-empty scripture section.
  - Whitespace is collapsed.
  - The text is cut at the first `, ; : . ? !` followed by a space, once it is at least 40 characters long, and `…` is appended.
  - Otherwise it is the full text, or null when there is no scripture.
  - Romans 8 gives exactly the prototype's "There is therefore now no condemnation to those who are in Christ Jesus…".
- Sections:
  - Every section has `id` and `type`.
  - text, reflect and prayer sections carry `{heading: string|null, body: string}`.
  - scripture sections carry `{ref: string|null, text: string}`.
  - questions sections carry `{heading: string|null, items: string[]}`; items are trimmed and blanks removed.
  - Server-assigned ids look like `sAbC12dEf3G`. A duplicate or blank client id is replaced. An id over 40 characters, a non-string id, or an unknown type returns 422.
  - jsonb may reorder object keys.
  - ★ Blank or null question lines are dropped before the 40-item limit is checked; 40 real questions plus blank lines is accepted.
- POST/PUT studies:
  - `sections` must be present (`[]` is fine). `meeting_date` and `status` are required.
  - ★ `meeting_date` must fall between 1900-01-01 and 2200-12-31, or 422 "Pick a date between 1900 and 2200." (year 0 used to reach Postgres and 500).
  - `ref` and `title` are required only when status=published.
  - Optional fields left out of a PUT become null (full replace).
  - A blank `series` is derived from `ref` on every save; an explicit series is kept.
  - draft→published or created-as-published sets published_at=now and logs `study_published`. published→draft clears published_at. Saving a draft, or editing a published study, logs nothing.
- Members:
  - ★ `role` (`member` default, or `leader`) and `password` are leader-only fields on POST and PATCH (see ACCESS); `profile()` in `SaveMemberRequest` is everything else. A blank `password` is ignored (kept), so a form can leave it empty.
  - POST needs only `name`. `tone` (null or missing) cycles sage, accent, sand by member count.
  - ★ `gifts` must be a JSON array, i.e. a list; an object or null returns 422. Each gift must be from the GIFTS list.
  - ★ Repeated gifts are de-duplicated (first wins, order kept) instead of rejected.
  - `dates` are ordered by id. The snapshot lists members in join order (created_at, then id), so a newcomer lands at the end of “Our group”.
- Dates:
  - POST requires `kind`, `date` and `recurring` (boolean). `date` is either:
    - `YYYY-MM-DD` (Feb 29 only in leap years), or
    - ★ `--MM-DD` for a recurring date kept without a year (birthday, remembrance): month and day are set and `year` becomes null. Feb 29 is always allowed. A day that doesn't exist (`--02-30`, `--13-01`, `--5-4`) is 422 "That date isn’t on the calendar."
  - ★ A full `date` must fall between 1900-01-01 and 2200-12-31, or 422 "Pick a date between 1900 and 2200." (POST and PATCH).
  - `year`, `month` and `day` always come from `date`, so a PATCH with a `--MM-DD` clears a stored year and a full date sets one. `label` is forced to null for birthdays.
  - PATCH takes any subset.
  - ★ A one-time date needs a year. Whenever the saved result would be `recurring:false` with no year, the response is 422 `errors.date` "A one-time date needs a year.", and nothing changes. The check uses the body's `recurring` and `date`, falling back to the stored ones on PATCH. It catches:
    - POST or PATCH of a `--MM-DD` with `recurring:false`;
    - PATCH of a `--MM-DD` alone on a one-time date;
    - `PATCH {recurring:false}` alone on a date stored without a year.
- Prayers:
  - ★ `member_id` may be a number or a numeric string. It is always returned as a number; booleans are rejected.
  - Body text is trimmed. PATCH ignores `answer` on active prayers.
  - `/answer` on an active prayer sets answered_at=now and logs once; `answer` defaults to null. On an answered prayer it only edits `answer`, and leaves it alone if the key is absent.
  - `/reopen` clears `answer` and `answered_at`.
  - Adding an update touches the prayer and logs. Updates come oldest first.
- Settings:
  - PATCH accepts any subset. `since_year` is an integer from 1900 to 2100. `meeting_day` is capitalised Sunday through Saturday.
  - A null tagline is stored as ''. Unknown keys (an old password_hash or password_version, `role`) are ignored. Leaders only.
- Snapshot:
  - `settings`
  - `members` in join order: created_at, then id
  - `prayers` by created_at desc, then id desc
  - `studies` by meeting_date desc, then id desc (drafts included for leaders and the super admin; published only for members)
  - `activity`: the newest 20, by created_at desc then id desc
  - `server_time`
- Demo data:
  - Member ids 1–8 follow prototype order. Rachel (1) and Mike (3) are leaders, and with Sarah (2, a member) have logins (`DemoSeeder::LOGINS`).
  - Timestamps are 19:00 UTC, and the shift is floor(days/7)*7.
  - ★ The Psalms of Ascent scripture is now exact World English Bible text.
- ★ Writes that also log activity run in one transaction, so a failed log entry leaves nothing half-saved (and a retry can't duplicate): adding a member, adding a prayer, marking one answered, adding a prayer update, and saving a study.

VALIDATION MESSAGES (★)
- Every 422 field message is plain copy the client can show under the field: no field names or paths (`sections.0.body`), no exclamation marks, curly apostrophes. E.g. "Keep it under 2,000 characters.", "Pick someone from the group.", "The group needs a name.", "Use at least 8 characters." They live in each FormRequest's `messages()` and the two inline validations (a prayer update's `body`, the `/answer` note). `tests/Feature/ValidationMessagesTest.php` pins them word for word.
- A few keep Laravel's own wording because the frontend matches on it (guarded by `test_messages_the_frontend_reads_keep_their_wording`):
  - studies: every `max` ("… greater than N characters." / "… more than N items.") and the `ref`/`title` "required when status is published", read by `friendly()` in `frontend/components/editor/draft.ts`;
  - (The group password form that read `password.min` and `password.confirmed` is gone with the group password; a person's password has plain messages of its own, see ACCESS.)
- Member `role` has “Pick member or leader.” (scoped to the `in` rule, so the leader's own “You can’t step down yourself…” isn't overridden), and `password` the ACCESS messages above.
- The top-level `message` is Laravel's (it adds "(and N more errors)"); the client shows the field messages instead.

STUDY SAVES AND CONFLICTS (★ optimistic concurrency)
- `PUT /api/studies/{id}` accepts an optional `expected_updated_at`: the `updated_at` the client loaded (from GET /api/studies/{id}, the snapshot, or its own last save's response).
- If it is present and is a different instant from the study's current `updated_at`, the response is 409 `{"message":"This study was changed somewhere else.","study": <the full current Study>}`. Nothing is saved and nothing is logged.
- Absent or null: the save overwrites, as before. This is the "keep mine" path.
- Any ISO-8601 form of the same instant matches: `2026-10-05T19:00:00.000000Z` (what the API sends), `…00.000Z` (JS `toISOString`) and `…00Z` all do. A value that isn't a date gets 422 `errors.expected_updated_at`. POST ignores the field.
- The check and the save share one transaction and hold a row lock (`SELECT … FOR UPDATE`), so two saves of the same version can't both win.
- `updated_at` is stored to the whole second (`timestamp(0)`). The value a save returns is exactly what is stored, so it can go straight into the next save. A save that changes nothing leaves `updated_at` alone. A conflicting save that lands within the same second as the version the client loaded can't be told apart; that is fine for people editing by hand.

UNLOCK THROTTLING AND CLIENT IPs (★)
- What Next does with X-Forwarded-For (measured on Next 16.4.0): the rewrite proxy (`next/dist/server/lib/router-utils/proxy-request.js`, httpxy without `xfwd`) forwards the browser's `X-Forwarded-For` verbatim and adds none of its own. It sets `X-Forwarded-Host` to the browser's Host. Two checks:
  - Through the dev proxy on :3110, using the IP Laravel stored in `sessions.ip_address`: no header gave 127.0.0.1; `XFF: 203.0.113.77` gave 203.0.113.77; `XFF: 198.51.100.9, 10.0.0.1` gave 10.0.0.1.
  - Next's own `proxyRequest` in front of an echo server received the header byte for byte, or no header at all.
- Client IP: Laravel trusts 127.0.0.1 and ::1 (where Next connects from) plus `TRUSTED_PROXIES`, and uses the rightmost untrusted `X-Forwarded-For` entry.
  - Behind a reverse proxy that appends the socket address (nginx `$proxy_add_x_forwarded_for`, Caddy's default), that entry is the real client and nothing the client sends changes it. Production must be set up this way (backend/README.md).
  - With Next exposed directly (local dev, which listens on *:3110), the client chooses the address.
- The named limiter `unlock` (AppServiceProvider) counts only wrong passwords (422). Successful unlocks, 503s and 419s cost nothing, so a whole group unlocking from one Wi-Fi network on meeting night never trips it.
  - Per client: 10 misses a minute, and 30 an hour. A client is an IPv4 address, or an IPv6 /64 (one home or server usually holds a whole /64). IPv4-mapped IPv6 counts as the IPv4 address.
  - Everyone together: 100 misses an hour.
  - While any of these applies, every attempt gets 429 with `Retry-After`, including the right password, so a 429 never says whether a guess was right. Each window starts at its first miss.
- What this buys:
  - One client can't lock anyone else out: it stops at 30 misses an hour, well under the group-wide 100.
  - Guessing from many addresses is capped at 100 guesses an hour in total. The price is that such an attack can make new unlocks wait up to an hour. Devices that are already unlocked aren't affected, because sessions last a year. So it only bites a new device, or every device after a password change.
  - With Next exposed directly, rotating `X-Forwarded-For` still can't get past 100 guesses an hour, but it can hold that group-wide ceiling. This is why production needs the front proxy.
- Verified end to end (client → Next's proxy code → Laravel on a private DB):
  - Next exposed directly: 12 misses from one XFF gave 422×10 then 429×2. The right password from that XFF got 429; from another XFF it got 200. Rotating XFF allowed 90 more misses (100 in total), then 429 for everyone, right password included.
  - Behind an appending front proxy: 12 misses with a different spoofed XFF each time gave 422×10 then 429×2. A fresh spoofed XFF with the right password still got 429. Another client got 200.

RESPONSE HEADERS (★)
- Every response from an /api route carries `Cache-Control: no-store, private` and `X-Content-Type-Options: nosniff`, including 401, 419, 429 and 503. The browser's HTTP cache never keeps the group's data after Lock. The service worker's Cache API ignores no-store, so offline reading still works.
- No CORS: `config/cors.php` has no paths. No response carries `Access-Control-*`, and a cross-origin preflight isn't approved. The app is same-origin through the Next rewrite.
- An unknown /api path (no route) is a plain 404 without these headers.

SESSIONS AND PRODUCTION (★)
- Every cookie-less request to an /api route starts a session row. `php artisan ff:prune-sessions` is scheduled daily (`routes/console.php`; production needs the `schedule:run` cron). It deletes rows idle for 24 hours or more (`--hours=` changes that) unless they are signed in with a login that still works: a person with a login whose `auth_version` the session holds, or the super admin with the current hash's fingerprint (same test as the gate, read from the stored payload). That covers visitors who never signed in, devices that locked, devices whose password changed or was removed, people who were removed, and sessions from the time of the shared group password. Signed-in sessions keep their year.
- With `APP_ENV=production`, the session and XSRF cookies are `Secure` unless `SESSION_SECURE_COOKIE=false`. Elsewhere they are Secure whenever the request arrives over https. `backend/.env.example` has a Production block, and `backend/README.md` has the deploy checklist. That checklist covers debug off, `--no-dev`, `expose_php=Off`, the XFF-appending front proxy, `BACKEND_URL`, and the scheduler.
- `SUPER_ADMIN_PASSWORD_HASH` (a bcrypt hash, never the password) comes from the environment; this deployment keeps it in the `sandbox/apps/fruitfull/env` secret (infra/README.md). A value that isn't bcrypt is logged and ignored, so a mangled one can't take sign-in down. The deploy runs `db:seed --force` every time; `DatabaseSeeder` only adds missing default settings.
