-- =====================================================================
-- BATUAN VOTING SYSTEM — COMPLETE LIVE DATABASE SCHEMA & MIGRATION
-- =====================================================================

-- =====================================================
-- Batuan Voting System — Supabase (PostgreSQL) Schema
-- Run via Supabase SQL Editor or Management API
-- SSLG Elections only
-- =====================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Users table (login via LRN for students, username for admin) ───
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lrn VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── User roles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'voter')),
  UNIQUE (user_id, role)
);

-- ─── Profiles ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  student_id VARCHAR(50) DEFAULT NULL,
  grade_level VARCHAR(50) DEFAULT NULL,
  section VARCHAR(50) DEFAULT NULL,
  has_voted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ
);

-- ─── Positions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  max_votes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Candidates ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  grade_level VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL,
  party_list VARCHAR(100) NOT NULL,
  motto VARCHAR(200) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Votes (unique per voter + candidate) ───────────────────────────
CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (voter_id, candidate_id)
);

-- ─── Election settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS election_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL DEFAULT 'SSLG Election 2026',
  school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  election_date DATE NOT NULL DEFAULT '2026-03-15',
  voting_start TIME NOT NULL DEFAULT '08:00:00',
  voting_end TIME NOT NULL DEFAULT '16:00:00',
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed')),
  school_name VARCHAR(150) DEFAULT 'Batuan National High School — Batuan, Bohol, Philippines',
  auto_end_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Trigger: auto-update updated_at columns ───────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_election_settings_updated_at ON election_settings;
CREATE TRIGGER update_election_settings_updated_at
  BEFORE UPDATE ON election_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── View: vote_counts ─────────────────────────────────────────────
CREATE OR REPLACE VIEW vote_counts AS
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
    COUNT(v.id) AS vote_count
  FROM candidates c
  JOIN positions p ON c.position_id = p.id
  LEFT JOIN votes v ON v.candidate_id = c.id
  GROUP BY c.id, c.name, c.position_id, c.party_list, c.grade_level,
           c.section, c.motto, p.title, p.display_order;

-- ─── RPC: Atomic vote submission ────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_votes(p_voter_id UUID, p_votes JSONB)
RETURNS VOID AS $$
DECLARE
  vote_record JSONB;
  v_id UUID;
BEGIN
  FOR vote_record IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_id := gen_random_uuid();
    INSERT INTO votes (id, voter_id, candidate_id, position_id)
    VALUES (
      v_id,
      p_voter_id,
      (vote_record->>'candidate_id')::UUID,
      (vote_record->>'position_id')::UUID
    );
  END LOOP;
  UPDATE profiles SET has_voted = TRUE WHERE user_id = p_voter_id;
END;
$$ LANGUAGE plpgsql;

-- ─── Row Level Security ─────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE election_settings ENABLE ROW LEVEL SECURITY;

-- ─── Storage: candidate photos bucket ───────────────────────────────
-- Run in Supabase SQL Editor:
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('candidate-photos', 'candidate-photos', true)
-- ON CONFLICT (id) DO NOTHING;

-- ─── Seed: default SSLG election settings ──────────────────────────
INSERT INTO election_settings (name, school_year, election_date, status)
VALUES ('SSLG Election 2026', '2025-2026', '2026-03-15', 'ongoing');

-- ─── Seed: default SSLG positions ──────────────────────────────────
-- max_votes = 2 for P.I.O. and Peace Officer (voters elect 2 per position)
INSERT INTO positions (title, display_order, max_votes) VALUES
  ('President',                  1, 1),
  ('Vice President',             2, 1),
  ('Secretary',                  3, 1),
  ('Treasurer',                  4, 1),
  ('Auditor',                    5, 1),
  ('Public Information Officer', 6, 2),
  ('Peace Officer',              7, 2),
  ('Grade 7 Representative',     8, 1),
  ('Grade 8 Representative',     9, 1),
  ('Grade 9 Representative',    10, 1),
  ('Grade 10 Representative',   11, 1),
  ('Grade 11 Representative',   12, 1),
  ('Grade 12 Representative',   13, 1);

-- ─── Seed: default admin user (username: admin, password: admin123) ─
-- bcrypt hash for 'admin123'
INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'admin',
  '$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.',
  'Administrator',
  FALSE
);

INSERT INTO profiles (user_id, full_name)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Administrator');

