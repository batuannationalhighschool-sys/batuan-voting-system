-- ============================================================================
-- BATUAN VOTING - NEXT-GRADE REPRESENTATIVE VOTING LOGIC & GRADE 7 REMOVAL
--
-- 1. Removes Grade 7 Representative position, candidates, and votes.
-- 2. Enforces next-grade representative voting logic:
--    Grade 7 -> Grade 8 Representative
--    Grade 8 -> Grade 9 Representative
--    Grade 9 -> Grade 10 Representative
--    Grade 10 -> Grade 11 Representative
--    Grade 11 -> Grade 12 Representative
-- 3. Updates app_submit_votes and app_get_stats RPCs in Supabase.
-- ============================================================================

BEGIN;

-- ─── 1. Clean up Grade 7 Representative Data ────────────────────────────────
-- Remove existing votes for Grade 7 Representative or candidates
DELETE FROM public.votes
WHERE position_id IN (
  SELECT id FROM public.positions WHERE lower(trim(title)) = 'grade 7 representative'
) OR candidate_id IN (
  SELECT id FROM public.candidates WHERE position_id IN (
    SELECT id FROM public.positions WHERE lower(trim(title)) = 'grade 7 representative'
  )
);

-- Remove candidates under Grade 7 Representative position
DELETE FROM public.candidates
WHERE position_id IN (
  SELECT id FROM public.positions WHERE lower(trim(title)) = 'grade 7 representative'
);

-- Remove Grade 7 Representative position
DELETE FROM public.positions
WHERE lower(trim(title)) = 'grade 7 representative';

-- Remove any archive records for Grade 7 Representative
DELETE FROM public.election_results_archive
WHERE lower(trim(position_title)) = 'grade 7 representative';


