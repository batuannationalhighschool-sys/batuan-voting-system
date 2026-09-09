-- =====================================================================
-- FIX: Keep CARNATION section exclusively for Grade 8
-- Batuan National High School Voting System
-- =====================================================================

-- 1. Allow section column in candidates table to be NULL
ALTER TABLE candidates ALTER COLUMN section DROP NOT NULL;

-- 2. Clear CARNATION from candidates that are not in Grade 8
UPDATE candidates
SET section = NULL
WHERE grade_level != 'Grade 8'
  AND section = 'CARNATION';

-- 3. Verify sections per grade level
SELECT DISTINCT grade_level, section
FROM candidates
WHERE section IS NOT NULL AND section != ''
ORDER BY grade_level, section;