INSERT INTO user_roles (user_id, role)
VALUES ('a0000000-0000-0000-0000-000000000001', 'admin');


-- =====================================================================
-- Batuan Voting System — Supabase Migration
-- Migrates Express backend logic into PostgreSQL RPC functions
-- Run this ENTIRE file in the Supabase SQL Editor
-- =====================================================================

-- ─── Enable required extensions ─────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgjwt WITH SCHEMA extensions;

-- ─── Helper: Verify custom JWT token ────────────────────────────────
CREATE OR REPLACE FUNCTION verify_app_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result RECORD;
  v_user_id UUID;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT payload, valid INTO v_result
  FROM extensions.verify(p_token, 'batuan-voting-secret-key-2026');

  IF NOT v_result.valid THEN
    RAISE EXCEPTION 'Invalid or expired token';
  END IF;

  IF ((v_result.payload->>'exp')::bigint) < extract(epoch FROM now())::bigint THEN
    RAISE EXCEPTION 'Token expired';
  END IF;

  v_user_id := (v_result.payload->>'id')::uuid;

  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN jsonb_build_object('id', v_result.payload->>'id', 'lrn', v_result.payload->>'lrn');
END;
$$;

-- ─── Helper: Require admin, return admin user_id ────────────────────
CREATE OR REPLACE FUNCTION require_admin(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_user_id UUID;
BEGIN
  v_payload := verify_app_token(p_token);
  v_user_id := (v_payload->>'id')::uuid;

  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN v_user_id;
END;
$$;

-- ─── Helper: Sign a JWT for a user ──────────────────────────────────
CREATE OR REPLACE FUNCTION sign_app_token(p_user_id UUID, p_lrn TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN extensions.sign(
    json_build_object(
      'id', p_user_id::text,
      'lrn', p_lrn,
      'iat', extract(epoch FROM now())::integer,
      'exp', extract(epoch FROM (now() + interval '7 days'))::integer
    ),
    'batuan-voting-secret-key-2026'
  );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- AUTH RPCs
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_login(p_lrn TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
BEGIN
  IF p_lrn IS NULL OR p_password IS NULL THEN
    RAISE EXCEPTION 'LRN and password are required';
  END IF;

  SELECT * INTO v_user FROM users WHERE lrn = p_lrn;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;

  IF crypt(p_password, v_user.password_hash) != v_user.password_hash THEN
    RAISE EXCEPTION 'Invalid LRN or password';
  END IF;

  v_token := sign_app_token(v_user.id, v_user.lrn);

  RETURN jsonb_build_object(
    'token', v_token,
    'user', jsonb_build_object('id', v_user.id, 'lrn', v_user.lrn, 'full_name', v_user.full_name),
    'must_change_password', v_user.must_change_password
  );
END;
$$;

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
BEGIN
  v_payload := verify_app_token(p_token);

  SELECT * INTO v_user FROM users WHERE id = (v_payload->>'id')::uuid;
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

  SELECT full_name, has_voted, grade_level, section INTO v_profile
  FROM profiles WHERE user_id = v_user.id LIMIT 1;

  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = v_user.id AND role = 'admin') INTO v_is_admin;

  RETURN jsonb_build_object(
    'user', jsonb_build_object('id', v_user.id, 'lrn', v_user.lrn, 'full_name', v_user.full_name),
    'profile', CASE WHEN v_profile.full_name IS NOT NULL THEN jsonb_build_object(
      'full_name', v_profile.full_name, 'has_voted', v_profile.has_voted,
      'grade_level', v_profile.grade_level, 'section', v_profile.section
    ) ELSE NULL END,
    'isAdmin', v_is_admin,
    'must_change_password', v_user.must_change_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION app_change_password(p_token TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_user_id UUID;
  v_user RECORD;
  v_token TEXT;
BEGIN
  v_payload := verify_app_token(p_token);
  v_user_id := (v_payload->>'id')::uuid;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  UPDATE users SET password_hash = crypt(p_new_password, gen_salt('bf', 10)), must_change_password = false
  WHERE id = v_user_id;

  SELECT * INTO v_user FROM users WHERE id = v_user_id;
  v_token := sign_app_token(v_user.id, v_user.lrn);

  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- VOTER MANAGEMENT RPCs (Admin only)
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_list_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r->>'created_at' DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', u.id, 'lrn', u.lrn, 'full_name', u.full_name,
        'must_change_password', u.must_change_password, 'created_at', u.created_at,
        'grade_level', p.grade_level, 'section', p.section, 'has_voted', p.has_voted
      ) AS r
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
      JOIN profiles p ON p.user_id = u.id AND p.archived = false
    ) sub
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app_add_voter(
  p_token TEXT, p_lrn TEXT, p_full_name TEXT,
  p_grade_level TEXT DEFAULT NULL, p_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  IF p_lrn IS NULL OR p_full_name IS NULL THEN RAISE EXCEPTION 'LRN and full name are required'; END IF;
  IF p_lrn !~ '^\d{12}$' THEN RAISE EXCEPTION 'LRN must be exactly 12 digits (numbers only)'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lrn = p_lrn) THEN RAISE EXCEPTION 'LRN already registered'; END IF;

  v_id := gen_random_uuid();
  INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
  VALUES (v_id, p_lrn, crypt(p_lrn, gen_salt('bf', 10)), p_full_name, true);

  INSERT INTO profiles (id, user_id, full_name, grade_level, section)
  VALUES (gen_random_uuid(), v_id, p_full_name, p_grade_level, p_section);

  INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), v_id, 'voter');

  RETURN jsonb_build_object('id', v_id, 'lrn', p_lrn, 'full_name', p_full_name,
    'grade_level', p_grade_level, 'section', p_section);
