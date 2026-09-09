-- =====================================================================
-- Rename Grade 11 LOVE to ACADEMIC - LOVE in Supabase Database
-- Batuan National High School Voting System
-- =====================================================================

-- 1. Update voter profiles
UPDATE profiles
SET section = 'ACADEMIC - LOVE'
WHERE grade_level = 'Grade 11'
  AND (section ILIKE '%love%');

-- 2. Update candidates if any
UPDATE candidates
SET section = 'ACADEMIC - LOVE'
WHERE grade_level = 'Grade 11'
  AND (section ILIKE '%love%');

-- 3. Update election results archive if any
UPDATE election_results_archive
SET candidate_section = 'ACADEMIC - LOVE'
WHERE candidate_grade = 'Grade 11'
  AND (candidate_section ILIKE '%love%');

UPDATE election_voter_groups_archive
SET voter_section = 'ACADEMIC - LOVE'
WHERE voter_grade = 'Grade 11'
  AND (voter_section ILIKE '%love%');

UPDATE election_results_voter_breakdown
SET voter_section = 'ACADEMIC - LOVE'
WHERE voter_grade = 'Grade 11'
  AND (voter_section ILIKE '%love%');

-- 4. Verification query
SELECT grade_level, section, COUNT(*) as voter_count
FROM profiles
WHERE grade_level = 'Grade 11'
GROUP BY grade_level, section
ORDER BY section;
