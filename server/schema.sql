-- Batuan Voting System — MySQL Schema
-- Run this file to create the database and all tables
-- SSLG Elections only

CREATE DATABASE IF NOT EXISTS batuan_voting CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batuan_voting;

-- Users table (login via LRN for students, username for admin)
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  lrn VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User roles
CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('admin', 'voter') NOT NULL,
  UNIQUE KEY uq_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  student_id VARCHAR(50) DEFAULT NULL,
  grade_level VARCHAR(50) DEFAULT NULL,
  section VARCHAR(50) DEFAULT NULL,
  has_voted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Positions
CREATE TABLE IF NOT EXISTS positions (
  id CHAR(36) PRIMARY KEY,
  title VARCHAR(100) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  max_votes INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Candidates
CREATE TABLE IF NOT EXISTS candidates (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  position_id CHAR(36) NOT NULL,
  grade_level VARCHAR(50) NOT NULL,
  section VARCHAR(50) NOT NULL,
  party_list VARCHAR(100) NOT NULL,
  motto VARCHAR(200) DEFAULT NULL,
  avatar_url VARCHAR(500) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- Votes (unique per voter + candidate)
CREATE TABLE IF NOT EXISTS votes (
  id CHAR(36) PRIMARY KEY,
  voter_id CHAR(36) NOT NULL,
  candidate_id CHAR(36) NOT NULL,
  position_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_voter_candidate (voter_id, candidate_id),
  FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
);

-- Election settings
CREATE TABLE IF NOT EXISTS election_settings (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL DEFAULT 'SSLG Election 2026',
  school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  election_date DATE NOT NULL DEFAULT '2026-03-15',
  voting_start TIME NOT NULL DEFAULT '08:00:00',
  voting_end TIME NOT NULL DEFAULT '16:00:00',
  status ENUM('upcoming', 'ongoing', 'completed') NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Vote counts view
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

-- Seed: default SSLG election settings
INSERT INTO election_settings (id, name, school_year, election_date, status)
VALUES (UUID(), 'SSLG Election 2026', '2025-2026', '2026-03-15', 'ongoing');

-- Seed: default SSLG positions
-- max_votes = 2 for P.I.O. and Peace Officer (voters elect 2 per position)
INSERT INTO positions (id, title, display_order, max_votes) VALUES
  (UUID(), 'President',                  1, 1),
  (UUID(), 'Vice President',             2, 1),
  (UUID(), 'Secretary',                  3, 1),
  (UUID(), 'Treasurer',                  4, 1),
  (UUID(), 'Auditor',                    5, 1),
  (UUID(), 'Public Information Officer', 6, 2),
  (UUID(), 'Peace Officer',              7, 2),
  (UUID(), 'Grade 7 Representative',     8, 1),
  (UUID(), 'Grade 8 Representative',     9, 1),
  (UUID(), 'Grade 9 Representative',    10, 1),
  (UUID(), 'Grade 10 Representative',   11, 1),
  (UUID(), 'Grade 11 Representative',   12, 1),
  (UUID(), 'Grade 12 Representative',   13, 1);

-- Seed: default admin user (username: admin, password: admin123)
-- bcrypt hash for 'admin123'
SET @admin_id = UUID();
INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
VALUES (@admin_id, 'admin', '$2a$10$qJuWvaZPekXNKtP8hr60SeYNgdeZVoze0/nRIQxgmWrglNH7ObvY.', 'Administrator', FALSE);

INSERT INTO profiles (id, user_id, full_name)
VALUES (UUID(), @admin_id, 'Administrator');

INSERT INTO user_roles (id, user_id, role)
VALUES (UUID(), @admin_id, 'admin');
