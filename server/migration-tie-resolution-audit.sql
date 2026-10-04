-- ─── Position Verifications & Tie Resolutions ────────────────────────
CREATE TABLE IF NOT EXISTS public.position_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id UUID NOT NULL REFERENCES public.positions(id) ON DELETE CASCADE,
  school_year VARCHAR(20) NOT NULL DEFAULT '2025-2026',
  status VARCHAR(50) NOT NULL DEFAULT 'finalized',
  is_tie BOOLEAN NOT NULL DEFAULT false,
  tied_candidates JSONB DEFAULT '[]'::jsonb,
  resolved_winner_id UUID REFERENCES public.candidates(id) ON DELETE SET NULL,
  resolved_winner_name VARCHAR(100),
  decision_type VARCHAR(100),
  admin_comment TEXT NOT NULL,
  verified_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_by_name VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_pos_verification_per_sy UNIQUE (position_id, school_year)
);

ALTER TABLE public.position_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read of position_verifications" ON public.position_verifications;
CREATE POLICY "Allow public read of position_verifications"
  ON public.position_verifications
  FOR SELECT
  TO public
  USING (true);

-- ─── RPC: Save Position Verification / Tie Resolution ───────────────
CREATE OR REPLACE FUNCTION public.app_save_position_verification(
  p_token TEXT,
  p_position_id UUID,
  p_is_tie BOOLEAN,
  p_tied_candidates JSONB,
  p_resolved_winner_id UUID,
  p_resolved_winner_name TEXT,
  p_decision_type TEXT,
  p_admin_comment TEXT,
  p_status TEXT DEFAULT 'finalized'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_admin_id UUID;
  v_admin_name TEXT;
  v_school_year TEXT;
  v_trimmed_comment TEXT;
  v_result RECORD;
BEGIN
  v_admin_id := require_admin(p_token);
  
  SELECT full_name INTO v_admin_name FROM public.users WHERE id = v_admin_id;
  IF v_admin_name IS NULL THEN
    v_admin_name := 'Authorized Administrator';
  END IF;

  SELECT school_year INTO v_school_year FROM public.election_settings LIMIT 1;
  IF v_school_year IS NULL OR v_school_year = '' THEN
    v_school_year := '2025-2026';
  END IF;

  v_trimmed_comment := trim(COALESCE(p_admin_comment, ''));
  IF p_is_tie AND v_trimmed_comment = '' THEN
    RAISE EXCEPTION 'A tie comment/reason must be entered manually by the authorized administrator.';
  END IF;

  INSERT INTO public.position_verifications (
    position_id,
    school_year,
    status,
    is_tie,
    tied_candidates,
    resolved_winner_id,
    resolved_winner_name,
    decision_type,
    admin_comment,
    verified_by_user_id,
    verified_by_name,
    updated_at
  ) VALUES (
    p_position_id,
    v_school_year,
    COALESCE(NULLIF(p_status, ''), 'finalized'),
    COALESCE(p_is_tie, false),
    COALESCE(p_tied_candidates, '[]'::jsonb),
    p_resolved_winner_id,
    NULLIF(trim(COALESCE(p_resolved_winner_name, '')), ''),
    NULLIF(trim(COALESCE(p_decision_type, '')), ''),
    v_trimmed_comment,
    v_admin_id,
    v_admin_name,
    now()
  )
  ON CONFLICT (position_id, school_year) DO UPDATE SET
    status = EXCLUDED.status,
    is_tie = EXCLUDED.is_tie,
    tied_candidates = EXCLUDED.tied_candidates,
    resolved_winner_id = EXCLUDED.resolved_winner_id,
    resolved_winner_name = EXCLUDED.resolved_winner_name,
    decision_type = EXCLUDED.decision_type,
    admin_comment = EXCLUDED.admin_comment,
    verified_by_user_id = EXCLUDED.verified_by_user_id,
    verified_by_name = EXCLUDED.verified_by_name,
    updated_at = now()
  RETURNING * INTO v_result;

  RETURN jsonb_build_object(
    'success', true,
    'verification', row_to_json(v_result)::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_save_position_verification TO anon, authenticated;

-- ─── RPC: Get Position Verifications ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.app_get_position_verifications(
  p_school_year TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_school_year TEXT;
BEGIN
  IF p_school_year IS NOT NULL AND p_school_year != '' THEN
    v_school_year := p_school_year;
  ELSE
    SELECT school_year INTO v_school_year FROM public.election_settings LIMIT 1;
    IF v_school_year IS NULL THEN
      v_school_year := '2025-2026';
    END IF;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(pv)::jsonb)
    FROM (
      SELECT 
        pv.id,
        pv.position_id,
        pv.school_year,
        pv.status,
        pv.is_tie,
        pv.tied_candidates,
        pv.resolved_winner_id,
        pv.resolved_winner_name,
        pv.decision_type,
        pv.admin_comment,
        pv.verified_by_user_id,
        pv.verified_by_name,
        pv.created_at,
        pv.updated_at,
        p.title AS position_title,
        p.display_order
      FROM public.position_verifications pv
      JOIN public.positions p ON p.id = pv.position_id
      WHERE pv.school_year = v_school_year
      ORDER BY p.display_order ASC
    ) pv
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_get_position_verifications TO anon, authenticated;

-- ─── RPC: Delete / Reset Position Verification ───────────────────────
CREATE OR REPLACE FUNCTION public.app_delete_position_verification(
  p_token TEXT,
  p_position_id UUID,
  p_school_year TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_admin_id UUID;
  v_school_year TEXT;
BEGIN
  v_admin_id := require_admin(p_token);

  IF p_school_year IS NOT NULL AND p_school_year != '' THEN
    v_school_year := p_school_year;
  ELSE
    SELECT school_year INTO v_school_year FROM public.election_settings LIMIT 1;
    IF v_school_year IS NULL THEN
      v_school_year := '2025-2026';
    END IF;
  END IF;

  DELETE FROM public.position_verifications
  WHERE position_id = p_position_id AND school_year = v_school_year;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.app_delete_position_verification TO anon, authenticated;
