-- =================================================================
-- Remove GRADE 11 - ACADEMIC KNOWLEDGE from Batuan Voting System (Live Database)
-- Permanently deletes all Grade 11 - ACADEMIC KNOWLEDGE voters & profiles
-- =================================================================

-- Step 1: Delete votes from Grade 11 Academic Knowledge voters
DELETE FROM votes
WHERE voter_id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.section = 'GRADE 11 - ACADEMIC KNOWLEDGE'
);

-- Step 2: Delete candidates in Grade 11 Academic Knowledge
DELETE FROM candidates
WHERE section = 'GRADE 11 - ACADEMIC KNOWLEDGE';

-- Step 3: Delete Grade 11 Academic Knowledge voter profiles
DELETE FROM profiles
WHERE section = 'GRADE 11 - ACADEMIC KNOWLEDGE';

-- Step 4: Delete users associated with Grade 11 Academic Knowledge (keep admin)
DELETE FROM users
WHERE id IN (
  SELECT p.user_id
  FROM profiles p
  WHERE p.section = 'GRADE 11 - ACADEMIC KNOWLEDGE'
  AND lrn != 'admin'
);

-- Step 5: Delete election history entries if any
DELETE FROM election_results_archive
WHERE candidate_section = 'GRADE 11 - ACADEMIC KNOWLEDGE';

DELETE FROM election_voter_groups_archive
WHERE voter_section = 'GRADE 11 - ACADEMIC KNOWLEDGE';

DELETE FROM election_results_voter_breakdown
WHERE voter_section = 'GRADE 11 - ACADEMIC KNOWLEDGE';

-- Step 6: Verify cleanup
SELECT
  (SELECT COUNT(*) FROM profiles WHERE section = 'GRADE 11 - ACADEMIC KNOWLEDGE') as remaining_academic_knowledge_profiles,
  (SELECT COUNT(*) FROM candidates WHERE section = 'GRADE 11 - ACADEMIC KNOWLEDGE') as remaining_academic_knowledge_candidates;
