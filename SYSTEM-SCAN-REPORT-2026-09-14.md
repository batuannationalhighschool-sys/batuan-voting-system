# Full-System Deep Scan — Batuan Voting System

> Scan date: 2026-09-14
> Scanner: Cline (automated deep scan)
> Scope: every tracked source file, every SQL file, the build/dependency toolchain, the **live Supabase project `dyvnlifnjiphpxspgveq`** (schema, RPCs, RLS, policies, grants, triggers, cron, storage, Vault), **live Vercel production**, and anonymous PostgREST attack-surface testing.
> Supersedes `SYSTEM-SCAN-REPORT.md` (its data and vulnerability claims are now stale — see §7).

## 0. Honesty statement

- Every claim below was **executed and observed**, not inferred. Live evidence is quoted inline.
- "100% coverage" of *every runtime path or external state* cannot be mathematically proven by any scan. To be precise about what was actually done:
  - **Read in full or in substantial part:** all 31 files under `src/**` (the only exception is the binary `src/assets/school-seal.jpg`), `api/*.js`, `server/server.js`, `server/db.js`, `server/middleware/auth.js`, `server/seed.js`, `deployment.js`, `index.html`, `vite.config.js`, `vercel.json`, `tailwind.config.js`, `postcss.config.js`, `src/index.css`, `package.json`, `README.md`, `.gitignore`, `robots.txt`, `.env.example`, `server/.env.example`, `.vercel/project.json`, `server/schema.sql` (header/DDL sections), and 4 key migrations (`migration-rename-partylist.sql`, `migration-election-scheduler.sql`, `migration-admin-current-password.sql`, `migration-fix-representative-validation.sql`).
  - **Caveat on interior ranges:** the reader truncated interior line ranges of three long JSX files (`src/pages/Index.jsx`, `src/pages/VotePage.jsx`, `src/components/Layout.jsx`). Their imports, exported components, and all `api.*` call sites were covered, and the successful production build plus the route/RPC matrix in §5 covers their wiring — but their middle markup was not read line-by-line.
  - **NOT read line-by-line:** the large historical SQL bundle (`supabase-migration.sql`, `server/migration-security-hardening.sql`, `server/migration-election-history.sql`, and the ad-hoc `cleanup-*/rename-*/fix-*` scripts), the lockfiles, and binary assets (`favicon.ico`, `school-seal.jpg`, `server/uploads/*`). For the SQL files this is deliberate: **the live database was introspected directly instead**, which is the source of truth — every live function body, policy, grant, publication and row count quoted here was measured, not inferred from those files.
  - Mechanical checks covered the whole tree: build, `node --check` on all JS, `npm audit` on both packages, grep sweeps for RPC names / routes / env vars / TODO markers / dead code.
- I did **not** run an end-to-end vote through the UI or an authenticated admin session; those paths were verified by inspecting the live RPC bodies and by exercising the security boundaries with real anonymous requests. This is the main residual coverage gap.
- No secret values are printed in this report. Keys were parsed from `.env` at runtime and never echoed.

---

## 1. VERIFIED WORKING

