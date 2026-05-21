-- Performance indexes for leads table queries
CREATE INDEX IF NOT EXISTS idx_leads_company_id        ON public.leads (company_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to       ON public.leads (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage    ON public.leads (pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at        ON public.leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company_updated   ON public.leads (company_id, updated_at DESC);
