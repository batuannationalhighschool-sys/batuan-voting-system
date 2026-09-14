-- Candidate identity must come from an active voter profile, never editable client fields.
-- Existing candidates are deliberately retained as legacy rows when no unambiguous profile
-- match exists. New candidates always receive student_user_id.

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS student_user_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'candidates_student_user_id_fkey'
      AND conrelid = 'public.candidates'::regclass
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_student_user_id_fkey
      FOREIGN KEY (student_user_id) REFERENCES public.users(id) ON DELETE RESTRICT;
  END IF;
END;
$$;

-- Backfill only exact, unambiguous active-profile matches. Never guess.
WITH exact_profiles AS (
  SELECT
    p.user_id,
    lower(btrim(p.full_name)) AS full_name,
    lower(btrim(p.grade_level)) AS grade_level,
    lower(btrim(p.section)) AS section
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'voter'
  WHERE p.archived = false
    AND NULLIF(btrim(p.full_name), '') IS NOT NULL
    AND NULLIF(btrim(p.grade_level), '') IS NOT NULL
    AND NULLIF(btrim(p.section), '') IS NOT NULL
), unambiguous_profiles AS (
  SELECT full_name, grade_level, section, (array_agg(user_id ORDER BY user_id))[1] AS user_id
  FROM exact_profiles
  GROUP BY full_name, grade_level, section
  HAVING count(*) = 1
)
UPDATE public.candidates c
SET student_user_id = p.user_id
FROM unambiguous_profiles p
WHERE c.student_user_id IS NULL
  AND lower(btrim(c.name)) = p.full_name
  AND lower(btrim(c.grade_level)) = p.grade_level
  AND lower(btrim(c.section)) = p.section;

CREATE UNIQUE INDEX IF NOT EXISTS candidates_one_active_candidate_per_student
  ON public.candidates (student_user_id)
  WHERE student_user_id IS NOT NULL AND archived = false;

CREATE OR REPLACE FUNCTION public.enforce_candidate_student_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student RECORD;
BEGIN
  -- Legacy candidates have no reliable source record and are retained unchanged.
  IF NEW.student_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.full_name, p.grade_level, p.section
  INTO v_student
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = 'voter'
  WHERE p.user_id = NEW.student_user_id
    AND p.archived = false
    AND NULLIF(btrim(p.full_name), '') IS NOT NULL
    AND NULLIF(btrim(p.grade_level), '') IS NOT NULL
    AND NULLIF(btrim(p.section), '') IS NOT NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected student is not active and eligible';
  END IF;

  -- Database, not the browser, owns these values.
  NEW.name := left(btrim(v_student.full_name), 100);
  NEW.grade_level := left(btrim(v_student.grade_level), 50);
  NEW.section := left(btrim(v_student.section), 50);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_candidate_student_identity ON public.candidates;
CREATE TRIGGER enforce_candidate_student_identity
  BEFORE INSERT OR UPDATE OF student_user_id, name, grade_level, section
  ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_candidate_student_identity();

CREATE OR REPLACE FUNCTION public.sync_candidate_identity_from_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  UPDATE public.candidates
  SET name = NEW.full_name,
      grade_level = NEW.grade_level,
      section = NEW.section
  WHERE student_user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_candidate_identity_from_profile ON public.profiles;
CREATE TRIGGER sync_candidate_identity_from_profile
  AFTER UPDATE OF full_name, grade_level, section ON public.profiles
  FOR EACH ROW
  WHEN (
    OLD.full_name IS DISTINCT FROM NEW.full_name OR
    OLD.grade_level IS DISTINCT FROM NEW.grade_level OR
    OLD.section IS DISTINCT FROM NEW.section
  )
  EXECUTE FUNCTION public.sync_candidate_identity_from_profile();

CREATE OR REPLACE FUNCTION public.app_search_eligible_students(
  p_token TEXT,
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_query TEXT := lower(btrim(COALESCE(p_query, '')));
  v_limit INTEGER := least(greatest(COALESCE(p_limit, 10), 1), 20);
BEGIN
  PERFORM public.require_admin(p_token);
  IF char_length(v_query) < 2 THEN
    RAISE EXCEPTION 'Enter at least 2 characters to search students';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(s)::jsonb ORDER BY s.full_name, s.student_id)
    FROM (
      SELECT u.id AS user_id, u.lrn AS student_id, p.full_name, p.grade_level, p.section
      FROM public.users u
      JOIN public.profiles p ON p.user_id = u.id
      JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
      WHERE p.archived = false
        AND NULLIF(btrim(p.full_name), '') IS NOT NULL
        AND NULLIF(btrim(p.grade_level), '') IS NOT NULL
        AND NULLIF(btrim(p.section), '') IS NOT NULL
        AND (
          strpos(lower(u.lrn), v_query) > 0 OR
          strpos(lower(p.full_name), v_query) > 0
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.candidates c
          WHERE c.student_user_id = u.id AND c.archived = false
        )
      ORDER BY p.full_name, u.lrn
      LIMIT v_limit
    ) s
  ), '[]'::jsonb);
