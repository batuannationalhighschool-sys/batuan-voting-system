-- =================================================================
-- Remove Grade 12 from Batuan Voting System (Live Database)
-- This will permanently delete all Grade 12 data
-- =================================================================

-- Step 1: Delete votes from Grade 12 voters
DELETE FROM votes
WHERE voter_id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.grade_level = 'Grade 12'
);

-- Step 2: Delete Grade 12 candidates
DELETE FROM candidates
WHERE grade_level = 'Grade 12';

-- Step 3: Delete Grade 12 voter profiles
DELETE FROM profiles
WHERE grade_level = 'Grade 12';

-- Step 4: Delete Grade 12 users (voters only - keep admin user)
DELETE FROM users
WHERE id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.grade_level = 'Grade 12'
  AND lrn != 'admin'
);

-- Step 5: Delete election history entries that include Grade 12 candidates
DELETE FROM election_results_archive
WHERE candidate_grade = 'Grade 12';

-- Step 6: Delete voter groups archive entries for Grade 12
DELETE FROM election_voter_groups_archive
WHERE voter_grade = 'Grade 12';

-- Step 7: Clean up any remaining Grade 12 references in the archive tables
DELETE FROM election_results_voter_breakdown
WHERE voter_grade = 'Grade 12';

-- Step 8: Verify cleanup
SELECT
  (SELECT COUNT(*) FROM profiles WHERE grade_level = 'Grade 12') as remaining_grade12_profiles,
  (SELECT COUNT(*) FROM candidates WHERE grade_level = 'Grade 12') as remaining_grade12_candidates,
  (SELECT COUNT(*) FROM election_results_archive WHERE candidate_grade = 'Grade 12') as remaining_grade12_history;