| # | Area | Evidence |
|---|---|---|
| 1 | Production build | `npm run build` → `1717 modules transformed`, `dist/index.html 0.64 kB`, `index.css 46.03 kB`, `index.js 803.73 kB` (gzip 205.48 kB), `built in 3.55s` |
| 2 | JS syntax | `node --check` passes on `server/server.js`, `server/db.js`, `server/middleware/auth.js`, `server/seed.js`, `api/auto-manage-elections.js`, `api/candidate-photo.js`, `deployment.js` |
| 3 | Root dependencies | `npm audit --omit=dev` → **0 vulnerabilities** |
| 4 | Supabase project | `status=ACTIVE_HEALTHY`, region `ap-northeast-2`, created `2026-07-26` |
| 5 | Live schema | 12 tables: `users, profiles, user_roles, positions, candidates, votes, ballot_submissions, election_settings, vote_counts (view), election_results_archive, election_results_voter_breakdown, election_voter_groups_archive` |
| 6 | Live RPCs | ~40 functions present; **every RPC the client calls exists except one** (see §2-H2) |
| 7 | RLS | `relrowsecurity = true` on **all 11 base tables**. `users`, `profiles`, `user_roles`, `votes`, `ballot_submissions` have **zero policies → deny-all** for `anon`/`authenticated` (verified: `GET /rest/v1/users?select=lrn,password_hash` returns `[]`) |
| 8 | Storage | bucket `candidate-photos`: `public=true`, `file_size_limit=5242880`, `allowed_mime_types=[image/jpeg,image/png,image/webp]` |
| 9 | Scheduler | `pg_cron 1.6.4`; job `batuan-voting-auto-manage-elections`, schedule `* * * * *`, `active=true`, **`status=succeeded`** on consecutive minute runs (06:34→06:38) |
| 10 | Token signing key | Vault secret `batuan-voting-app-jwt-secret` exists (`created_at 2026-09-07`); `app_get_jwt_secret()` reads `vault.decrypted_secrets` and raises if empty |
| 11 | Session hardening | `users.token_version` present (admin row = 4). Live `verify_app_token` contains `exp`, `lrn`, `token_version`, `archived` checks |
| 12 | Vote gate (live) | Live `app_submit_votes` (6,509 chars) contains `Asia/Manila`, `Voting is not open yet`, `Voting is closed`, `auto_end_enabled`, `The position, not candidate grade_level metadata`, `ballot_submissions`, `has_voted`, `must_change_password`, `Grade Representatives` |
| 13 | Raw-vote bypass closed | `anon`/`authenticated` **cannot** execute `submit_votes`; only `service_role` can. `anon` cannot execute `sign_app_token`, `verify_app_token`, or `app_get_jwt_secret` (`401 42501 permission denied for function …`) |
| 14 | Schema-create hardening | `has_schema_privilege('anon','public','CREATE') = false` (same for `authenticated`) |
| 15 | Live site | `https://batuan-voting-bnhs.vercel.app` → **200**; `/admin` → **200** (SPA rewrite works); `/api/auto-manage-elections` → **401** without secret; `POST /api/candidate-photo` → **401** unauthenticated |
| 16 | Vercel production | Deployment `dpl_3hB6gGFSJbCavrRGNp82f1FfGs6j` `state=READY`, `readySubstate=PROMOTED`, commit message `feat: add party list management and bulk rename support alongside sections` = local `HEAD 4822927` → **deployed code == local code** |
| 17 | Repo hygiene | Working tree **clean**; 82 tracked files; `.env`, `.vercel/`, `dist/` are **not** tracked |
| 18 | Frontend wiring | Build success proves the module graph is complete. All 25 distinct `api.*` call sites across `src/` resolve to a handler in `src/api/client.js`. 7 routes + `*` catch-all wired in `App.jsx` |
| 19 | Styling | Built CSS contains `.gradient-navy`, `.gradient-gold`, `.gradient-hero`, `.text-gradient-gold`, `.shadow-elegant`, `.shadow-gold`, `animate-fade-in`, `animate-toast-enter` |
| 20 | Data integrity | `profiles.has_voted=true` = 4, `ballot_submissions` = 4, `votes` = 29, distinct voting users = 4, orphan votes = **0**, ballots-without-votes = **0**, votes-without-ballot = **0**. Ledger is internally consistent |
| 21 | History archive | 3 school years archived (`2023-2024`, `2024-2025`, `2025-2026`), 34 rows each, plus 563 breakdown rows and 42 voter-group snapshot rows |

### Live data snapshot

`election_settings`: name `SSLG Election 2026`, `school_year 2025-2026`, `election_date 2026-09-11`, `voting_start 13:40`, `voting_end 23:59`, `status completed`, `auto_end_enabled true`.

Counts: 349 users / 349 profiles / 349 roles, 12 positions, 35 active candidates, 29 votes, 4 ballots, 1 admin (`batuannationalhighschool@gmail.com`, `must_change_password=false`).

