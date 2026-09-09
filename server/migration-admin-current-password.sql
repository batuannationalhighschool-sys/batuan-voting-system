-- =====================================================================
-- BATUAN VOTING SYSTEM — ADMIN CURRENT-PASSWORD VERIFICATION
-- Apply after migration-admin-email.sql.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.app_change_admin_password(
  p_token TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_token TEXT;
BEGIN
  v_payload := public.verify_app_token(p_token);

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = (v_payload->>'id')::UUID AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT id, lrn, password_hash
  INTO v_user
  FROM public.users
  WHERE id = (v_payload->>'id')::UUID;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF p_current_password IS NULL
     OR length(p_current_password) > 256
     OR extensions.crypt(p_current_password, v_user.password_hash) <> v_user.password_hash THEN
    RAISE EXCEPTION 'Current password is incorrect';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 12 OR length(p_new_password) > 256
     OR p_new_password !~ '[a-z]'
     OR p_new_password !~ '[A-Z]'
     OR p_new_password !~ '[0-9]'
     OR p_new_password !~ '[^A-Za-z0-9]' THEN
    RAISE EXCEPTION 'Admin password must be at least 12 characters and include upper, lower, number, and special character';
  END IF;

  IF extensions.crypt(p_new_password, v_user.password_hash) = v_user.password_hash THEN
    RAISE EXCEPTION 'New password must be different from the current password';
  END IF;

  UPDATE public.users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      must_change_password = false,
      token_version = token_version + 1
  WHERE id = v_user.id;

  v_token := public.sign_app_token(v_user.id, v_user.lrn);
  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

REVOKE ALL ON FUNCTION public.app_change_admin_password(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_change_admin_password(TEXT, TEXT, TEXT) TO anon, authenticated;
