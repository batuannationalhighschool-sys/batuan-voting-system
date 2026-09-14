-- Bulk operations for Archive and Voters
-- 1. Restore all archived candidates
CREATE OR REPLACE FUNCTION public.app_restore_all_candidates(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  v_admin_id := public.require_admin(p_token);
  UPDATE public.candidates
  SET archived = false, archived_at = null
  WHERE archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'restored_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_restore_all_candidates(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_restore_all_candidates(TEXT) TO anon, authenticated;

-- 2. Restore selected archived candidates
CREATE OR REPLACE FUNCTION public.app_restore_selected_candidates(p_token TEXT, p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
  v_uuids UUID[];
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No candidate IDs provided';
  END IF;

  v_uuids := p_ids::UUID[];
  UPDATE public.candidates
  SET archived = false, archived_at = null
  WHERE id = ANY(v_uuids) AND archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'restored_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_restore_selected_candidates(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_restore_selected_candidates(TEXT, TEXT[]) TO anon, authenticated;

-- 3. Permanent delete all archived candidates
CREATE OR REPLACE FUNCTION public.app_permanent_delete_all_candidates(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  v_admin_id := public.require_admin(p_token);
  DELETE FROM public.candidates
  WHERE archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_permanent_delete_all_candidates(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_permanent_delete_all_candidates(TEXT) TO anon, authenticated;

-- 4. Permanent delete selected archived candidates
CREATE OR REPLACE FUNCTION public.app_permanent_delete_selected_candidates(p_token TEXT, p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
  v_uuids UUID[];
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No candidate IDs provided';
  END IF;

  v_uuids := p_ids::UUID[];
  DELETE FROM public.candidates
  WHERE id = ANY(v_uuids) AND archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_permanent_delete_selected_candidates(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_permanent_delete_selected_candidates(TEXT, TEXT[]) TO anon, authenticated;

-- 5. Restore all archived voters
CREATE OR REPLACE FUNCTION public.app_restore_all_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  v_admin_id := public.require_admin(p_token);
  UPDATE public.profiles
  SET archived = false, archived_at = null
  WHERE archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'restored_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_restore_all_voters(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_restore_all_voters(TEXT) TO anon, authenticated;

-- 6. Restore selected archived voters
CREATE OR REPLACE FUNCTION public.app_restore_selected_voters(p_token TEXT, p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
  v_uuids UUID[];
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No voter IDs provided';
  END IF;

  v_uuids := p_ids::UUID[];
  UPDATE public.profiles
  SET archived = false, archived_at = null
  WHERE user_id = ANY(v_uuids) AND archived = true;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'restored_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_restore_selected_voters(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_restore_selected_voters(TEXT, TEXT[]) TO anon, authenticated;

-- 7. Permanent delete all archived voters
CREATE OR REPLACE FUNCTION public.app_permanent_delete_all_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  v_admin_id := public.require_admin(p_token);
  DELETE FROM public.users
  WHERE id IN (SELECT user_id FROM public.profiles WHERE archived = true);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_permanent_delete_all_voters(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_permanent_delete_all_voters(TEXT) TO anon, authenticated;

-- 8. Permanent delete selected archived voters
CREATE OR REPLACE FUNCTION public.app_permanent_delete_selected_voters(p_token TEXT, p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
  v_uuids UUID[];
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No voter IDs provided';
  END IF;

  v_uuids := p_ids::UUID[];
  DELETE FROM public.users
  WHERE id = ANY(v_uuids)
    AND id IN (SELECT user_id FROM public.profiles WHERE archived = true);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'deleted_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_permanent_delete_selected_voters(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_permanent_delete_selected_voters(TEXT, TEXT[]) TO anon, authenticated;

-- 9. Archive all active voters
CREATE OR REPLACE FUNCTION public.app_archive_all_voters(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
BEGIN
  v_admin_id := public.require_admin(p_token);
  UPDATE public.profiles
  SET archived = true, archived_at = now()
  WHERE archived = false
    AND user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'voter');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'archived_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_archive_all_voters(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_archive_all_voters(TEXT) TO anon, authenticated;

-- 10. Archive selected active voters
CREATE OR REPLACE FUNCTION public.app_archive_selected_voters(p_token TEXT, p_ids TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_admin_id UUID;
  v_count INTEGER;
  v_uuids UUID[];
BEGIN
  v_admin_id := public.require_admin(p_token);
  IF p_ids IS NULL OR array_length(p_ids, 1) IS NULL OR array_length(p_ids, 1) = 0 THEN
    RAISE EXCEPTION 'No voter IDs provided';
  END IF;

  v_uuids := p_ids::UUID[];
  UPDATE public.profiles
  SET archived = true, archived_at = now()
  WHERE user_id = ANY(v_uuids)
    AND archived = false
    AND user_id IN (SELECT user_id FROM public.user_roles WHERE role = 'voter');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', true, 'archived_count', v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.app_archive_selected_voters(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_archive_selected_voters(TEXT, TEXT[]) TO anon, authenticated;
