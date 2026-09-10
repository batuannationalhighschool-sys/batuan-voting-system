-- ============================================================================
-- BATUAN VOTING - VOTING RULES UPDATE & BLANK BALLOT SUPPORT
--
-- 1. Sets max_votes = 2 for all Grade Representative positions (allowing voters to vote for up to 2 candidates).
-- 2. Updates public.app_submit_votes and public.submit_votes to allow empty/blank ballots (voters can skip any/all positions).
-- ============================================================================

BEGIN;

-- ─── 1. Update positions max_votes ─────────────────────────────────────────
-- Only Grade Representatives have max_votes = 2
UPDATE public.positions
SET max_votes = 2
WHERE lower(title) LIKE '%representative%';

-- All other positions (President, VP, Sec, Treas, Aud, PIO, Protocol Officer) have max_votes = 1
UPDATE public.positions
SET max_votes = 1
WHERE lower(title) NOT LIKE '%representative%';

-- ─── 2. Update submit_votes to support empty votes array ───────────────────
CREATE OR REPLACE FUNCTION public.submit_votes(p_voter_id UUID, p_votes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote JSONB;
BEGIN
  IF p_votes IS NOT NULL AND jsonb_typeof(p_votes) = 'array' THEN
    FOR v_vote IN SELECT value FROM jsonb_array_elements(p_votes)
    LOOP
      INSERT INTO public.votes (id, voter_id, candidate_id, position_id)
      VALUES (
        extensions.gen_random_uuid(),
        p_voter_id,
        (v_vote->>'candidate_id')::UUID,
        (v_vote->>'position_id')::UUID
      );
    END LOOP;
  END IF;
  UPDATE public.profiles SET has_voted = true WHERE user_id = p_voter_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_votes(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- ─── 3. Update app_submit_votes to allow blank votes and enforce max_votes ───
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

  IF p_votes IS NULL OR jsonb_typeof(p_votes) <> 'array' THEN
    RAISE EXCEPTION 'Invalid votes format';
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

      IF v_candidate.grade_level <> v_allowed_grade THEN
        RAISE EXCEPTION 'Grade Representatives: voters from % may only vote for % Representative candidates', v_profile.grade_level, v_allowed_grade;
      END IF;

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

COMMIT;
