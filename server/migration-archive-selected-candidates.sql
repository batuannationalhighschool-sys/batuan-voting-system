-- Archive Selected Candidates RPC (Bulk Archive by IDs)
CREATE OR REPLACE FUNCTION public.app_archive_selected_candidates(p_token TEXT, p_ids TEXT[])
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
  SET archived = true, archived_at = now()
  WHERE id = ANY(v_uuids) AND archived = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'archived_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.app_archive_selected_candidates(TEXT, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_archive_selected_candidates(TEXT, TEXT[]) TO anon, authenticated;
