-- =====================================================================
-- FIX: Huwag nang i-overwrite ang existing LRN sa bulk upload
-- Dati: UPSERT — kapag ang LRN ay nag-exist na, ina-UPDATE ang pangalan,
-- grade, at section (kaya nare-rewrite ang unang may-ari).
-- Ngayon: SKIP — ang unang may-ari ng LRN ang mananatili. Ang duplicate
-- ay ilalagay sa skippedList + errorList bilang trapping.
--
-- Paano gamitin:
-- 1. Buksan ang Supabase Dashboard > SQL Editor
-- 2. I-paste ang buong file na ito at i-Run
-- =====================================================================

CREATE OR REPLACE FUNCTION app_bulk_upload_voters(p_token TEXT, p_voters JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_row JSONB;
  v_clean_lrn TEXT;
  v_name TEXT;
  v_grade TEXT;
  v_section TEXT;
  v_id UUID;
  v_inserted INT := 0;
  v_updated INT := 0;
  v_skipped INT := 0;
  v_errors INT := 0;
  v_skipped_list JSONB := '[]'::jsonb;
  v_error_list JSONB := '[]'::jsonb;
  v_idx INT := 0;
  v_seen_lrns TEXT[] := '{}';
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

    v_name := trim(v_row->>'full_name');
    v_grade := NULLIF(trim(v_row->>'grade_level'), '');
    v_section := NULLIF(trim(v_row->>'section'), '');

    -- TRAPPING 1: duplicate LRN sa loob mismo ng ini-upload na batch.
    IF v_clean_lrn = ANY(v_seen_lrns) THEN
      v_skipped := v_skipped + 1;
      v_skipped_list := v_skipped_list || jsonb_build_array(jsonb_build_object('lrn', v_clean_lrn, 'full_name', left(v_name, 100)));
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'lrn', v_clean_lrn, 'reason', 'Duplicate LRN inside the uploaded file — first occurrence kept'));
      CONTINUE;
    END IF;
    v_seen_lrns := v_seen_lrns || v_clean_lrn;

    -- TRAPPING 2: kapag ang LRN ay nag-e-exist na sa system, HUWAG i-overwrite.
    SELECT id INTO v_id FROM users WHERE lrn = v_clean_lrn;
    IF v_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      v_skipped_list := v_skipped_list || jsonb_build_array(jsonb_build_object('lrn', v_clean_lrn, 'full_name', left(v_name, 100)));
      v_errors := v_errors + 1;
      v_error_list := v_error_list || jsonb_build_array(jsonb_build_object('row', 'Row ' || v_idx, 'lrn', v_clean_lrn, 'reason', 'LRN already registered — original record kept, new data skipped'));
      CONTINUE;
    END IF;

    -- Kung bagong LRN lang saka mag-INSERT
    v_id := gen_random_uuid();
    INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
    VALUES (v_id, v_clean_lrn, crypt(v_clean_lrn, gen_salt('bf', 10)), left(v_name, 100), true);

    INSERT INTO profiles (id, user_id, full_name, grade_level, section, archived)
    VALUES (gen_random_uuid(), v_id, left(v_name, 100), left(v_grade, 50), left(v_section, 50), false);

    INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), v_id, 'voter');
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'skipped', v_skipped,
    'errors', v_errors,
    'skippedList', v_skipped_list,
    'errorList', v_error_list,
    'updatedList', '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION app_bulk_upload_voters TO anon, authenticated;

-- Tandaan: ang single "Add New Voter" (app_add_voter) ay may trapping na:
--   IF EXISTS (...) THEN RAISE EXCEPTION 'LRN already registered'
-- kaya hindi nito nare-rewrite ang existing. Ang bulk lang ang dating nag-UPSERT.
