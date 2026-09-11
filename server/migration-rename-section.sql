-- --- Rename Section RPC --------------------------------------------------------
-- Renames a section across all profiles (voters) and candidates of a given grade level.
-- Called by PATCH /sections/rename from the admin panel.
-- -------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app_rename_section(
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
  v_caller_id   UUID;
  v_caller_role TEXT;
  v_voter_count INT;
  v_cand_count  INT;
BEGIN
  -- Auth check
  SELECT user_id INTO v_caller_id
  FROM sessions
  WHERE token = p_token AND expires_at > NOW();

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = v_caller_id
  LIMIT 1;

  IF v_caller_role <> 'admin' THEN
    RAISE EXCEPTION 'Forbidden: admin only';
  END IF;

  -- Validate inputs
  IF TRIM(p_new_section) = '' THEN
    RAISE EXCEPTION 'New section name cannot be empty';
  END IF;

  IF UPPER(TRIM(p_old_section)) = UPPER(TRIM(p_new_section)) THEN
    RAISE EXCEPTION 'New section name is the same as the old name';
  END IF;

  -- Update profiles (voters)
  UPDATE profiles
  SET section = UPPER(TRIM(p_new_section))
  WHERE grade_level = p_grade_level
    AND UPPER(TRIM(section)) = UPPER(TRIM(p_old_section));

  GET DIAGNOSTICS v_voter_count = ROW_COUNT;

  -- Update candidates (non-archived only)
  UPDATE candidates
  SET section = UPPER(TRIM(p_new_section))
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
