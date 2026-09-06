-- =====================================================================
-- FIX BULK UPLOAD VOTERS & SECTIONS MIGRATION
-- Run this in your Supabase SQL Editor to apply the fix for bulk upload sections
-- =====================================================================

-- 1. Update app_bulk_upload_voters to support UPSERT (updates name, grade_level, section if voter exists)
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

    -- Check if voter already exists by LRN -> UPDATE if exists
    SELECT id INTO v_id FROM users WHERE lrn = v_clean_lrn;
    IF v_id IS NOT NULL THEN
      UPDATE users SET full_name = left(v_name, 100) WHERE id = v_id;

      IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_id) THEN
        UPDATE profiles 
        SET full_name = left(v_name, 100),
            grade_level = COALESCE(left(v_grade, 50), grade_level),
            section = COALESCE(left(v_section, 50), section),
            archived = false
        WHERE user_id = v_id;
      ELSE
        INSERT INTO profiles (id, user_id, full_name, grade_level, section, archived)
        VALUES (gen_random_uuid(), v_id, left(v_name, 100), left(v_grade, 50), left(v_section, 50), false);
      END IF;

      IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = v_id AND role = 'voter') THEN
        INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), v_id, 'voter');
      END IF;

      v_updated := v_updated + 1;
      CONTINUE;
    END IF;

    -- If new voter -> INSERT
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
    'errorList', v_error_list
  );
END;
$$;

-- 2. Update app_add_voter
CREATE OR REPLACE FUNCTION app_add_voter(
  p_token TEXT, p_lrn TEXT, p_full_name TEXT,
  p_grade_level TEXT DEFAULT NULL, p_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id UUID;
  v_id UUID;
  v_clean_lrn TEXT;
  v_name TEXT;
  v_grade TEXT;
  v_section TEXT;
BEGIN
  v_admin_id := require_admin(p_token);
  IF p_lrn IS NULL OR p_full_name IS NULL THEN RAISE EXCEPTION 'LRN and full name are required'; END IF;
  v_clean_lrn := regexp_replace(p_lrn, '\D', '', 'g');
  IF v_clean_lrn !~ '^\d{12}$' THEN RAISE EXCEPTION 'LRN must be exactly 12 digits (numbers only)'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lrn = v_clean_lrn) THEN RAISE EXCEPTION 'LRN already registered'; END IF;

  v_name := trim(p_full_name);
  v_grade := NULLIF(trim(p_grade_level), '');
  v_section := NULLIF(trim(p_section), '');

  v_id := gen_random_uuid();
  INSERT INTO users (id, lrn, password_hash, full_name, must_change_password)
  VALUES (v_id, v_clean_lrn, crypt(v_clean_lrn, gen_salt('bf', 10)), left(v_name, 100), true);

  INSERT INTO profiles (id, user_id, full_name, grade_level, section, archived)
  VALUES (gen_random_uuid(), v_id, left(v_name, 100), left(v_grade, 50), left(v_section, 50), false);

  INSERT INTO user_roles (id, user_id, role) VALUES (gen_random_uuid(), v_id, 'voter');

  RETURN jsonb_build_object('id', v_id, 'lrn', v_clean_lrn, 'full_name', v_name,
    'grade_level', v_grade, 'section', v_section);
END;
$$;

-- 3. Update app_update_voter
CREATE OR REPLACE FUNCTION app_update_voter(
  p_token TEXT, p_id TEXT, p_lrn TEXT, p_full_name TEXT,
  p_grade_level TEXT DEFAULT NULL, p_section TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE 
  v_admin_id UUID; 
  v_vid UUID;
  v_clean_lrn TEXT;
  v_name TEXT;
  v_grade TEXT;
  v_section TEXT;
BEGIN
  v_admin_id := require_admin(p_token);
  v_vid := p_id::uuid;
  IF p_lrn IS NULL OR p_full_name IS NULL THEN RAISE EXCEPTION 'LRN and full name are required'; END IF;
  v_clean_lrn := regexp_replace(p_lrn, '\D', '', 'g');
  IF v_clean_lrn !~ '^\d{12}$' THEN RAISE EXCEPTION 'LRN must be exactly 12 digits (numbers only)'; END IF;
  IF EXISTS (SELECT 1 FROM users WHERE lrn = v_clean_lrn AND id != v_vid) THEN RAISE EXCEPTION 'LRN already in use by another account'; END IF;

  v_name := trim(p_full_name);
  v_grade := NULLIF(trim(p_grade_level), '');
  v_section := NULLIF(trim(p_section), '');

  UPDATE users SET lrn = v_clean_lrn, full_name = left(v_name, 100) WHERE id = v_vid;
  
  IF EXISTS (SELECT 1 FROM profiles WHERE user_id = v_vid) THEN
    UPDATE profiles 
    SET full_name = left(v_name, 100), 
        grade_level = left(v_grade, 50), 
        section = left(v_section, 50) 
    WHERE user_id = v_vid;
  ELSE
    INSERT INTO profiles (id, user_id, full_name, grade_level, section, archived)
    VALUES (gen_random_uuid(), v_vid, left(v_name, 100), left(v_grade, 50), left(v_section, 50), false);
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Update app_list_voters with LEFT JOIN to safeguard missing profiles
CREATE OR REPLACE FUNCTION app_list_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_admin_id UUID;
BEGIN
  v_admin_id := require_admin(p_token);
  RETURN COALESCE((
    SELECT jsonb_agg(r ORDER BY r->>'created_at' DESC)
    FROM (
      SELECT jsonb_build_object(
        'id', u.id, 'lrn', u.lrn, 'full_name', u.full_name,
        'must_change_password', u.must_change_password, 'created_at', u.created_at,
        'grade_level', p.grade_level, 'section', p.section, 'has_voted', COALESCE(p.has_voted, false)
      ) AS r
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'voter'
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE COALESCE(p.archived, false) = false
    ) sub
  ), '[]'::jsonb);
END;
$$;

-- 5. Grant permissions
GRANT EXECUTE ON FUNCTION app_bulk_upload_voters TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_add_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_update_voter TO anon, authenticated;
GRANT EXECUTE ON FUNCTION app_list_voters TO anon, authenticated;