END;
$$;

-- Keep the former free-form RPC as a safe, explicit rejection for stale clients.
CREATE OR REPLACE FUNCTION public.app_add_candidate(
  p_token TEXT, p_name TEXT, p_position_id TEXT, p_grade_level TEXT,
  p_section TEXT, p_party_list TEXT, p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.require_admin(p_token);
  RAISE EXCEPTION 'Select an existing student before adding a candidate';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_add_candidate(
  p_token TEXT, p_student_user_id TEXT, p_position_id TEXT,
  p_party_list TEXT, p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_student RECORD;
  v_candidate public.candidates%ROWTYPE;
BEGIN
  PERFORM public.require_admin(p_token);
  IF COALESCE(btrim(p_student_user_id), '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A selected student is required';
  END IF;
  IF COALESCE(btrim(p_position_id), '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A valid position is required';
  END IF;
  IF NULLIF(btrim(p_party_list), '') IS NULL THEN
    RAISE EXCEPTION 'Party list is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.positions WHERE id = p_position_id::uuid) THEN
    RAISE EXCEPTION 'Selected position does not exist';
  END IF;

  SELECT u.id AS user_id, p.full_name, p.grade_level, p.section
  INTO v_student
  FROM public.users u
  JOIN public.profiles p ON p.user_id = u.id
  JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
  WHERE u.id = p_student_user_id::uuid
    AND p.archived = false
    AND NULLIF(btrim(p.full_name), '') IS NOT NULL
    AND NULLIF(btrim(p.grade_level), '') IS NOT NULL
    AND NULLIF(btrim(p.section), '') IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected student is not active and eligible';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.candidates c
    WHERE c.archived = false
      AND (
        c.student_user_id = v_student.user_id OR
        (c.student_user_id IS NULL AND lower(btrim(c.name)) = lower(btrim(v_student.full_name))
         AND lower(btrim(c.grade_level)) = lower(btrim(v_student.grade_level))
         AND lower(btrim(c.section)) = lower(btrim(v_student.section)))
      )
  ) THEN
    RAISE EXCEPTION 'This student is already an active candidate';
  END IF;

  INSERT INTO public.candidates (
    student_user_id, name, position_id, grade_level, section, party_list, motto, avatar_url
  ) VALUES (
    v_student.user_id, v_student.full_name, p_position_id::uuid,
    v_student.grade_level, v_student.section, left(btrim(p_party_list), 100),
    NULLIF(left(btrim(COALESCE(p_motto, '')), 200), ''), p_avatar_url
  ) RETURNING * INTO v_candidate;

  RETURN row_to_json(v_candidate)::jsonb;
END;
$$;

-- Old update calls carry editable identity fields and must not bypass canonical data.
CREATE OR REPLACE FUNCTION public.app_update_candidate(
  p_token TEXT, p_id TEXT, p_name TEXT, p_position_id TEXT, p_grade_level TEXT,
  p_section TEXT, p_party_list TEXT, p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.require_admin(p_token);
  RAISE EXCEPTION 'Candidate identity is read-only; submit only position and campaign details';
END;
$$;

CREATE OR REPLACE FUNCTION public.app_update_candidate(
  p_token TEXT, p_id TEXT, p_position_id TEXT, p_party_list TEXT,
  p_motto TEXT DEFAULT NULL, p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_candidate public.candidates%ROWTYPE;
BEGIN
  PERFORM public.require_admin(p_token);
  IF COALESCE(btrim(p_id), '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'Invalid candidate';
  END IF;
  IF COALESCE(btrim(p_position_id), '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RAISE EXCEPTION 'A valid position is required';
  END IF;
  IF NULLIF(btrim(p_party_list), '') IS NULL THEN
    RAISE EXCEPTION 'Party list is required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.positions WHERE id = p_position_id::uuid) THEN
    RAISE EXCEPTION 'Selected position does not exist';
  END IF;

  UPDATE public.candidates
  SET position_id = p_position_id::uuid,
      party_list = left(btrim(p_party_list), 100),
      motto = NULLIF(left(btrim(COALESCE(p_motto, '')), 200), ''),
      avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = p_id::uuid
  RETURNING * INTO v_candidate;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  RETURN row_to_json(v_candidate)::jsonb;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_bulk_upload_candidates(p_token TEXT, p_candidates JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row JSONB; v_student RECORD; v_position_id UUID;
  v_student_id TEXT; v_position TEXT; v_party TEXT; v_motto TEXT;
  v_name TEXT; v_grade TEXT; v_section TEXT;
  v_inserted INT := 0; v_skipped INT := 0; v_errors INT := 0; v_idx INT := 0;
  v_skipped_list JSONB := '[]'::jsonb; v_error_list JSONB := '[]'::jsonb;
BEGIN
  PERFORM public.require_admin(p_token);
  IF p_candidates IS NULL OR jsonb_typeof(p_candidates) <> 'array' THEN
    RAISE EXCEPTION 'Candidates must be a JSON array';
  END IF;

  FOR v_row IN SELECT * FROM jsonb_array_elements(p_candidates) LOOP
    v_idx := v_idx + 1;
    v_student_id := btrim(COALESCE(v_row->>'student_id', v_row->>'lrn', ''));
    v_position := btrim(COALESCE(v_row->>'position', ''));
    v_party := btrim(COALESCE(v_row->>'party_list', ''));
    v_motto := btrim(COALESCE(v_row->>'motto', ''));
    v_name := NULLIF(btrim(COALESCE(v_row->>'name', '')), '');
    v_grade := NULLIF(btrim(COALESCE(v_row->>'grade_level', '')), '');
    v_section := NULLIF(btrim(COALESCE(v_row->>'section', '')), '');

    IF v_student_id = '' OR v_position = '' OR v_party = '' THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'reason', 'Student ID, position, and party list are required'));
      CONTINUE;
    END IF;

    SELECT u.id AS user_id, p.full_name, p.grade_level, p.section
    INTO v_student
    FROM public.users u
    JOIN public.profiles p ON p.user_id = u.id
    JOIN public.user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
    WHERE u.lrn = v_student_id AND p.archived = false
      AND NULLIF(btrim(p.full_name), '') IS NOT NULL
      AND NULLIF(btrim(p.grade_level), '') IS NOT NULL
      AND NULLIF(btrim(p.section), '') IS NOT NULL;
    IF NOT FOUND THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'student_id', v_student_id, 'reason', 'Student does not exist or is not active and eligible'));
      CONTINUE;
    END IF;

    IF (v_name IS NOT NULL AND lower(v_name) <> lower(btrim(v_student.full_name)))
       OR (v_grade IS NOT NULL AND lower(v_grade) <> lower(btrim(v_student.grade_level)))
       OR (v_section IS NOT NULL AND lower(v_section) <> lower(btrim(v_student.section))) THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'student_id', v_student_id, 'reason', 'Submitted name, grade, or section does not match the official student record'));
      CONTINUE;
    END IF;

    SELECT id INTO v_position_id FROM public.positions WHERE lower(btrim(title)) = lower(v_position);
    IF v_position_id IS NULL THEN
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'student_id', v_student_id, 'reason', 'Position does not exist'));
      CONTINUE;
    END IF;

    IF EXISTS (SELECT 1 FROM public.candidates c WHERE c.archived = false AND c.student_user_id = v_student.user_id) THEN
      v_skipped := v_skipped + 1;
      v_skipped_list := v_skipped_list || jsonb_build_array(jsonb_build_object('student_id', v_student_id, 'name', v_student.full_name));
      CONTINUE;
    END IF;

    INSERT INTO public.candidates (student_user_id, name, position_id, grade_level, section, party_list, motto)
    VALUES (v_student.user_id, v_student.full_name, v_position_id, v_student.grade_level, v_student.section,
      left(v_party, 100), NULLIF(left(v_motto, 200), ''));
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('inserted', v_inserted, 'skipped', v_skipped, 'errors', v_errors,
    'skippedList', v_skipped_list, 'errorList', v_error_list);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_restore_candidate(p_token TEXT, p_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_student_user_id UUID;
BEGIN
  PERFORM public.require_admin(p_token);
  SELECT student_user_id INTO v_student_user_id FROM public.candidates WHERE id = p_id::uuid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Candidate not found'; END IF;
  IF v_student_user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.candidates
    WHERE student_user_id = v_student_user_id AND archived = false AND id <> p_id::uuid
  ) THEN
    RAISE EXCEPTION 'This student is already an active candidate';
  END IF;
  UPDATE public.candidates SET archived = false, archived_at = NULL WHERE id = p_id::uuid;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.app_list_public_candidates()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'name', c.name, 'position_id', c.position_id,
    'grade_level', c.grade_level, 'section', c.section,
    'party_list', c.party_list, 'motto', c.motto,
    'avatar_url', c.avatar_url, 'created_at', c.created_at
  ) ORDER BY c.created_at, c.id), '[]'::jsonb)
  FROM public.candidates c
  WHERE c.archived = false;
$$;

-- Prevent direct REST reads from disclosing the internal student account link.
DROP POLICY IF EXISTS candidates_anon_select ON public.candidates;
REVOKE SELECT ON TABLE public.candidates FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.app_search_eligible_students(TEXT, TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_add_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_add_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_update_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_update_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_bulk_upload_candidates(TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_restore_candidate(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_list_public_candidates() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.app_search_eligible_students(TEXT, TEXT, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_add_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_add_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_update_candidate(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_bulk_upload_candidates(TEXT, JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_restore_candidate(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_list_public_candidates() TO anon, authenticated;