END;
$$;

CREATE OR REPLACE FUNCTION app_update_voter(
  p_token TEXT, p_id TEXT, p_lrn TEXT, p_full_name TEXT,
  p_grade_level TEXT DEFAULT NULL, p_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID; v_vid UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  v_vid := p_id::uuid;
  IF p_lrn IS NULL OR p_full_name IS NULL THEN RAISE EXCEPTION 'LRN and full name are required'; END IF;
  IF p_lrn !~ '^\d{12}$' THEN RAISE EXCEPTION 'LRN must be exactly 12 digits (numbers only)'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lrn = p_lrn AND id != v_vid) THEN RAISE EXCEPTION 'LRN already in use by another account'; END IF;

  UPDATE users SET lrn = p_lrn, full_name = p_full_name WHERE id = v_vid;
  UPDATE profiles SET full_name = p_full_name, grade_level = p_grade_level, section = p_section WHERE user_id = v_vid;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_archive_voter(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE profiles SET archived = true, archived_at = now() WHERE user_id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_list_archived_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r->>'archived_at' DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', p.user_id, 'lrn', u.lrn, 'full_name', p.full_name,
        'grade_level', p.grade_level, 'section', p.section,
        'has_voted', p.has_voted, 'archived_at', p.archived_at, 'created_at', u.created_at
      ) AS r
      FROM profiles p
      JOIN users u ON u.id = p.user_id
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
      WHERE p.archived = true
    ) sub
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app_restore_voter(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE profiles SET archived = false, archived_at = null WHERE user_id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_permanent_delete_voter(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  DELETE FROM users WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_reset_voter_password(p_token TEXT, p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID; v_lrn TEXT;
BEGIN
  v_admin_id := require_admin(p_token);
  SELECT lrn INTO v_lrn FROM users WHERE id = p_id::uuid;
  IF v_lrn IS NULL THEN RAISE EXCEPTION 'Voter not found'; END IF;
  UPDATE users SET password_hash = crypt(v_lrn, gen_salt('bf', 10)), must_change_password = true WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_reset_all_voted(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE profiles SET has_voted = false;
  DELETE FROM votes WHERE id != '00000000-0000-0000-0000-000000000000'::uuid;
  RETURN jsonb_build_object('success', true, 'message', 'All voters voting status reset successfully');
END;
$$;

CREATE OR REPLACE FUNCTION app_bulk_upload_voters(p_token TEXT, p_voters JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_row JSONB;
  v_clean_lrn TEXT;
  v_id UUID;
  v_inserted INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  v_skipped_list JSONB := '[]'::jsonb;
  v_error_list JSONB := '[]'::jsonb;
  v_idx INT := 0;
BEGIN
  v_admin_id := require_admin(p_token);

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_voters)
  LOOP
    v_idx := v_idx + 1;

    IF (v_row->>'lrn') IS NULL OR (v_row->>'full_name') IS NULL THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'reason', 'LRN and full name are required'));
      CONTINUE;
    END IF;

    v_clean_lrn := regexp_replace(v_row->>'lrn', '\D', '', 'g');

    IF v_clean_lrn !~ '^\d{12}$' THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'lrn', v_clean_lrn, 'reason', 'LRN must be exactly 12 digits'));
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM users WHERE lrn = v_clean_lrn) THEN
      v_skipped := v_skipped + 1;
      v_skipped_list := v_skipped_list || jsonb_build_array(jsonb_build_object('lrn', v_clean_lrn, 'full_name', v_row->>'full_name'));
      CONTINUE;
    END IF;

    v_id := gen_random_uuid();
    INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
    VALUES (v_id, v_clean_lrn, crypt(v_clean_lrn, gen_salt('bf', 10)), left(v_row->>'full_name', 100), true);

    INSERT INTO profiles (id, user_id, full_name, grade_level, section)
    VALUES (gen_random_uuid(), v_id, left(v_row->>'full_name', 100),
      CASE WHEN (v_row->>'grade_level') IS NOT NULL THEN left(v_row->>'grade_level', 50) ELSE NULL END,
      CASE WHEN (v_row->>'section') IS NOT NULL THEN left(v_row->>'section', 50) ELSE NULL END);

    INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), v_id, 'voter');
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors,
    'skippedList', v_skipped_list, 'errorList', v_error_list);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- CANDIDATE MANAGEMENT RPCs
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_add_candidate(
  p_token TEXT, p_name TEXT, p_position_id TEXT, p_grade_level TEXT,
  p_section TEXT, p_party_list TEXT, p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID; v_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  IF p_name IS NULL OR p_position_id IS NULL OR p_grade_level IS NULL OR p_section IS NULL OR p_party_list IS NULL THEN
    RAISE EXCEPTION 'Name, position, grade level, section, and party list are required';
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO candidates (id, name, position_id, grade_level, section, party_list, motto, avatar_url)
  VALUES (v_id, p_name, p_position_id::uuid, p_grade_level, p_section, p_party_list, p_motto, p_avatar_url);
  RETURN jsonb_build_object('id', v_id, 'name', p_name, 'position_id', p_position_id,
    'grade_level', p_grade_level, 'section', p_section, 'party_list', p_party_list,
    'motto', p_motto, 'avatar_url', p_avatar_url);
END;
$$;

CREATE OR REPLACE FUNCTION app_update_candidate(
  p_token TEXT, p_id TEXT, p_name TEXT, p_position_id TEXT, p_grade_level TEXT,
  p_section TEXT, p_party_list TEXT, p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID; v_result RECORD;
BEGIN
  v_admin_id := require_admin(p_token);
  IF p_name IS NULL OR p_position_id IS NULL OR p_grade_level IS NULL OR p_section IS NULL OR p_party_list IS NULL THEN
    RAISE EXCEPTION 'Name, position, grade level, section, and party list are required';
  END IF;
  UPDATE candidates SET name = p_name, position_id = p_position_id::uuid,
    grade_level = p_grade_level, section = p_section, party_list = p_party_list,
    motto = p_motto, avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = p_id::uuid;
  SELECT * INTO v_result FROM candidates WHERE id = p_id::uuid;
  RETURN row_to_json(v_result)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION app_archive_candidate(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE candidates SET archived = true, archived_at = now() WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_list_archived_candidates(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r)::jsonb ORDER BY r.archived_at DESC)
    FROM (
      SELECT c.*, p.title AS position_title
      FROM candidates c LEFT JOIN positions p ON c.position_id = p.id
      WHERE c.archived = true ORDER BY c.archived_at DESC
    ) r
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app_restore_candidate(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  UPDATE candidates SET archived = false, archived_at = null WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_permanent_delete_candidate(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  DELETE FROM candidates WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION app_bulk_upload_candidates(p_token TEXT, p_candidates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_row JSONB;
  v_name TEXT; v_position TEXT; v_grade TEXT; v_sec TEXT; v_party TEXT; v_motto TEXT;
  v_position_id UUID; v_id UUID;
  v_inserted INT := 0; v_skipped INT := 0; v_errors INT := 0;
  v_skipped_list JSONB := '[]'::jsonb; v_error_list JSONB := '[]'::jsonb;
  v_idx INT := 0;
BEGIN
  v_admin_id := require_admin(p_token);

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_candidates)
  LOOP
    v_idx := v_idx + 1;
    v_name := trim(COALESCE(v_row->>'name', ''));
    v_position := trim(COALESCE(v_row->>'position', ''));
    v_grade := trim(COALESCE(v_row->>'grade_level', ''));
    v_sec := trim(COALESCE(v_row->>'section', ''));
    v_party := trim(COALESCE(v_row->>'party_list', ''));
    v_motto := trim(COALESCE(v_row->>'motto', ''));

    IF v_name = '' OR v_position = '' OR v_grade = '' OR v_sec = '' OR v_party = '' THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'name', v_name, 'reason', 'Name, position, grade level, section, and party list are required'));
      CONTINUE;
    END IF;

    SELECT id INTO v_position_id FROM positions WHERE lower(trim(title)) = lower(v_position);
    IF v_position_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'name', v_name, 'reason', 'Position "' || v_position || '" does not exist'));
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM candidates WHERE name = v_name AND position_id = v_position_id AND archived = false) THEN
      v_skipped := v_skipped + 1;
      v_skipped_list := v_skipped_list || jsonb_build_array(jsonb_build_object('name', v_name, 'position', v_position));
      CONTINUE;
    END IF;

    v_id := gen_random_uuid();
    INSERT INTO candidates (id, name, position_id, grade_level, section, party_list, motto, archived)
    VALUES (v_id, left(v_name,100), v_position_id, left(v_grade,50), left(v_sec,50), left(v_party,100),
      CASE WHEN v_motto != '' THEN left(v_motto,200) ELSE NULL END, false);
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors,
    'skippedList', v_skipped_list, 'errorList', v_error_list);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- POSITION RPCs
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_add_position(p_token TEXT, p_title TEXT, p_display_order INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID; v_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  IF p_title IS NULL THEN RAISE EXCEPTION 'Title is required'; END IF;
  v_id := gen_random_uuid();
  INSERT INTO positions (id, title, display_order) VALUES (v_id, p_title, p_display_order);
  RETURN jsonb_build_object('id', v_id, 'title', p_title, 'display_order', p_display_order);
END;
$$;

CREATE OR REPLACE FUNCTION app_delete_position(p_token TEXT, p_id TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  DELETE FROM positions WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- ELECTION SETTINGS RPC
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_update_election_settings(p_token TEXT, p_id TEXT, p_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_curr_date DATE;
  v_today DATE;
BEGIN
  v_admin_id := require_admin(p_token);

  -- If setting to upcoming and no election_date, auto-fix past dates
  IF (p_data->>'status') = 'upcoming' AND (p_data->>'election_date') IS NULL THEN
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
-- VOTING RPC (with full validation)
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_submit_votes(p_token TEXT, p_votes JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_payload JSONB;
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_election RECORD;
  v_profile RECORD;
  v_vote JSONB;
  v_pos_id UUID;
  v_position RECORD;
  v_candidate RECORD;
  v_votes_by_pos JSONB := '{}'::jsonb;
  v_count INT;
  v_pos_key TEXT;
BEGIN
  v_payload := verify_app_token(p_token);
  v_user_id := (v_payload->>'id')::uuid;

  IF p_votes IS NULL OR jsonb_array_length(p_votes) = 0 THEN
    RAISE EXCEPTION 'No votes provided';
  END IF;

  -- Block admins
  SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id = v_user_id AND role = 'admin') INTO v_is_admin;
  IF v_is_admin THEN RAISE EXCEPTION 'Administrators are not allowed to vote'; END IF;

  -- Check election status
  SELECT * INTO v_election FROM election_settings LIMIT 1;
  IF v_election IS NULL OR v_election.status != 'ongoing' THEN
    IF v_election IS NOT NULL AND v_election.status = 'upcoming' THEN
      RAISE EXCEPTION 'Voting is not open yet. The administrator has set this election as Upcoming.';
    ELSE
      RAISE EXCEPTION 'Voting is closed. This election is not currently active.';
    END IF;
  END IF;

  -- Get voter profile
  SELECT grade_level, section INTO v_profile FROM profiles WHERE user_id = v_user_id LIMIT 1;

  -- Validate each vote
  FOR v_vote IN SELECT * FROM jsonb_array_elements(p_votes)
  LOOP
    v_pos_id := (v_vote->>'position_id')::uuid;
    v_pos_key := v_pos_id::text;

    SELECT * INTO v_position FROM positions WHERE id = v_pos_id;
    IF v_position IS NULL THEN RAISE EXCEPTION 'Invalid position'; END IF;

    v_count := COALESCE((v_votes_by_pos->>v_pos_key)::int, 0) + 1;
    v_votes_by_pos := v_votes_by_pos || jsonb_build_object(v_pos_key, v_count);

    IF v_count > v_position.max_votes THEN
      RAISE EXCEPTION 'You can only vote for up to % candidate(s) for %', v_position.max_votes, v_position.title;
    END IF;

    -- Grade Representative restriction
    IF lower(v_position.title) LIKE '%representative%' THEN
      IF v_profile.grade_level IS NULL THEN
        RAISE EXCEPTION 'Your grade level must be set to vote for Grade Representatives';
      END IF;
      SELECT grade_level INTO v_candidate FROM candidates WHERE id = (v_vote->>'candidate_id')::uuid;
      IF v_candidate IS NULL THEN RAISE EXCEPTION 'Invalid candidate'; END IF;
      IF v_candidate.grade_level != v_profile.grade_level THEN
        RAISE EXCEPTION 'Grade Representatives: you may only vote for candidates from your grade level (%)', v_profile.grade_level;
      END IF;
    END IF;
  END LOOP;

  -- Atomic insert via existing function
  PERFORM submit_votes(v_user_id, p_votes);
  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'You have already voted for one of the selected candidates';
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- STATS & DATA RPCs (Public)
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_get_stats(
  p_voter_grade TEXT DEFAULT NULL, p_voter_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voter_count INT; v_voted_count INT; v_total_votes BIGINT; v_position_count INT;
  v_voter_ids UUID[];
BEGIN
  SELECT array_agg(user_id) INTO v_voter_ids FROM user_roles WHERE role = 'voter';
  IF v_voter_ids IS NULL THEN v_voter_ids := ARRAY[]::UUID[]; END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE has_voted) INTO v_voter_count, v_voted_count
  FROM profiles WHERE user_id = ANY(v_voter_ids) AND archived = false
    AND (p_voter_grade IS NULL OR grade_level = p_voter_grade)
    AND (p_voter_section IS NULL OR section = p_voter_section);

  IF p_voter_grade IS NULL AND p_voter_section IS NULL THEN
    SELECT COUNT(*) INTO v_total_votes FROM votes;
  ELSE
    SELECT COUNT(*) INTO v_total_votes FROM votes v
    JOIN profiles p ON p.user_id = v.voter_id
    WHERE (p_voter_grade IS NULL OR p.grade_level = p_voter_grade)
      AND (p_voter_section IS NULL OR p.section = p_voter_section);
  END IF;

  SELECT COUNT(*) INTO v_position_count FROM positions
  WHERE p_voter_grade IS NULL OR NOT starts_with(title, 'Grade ')
    OR lower(title) LIKE '%' || lower(COALESCE(p_voter_grade, '')) || '%';

  RETURN jsonb_build_object('voterCount', v_voter_count, 'votedCount', v_voted_count,
    'totalVotes', v_total_votes, 'positionCount', v_position_count);
END;
$$;

CREATE OR REPLACE FUNCTION app_get_filtered_vote_counts(
  p_voter_grade TEXT DEFAULT NULL, p_voter_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_voter_grade IS NULL AND p_voter_section IS NULL THEN
    RETURN COALESCE((
      SELECT jsonb_agg(row_to_json(r)::jsonb)
      FROM (SELECT * FROM vote_counts ORDER BY display_order, vote_count DESC) r
    ), '[]'::jsonb);
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(r)::jsonb)
    FROM (
      SELECT c.id AS candidate_id, c.name AS candidate_name, c.position_id,
        c.party_list, c.grade_level, c.section, c.motto,
        p.title AS position_title, p.display_order,
        COALESCE((SELECT COUNT(*)::bigint FROM votes v
          JOIN profiles pr ON pr.user_id = v.voter_id
          WHERE v.candidate_id = c.id
            AND (p_voter_grade IS NULL OR pr.grade_level = p_voter_grade)
            AND (p_voter_section IS NULL OR pr.section = p_voter_section)
        ), 0) AS vote_count
      FROM candidates c JOIN positions p ON c.position_id = p.id
      ORDER BY p.display_order, vote_count DESC
    ) r
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION app_get_voter_groups()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'gradeLevels', COALESCE((
      SELECT jsonb_agg(t.gl) FROM (
        SELECT DISTINCT grade_level AS gl FROM profiles
        WHERE grade_level IS NOT NULL AND grade_level != '' ORDER BY grade_level
      ) t
    ), '[]'::jsonb),
    'sections', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('grade_level', t.grade_level, 'section', t.section))
      FROM (
        SELECT DISTINCT grade_level, section FROM profiles
        WHERE grade_level IS NOT NULL AND grade_level != '' AND section IS NOT NULL AND section != ''
        ORDER BY grade_level, section
      ) t
    ), '[]'::jsonb)
  );
