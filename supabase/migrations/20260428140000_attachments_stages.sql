-- Lead attachments table
CREATE TABLE IF NOT EXISTS public.lead_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_attachments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_attachments_lead ON public.lead_attachments(lead_id);

-- RLS for attachments: same access as lead activities
CREATE POLICY "sa_attachments_all" ON public.lead_attachments FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "view_attachments" ON public.lead_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
      )
    )
  );

CREATE POLICY "insert_attachments" ON public.lead_attachments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
      )
    )
  );

CREATE POLICY "delete_attachments" ON public.lead_attachments FOR DELETE
  USING (uploaded_by = auth.uid() OR public.is_super_admin(auth.uid()));

-- Update all existing pipeline stages to Italian names
-- (runs for every company)
UPDATE public.pipeline_stages SET
  name = CASE "order"
    WHEN 1 THEN 'Non interesato'
    WHEN 2 THEN 'Non risponde'
    WHEN 3 THEN 'Preventivo inviato'
    WHEN 4 THEN 'Call back'
    WHEN 5 THEN 'Attesa photo'
    WHEN 6 THEN 'Richiamo piu mesi'
    WHEN 7 THEN 'Non idoneo'
    WHEN 8 THEN 'Numero sbagliato'
    WHEN 9 THEN 'Messagio whatsApp'
    ELSE name
  END,
  color = CASE "order"
    WHEN 1 THEN '#ef4444'
    WHEN 2 THEN '#f97316'
    WHEN 3 THEN '#8b5cf6'
    WHEN 4 THEN '#3b82f6'
    WHEN 5 THEN '#06b6d4'
    WHEN 6 THEN '#f59e0b'
    WHEN 7 THEN '#6b7280'
    WHEN 8 THEN '#ec4899'
    WHEN 9 THEN '#10b981'
    ELSE color
  END
WHERE "order" BETWEEN 1 AND 9;

-- Delete any extra stages beyond order 9
DELETE FROM public.pipeline_stages WHERE "order" > 9;
