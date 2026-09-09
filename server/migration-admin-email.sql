-- =====================================================================
-- BATUAN VOTING SYSTEM — ADMIN EMAIL LOGIN AND PASSWORD POLICY
-- Apply after migration-security-hardening.sql.
-- This migration does not print or store a new password. The administrator
-- must set the strong password through the application after deployment.
-- =====================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email VARCHAR(320) DEFAULT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON public.users (lower(email))
  WHERE email IS NOT NULL;

UPDATE public.users
SET email = lower(btrim(email))
WHERE email IS NOT NULL AND email <> lower(btrim(email));

DO $$
DECLARE
  v_admin_id UUID;
  v_existing_id UUID;
BEGIN
  SELECT u.id
  INTO v_admin_id
  FROM public.users AS u
  JOIN public.user_roles AS ur ON ur.user_id = u.id AND ur.role = 'admin'
  WHERE lower(u.lrn) = 'admin'
  ORDER BY u.created_at
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE NOTICE 'No seeded admin account found; provision an admin with the deployment secret process.';
  ELSE
    SELECT id
    INTO v_existing_id
    FROM public.users
    WHERE lower(email) = 'batuannationalhighschool@gmail.com'
      AND id <> v_admin_id;

    IF v_existing_id IS NOT NULL THEN
      RAISE EXCEPTION 'The requested admin email is already assigned to another account';
    END IF;

    UPDATE public.users AS u
    SET email = 'batuannationalhighschool@gmail.com',
        must_change_password = CASE
          WHEN u.email IS DISTINCT FROM 'batuannationalhighschool@gmail.com' THEN true
          ELSE u.must_change_password
        END
    WHERE u.id = v_admin_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.app_login(p_lrn TEXT, p_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_user RECORD;
  v_token TEXT;
  v_identifier TEXT;
BEGIN
  v_identifier := lower(btrim(COALESCE(p_lrn, '')));

  IF v_identifier = '' OR p_password IS NULL OR length(p_password) > 256 THEN
    RAISE EXCEPTION 'Invalid email/LRN or password';
  END IF;

  SELECT u.id, u.lrn, u.email, u.password_hash, u.full_name, u.must_change_password
  INTO v_user
  FROM public.users AS u
  WHERE (
      u.email IS NOT NULL
      AND lower(btrim(u.email)) = v_identifier
      AND EXISTS (
        SELECT 1 FROM public.user_roles AS ur
        WHERE ur.user_id = u.id AND ur.role = 'admin'
      )
    )
    OR (
      u.email IS NULL
      AND lower(u.lrn) = v_identifier
    );

  IF NOT FOUND OR extensions.crypt(p_password, v_user.password_hash) <> v_user.password_hash THEN
    RAISE EXCEPTION 'Invalid email/LRN or password';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = v_user.id AND archived = true
  ) THEN
    RAISE EXCEPTION 'Invalid email/LRN or password';
  END IF;

  v_token := public.sign_app_token(v_user.id, v_user.lrn);
  RETURN jsonb_build_object(
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'lrn', v_user.lrn,
      'email', v_user.email,
      'full_name', v_user.full_name
    ),
    'must_change_password', v_user.must_change_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_get_me(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_profile RECORD;
  v_profile_found BOOLEAN;
  v_is_admin BOOLEAN;
  v_has_voted BOOLEAN;
BEGIN
  v_payload := public.verify_app_token(p_token);

  SELECT id, lrn, email, full_name, must_change_password
  INTO v_user
  FROM public.users
  WHERE id = (v_payload->>'id')::UUID;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT full_name, grade_level, section, has_voted
  INTO v_profile
  FROM public.profiles
  WHERE user_id = v_user.id
  LIMIT 1;
  v_profile_found := FOUND;

  v_has_voted := CASE WHEN v_profile_found THEN COALESCE(v_profile.has_voted, false) ELSE false END
    OR EXISTS (SELECT 1 FROM public.ballot_submissions WHERE voter_id = v_user.id)
    OR EXISTS (SELECT 1 FROM public.votes WHERE voter_id = v_user.id);

  IF v_profile_found AND v_profile.full_name IS NOT NULL AND v_profile.has_voted IS DISTINCT FROM v_has_voted THEN
    UPDATE public.profiles SET has_voted = v_has_voted WHERE user_id = v_user.id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user.id AND role = 'admin'
  ) INTO v_is_admin;

  RETURN jsonb_build_object(
    'user', jsonb_build_object(
      'id', v_user.id,
      'lrn', v_user.lrn,
      'email', v_user.email,
      'full_name', v_user.full_name
    ),
    'profile', CASE WHEN v_profile_found AND v_profile.full_name IS NOT NULL THEN jsonb_build_object(
      'full_name', v_profile.full_name,
      'has_voted', v_has_voted,
      'grade_level', v_profile.grade_level,
      'section', v_profile.section
    ) ELSE NULL END,
    'isAdmin', v_is_admin,
    'must_change_password', v_user.must_change_password
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.app_change_password(p_token TEXT, p_new_password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_payload JSONB;
  v_user RECORD;
  v_token TEXT;
  v_is_admin BOOLEAN;
BEGIN
  v_payload := public.verify_app_token(p_token);

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (v_payload->>'id')::UUID AND role = 'admin'
  ) INTO v_is_admin;

  IF p_new_password IS NULL OR length(p_new_password) < 6 OR length(p_new_password) > 256 THEN
    RAISE EXCEPTION 'Password must be between 6 and 256 characters';
  END IF;

  IF v_is_admin AND (
    length(p_new_password) < 12
    OR p_new_password !~ '[a-z]'
    OR p_new_password !~ '[A-Z]'
    OR p_new_password !~ '[0-9]'
    OR p_new_password !~ '[^A-Za-z0-9]'
  ) THEN
    RAISE EXCEPTION 'Admin password must be at least 12 characters and include upper, lower, number, and special character';
  END IF;

  UPDATE public.users
  SET password_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)),
      must_change_password = false,
      token_version = token_version + 1
  WHERE id = (v_payload->>'id')::UUID
  RETURNING id, lrn INTO v_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_token := public.sign_app_token(v_user.id, v_user.lrn);
  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_login(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_get_me(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_change_password(TEXT, TEXT) TO anon, authenticated;
