-- Fix: operators can insert activities and tasks for their assigned leads

-- Drop old restrictive policies
DROP POLICY IF EXISTS "insert_activities" ON public.lead_activities;
DROP POLICY IF EXISTS "manage_tasks"      ON public.tasks;
DROP POLICY IF EXISTS "op_update_own_tasks" ON public.tasks;
DROP POLICY IF EXISTS "view_tasks"        ON public.tasks;

-- Activities: any user who can access the lead can insert
CREATE POLICY "insert_activities" ON public.lead_activities FOR INSERT
  WITH CHECK (
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

-- Tasks SELECT: assigned operator OR company_admin/TL of that company
CREATE POLICY "view_tasks" ON public.tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
        l.company_id IN (
          SELECT company_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'team_leader')
        )
    )
  );

-- Tasks INSERT/UPDATE/DELETE: operator on their assigned lead OR admin/TL
CREATE POLICY "insert_tasks" ON public.tasks FOR INSERT
  WITH CHECK (
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

CREATE POLICY "update_tasks" ON public.tasks FOR UPDATE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
        l.company_id IN (
          SELECT company_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'team_leader')
        )
    )
  );

CREATE POLICY "delete_tasks" ON public.tasks FOR DELETE
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
        l.company_id IN (
          SELECT company_id FROM public.user_roles
          WHERE user_id = auth.uid() AND role IN ('company_admin', 'team_leader')
        )
    )
  );