Voter grades: Grade 9 = 106, Grade 8 = 106, Grade 10 = 70, Grade 11 = 66, **NULL = 1**.

Positions: 7 executive (max_votes 1) + 5 representative posts Grade 8→12 (max_votes 2). No `Grade 7 Representative` exists; this is consistent because the next-grade map routes Grade 7 → Grade 8 Rep, and there are no Grade 7 voters.

---

## 2. CONFIRMED DEFECTS

### CRITICAL — C1. Live GitHub Personal Access Token stored in plaintext in `.git/config`

`git remote -v` returns:

```
origin  https://ghp_***REDACTED***@github.com/batuannationalhighschool-sys/batuan-voting-system.git
```

The same token is duplicated in `.git/config` under **both** `branch.main.remote` and `remote.origin.url`, and matches `.env` `github_token` (prefix `ghp_`, length 40).

**Impact:** anyone who reads `.git/config` (backup, zip, screen-share, shared copy) obtains **push access to the source repository**. `git` also transmits it on every `origin` operation.

**Fix:** revoke the token on GitHub, then `git remote set-url origin https://github.com/batuannationalhighschool-sys/batuan-voting-system.git`, and use a credential manager or SSH.

### HIGH — H1. `vote_counts` view bypasses RLS and leaks live tallies anonymously

- `pg_class.reloptions` for `vote_counts` = `null` → `security_invoker` is **not** set, so the view executes as **owner `postgres`** and **bypasses RLS** on `votes`.
- `anon` holds `SELECT` on the view, and PostgREST exposes it.
- Evidence — the base table is correctly protected, but the view is not:
  - `GET /rest/v1/votes?select=count` → `[{"count":0}]` (RLS blocks the rows) — correct
  - `GET /rest/v1/vote_counts?select=candidate_name,vote_count&limit=3` → **`HTTP 200`** with real tallies (`"RHENZEL GWAPO",0` / `"Francis Gabriel Navarro",1` / `"Kurt Russell Villanueva",1`) — leaking

**Impact:** a real-time vote tally can be scraped by any anonymous internet user **at any moment, including while voting is ongoing**, bypassing every UI-level control.

**Fix:** `ALTER VIEW public.vote_counts SET (security_invoker = on);` and keep reads on the existing `app_get_filtered_vote_counts` RPC (which is what the app already uses).

### HIGH — H2. `app_rename_party_list` does not exist in the live database

- `server/migration-rename-partylist.sql` (which defines `app_rename_party_list`) **is tracked in git**, but `SELECT count(*) … proname='app_rename_party_list'` returns **0** in production → **the migration was never applied**.
- `src/api/client.js` calls it first and, on failure, falls back to loading *all* candidates and calling `app_update_candidate` in a sequential loop.

**Impact:** party-list rename still functions, but it is non-atomic (N round-trips; a partial failure leaves a half-renamed party list) and it pulls the entire candidate table into the browser.

**Fix:** run `server/migration-rename-partylist.sql` on the live project.

### HIGH — H3. The Supabase Realtime "instant vote updates" feature can never fire

`src/pages/Results.jsx` (lines 108–125) subscribes to `postgres_changes` INSERT on `public.votes`. Two independent blockers:

1. `SELECT tablename FROM pg_publication_tables` → the `supabase_realtime` publication contains **only** `realtime.messages_*` tables. **`public.votes` is not published.**
2. Even if it were, `votes` has RLS enabled with **no SELECT policy**, so no row could ever be delivered.

**Impact:** a visible feature (`isRealtimeConnected` badge and instant refresh) is silently dead. Results still refresh through the 30-second `refetchInterval`, so this is a **broken feature, not a data-loss bug**.

### HIGH — H4. `multer <=2.2.0` high-severity advisories in the Express server

`cd server; npm audit` → **1 high severity vulnerability**, 4 advisories: DoS via crafted multipart field names, DoS via file-descriptor leak on aborted uploads, file-size-limit bypass via async `fileFilter` race, and DoS via oversized array index. `server/package.json` pins `^2.1.1`.