END;
$$;

-- ═════════════════════════════════════════════════════════════════════
-- ELECTION AUTO-SCHEDULER (replaces Express setInterval)
-- ═════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION app_auto_manage_elections()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMP;
  v_election RECORD;
  v_start_dt TIMESTAMP;
  v_end_dt TIMESTAMP;
BEGIN
  v_now := now()::timestamp;

  -- Auto-start upcoming elections
  FOR v_election IN SELECT * FROM election_settings WHERE status = 'upcoming'
  LOOP
    v_start_dt := (v_election.election_date + v_election.voting_start)::timestamp;
    v_end_dt := (v_election.election_date + v_election.voting_end)::timestamp;
    IF v_now >= v_start_dt AND v_now < v_end_dt THEN
      UPDATE election_settings SET status = 'ongoing' WHERE id = v_election.id;
    END IF;
  END LOOP;

  -- Auto-end ongoing elections
  FOR v_election IN SELECT * FROM election_settings WHERE status = 'ongoing'
  LOOP
    IF v_election.auto_end_enabled = false THEN CONTINUE; END IF;
    v_end_dt := (v_election.election_date + v_election.voting_end)::timestamp;
    IF v_now >= v_end_dt THEN
      UPDATE election_settings SET status = 'completed' WHERE id = v_election.id;
    END IF;
  END LOOP;
