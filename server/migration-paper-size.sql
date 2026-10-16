-- ====================================================================
-- Migration: Add paper_size column to election_settings
-- Allows Admin to select Short Bond Paper (Letter: 8.5" x 11")
-- or Long Bond Paper (Folio: 8.5" x 13") for printing official results.
-- ====================================================================

ALTER TABLE public.election_settings
ADD COLUMN IF NOT EXISTS paper_size VARCHAR(20) DEFAULT 'short';

-- Update app_update_election_settings RPC to support paper_size
CREATE OR REPLACE FUNCTION public.app_update_election_settings(p_token TEXT, p_id TEXT, p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_current RECORD;
  v_new_status TEXT;
  v_new_date DATE;
  v_new_start TIME;
  v_new_end TIME;
  v_has_ballots BOOLEAN;
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' THEN RAISE EXCEPTION 'Invalid election settings'; END IF;

  SELECT * INTO v_current FROM public.election_settings WHERE id = p_id::UUID FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election settings not found'; END IF;

  v_new_status := COALESCE(NULLIF(p_data->>'status', ''), v_current.status);
  v_new_date := COALESCE(NULLIF(p_data->>'election_date', '')::DATE, v_current.election_date);
  v_new_start := COALESCE(NULLIF(p_data->>'voting_start', '')::TIME, v_current.voting_start);
  v_new_end := COALESCE(NULLIF(p_data->>'voting_end', '')::TIME, v_current.voting_end);
  IF v_new_end <= v_new_start THEN RAISE EXCEPTION 'The ending time must be later than the opening time'; END IF;

  v_has_ballots := EXISTS (SELECT 1 FROM public.votes)
    OR EXISTS (SELECT 1 FROM public.ballot_submissions);

  IF v_new_status = 'ongoing' AND v_current.status <> 'ongoing' AND v_has_ballots THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.election_results_archive
      WHERE school_year = v_current.school_year
    ) THEN
      RAISE EXCEPTION 'Archive the current election results before starting a new election';
    END IF;

    UPDATE public.profiles SET has_voted = false WHERE user_id IS NOT NULL;
    DELETE FROM public.ballot_submissions;
    DELETE FROM public.votes;
  END IF;

  UPDATE public.election_settings
  SET status = v_new_status,
      name = COALESCE(NULLIF(p_data->>'name', ''), name),
      school_year = COALESCE(NULLIF(p_data->>'school_year', ''), school_year),
      election_date = v_new_date,
      voting_start = v_new_start,
      voting_end = v_new_end,
      school_name = CASE WHEN p_data ? 'school_name' THEN p_data->>'school_name' ELSE school_name END,
      auto_end_enabled = CASE WHEN p_data ? 'auto_end_enabled' THEN (p_data->>'auto_end_enabled')::BOOLEAN ELSE auto_end_enabled END,
      paper_size = CASE WHEN p_data ? 'paper_size' THEN p_data->>'paper_size' ELSE COALESCE(paper_size, 'short') END
  WHERE id = v_current.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_update_election_settings(TEXT, TEXT, JSONB) TO anon, authenticated;