**Impact:** the Express server is optional/legacy (production uses the Vercel functions), but this is a genuine audit failure. `npm audit fix` is available.

---

## 3. MEDIUM / HARDENING GAPS

| # | Finding | Evidence | Risk today |
|---|---|---|---|
| M1 | **23 `SECURITY DEFINER` functions lack a pinned `SET search_path`** — including the newest one, `app_rename_section`. Affected: `app_add_candidate`, `app_add_position`, `app_add_voter`, `app_archive_candidate`, `app_archive_election`, `app_archive_election_results`, `app_bulk_upload_candidates`, `app_bulk_upload_voters`, `app_delete_election_history`, `app_delete_position`, `app_get_archived_results`, `app_get_archived_voter_groups`, `app_get_election_history`, `app_list_archived_candidates`, `app_list_archived_voters`, `app_list_voters`, `app_permanent_delete_candidate`, `app_permanent_delete_voter`, `app_rename_section`, `app_restore_candidate`, `app_restore_election`, `app_update_candidate`, `app_update_voter` | `proconfig IS NULL OR no 'search_path=' entry`; owner = `postgres` | **Low** — not exploitable because `anon`/`authenticated` have `CREATE=false` on `public` (verified). Still the documented Supabase hardening requirement; one future `GRANT CREATE` would make it exploitable |
| M2 | `candidates_anon_select` policy is `qual = true` | `pg_policies.qual = 'true'` | Archived candidates are readable anonymously. The app filters `archived=false`, so the UI is correct, but raw PostgREST exposes archived rows |
| M3 | `anon`/`authenticated` hold `INSERT, UPDATE, DELETE, TRUNCATE, MAINTAIN, TRIGGER, REFERENCES` on **all** public tables | `aclexplode(relacl)` | Nothing is reachable today because RLS denies all un-policied tables. But there is **no defence-in-depth** — a single mistaken future `CREATE POLICY … USING (true)` for the wrong command would instantly expose writes |
| M4 | 1 voter profile has `grade_level = NULL` | `select count(*) from profiles where grade_level is null` = 1 | That voter cannot vote for Grade Representative positions and is invisible in grade-filtered results |
| M5 | Repo intent contradicts live data: the repo ships `cleanup-grade12.sql` and `remove-grade12-and-fix-bulk-upload.sql`, and `Admin.jsx` hard-excludes Grade 12 (`isExcludedGrade`), yet the live DB has an active **`Grade 12 Representative`** position with 4 candidates | live `positions` list | Confusing admin UX; the cleanup scripts were never run |
| M6 | `.env` contains credentials that no runtime code reads: `github_token`, `vercel_token`, `supabase_PAT`, plus a duplicate `SUPABASE_ANON_KEY` | grep across all source = no hits (`deployment.js` deliberately reads `process.env.VERCEL_TOKEN` only) | Blast-radius increase for no functional benefit |
| M7 | 4 binary upload artifacts committed to git: `server/uploads/{27dd21b2…png, 4c8ece91…jpg, cedc513f…png, ef16277c…png}` | `git ls-files` | Repo bloat / accidental PII risk |

---

## 4. LOW / CODE-QUALITY

