-- =====================================================================
-- BATUAN VOTING SYSTEM — ELECTION HISTORY MIGRATION
-- =====================================================================

-- ─── 1. Table: election_results_archive ──────────────────────────────
CREATE TABLE IF NOT EXISTS election_results_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_name VARCHAR(100) NOT NULL,
  school_year VARCHAR(20) NOT NULL,
  election_date DATE,
  position_title VARCHAR(100) NOT NULL,
  position_order INT NOT NULL DEFAULT 0,
  candidate_name VARCHAR(100) NOT NULL,
  candidate_party VARCHAR(100),
  candidate_grade VARCHAR(50),
  candidate_section VARCHAR(50),
  candidate_avatar_url VARCHAR(500) DEFAULT NULL,
  vote_count INT NOT NULL DEFAULT 0,
  total_position_votes INT NOT NULL DEFAULT 0,
  rank INT NOT NULL DEFAULT 1,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Row Level Security ───────────────────────────────────────────
ALTER TABLE election_results_archive ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "election_results_archive_anon_select" ON election_results_archive;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "election_results_archive_anon_select" ON election_results_archive FOR SELECT USING (true);


-- ═════════════════════════════════════════════════════════════════════
-- ELECTION HISTORY RPCs
-- ═════════════════════════════════════════════════════════════════════

-- ─── 3. RPC: Archive current election results (Admin) ───────────────
CREATE OR REPLACE FUNCTION app_archive_election_results(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_settings RECORD;
  v_candidate RECORD;
  v_archived_count INT := 0;
  v_current_pos_title VARCHAR(100) := '';
  v_current_rank INT := 1;
  v_pos_max_votes INT := 1;
  v_total_pos_votes INT := 0;
BEGIN
  -- Validate admin token
  v_admin_id := require_admin(p_token);

  -- Read current election_settings
  SELECT name, school_year, election_date INTO v_settings FROM election_settings LIMIT 1;
  IF v_settings IS NULL THEN
    RAISE EXCEPTION 'No election settings found';
  END IF;

  -- Delete existing results for this school_year to allow re-archiving
  DELETE FROM election_results_archive WHERE school_year = v_settings.school_year;

  -- Query vote_counts to get all candidates and their votes
  FOR v_candidate IN (
    SELECT 
      c.candidate_name,
      c.party_list,
      c.grade_level,
      c.section,
      p.max_votes,
      c.position_title,
      c.display_order,
      c.vote_count,
      (SELECT avatar_url FROM candidates WHERE id = c.candidate_id LIMIT 1) AS avatar_url
    FROM vote_counts c
    JOIN positions p ON p.id = c.position_id
    ORDER BY c.display_order ASC, c.vote_count DESC
  )
  LOOP
    -- Handle positions and max_votes to mark winners
    IF v_current_pos_title != v_candidate.position_title THEN
      v_current_pos_title := v_candidate.position_title;
      v_current_rank := 1;
      v_pos_max_votes := v_candidate.max_votes;
      
      SELECT COALESCE(SUM(vote_count), 0) INTO v_total_pos_votes 
      FROM vote_counts 
      WHERE position_title = v_candidate.position_title;
    ELSE
      v_current_rank := v_current_rank + 1;
    END IF;

    -- Insert into election_results_archive
    INSERT INTO election_results_archive (
      election_name, school_year, election_date,
      position_title, position_order,
      candidate_name, candidate_party, candidate_grade, candidate_section, candidate_avatar_url,
      vote_count, total_position_votes, rank, is_winner
    ) VALUES (
      v_settings.name, v_settings.school_year, v_settings.election_date,
      v_candidate.position_title, v_candidate.display_order,
      v_candidate.candidate_name, v_candidate.party_list, v_candidate.grade_level, v_candidate.section, v_candidate.avatar_url,
      v_candidate.vote_count, v_total_pos_votes, v_current_rank, (v_current_rank <= v_pos_max_votes)
    );
    
    v_archived_count := v_archived_count + 1;
  END LOOP;

  -- Return success
  RETURN jsonb_build_object('success', true, 'archived_count', v_archived_count);
END;
$$;

-- ─── 4. RPC: Get election history list (Public) ─────────────────────
CREATE OR REPLACE FUNCTION app_get_election_history()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT DISTINCT school_year, election_name, election_date, archived_at
      FROM election_results_archive
      ORDER BY election_date DESC
    ) r
  ), '[]'::jsonb);
END;
$$;

-- ─── 5. RPC: Get archived results for a school year (Public) ────────
CREATE OR REPLACE FUNCTION app_get_archived_results(p_school_year TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r))
    FROM (
      SELECT *
      FROM election_results_archive
      WHERE school_year = p_school_year
      ORDER BY position_order ASC, rank ASC
    ) r
  ), '[]'::jsonb);
END;
$$;

