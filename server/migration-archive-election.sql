-- Migration: Add archived status and archive/restore functions for past elections

ALTER TABLE election_results_archive
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION app_get_election_history()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT school_year, election_name, election_date,
        MAX(archived_at) AS archived_at,
        BOOL_OR(voter_filter_available) AS voter_filter_available,
        COALESCE(BOOL_OR(archived), false) AS archived
      FROM election_results_archive
      GROUP BY school_year, election_name, election_date
      ORDER BY election_date DESC
    ) r
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION app_get_election_history TO anon, authenticated;

CREATE OR REPLACE FUNCTION app_archive_election(p_token TEXT, p_school_year TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE election_results_archive
  SET archived = true, archived_at = now()
  WHERE school_year = p_school_year;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app_archive_election TO anon, authenticated;

CREATE OR REPLACE FUNCTION app_restore_election(p_token TEXT, p_school_year TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE election_results_archive
  SET archived = false
  WHERE school_year = p_school_year;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION app_restore_election TO anon, authenticated;