-- ─── 2. Update app_submit_votes with Next-Grade Representative Validation ───
CREATE OR REPLACE FUNCTION public.app_submit_votes(p_token TEXT, p_votes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload JSONB;
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_is_voter BOOLEAN;
  v_must_change_password BOOLEAN;
  v_profile RECORD;
  v_election RECORD;
  v_vote JSONB;
  v_position RECORD;
  v_candidate RECORD;
  v_position_id UUID;
  v_candidate_id UUID;
  v_votes_by_position JSONB := '{}'::JSONB;
  v_seen_candidates JSONB := '{}'::JSONB;
  v_position_key TEXT;
  v_count INTEGER;
  v_inserted INTEGER;
  v_now TIMESTAMPTZ;
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
  v_allowed_grade TEXT;
BEGIN
  v_payload := public.verify_app_token(p_token);
  v_user_id := (v_payload->>'id')::UUID;

  IF p_votes IS NULL OR jsonb_typeof(p_votes) <> 'array' OR jsonb_array_length(p_votes) = 0 THEN
    RAISE EXCEPTION 'No votes provided';
  END IF;
  IF jsonb_array_length(p_votes) > 100 THEN
    RAISE EXCEPTION 'Too many votes provided';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'
  ) INTO v_is_admin;
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'voter'
  ) INTO v_is_voter;
  IF v_is_admin THEN RAISE EXCEPTION 'Administrators are not allowed to vote'; END IF;
  IF NOT v_is_voter THEN RAISE EXCEPTION 'Voter role required'; END IF;

  SELECT must_change_password INTO v_must_change_password
  FROM public.users
  WHERE id = v_user_id;
  IF COALESCE(v_must_change_password, false) THEN
    RAISE EXCEPTION 'Please change your password before voting';
  END IF;

  SELECT full_name, grade_level, section, has_voted, archived
  INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Active voter profile required';
  END IF;
  IF COALESCE(v_profile.archived, true) THEN
    RAISE EXCEPTION 'Active voter profile required';
  END IF;
  IF COALESCE(v_profile.has_voted, false)
     OR EXISTS (SELECT 1 FROM public.ballot_submissions WHERE voter_id = v_user_id)
     OR EXISTS (SELECT 1 FROM public.votes WHERE voter_id = v_user_id) THEN
    RAISE EXCEPTION 'You have already voted';
  END IF;

  -- Lock the settings row so a vote cannot race an admin status/schedule change.
  SELECT id, status, election_date, voting_start, voting_end, auto_end_enabled
  INTO v_election
  FROM public.election_settings
  ORDER BY updated_at DESC NULLS LAST, id
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Election settings are not configured'; END IF;

  v_now := clock_timestamp();
  v_start_at := (v_election.election_date + v_election.voting_start) AT TIME ZONE 'Asia/Manila';
  v_end_at := (v_election.election_date + v_election.voting_end) AT TIME ZONE 'Asia/Manila';
  IF v_end_at <= v_start_at THEN
    RAISE EXCEPTION 'Election schedule is invalid';
  END IF;

  IF v_election.status <> 'ongoing' THEN
    IF v_election.status = 'upcoming' THEN
      RAISE EXCEPTION 'Voting is not open yet';
    END IF;
    RAISE EXCEPTION 'Voting is closed';
  END IF;

  IF v_now < v_start_at THEN
    RAISE EXCEPTION 'Voting is not open yet';
  END IF;
  IF COALESCE(v_election.auto_end_enabled, true) AND v_now >= v_end_at THEN
    RAISE EXCEPTION 'Voting is closed';
  END IF;

  FOR v_vote IN SELECT value FROM jsonb_array_elements(p_votes)
  LOOP
    IF jsonb_typeof(v_vote) <> 'object' THEN RAISE EXCEPTION 'Invalid vote'; END IF;
    IF COALESCE(v_vote->>'position_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Invalid position';
    END IF;
    IF COALESCE(v_vote->>'candidate_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Invalid candidate';
    END IF;

    v_position_id := (v_vote->>'position_id')::UUID;
    v_candidate_id := (v_vote->>'candidate_id')::UUID;
    v_position_key := v_position_id::TEXT;

    IF v_seen_candidates ? v_candidate_id::TEXT THEN
      RAISE EXCEPTION 'A candidate may only be selected once';
    END IF;
    v_seen_candidates := v_seen_candidates || jsonb_build_object(v_candidate_id::TEXT, true);

    SELECT id, title, max_votes
    INTO v_position
    FROM public.positions
    WHERE id = v_position_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid position'; END IF;

    SELECT id, position_id, grade_level
    INTO v_candidate
    FROM public.candidates
    WHERE id = v_candidate_id AND archived = false;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid candidate'; END IF;
    IF v_candidate.position_id <> v_position_id THEN
      RAISE EXCEPTION 'Candidate does not belong to the selected position';
    END IF;

    v_count := COALESCE((v_votes_by_position->>v_position_key)::INTEGER, 0) + 1;
    v_votes_by_position := v_votes_by_position || jsonb_build_object(v_position_key, v_count);
    IF v_count > v_position.max_votes THEN
      RAISE EXCEPTION 'You can only vote for up to % candidate(s) for %', v_position.max_votes, v_position.title;
    END IF;

    -- Next-grade representative voting logic
    IF lower(v_position.title) LIKE '%representative%' THEN
      IF v_profile.grade_level IS NULL THEN
        RAISE EXCEPTION 'Your grade level must be set to vote for Grade Representatives';
      END IF;

      v_allowed_grade := CASE v_profile.grade_level
        WHEN 'Grade 7' THEN 'Grade 8'
        WHEN 'Grade 8' THEN 'Grade 9'
        WHEN 'Grade 9' THEN 'Grade 10'
        WHEN 'Grade 10' THEN 'Grade 11'
        WHEN 'Grade 11' THEN 'Grade 12'
        ELSE NULL
      END;

      IF v_allowed_grade IS NULL THEN
        RAISE EXCEPTION 'Voters from % are not eligible to vote for a Grade Representative', v_profile.grade_level;
      END IF;

      -- The selected position is authoritative for representative eligibility.
      -- Candidate grade_level is descriptive metadata in existing imports.
      IF lower(v_position.title) NOT LIKE '%' || lower(v_allowed_grade) || '%' THEN
        RAISE EXCEPTION 'Grade Representatives: voters from % may only vote for % Representative', v_profile.grade_level, v_allowed_grade;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO public.ballot_submissions (voter_id)
  VALUES (v_user_id)
  ON CONFLICT (voter_id) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted <> 1 THEN RAISE EXCEPTION 'You have already voted'; END IF;

  PERFORM public.submit_votes(v_user_id, p_votes);
  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You have already voted';
END;
$$;


-- ─── 3. Update app_get_stats with Next-Grade Representative Counting ────────
CREATE OR REPLACE FUNCTION public.app_get_stats(
  p_voter_grade TEXT DEFAULT NULL,
  p_voter_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_voter_count INTEGER;
  v_voted_count INTEGER;
  v_total_votes BIGINT;
  v_position_count INTEGER;
  v_allowed_rep_grade TEXT;
BEGIN
  SELECT COUNT(*)::INTEGER
  INTO v_voter_count
  FROM public.profiles AS p
  JOIN public.user_roles AS ur ON ur.user_id = p.user_id AND ur.role = 'voter'
  WHERE p.archived = false
    AND (p_voter_grade IS NULL OR p.grade_level = p_voter_grade)
    AND (p_voter_section IS NULL OR p.section = p_voter_section);

  SELECT COUNT(*)::INTEGER
  INTO v_voted_count
  FROM public.profiles AS p
  JOIN public.user_roles AS ur ON ur.user_id = p.user_id AND ur.role = 'voter'
  WHERE p.archived = false
    AND (p_voter_grade IS NULL OR p.grade_level = p_voter_grade)
    AND (p_voter_section IS NULL OR p.section = p_voter_section)
    AND (p.has_voted OR EXISTS (
      SELECT 1 FROM public.ballot_submissions AS b WHERE b.voter_id = p.user_id
    ));

  SELECT COUNT(*)::BIGINT
  INTO v_total_votes
  FROM public.votes AS v
  JOIN public.profiles AS p ON p.user_id = v.voter_id AND p.archived = false
  JOIN public.candidates AS c ON c.id = v.candidate_id AND c.archived = false
  WHERE v.position_id = c.position_id
    AND (p_voter_grade IS NULL OR p.grade_level = p_voter_grade)
    AND (p_voter_section IS NULL OR p.section = p_voter_section);

  IF p_voter_grade IS NOT NULL THEN
    v_allowed_rep_grade := CASE p_voter_grade
      WHEN 'Grade 7' THEN 'Grade 8'
      WHEN 'Grade 8' THEN 'Grade 9'
      WHEN 'Grade 9' THEN 'Grade 10'
      WHEN 'Grade 10' THEN 'Grade 11'
      WHEN 'Grade 11' THEN 'Grade 12'
      ELSE NULL
    END;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_position_count
  FROM public.positions AS pos
  WHERE p_voter_grade IS NULL
     OR lower(pos.title) NOT LIKE '%representative%'
     OR (v_allowed_rep_grade IS NOT NULL AND lower(pos.title) LIKE '%' || lower(v_allowed_rep_grade) || '%');

  RETURN jsonb_build_object(
    'voterCount', COALESCE(v_voter_count, 0),
    'votedCount', COALESCE(v_voted_count, 0),
    'totalVotes', COALESCE(v_total_votes, 0),
    'positionCount', COALESCE(v_position_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_submit_votes(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_stats(TEXT, TEXT) TO anon, authenticated;

COMMIT;
