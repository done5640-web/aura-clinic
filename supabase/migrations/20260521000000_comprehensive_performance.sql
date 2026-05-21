-- ═══════════════════════════════════════════════════════════════════
-- COMPREHENSIVE PERFORMANCE UPGRADE
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. MISSING INDEXES ──────────────────────────────────────────────

-- profiles: team_leader lookup (used in every TL query)
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader_id
  ON public.profiles(team_leader_id);

-- leads: composite indexes for the actual query patterns used in the app
CREATE INDEX IF NOT EXISTS idx_leads_company_assigned
  ON public.leads(company_id, assigned_to_user_id);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_updated
  ON public.leads(assigned_to_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON public.leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_leads_status_changed_at
  ON public.leads(status_changed_at DESC);

-- lead_activities: missing indexes for ordering and user filtering
CREATE INDEX IF NOT EXISTS idx_activities_user_id
  ON public.lead_activities(user_id);

CREATE INDEX IF NOT EXISTS idx_activities_lead_created
  ON public.lead_activities(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_created_at
  ON public.lead_activities(created_at DESC);

-- tasks: join index for RLS EXISTS lookups
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id
  ON public.tasks(lead_id);

-- partial index — the app always queries WHERE completed = false
CREATE INDEX IF NOT EXISTS idx_tasks_open_due
  ON public.tasks(completed, due_date)
  WHERE completed = false;

-- calendar events
CREATE INDEX IF NOT EXISTS idx_calendar_user_id
  ON public.calendar_events(user_id);


-- ── 2. ADD company_id TO lead_activities ────────────────────────────
-- Eliminates the correlated EXISTS(SELECT 1 FROM leads) in RLS policies
-- that was executing for every single activity row.

ALTER TABLE public.lead_activities
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.lead_activities la
SET    company_id = l.company_id
FROM   public.leads l
WHERE  la.lead_id = l.id
  AND  la.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_activities_company_date
  ON public.lead_activities(company_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_activity_company_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_activity_company_id ON public.lead_activities;
CREATE TRIGGER trg_activity_company_id
  BEFORE INSERT ON public.lead_activities
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_company_id();


-- ── 3. ADD company_id TO tasks ───────────────────────────────────────
-- Same benefit: removes the JOIN to leads in every task RLS check.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

UPDATE public.tasks t
SET    company_id = l.company_id
FROM   public.leads l
WHERE  t.lead_id = l.id
  AND  t.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_company_due
  ON public.tasks(company_id, completed, due_date);

CREATE OR REPLACE FUNCTION public.set_task_company_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.company_id IS NULL AND NEW.lead_id IS NOT NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.leads WHERE id = NEW.lead_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_company_id ON public.tasks;
CREATE TRIGGER trg_task_company_id
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_task_company_id();


-- ── 4. REWRITE EXPENSIVE RLS POLICIES ───────────────────────────────
-- Old policies did EXISTS(SELECT 1 FROM leads ...) for every row.
-- New policies use the direct company_id column — one index lookup.

DROP POLICY IF EXISTS "view_activities"   ON public.lead_activities;
DROP POLICY IF EXISTS "insert_activities" ON public.lead_activities;

CREATE POLICY "view_activities" ON public.lead_activities FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
        OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_id AND l.assigned_to_user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "insert_activities" ON public.lead_activities FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
        OR EXISTS (
          SELECT 1 FROM public.leads l
          WHERE l.id = lead_id AND l.assigned_to_user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "view_tasks"   ON public.tasks;
DROP POLICY IF EXISTS "manage_tasks" ON public.tasks;

CREATE POLICY "view_tasks" ON public.tasks FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR assigned_to = auth.uid()
    OR (
      company_id = public.get_my_company()
      AND (
        public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  );

CREATE POLICY "manage_tasks" ON public.tasks FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_my_company()
      AND (
        public.is_company_admin(auth.uid(), company_id)
        OR public.is_team_leader(auth.uid(), company_id)
      )
    )
  );
