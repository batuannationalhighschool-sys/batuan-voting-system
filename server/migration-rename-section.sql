-- --- Rename Section RPC --------------------------------------------------------
-- Renames a section across all profiles (voters) and candidates of a given grade level.
-- Called by PATCH /sections/rename from the admin panel.
-- -------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_rename_section(
  p_token       TEXT,
  p_grade_level TEXT,
  p_old_section TEXT,
  p_new_section TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id    UUID;
  v_voter_count INT;
  v_cand_count  INT;
  v_new_sec     TEXT;
BEGIN
  -- Auth: reuse the same require_admin helper all other RPCs use
  v_admin_id := public.require_admin(p_token);

  -- Validate inputs
  v_new_sec := UPPER(TRIM(p_new_section));

  IF v_new_sec = '' THEN
    RAISE EXCEPTION 'New section name cannot be empty';
  END IF;

  IF v_new_sec = UPPER(TRIM(p_old_section)) THEN
    RAISE EXCEPTION 'New section name is the same as the old name';
  END IF;

  -- Update profiles (voters)
  UPDATE public.profiles
  SET section = v_new_sec
  WHERE grade_level = p_grade_level
    AND UPPER(TRIM(section)) = UPPER(TRIM(p_old_section));

  GET DIAGNOSTICS v_voter_count = ROW_COUNT;

  -- Update candidates (non-archived only)
  UPDATE public.candidates
  SET section = v_new_sec
  WHERE grade_level = p_grade_level
    AND UPPER(TRIM(section)) = UPPER(TRIM(p_old_section))
    AND archived = false;

  GET DIAGNOSTICS v_cand_count = ROW_COUNT;

  RETURN json_build_object(
    'updated_voters',     v_voter_count,
    'updated_candidates', v_cand_count
  );
END;
$$;
