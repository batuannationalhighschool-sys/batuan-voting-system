# Batuan National High School - SSLG Voting System

This is a React/Vite voting application backed by Supabase PostgreSQL RPCs. The `server/` Express process is an optional local compatibility server and photo proxy; the deployed frontend normally calls Supabase directly.

## Requirements

- Node.js 20 or newer
- A Supabase project
- A trusted scheduler for automatic election start/end (Supabase `pg_cron` is recommended)

## Database setup

For a new Supabase project, run these files in order in the Supabase SQL Editor:

```text
server/schema.sql
server/migration-election-history.sql
server/migration-security-hardening.sql
server/migration-admin-email.sql
server/migration-admin-current-password.sql
server/migration-election-scheduler.sql
```

For an existing project that already has the base schema and RPC migration, run the migration files after `server/schema.sql` in order. The security migration must be applied after the election-history migration because it protects the reset/start path with the archive table. Apply `server/migration-admin-email.sql` and then `server/migration-admin-current-password.sql` after the security migration; they assign the configured administrator email, force a strong password change, and require the current password for changes made from Admin Settings.

The hardening migration makes the configured election window authoritative inside `app_submit_votes`. A stale `ongoing` status cannot accept a vote before the opening instant or, when automatic ending is enabled, at or after the closing instant. It also moves the custom-token signing key into Supabase Vault, creates an atomic ballot marker, removes anonymous candidate-photo uploads, and prevents an unarchived ballot from being silently deleted during a reset. The scheduler migration keeps the displayed election status synchronized every minute.

Applying it invalidates existing custom session tokens by changing the signing key; users must sign in again after the migration.

## Environment variables

Copy the safe templates and fill them locally or in your hosting provider:

```text
.env.example
server/.env.example
```

The browser may receive only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Keep `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, and all provider tokens in server/hosting secret storage. The deployment helper requires `VERCEL_TOKEN` in the process environment; it does not read tokens from `.env`.

Never commit `.env` files. Rotate any PAT, service-role key, GitHub token, or Vercel token if this workspace has been shared or copied.

## Local development

```sh
npm install
npm run dev
```

To run the optional Express compatibility server and its local candidate-photo proxy:

```sh
cd server
npm install
npm run dev
```

When using the local photo proxy, set `VITE_UPLOAD_API_URL=http://localhost:3001/api/candidate-photo` in the root environment. Production uses `/api/candidate-photo` from the Vercel Function.

## Automatic election scheduling

The vote RPC is safe even when a scheduler invocation is missed. To keep the displayed database status synchronized, configure one trusted scheduler after applying the hardening migration:

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule(
  'batuan-voting-auto-manage-elections',
  '* * * * *',
  $$SELECT public.app_auto_manage_elections()$$
);
```

Alternatively, use the included `/api/auto-manage-elections` function with `CRON_SECRET` configured behind a trusted scheduler. Vercel Hobby plans only allow daily Cron jobs, so they are not suitable for minute-level election status updates; Supabase `pg_cron` is the configured production scheduler here. Do not expose the scheduler endpoint without its secret.

## Verification

```sh
npm run build
node --check server/server.js
node --check server/middleware/auth.js
node --check api/auto-manage-elections.js
node --check api/candidate-photo.js
```
