-- =====================================================================
-- Rename Peace Officer to Protocol Officer in Supabase Database
-- Batuan National High School Voting System
-- =====================================================================

-- 1. Update positions table
UPDATE positions
SET title = 'Protocol Officer'
WHERE title = 'Peace Officer';

-- 2. Update election results archive if any
UPDATE election_results_archive
SET position_title = 'Protocol Officer'
WHERE position_title = 'Peace Officer';

-- 3. Verification query
SELECT id, title, display_order, max_votes
FROM positions
ORDER BY display_order;
