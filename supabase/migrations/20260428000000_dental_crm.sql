-- ── Dental CRM: add dental-specific fields to leads ──────────────────────────

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sherbimi TEXT,
  ADD COLUMN IF NOT EXISTS kur_kontaktohet TEXT;

-- ── Rename existing English pipeline stages to Albanian dental names ──────────
UPDATE public.pipeline_stages SET name = 'Kontakt i Parë',       color = '#3b82f6' WHERE name = 'Prospecting';
UPDATE public.pipeline_stages SET name = 'I Interesuar',          color = '#f59e0b' WHERE name = 'First Contact';
UPDATE public.pipeline_stages SET name = 'Dërgoi Foto',           color = '#06b6d4' WHERE name = 'Qualified';
UPDATE public.pipeline_stages SET name = 'Dërgoi Preventiv',      color = '#8b5cf6' WHERE name = 'Demo Scheduled';
UPDATE public.pipeline_stages SET name = 'Në Pritje Vendimi',     color = '#ec4899' WHERE name = 'Proposal Sent';
UPDATE public.pipeline_stages SET name = 'Konfirmuar – Vizitë',   color = '#10b981' WHERE name = 'Negotiation';
UPDATE public.pipeline_stages SET name = 'Trajtim në Kurs',       color = '#a855f7' WHERE name = 'Closed Won';
UPDATE public.pipeline_stages SET name = 'Mbyllur – Pa Interes',  color = '#ef4444' WHERE name = 'Closed Lost';

-- ── Super admin: pamela@auravitaclinic.al ────────────────────────────────────
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'pamela@auravitaclinic.al' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (v_user_id, 'pamela@auravitaclinic.al', 'Pamela Admin')
    ON CONFLICT (id) DO UPDATE SET full_name = 'Pamela Admin', company_id = NULL;

    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'super_admin', NULL)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