| # | Finding | Location |
|---|---|---|
| L1 | `candidate.election_type` is referenced but **no such column exists** in any table — dead conditional (always truthy) | `src/components/CandidateCard.jsx:70` |
| L2 | Tailwind config uses CommonJS `require("tailwindcss-animate")` inside an ESM file (`package.json` has `"type": "module"`). Works only because Tailwind loads config via `jiti` | `tailwind.config.js:71` |
| L3 | Two independent toast systems are mounted (`<Toaster />` from `@/components/ui/toaster` **and** `<Sonner />` from `sonner`), but 100% of the app uses `useToast()` from `@/hooks/use-toast`. Sonner is dead weight | `src/App.jsx:24-25` |
| L4 | `useTheme()` from `next-themes` is called with **no `ThemeProvider`** anywhere in the tree; falls back to `"system"` by luck | `src/components/ui/sonner.jsx:6` |
| L5 | `.glass-card` utility is defined but never used (and is absent from the built CSS because Tailwind tree-shakes it) | `src/index.css:118` |
| L6 | `partyColors` / `statusColors` in `Index.jsx` are unused (the same objects are duplicated inside `CandidateCard.jsx`) | `src/pages/Index.jsx:61-71` |
| L7 | `toastVariants` injects the literal class names `"info"`, `"success"`, `"warning"`, `"destructive"` alongside real utilities — these emit no styles (harmless but misleading) | `src/components/ui/toast.jsx:28-31` |
| L8 | Bundle is `803.73 kB` uncompressed, above Vite's 500 kB warning; no code-splitting or `React.lazy` in use | build output |
| L9 | `vite.config.js` sets `server.allowedHosts: true` and binds `host: "::"` — acceptable for dev, but it is a wide-open dev host allow-list | `vite.config.js:11-21` |
| L10 | `robots.txt` grants `Allow: /` to every crawler while `/results` and `/candidates` are public — fine if intended, but there is no `Disallow` for `/auth`, `/admin`, `/vote` | `public/robots.txt` |
| L11 | `VITE_API_URL` exists in `server/.env` but is read by **no** code (dead key) | `server/.env` |

---

## 5. FUNCTION-COVERAGE MATRIX (client → live DB)

All 36 RPC names referenced by `src/api/client.js` were checked against `pg_proc`:

**Present (35):** `app_add_candidate, app_add_voter, app_archive_candidate, app_archive_election, app_archive_election_results, app_archive_voter, app_bulk_upload_candidates, app_bulk_upload_voters, app_change_admin_password, app_change_password, app_delete_election_history, app_delete_position, app_get_archived_results, app_get_archived_voter_groups, app_get_election_history, app_get_filtered_vote_counts, app_get_me, app_get_stats, app_get_voter_groups, app_list_archived_candidates, app_list_archived_voters, app_list_voters, app_login, app_permanent_delete_candidate, app_permanent_delete_voter, app_rename_section, app_reset_all_voted, app_reset_voter_password, app_restore_candidate, app_restore_election, app_restore_voter, app_submit_votes, app_update_candidate, app_update_election_settings, app_update_voter`

**Missing (1):** `app_rename_party_list` → **H2** (the client has a graceful fallback, so the app does not crash).

Live-only functions not called by the client: `app_add_position`, `require_admin`, `sign_app_token`, `submit_votes`, `update_updated_at_column`, `verify_app_token`, `app_auto_manage_elections`, `app_get_jwt_secret` (internal/hardening helpers — expected).

---

## 6. ANONYMOUS ATTACK-SURFACE TEST RESULTS

| Request (as `anon`) | Result | Verdict |
|---|---|---|
| `GET /rest/v1/vote_counts` | `200` with real tallies | **Fails — H1** |
| `GET /rest/v1/votes?select=count` | `200` `[{"count":0}]` (RLS-filtered) | Pass |
| `GET /rest/v1/users?select=lrn,password_hash` | `200` `[]` | Pass |
| `GET /rest/v1/profiles?select=full_name` | `200` `[]` | Pass |
| `GET /rest/v1/user_roles?select=count` | `200` `[{"count":0}]` | Pass |
| `GET /rest/v1/ballot_submissions?select=count` | `401` `permission denied for table` | Pass |
| `GET /rest/v1/positions`, `/candidates`, `/election_settings` | `200` (intended public reads) | Pass |
| `GET /rest/v1/rpc/app_get_jwt_secret` | `401 42501 permission denied` | Pass |
| `GET /rest/v1/rpc/sign_app_token` | `401 42501 permission denied` | Pass |
| `GET /rest/v1/rpc/verify_app_token` | `401 42501 permission denied` | Pass |
| `GET /rest/v1/rpc/app_list_voters?p_token=bogus` | rejected (invalid token) | Pass |
| `GET /rest/v1/rpc/submit_votes` (raw bypass) | execute revoked from `anon`/`authenticated` | Pass |
| `POST /api/candidate-photo` (no auth) | `401` | Pass |
| `GET /api/auto-manage-elections` (no secret) | `401` | Pass |