-- ─── 6. RPC: Delete election history (Admin) ────────────────────────
CREATE OR REPLACE FUNCTION app_delete_election_history(p_token TEXT, p_school_year TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
BEGIN
  -- Validate admin token
  v_admin_id := require_admin(p_token);
  
  -- Delete all rows from election_results_archive
  DELETE FROM election_results_archive WHERE school_year = p_school_year;
  
  -- Return success
  RETURN jsonb_build_object('success', true);
END;
$$;


-- ─── 7. RPC: Reset all voting statuses (Admin — manual archive via separate button) ───
CREATE OR REPLACE FUNCTION app_reset_all_voted(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);

  -- Reset voter statuses and clear live votes (manual archiving is left to the admin)
  UPDATE profiles SET has_voted = false WHERE user_id IS NOT NULL;
  DELETE FROM votes WHERE id IS NOT NULL;

  RETURN jsonb_build_object('success', true, 'message', 'All voting statuses reset successfully.');
END;
$$;

-- ─── 8. RPC: Dynamic has_voted check in app_get_me ────────────────────
CREATE OR REPLACE FUNCTION app_get_me(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_profile RECORD;
  v_is_admin BOOLEAN;
  v_has_voted_actual BOOLEAN;
BEGIN
  v_payload := verify_app_token(p_token);

  SELECT * INTO v_user FROM users WHERE id = (v_payload->>'id')::uuid;
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT full_name, has_voted, grade_level, section INTO v_profile
  FROM profiles WHERE user_id = v_user.id LIMIT 1;

  -- Check if the user has actually cast votes in the active votes table
  SELECT EXISTS(SELECT 1 FROM votes WHERE voter_id = v_user.id) INTO v_has_voted_actual;

  -- Auto-sync profile has_voted flag if votes were reset/cleared for a new election
  IF v_profile.full_name IS NOT NULL AND v_profile.has_voted != v_has_voted_actual THEN
    UPDATE profiles SET has_voted = v_has_voted_actual WHERE user_id = v_user.id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = v_user.id AND role = 'admin') INTO v_is_admin;

  RETURN jsonb_build_object(
    'user', jsonb_build_object('id', v_user.id, 'lrn', v_user.lrn, 'full_name', v_user.full_name),
    'profile', CASE WHEN v_profile.full_name IS NOT NULL THEN jsonb_build_object(
      'full_name', v_profile.full_name, 'has_voted', v_has_voted_actual,
      'grade_level', v_profile.grade_level, 'section', v_profile.section
    ) ELSE NULL END,
    'isAdmin', v_is_admin,
    'must_change_password', v_user.must_change_password
  );
END;
$$;


-- ─── 9. RPC: Update election settings ──────────────────────────────────
CREATE OR REPLACE FUNCTION app_update_election_settings(p_token TEXT, p_id TEXT, p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_curr_date DATE;
  v_today DATE;
  v_old_status TEXT;
  v_new_status TEXT;
BEGIN
  v_admin_id := require_admin(p_token);

  SELECT status INTO v_old_status FROM election_settings WHERE id = p_id::uuid;
  v_new_status := p_data->>'status';

  -- If status is changing to 'ongoing' (Starting Election), clear previous votes and reset voters (no auto-archiving)
  IF v_new_status = 'ongoing' AND (v_old_status IS NULL OR v_old_status != 'ongoing') THEN
    UPDATE profiles SET has_voted = false WHERE user_id IS NOT NULL;
    DELETE FROM votes WHERE id IS NOT NULL;
  END IF;

  -- If setting to upcoming and no election_date, auto-fix past dates
  IF v_new_status = 'upcoming' AND (p_data->>'election_date') IS NULL THEN
    SELECT election_date INTO v_curr_date FROM election_settings WHERE id = p_id::uuid;
    v_today := current_date;
    IF v_curr_date IS NOT NULL AND v_curr_date < v_today THEN
      p_data := p_data || jsonb_build_object('election_date', v_today::text);
    END IF;
  END IF;

  UPDATE election_settings SET
    status = COALESCE(p_data->>'status', status),
    name = COALESCE(p_data->>'name', name),
    school_year = COALESCE(p_data->>'school_year', school_year),
    election_date = COALESCE((p_data->>'election_date')::date, election_date),
    voting_start = COALESCE((p_data->>'voting_start')::time, voting_start),
    voting_end = COALESCE((p_data->>'voting_end')::time, voting_end),
    school_name = CASE WHEN p_data ? 'school_name' THEN p_data->>'school_name' ELSE school_name END,
    auto_end_enabled = CASE WHEN p_data ? 'auto_end_enabled' THEN (p_data->>'auto_end_enabled')::boolean ELSE auto_end_enabled END
  WHERE id = p_id::uuid;

  RETURN jsonb_build_object('success', true);
END;
$$;


-- ═════════════════════════════════════════════════════════════════════
-- 10. GRANT EXECUTE to anon and authenticated roles
-- ═════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION app_archive_election_results TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_election_history TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_archived_results TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_delete_election_history TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_reset_all_voted TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_me TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_election_settings TO anon, authenticated;



