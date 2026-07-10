-- ═══════════════════════════════════════════════════════════════════
-- LEAD ACTIVITIES — allow editing/deleting comments
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE POLICY "update_activities" ON public.lead_activities FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "delete_activities" ON public.lead_activities FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  );

CREATE OR REPLACE FUNCTION public.set_lead_activities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_activities_updated_at ON public.lead_activities;
CREATE TRIGGER trg_lead_activities_updated_at
  BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_lead_activities_updated_at();
