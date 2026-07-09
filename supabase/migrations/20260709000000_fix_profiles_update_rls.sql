-- ═══════════════════════════════════════════════════════════════════
-- PROFILES — allow company_admin to update OTHER members' profiles
-- (e.g. assigning an operator to a team leader). Previously only
-- SELECT was granted for company profiles; UPDATE was missing, so
-- writes were silently blocked by RLS (0 rows affected, no error).
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY "ca_update_company_profiles" ON public.profiles FOR UPDATE
  USING (
    company_id = public.get_my_company()
    AND public.is_company_admin(auth.uid(), company_id)
  )
  WITH CHECK (
    company_id = public.get_my_company()
    AND public.is_company_admin(auth.uid(), company_id)
  );