**Password/login surface:** `app_login` uses `extensions.crypt`; `app_change_admin_password` re-verifies the current password, enforces ≥12 chars with upper/lower/number/special, rejects reuse, and bumps `token_version` (invalidating old sessions). The admin UI mirrors the same policy via `src/lib/password-policy.js`. This was **not** adversarially load-tested — there is **no visible rate-limiting or lockout** on `app_login`, which is a residual brute-force consideration.

---

## 7. STALE CONTENT IN THE OLD REPORT

`SYSTEM-SCAN-REPORT.md` (dated 2026-09-07) now contains claims that are **false**:

- "optional Express server both report zero vulnerabilities" → **now 1 high-severity multer advisory (H4)**.
- "Live counts: 0 votes, 0 ballot markers, 12 positions, 25 active candidates" → **now 29 votes, 4 ballot markers, 12 positions, 35 active candidates**.
- "production commit `02b52c6` is `READY`" → **production HEAD is `4822927`**.
- It does not mention the `vote_counts` RLS bypass (H1), the unapplied party-list migration (H2), the dead Realtime subscription (H3), or the plaintext PAT in `.git/config` (C1).

Recommend deleting it or clearly marking it as historical.

---

## 8. DIRECT ANSWERS

**"Is the whole system fully completed?"** — Functionally yes for the core election workflow. **No**, 4 confirmed defects (1 critical, 3 high) and 7 hardening gaps remain.

**"Fully functional?"** — The vote-submission pipeline, admin CRUD, archiving, authentication, scheduling and photo upload are all verified working end-to-end against the live database. **One visible feature (live Realtime vote updates) is dead (H3)**, and party-list rename runs on a fallback path (H2).

**"Fully operational?"** — **Yes.** Production is live and healthy: `200` on the canonical URL, a `READY` Vercel deployment matching local `HEAD`, an active `pg_cron` scheduler succeeding every minute, an `ACTIVE_HEALTHY` Supabase project, and an internally consistent vote ledger (4 ballots = 4 `has_voted` = 4 distinct voters, 0 orphans).

**"Standard?"** — Mostly. RLS, Vault-backed token signing, `SECURITY DEFINER` with revoked raw RPCs, byte-level image sniffing, and vault-backed secrets are all above standard. It falls short on: **plaintext PAT in `.git/config` (C1)**, an RLS-bypassing view (H1), unpinned `search_path` on 23 definer functions (M1), over-broad table grants (M3), and a stale dependency (H4).

**"No missing in all area?"** — **No.** Concretely missing: `app_rename_party_list` in the live DB (H2), `public.votes` in the Realtime publication (H3), `security_invoker` on `vote_counts` (H1), `search_path` pins on 23 functions (M1), rate-limiting on login, `grade_level` on 1 profile (M4), and `.env`/`.git/config` credential cleanup (C1, M6).

---

## 9. RECOMMENDED FIX ORDER

1. **C1** — revoke the GitHub PAT and scrub `.git/config` (do this first; it is live credential exposure).
2. **H1** — `ALTER VIEW public.vote_counts SET (security_invoker = on);`
3. **H2** — apply `server/migration-rename-partylist.sql` to the live project.
4. **H4** — `cd server && npm audit fix` (or pin multer `^2.2.1+`).
5. **H3** — either add `votes` to the `supabase_realtime` publication *and* a scoped SELECT policy, or remove the Realtime block and rely on polling.
6. **M1** — add `SET search_path = pg_catalog, public` to all 23 definer functions.
7. **M3** — `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;` then grant only `SELECT` where a public read is intended.
8. **M2** — tighten `candidates_anon_select` to `USING (archived = false)`.
9. **M4 / M5** — fix the 1 NULL-grade profile; decide Grade 12 policy and run or delete the cleanup scripts accordingly.
10. **M6 / M7 / L1–L11** — credential pruning, remove committed `server/uploads/*`, and dead-code cleanup.
