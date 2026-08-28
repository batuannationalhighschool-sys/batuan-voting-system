-- ============================================================================
-- BATUAN VOTING - SECURITY AND ELECTION-WINDOW HARDENING
--
-- Apply this file AFTER server/schema.sql and
-- server/migration-election-history.sql. It is deliberately separate from
-- the original bootstrap files so the order of the live migrations is clear.
-- It does not print, import, or rotate any application secret.
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Create the signing key inside Supabase Vault once. The generated value is
-- never returned by this migration or exposed to the client.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM vault.decrypted_secrets
    WHERE name = 'batuan-voting-app-jwt-secret'
  ) THEN
    PERFORM vault.create_secret(
      encode(public.gen_random_bytes(32), 'hex'),
      'batuan-voting-app-jwt-secret',
      'Signing key for Batuan Voting custom session tokens',
      NULL::uuid
    );
  END IF;
END;
$$;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

-- One durable marker makes a ballot atomic and prevents the existing
-- per-candidate unique constraint from allowing a second partial ballot.
CREATE TABLE IF NOT EXISTS public.ballot_submissions (
  voter_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ballot_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.ballot_submissions FROM PUBLIC, anon, authenticated;

-- Preserve the current state when this migration is installed on an existing
-- election. Resetting the election later removes these markers intentionally.
INSERT INTO public.ballot_submissions (voter_id, submitted_at)
SELECT v.voter_id, MIN(v.created_at)
FROM public.votes AS v
GROUP BY v.voter_id
ON CONFLICT (voter_id) DO NOTHING;

INSERT INTO public.ballot_submissions (voter_id)
SELECT p.user_id
FROM public.profiles AS p
WHERE p.has_voted = true
ON CONFLICT (voter_id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Secret-backed custom token functions
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_get_jwt_secret()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = pg_catalog, public, extensions, vault
AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret
  INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'batuan-voting-app-jwt-secret'
  LIMIT 1;

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE EXCEPTION 'Authentication configuration is incomplete';
  END IF;

  RETURN v_secret;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_app_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_result RECORD;
  v_payload JSONB;
  v_user_id UUID;
  v_user_lrn TEXT;
  v_token_version INTEGER;
  v_claimed_lrn TEXT;
BEGIN
  IF p_token IS NULL OR length(p_token) = 0 THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT payload, valid
  INTO v_result
  FROM extensions.verify(p_token, public.app_get_jwt_secret());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;
  IF NOT COALESCE(v_result.valid, false) THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  v_payload := v_result.payload;
  IF v_payload IS NULL
     OR v_payload->>'id' IS NULL
     OR v_payload->>'id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR v_payload->>'exp' IS NULL
     OR (v_payload->>'exp')::BIGINT <= extract(epoch FROM clock_timestamp())::BIGINT THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  v_user_id := (v_payload->>'id')::UUID;
  v_claimed_lrn := v_payload->>'lrn';

  SELECT lrn, token_version
  INTO v_user_lrn, v_token_version
  FROM public.users
  WHERE id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_claimed_lrn IS DISTINCT FROM v_user_lrn
     OR v_payload->>'ver' IS NULL
     OR (v_payload->>'ver')::INTEGER <> v_token_version
     OR EXISTS (
       SELECT 1
       FROM public.profiles
       WHERE user_id = v_user_id AND archived = true
     ) THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  RETURN jsonb_build_object(
    'id', v_user_id,
    'lrn', v_user_lrn,
    'ver', v_token_version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sign_app_token(p_user_id UUID, p_lrn TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_lrn TEXT;
  v_token_version INTEGER;
BEGIN
  SELECT lrn, token_version
  INTO v_lrn, v_token_version
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN extensions.sign(
    json_build_object(
      'id', p_user_id::TEXT,
      'lrn', v_lrn,
      'ver', v_token_version,
      'iat', extract(epoch FROM clock_timestamp())::INTEGER,
      'exp', extract(epoch FROM (clock_timestamp() + interval '7 days'))::INTEGER
    ),
    public.app_get_jwt_secret()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.require_admin(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload JSONB;
  v_user_id UUID;
BEGIN
  v_payload := public.verify_app_token(p_token);
  v_user_id := (v_payload->>'id')::UUID;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_login(p_lrn TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
BEGIN
  IF p_lrn IS NULL OR p_password IS NULL OR length(p_password) > 256 THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;

  SELECT id, lrn, password_hash, full_name, must_change_password
  INTO v_user
  FROM public.users
  WHERE lrn = p_lrn;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;
  IF crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = v_user.id AND archived = true
  ) THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;

  v_token := public.sign_app_token(v_user.id, v_user.lrn);
  RETURN jsonb_build_object(
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'lrn', v_user.lrn,
      'full_name', v_user.full_name
    ),
    'must_change_password', v_user.must_change_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_me(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_profile RECORD;
  v_profile_found BOOLEAN;
  v_is_admin BOOLEAN;
  v_has_voted BOOLEAN;
BEGIN
  v_payload := public.verify_app_token(p_token);

  SELECT id, lrn, full_name, must_change_password
  INTO v_user
  FROM public.users
  WHERE id = (v_payload->>'id')::UUID;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT full_name, grade_level, section, has_voted
  INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user.id
  LIMIT 1;
  v_profile_found := FOUND;

  v_has_voted := CASE WHEN v_profile_found THEN COALESCE(v_profile.has_voted, false) ELSE false END
    OR EXISTS (SELECT 1 FROM public.ballot_submissions WHERE voter_id = v_user.id)
    OR EXISTS (SELECT 1 FROM public.votes WHERE voter_id = v_user.id);

  IF v_profile_found AND v_profile.full_name IS NOT NULL AND v_profile.has_voted IS DISTINCT FROM v_has_voted THEN
    UPDATE public.profiles
    SET has_voted = v_has_voted
    WHERE user_id = v_user.id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user.id AND role = 'admin'
  ) INTO v_is_admin;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'lrn', v_user.lrn,
      'full_name', v_user.full_name
    ),
    'profile', CASE WHEN v_profile_found AND v_profile.full_name IS NOT NULL THEN jsonb_build_object(
      'full_name', v_profile.full_name,
      'has_voted', v_has_voted,
      'grade_level', v_profile.grade_level,
      'section', v_profile.section
    ) ELSE NULL END,
    'isAdmin', v_is_admin,
    'must_change_password', v_user.must_change_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_change_password(p_token TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_token TEXT;
BEGIN
  v_payload := public.verify_app_token(p_token);

  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 256 THEN
    RAISE EXCEPTION 'Password must be between 6 and 256 characters';
  END IF;

  UPDATE public.users
  SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
      must_change_password = false,
      token_version = token_version + 1
  WHERE id = (v_payload->>'id')::UUID
  RETURNING id, lrn INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_token := public.sign_app_token(v_user.id, v_user.lrn);
  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_archive_voter(p_token TEXT, p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := public.require_admin(p_token);
  UPDATE public.profiles
  SET archived = true, archived_at = clock_timestamp()
  WHERE user_id = p_id::UUID;
  UPDATE public.users
  SET token_version = token_version + 1
  WHERE id = p_id::UUID;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_restore_voter(p_token TEXT, p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := public.require_admin(p_token);
  UPDATE public.profiles
  SET archived = false, archived_at = NULL
  WHERE user_id = p_id::UUID;
  UPDATE public.users
  SET token_version = token_version + 1
  WHERE id = p_id::UUID;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_reset_voter_password(p_token TEXT, p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_admin_id UUID;
  v_lrn TEXT;
BEGIN
  v_admin_id := public.require_admin(p_token);
  SELECT lrn INTO v_lrn FROM public.users WHERE id = p_id::UUID;
  IF NOT FOUND THEN RAISE EXCEPTION 'Voter not found'; END IF;

  UPDATE public.users
  SET password_hash = crypt(v_lrn, gen_salt('bf', 10)),
      must_change_password = true,
      token_version = token_version + 1
  WHERE id = p_id::UUID;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- --------------------------------------------------------------------------
-- Authoritative voting-window enforcement
-- --------------------------------------------------------------------------

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
  -- Manual mode intentionally allows the administrator to end the election;
  -- automatic mode closes at the configured end instant even if its status is
  -- stale because a scheduler invocation was missed.
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
      IF v_profile.grade_level IS NULL OR v_candidate.grade_level <> v_profile.grade_level THEN
        RAISE EXCEPTION 'You may only vote for a representative from your grade level';
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

CREATE OR REPLACE FUNCTION public.submit_votes(p_voter_id UUID, p_votes JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_vote JSONB;
BEGIN
  FOR v_vote IN SELECT value FROM jsonb_array_elements(p_votes)
  LOOP
    INSERT INTO public.votes (id, voter_id, candidate_id, position_id)
    VALUES (
      public.gen_random_uuid(),
      p_voter_id,
      (v_vote->>'candidate_id')::UUID,
      (v_vote->>'position_id')::UUID
    );
  END LOOP;
  UPDATE public.profiles SET has_voted = true WHERE user_id = p_voter_id;
END;
$$;

-- Prevent callers from bypassing the validation function through the legacy
-- raw insert helper. The security-definer app function can still call it.
REVOKE ALL ON FUNCTION public.submit_votes(UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- --------------------------------------------------------------------------
-- Never silently discard a previous election when starting/resetting a new one
-- --------------------------------------------------------------------------

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
      auto_end_enabled = CASE WHEN p_data ? 'auto_end_enabled' THEN (p_data->>'auto_end_enabled')::BOOLEAN ELSE auto_end_enabled END
  WHERE id = v_current.id;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_reset_all_voted(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF (EXISTS (SELECT 1 FROM public.votes) OR EXISTS (SELECT 1 FROM public.ballot_submissions))
     AND NOT EXISTS (
       SELECT 1 FROM public.election_results_archive a
       JOIN public.election_settings s ON s.school_year = a.school_year
     ) THEN
    RAISE EXCEPTION 'Archive the current election results before resetting votes';
  END IF;

  UPDATE public.profiles SET has_voted = false WHERE user_id IS NOT NULL;
  DELETE FROM public.ballot_submissions;
  DELETE FROM public.votes;
  RETURN jsonb_build_object('success', true, 'message', 'All voting statuses reset successfully');
END;
$$;

-- --------------------------------------------------------------------------
-- Consistent public result/statistics filters
-- --------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.vote_counts AS
SELECT
  c.id AS candidate_id,
  c.name AS candidate_name,
  c.position_id,
  c.party_list,
  c.grade_level,
  c.section,
  c.motto,
  p.title AS position_title,
  p.display_order,
  COALESCE(vc.vote_count, 0)::BIGINT AS vote_count
FROM public.candidates AS c
JOIN public.positions AS p ON p.id = c.position_id
LEFT JOIN (
  SELECT v.candidate_id, COUNT(*)::BIGINT AS vote_count
  FROM public.votes AS v
  JOIN public.profiles AS pr ON pr.user_id = v.voter_id AND pr.archived = false
  JOIN public.candidates AS active_candidate ON active_candidate.id = v.candidate_id
    AND active_candidate.archived = false
  WHERE v.position_id = active_candidate.position_id
  GROUP BY v.candidate_id
) AS vc ON vc.candidate_id = c.id
WHERE c.archived = false;

CREATE OR REPLACE FUNCTION public.app_get_filtered_vote_counts(
  p_voter_grade TEXT DEFAULT NULL,
  p_voter_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r)::JSONB)
    FROM (
      SELECT c.id AS candidate_id, c.name AS candidate_name, c.position_id,
        c.party_list, c.grade_level, c.section, c.motto,
        p.title AS position_title, p.display_order,
        COALESCE((
          SELECT COUNT(*)::BIGINT
          FROM public.votes AS v
          JOIN public.profiles AS pr ON pr.user_id = v.voter_id AND pr.archived = false
          WHERE v.candidate_id = c.id
            AND v.position_id = c.position_id
            AND (p_voter_grade IS NULL OR pr.grade_level = p_voter_grade)
            AND (p_voter_section IS NULL OR pr.section = p_voter_section)
        ), 0) AS vote_count
      FROM public.candidates AS c
      JOIN public.positions AS p ON p.id = c.position_id
      WHERE c.archived = false
      ORDER BY p.display_order, vote_count DESC, c.name
    ) AS r
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_voter_groups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'gradeLevels', COALESCE((
      SELECT jsonb_agg(t.grade_level ORDER BY t.grade_level)
      FROM (
        SELECT DISTINCT p.grade_level
        FROM public.profiles AS p
        JOIN public.user_roles AS ur ON ur.user_id = p.user_id AND ur.role = 'voter'
        WHERE p.archived = false AND p.grade_level IS NOT NULL AND p.grade_level <> ''
      ) AS t
    ), '[]'::JSONB),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('grade_level', t.grade_level, 'section', t.section)
        ORDER BY t.grade_level, t.section)
      FROM (
        SELECT DISTINCT p.grade_level, p.section
        FROM public.profiles AS p
        JOIN public.user_roles AS ur ON ur.user_id = p.user_id AND ur.role = 'voter'
        WHERE p.archived = false
          AND p.grade_level IS NOT NULL AND p.grade_level <> ''
          AND p.section IS NOT NULL AND p.section <> ''
      ) AS t
    ), '[]'::JSONB)
  );
END;
$$;

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

  SELECT COUNT(*)::INTEGER
  INTO v_position_count
  FROM public.positions AS pos
  WHERE p_voter_grade IS NULL
     OR left(pos.title, 6) <> 'Grade '
     OR lower(pos.title) LIKE '%' || lower(p_voter_grade) || '%';

  RETURN jsonb_build_object(
    'voterCount', COALESCE(v_voter_count, 0),
    'votedCount', COALESCE(v_voted_count, 0),
    'totalVotes', COALESCE(v_total_votes, 0),
    'positionCount', COALESCE(v_position_count, 0)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_auto_manage_elections()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_election RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
  v_start_at TIMESTAMPTZ;
  v_end_at TIMESTAMPTZ;
BEGIN
  FOR v_election IN SELECT * FROM public.election_settings FOR UPDATE
  LOOP
    v_start_at := (v_election.election_date + v_election.voting_start) AT TIME ZONE 'Asia/Manila';
    v_end_at := (v_election.election_date + v_election.voting_end) AT TIME ZONE 'Asia/Manila';
    IF v_end_at <= v_start_at THEN CONTINUE; END IF;

    IF v_election.status = 'upcoming' AND v_now >= v_start_at AND v_now < v_end_at THEN
      UPDATE public.election_settings SET status = 'ongoing' WHERE id = v_election.id;
    ELSIF v_election.status = 'ongoing'
      AND COALESCE(v_election.auto_end_enabled, true)
      AND v_now >= v_end_at THEN
      UPDATE public.election_settings SET status = 'completed' WHERE id = v_election.id;
    END IF;
  END LOOP;
END;
$$;

-- Candidate photos remain publicly readable, but anonymous uploads are
-- removed. The application/server proxy performs the admin authorization and
-- validates image bytes before using the service-role storage client.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-photos',
  'candidate-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "candidate_photos_upload" ON storage.objects;

REVOKE ALL ON FUNCTION public.app_get_jwt_secret() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_app_token(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sign_app_token(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.require_admin(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.app_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_me(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_change_password(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_submit_votes(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_filtered_vote_counts(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_voter_groups() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_stats(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_election_settings(TEXT, TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_reset_all_voted(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_auto_manage_elections() TO service_role;

COMMIT;

-- Scheduler choices (run one after enabling/configuring the chosen service):
-- Supabase pg_cron:
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule('auto-manage-elections', '* * * * *', $$SELECT public.app_auto_manage_elections()$$);
-- Vercel Cron or another trusted scheduler:
--   GET /api/auto-manage-elections with Authorization: Bearer <CRON_SECRET>
