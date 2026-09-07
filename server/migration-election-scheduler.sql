-- ============================================================================
-- BATUAN VOTING - SUPABASE ELECTION SCHEDULER
--
-- Apply after migration-security-hardening.sql. Supabase may require pg_cron to
-- be enabled first from Database > Extensions / Integrations > Cron.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cron.job
    WHERE jobname = 'batuan-voting-auto-manage-elections'
  ) THEN
    PERFORM cron.schedule(
      'batuan-voting-auto-manage-elections',
      '* * * * *',
      'SELECT public.app_auto_manage_elections()'
    );
  END IF;
END;
$$;
