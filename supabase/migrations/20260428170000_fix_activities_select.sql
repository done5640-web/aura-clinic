-- Fix: operators can also SELECT activities for their assigned leads

DROP POLICY IF EXISTS "view_activities" ON public.lead_activities;

CREATE POLICY "view_activities" ON public.lead_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (
          SELECT company_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'team_leader')
        )
      )
    )
  );
