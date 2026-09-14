-- Archive All Candidates RPC
CREATE OR REPLACE FUNCTION public.app_archive_all_candidates(p_token TEXT)
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
  SET archived = true, archived_at = now()
  WHERE archived = false;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'archived_count', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.app_archive_all_candidates(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_archive_all_candidates(TEXT) TO anon, authenticated;