END;
$$;

-- Schedule via pg_cron (runs every minute)
-- NOTE: Enable pg_cron extension in Supabase Dashboard > Database > Extensions first
-- Then run this:
-- SELECT cron.schedule('auto-manage-elections', '* * * * *', $$SELECT app_auto_manage_elections()$$);

-- ═════════════════════════════════════════════════════════════════════
-- RLS POLICIES (public reads for anon key)
-- ═════════════════════════════════════════════════════════════════════

-- Drop any existing policies first to avoid conflicts
DO $$ BEGIN
  DROP POLICY IF EXISTS "positions_anon_select" ON positions;
  DROP POLICY IF EXISTS "candidates_anon_select" ON candidates;
  DROP POLICY IF EXISTS "election_settings_anon_select" ON election_settings;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Allow public reads
CREATE POLICY "positions_anon_select" ON positions FOR SELECT USING (true);
CREATE POLICY "candidates_anon_select" ON candidates FOR SELECT USING (true);
CREATE POLICY "election_settings_anon_select" ON election_settings FOR SELECT USING (true);

-- ═════════════════════════════════════════════════════════════════════
-- STORAGE POLICIES (candidate photo uploads)
-- ═════════════════════════════════════════════════════════════════════

-- Ensure bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('candidate-photos', 'candidate-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow uploads and reads
DO $$ BEGIN
  DROP POLICY IF EXISTS "candidate_photos_upload" ON storage.objects;
  DROP POLICY IF EXISTS "candidate_photos_read" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "candidate_photos_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'candidate-photos');

CREATE POLICY "candidate_photos_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-photos');

-- ═════════════════════════════════════════════════════════════════════
-- GRANT EXECUTE to anon and authenticated roles
-- ═════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION app_login TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_me TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_change_password TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_list_voters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_add_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_archive_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_list_archived_voters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_restore_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_permanent_delete_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_reset_voter_password TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_reset_all_voted TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_bulk_upload_voters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_add_candidate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_candidate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_archive_candidate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_list_archived_candidates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_restore_candidate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_permanent_delete_candidate TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_bulk_upload_candidates TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_add_position TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_delete_position TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_election_settings TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_submit_votes TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_stats TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_filtered_vote_counts TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_get_voter_groups TO anon, authenticated;
