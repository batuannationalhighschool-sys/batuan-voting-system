-- =====================================================================
-- Remove Grade 8 CARNATION from Batuan Voting System (Live Database)
-- Permanently deletes all Grade 8 CARNATION voters, profiles, and candidates
-- =====================================================================

-- Step 1: Delete votes from Grade 8 Carnation voters
DELETE FROM votes
WHERE voter_id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.grade_level = 'Grade 8' AND p.section ILIKE '%carnation%'
);

-- Step 2: Delete votes for Grade 8 Carnation candidates
DELETE FROM votes
WHERE candidate_id IN (
  SELECT id
  FROM candidates
  WHERE grade_level = 'Grade 8' AND section ILIKE '%carnation%'
);

-- Step 3: Delete Grade 8 Carnation candidates
DELETE FROM candidates
WHERE grade_level = 'Grade 8' AND section ILIKE '%carnation%';

-- Step 4: Delete Grade 8 Carnation voter profiles
DELETE FROM profiles
WHERE grade_level = 'Grade 8' AND section ILIKE '%carnation%';

-- Step 5: Delete users associated with Grade 8 Carnation (keep admin)
DELETE FROM users
WHERE id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.grade_level = 'Grade 8' AND p.section ILIKE '%carnation%'
  AND lrn != 'admin'
);

-- Step 6: Clean up archives if any
DELETE FROM election_results_archive
WHERE candidate_section ILIKE '%carnation%';

DELETE FROM election_voter_groups_archive
WHERE voter_section ILIKE '%carnation%';

DELETE FROM election_results_voter_breakdown
WHERE voter_section ILIKE '%carnation%';
