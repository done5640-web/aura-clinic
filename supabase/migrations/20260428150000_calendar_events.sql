CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL DEFAULT 'call',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_company ON public.calendar_events(company_id);

-- Super admin sees all
CREATE POLICY "sa_calendar_all" ON public.calendar_events FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Users can manage their own events
CREATE POLICY "own_calendar_select" ON public.calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "own_calendar_insert" ON public.calendar_events FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_calendar_update" ON public.calendar_events FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "own_calendar_delete" ON public.calendar_events FOR DELETE
  USING (user_id = auth.uid());

-- Company admins and team leaders can see all events for their company
CREATE POLICY "company_calendar_select" ON public.calendar_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('company_admin', 'team_leader')
    )
  );
