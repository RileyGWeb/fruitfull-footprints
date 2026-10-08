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
   - 200 `{unlocked:true}`. The session id and token are regenerated; the session stores ff_unlocked=true and ff_pw_version.
   - 422 `{"message":"Try that once more.","errors":{"password":["Try that once more."]}}`.
   - ★ 429 `{"message":"Too Many Attempts."}` with `Retry-After` once the `unlock` limiter trips. Only wrong passwords count. See UNLOCK THROTTLING below.
   - 503 `{message}` when no password is configured.
4. Gated routes return 401 `{"message":"Locked"}` unless the session is unlocked and its ff_pw_version equals the current version. The 401 comes before any 404.
5. `POST /api/lock` returns 204. It invalidates the session and rotates the token.
6. `PUT /api/settings/password {current_password, password, password_confirmation}` returns 204. The version is bumped, this session stays unlocked, and other sessions get 401. Errors:
   - 422 `errors.current_password` ("That isn’t the current password.")
   - 422 `errors.password` (minimum 6 characters, must be confirmed)

ROUTES (all under /api; ids must be numeric, `[0-9]{1,18}`, anything else is 404)
Public:
- GET /api/group → GroupInfo
- POST /api/unlock
- POST /api/lock → 204

Gated:
- GET /api/snapshot → Snapshot
- PATCH /api/settings → Settings
- PUT /api/settings/password → 204
- POST /api/members → 201 Member
- PATCH /api/members/{id} → Member
- DELETE /api/members/{id} → 204
- POST /api/members/{id}/dates → 201 MemberDate
- PATCH /api/dates/{id} → MemberDate
- DELETE /api/dates/{id} → 204
- POST /api/prayers → 201 Prayer
- PATCH /api/prayers/{id} → Prayer
- DELETE /api/prayers/{id} → 204
- POST /api/prayers/{id}/answer → Prayer
- POST /api/prayers/{id}/reopen → Prayer
- POST /api/prayers/{id}/updates → 201 PrayerUpdate
- DELETE /api/prayer-updates/{id} → 204
- GET /api/studies/{id} → Study
- POST /api/studies → 201 Study
- PUT /api/studies/{id} → Study · ★ 409 `{message, study}` (see STUDY SAVES AND CONFLICTS)
- DELETE /api/studies/{id} → 204

Errors: 422 `{message, errors:{field:[msg]}}`, 401, 404 `{message}`, 405, ★ 409, 419, 429, 503.

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
  - A null tagline is stored as ''. Unknown keys (password_hash, password_version) are ignored.
- Snapshot:
  - `settings`
  - `members` in join order: created_at, then id
  - `prayers` by created_at desc, then id desc
  - `studies` by meeting_date desc, then id desc (drafts included)
  - `activity`: the newest 20, by created_at desc then id desc
  - `server_time`
- Demo data:
  - Member ids 1–8 follow prototype order.
  - Timestamps are 19:00 UTC, and the shift is floor(days/7)*7.
  - ★ The Psalms of Ascent scripture is now exact World English Bible text.
- ★ Writes that also log activity run in one transaction, so a failed log entry leaves nothing half-saved (and a retry can't duplicate): adding a member, adding a prayer, marking one answered, adding a prayer update, and saving a study.

VALIDATION MESSAGES (★)
- Every 422 field message is plain copy the client can show under the field: no field names or paths (`sections.0.body`), no exclamation marks, curly apostrophes. E.g. "Keep it under 2,000 characters.", "Pick someone from the group.", "The group needs a name.", "Choose a new password." They live in each FormRequest's `messages()` and the two inline validations (a prayer update's `body`, the `/answer` note). `tests/Feature/ValidationMessagesTest.php` pins them word for word.
- A few keep Laravel's own wording because the frontend matches on it (guarded by `test_messages_the_frontend_reads_keep_their_wording`):
  - studies: every `max` ("… greater than N characters." / "… more than N items.") and the `ref`/`title` "required when status is published", read by `friendly()` in `frontend/components/editor/draft.ts`;
  - `password.min` and `password.confirmed`, read by `passwordServerErrors()` in `frontend/components/settings/form.ts` (by "least"/"min" and "confirm", so no other password message may use those words).
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
- Every cookie-less request to an /api route starts a session row. `php artisan ff:prune-sessions` is scheduled daily (`routes/console.php`; production needs the `schedule:run` cron). It deletes rows idle for 24 hours or more (`--hours=` changes that) unless they are unlocked with the current password version. That covers visitors who never unlocked, devices that locked, and devices still on an old password. Unlocked sessions keep their year.
- With `APP_ENV=production`, the session and XSRF cookies are `Secure` unless `SESSION_SECURE_COOKIE=false`. Elsewhere they are Secure whenever the request arrives over https. `backend/.env.example` has a Production block, and `backend/README.md` has the deploy checklist. That checklist covers debug off, `--no-dev`, `expose_php=Off`, the XFF-appending front proxy, `BACKEND_URL`, and the scheduler.
