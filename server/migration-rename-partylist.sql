-- --- Rename Party List RPC --------------------------------------------------
-- Renames a party list across all candidates.
-- Called by PATCH /partylists/rename from the admin panel.
-- -------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.app_rename_party_list(
  p_token          TEXT,
  p_old_party_list TEXT,
  p_new_party_list TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id   UUID;
  v_cand_count INT;
  v_new_pl     TEXT;
  v_old_pl     TEXT;
BEGIN
  -- Auth: reuse the same require_admin helper all other RPCs use
  v_admin_id := public.require_admin(p_token);

  -- Validate inputs
  v_new_pl := TRIM(p_new_party_list);
  v_old_pl := TRIM(p_old_party_list);

  IF v_new_pl = '' THEN
    RAISE EXCEPTION 'New party list name cannot be empty';
  END IF;

  IF v_new_pl = v_old_pl THEN
    RAISE EXCEPTION 'New party list name is the same as the old name';
  END IF;

  -- Update candidates (both active and archived with this party list)
  UPDATE public.candidates
  SET party_list = v_new_pl
  WHERE LOWER(TRIM(party_list)) = LOWER(v_old_pl);

  GET DIAGNOSTICS v_cand_count = ROW_COUNT;

  RETURN json_build_object(
    'updated_candidates', v_cand_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_rename_party_list TO anon, authenticated;
