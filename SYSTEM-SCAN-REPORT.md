# Full-System Deep Scan Report — Batuan Voting System

> Scan date: 2026-09-07
> Scope: local source/configuration, dependency tree, SQL migrations, live Supabase schema/RPCs/storage/public REST, Vercel project metadata, and production-readiness checks.

## Coverage and honesty

No automated scan can prove literal 100% coverage of every runtime path or external state. This report labels each result as observed, structurally verified, or still pending; no secret values are included.

## Verified locally

| Area | Result |
|---|---|
| Production build | `npm run build` passes with Vite 8.2.2; 1,716 modules transformed. |
| JavaScript syntax | Server, middleware, API functions, and deployment helper pass `node --check`. |
| Dependency audit | Root app and optional Express server both report zero vulnerabilities. |
| Election-time logic | Asia/Manila conversion and before/start/end boundary tests pass. |
| Security migration structure | Transaction, dollar quoting, Vault, token versioning, atomic ballot marker, time-window checks, and raw-submit revoke checks pass. |
| Candidate photos | Both upload paths enforce 5 MB, JPEG/PNG/WebP only, file-byte detection, matching content type, and bounded errors. |
| Secret-safety scan | No high-confidence secret values were found in tracked source; `.env` remains ignored and was never printed. |

## Live Supabase verification

| Area | Result |
|---|---|
| Original issue #1 | Confirmed true before the fix: live `app_submit_votes` lacked independent start/end checks and no scheduler existed. |
| Hardening migration | Applied successfully as one transaction. The signing secret is in Supabase Vault; `users.token_version` is present for 191 users. |
| Authoritative voting gate | Live `app_submit_votes` now includes the Manila-time window, status gate, automatic-end gate, candidate/position/grade validation, and atomic ballot marker. |
| Scheduler | `pg_cron` is enabled; job `batuan-voting-auto-manage-elections` runs every minute and has a successful recorded run. |
| Current election state | `status=completed`, date `2026-09-04`, automatic ending enabled. Live counts: 0 votes, 0 ballot markers, 12 positions, 25 active candidates. |
| Authentication | Live token verification uses the Vault-backed signing key, expiry, LRN binding, token version, and archived-profile checks. |
| Raw vote bypass | Anonymous/authenticated roles cannot execute `submit_votes` directly; they can execute only the validated `app_submit_votes`. |
| Storage | `candidate-photos` is public-read, limited to 5 MB and JPEG/PNG/WebP; anonymous upload policy is absent. |
| Public REST | Settings, positions, candidates, and the anonymous votes query returned the expected secured responses. |
| Data cleanup | One pre-existing marker with no vote row and `has_voted=false` was removed under exact guards; no vote rows were deleted. |

## Production hosting status

Vercel is linked to the GitHub repository and production branch `main`. Production commit `02b52c6` is `READY`. The canonical live URL `https://batuan-voting-bnhs.vercel.app` returns HTTP 200 with the new bundle; its scheduler returns 401 without the secret and 200 with the configured secret. The candidate-photo API also rejects unauthenticated requests with 401. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` are configured for production only.

The Vercel Hobby plan is not used for minute-level Cron; Supabase `pg_cron` is the active production scheduler. The additional `batuan-voting.vercel.app` and `batuan-voting-bnhs2.vercel.app` hostnames are Vercel redirects to the canonical URL, so authenticated API callers should use the canonical hostname after redirects are followed.

## Remaining risks or limitations

1. The original voting-window gap is fixed in Supabase and covered by the active scheduler. The vote RPC remains safe if a scheduler invocation is missed because it checks the time window itself.
2. `.env` contains sensitive provider credentials by design. They were not exposed or committed, but should be rotated if this machine or repository copy was shared.
3. Legacy Vercel aliases redirect to the canonical hostname; this is expected routing behavior, not a database or application failure.
4. Older bootstrap SQL files remain alongside the canonical ordered migrations; use `server/schema.sql`, `server/migration-election-history.sql`, `server/migration-security-hardening.sql`, and `server/migration-election-scheduler.sql` in that order for a fresh setup.
5. The production JavaScript bundle remains above Vite’s 500 kB warning threshold; this is a performance improvement, not a correctness failure.

## Bottom line

The previously reported active issue #1 was real and is now implemented and verified live. The Supabase election and security core and the canonical production frontend/API are operational. Literal 100% coverage cannot be mathematically claimed, but all listed findings were rechecked and no known required implementation remains pending.
