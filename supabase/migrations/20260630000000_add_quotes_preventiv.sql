-- ═══════════════════════════════════════════════════════════════════
-- PREVENTIV (QUOTES) FEATURE
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. Company contact fields used on the generated PDF footer ──────
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS phone   TEXT,
  ADD COLUMN IF NOT EXISTS email   TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- ── 2. Quotes table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'Preventiv',
  -- Each item: { section, service, qty, unit_price, total, note }
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  currency TEXT NOT NULL DEFAULT 'EUR',
  total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_quotes_lead ON public.quotes(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company ON public.quotes(company_id);

-- Same access pattern as lead_attachments: assigned operator or company admin/team leader
CREATE POLICY "sa_quotes_all" ON public.quotes FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "view_quotes" ON public.quotes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
      )
    )
  );

CREATE POLICY "insert_quotes" ON public.quotes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
      )
    )
  );

CREATE POLICY "update_quotes" ON public.quotes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
      )
    )
  );

CREATE POLICY "delete_quotes" ON public.quotes FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND
        l.company_id IN (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','team_leader'))
    )
  );

-- keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_quotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_updated_at ON public.quotes;
CREATE TRIGGER trg_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_quotes_updated_at();
