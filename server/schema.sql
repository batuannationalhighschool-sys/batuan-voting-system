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
