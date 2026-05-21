
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('super_admin', 'company_admin', 'team_leader', 'operator');
CREATE TYPE public.company_status AS ENUM ('active', 'suspended');
CREATE TYPE public.activity_type AS ENUM ('call', 'email', 'note', 'meeting', 'status_change', 'assignment');

-- ============ COMPANIES ============
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status company_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============ SECURITY DEFINER FUNCTIONS ============
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin') $$;

CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT company_id FROM public.profiles WHERE id = _user_id LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = 'company_admin' AND company_id = _company_id
) $$;

CREATE OR REPLACE FUNCTION public.is_team_leader(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (
  SELECT 1 FROM public.user_roles
  WHERE user_id = _user_id AND role = 'team_leader' AND company_id = _company_id
) $$;

CREATE OR REPLACE FUNCTION public.can_manage_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_super_admin(_user_id)
       OR public.is_company_admin(_user_id, _company_id)
       OR public.is_team_leader(_user_id, _company_id) $$;

-- ============ PIPELINE STAGES ============
CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;

-- ============ LEADS ============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_to_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  company_name TEXT,
  source TEXT,
  pipeline_stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_leads_company ON public.leads(company_id);
CREATE INDEX idx_leads_assigned ON public.leads(assigned_to_user_id);
CREATE INDEX idx_leads_stage ON public.leads(pipeline_stage_id);

-- ============ LEAD ACTIVITIES ============
CREATE TABLE public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type activity_type NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_activities_lead ON public.lead_activities(lead_id);

-- ============ TASKS ============
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_tasks_lead ON public.tasks(lead_id);
CREATE INDEX idx_tasks_assigned ON public.tasks(assigned_to);

-- ============ WEBHOOK TOKENS ============
CREATE TABLE public.company_webhook_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_webhook_tokens ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- COMPANIES
CREATE POLICY "super_admin_all_companies" ON public.companies FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "users_view_own_company" ON public.companies FOR SELECT
  USING (id = public.get_user_company(auth.uid()));
CREATE POLICY "company_admin_update_own" ON public.companies FOR UPDATE
  USING (public.is_company_admin(auth.uid(), id));

-- PROFILES
CREATE POLICY "super_admin_all_profiles" ON public.profiles FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "users_view_own_profile" ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "users_view_company_profiles" ON public.profiles FOR SELECT
  USING (company_id IS NOT NULL AND company_id = public.get_user_company(auth.uid()));
CREATE POLICY "users_update_own_profile" ON public.profiles FOR UPDATE
  USING (id = auth.uid());
CREATE POLICY "users_insert_own_profile" ON public.profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- USER ROLES
CREATE POLICY "super_admin_all_roles" ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "users_view_own_roles" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "company_admin_view_roles" ON public.user_roles FOR SELECT
  USING (company_id IS NOT NULL AND public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "company_admin_manage_roles" ON public.user_roles FOR INSERT
  WITH CHECK (
    company_id IS NOT NULL
    AND public.is_company_admin(auth.uid(), company_id)
    AND role IN ('team_leader', 'operator')
  );
CREATE POLICY "company_admin_delete_roles" ON public.user_roles FOR DELETE
  USING (
    company_id IS NOT NULL
    AND public.is_company_admin(auth.uid(), company_id)
    AND role IN ('team_leader', 'operator')
  );

-- PIPELINE STAGES
CREATE POLICY "super_admin_all_stages" ON public.pipeline_stages FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company_view_stages" ON public.pipeline_stages FOR SELECT
  USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "company_admin_manage_stages" ON public.pipeline_stages FOR ALL
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- LEADS
CREATE POLICY "super_admin_all_leads" ON public.leads FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "operators_view_assigned_leads" ON public.leads FOR SELECT
  USING (
    assigned_to_user_id = auth.uid()
    AND company_id = public.get_user_company(auth.uid())
  );
CREATE POLICY "operators_update_assigned_leads" ON public.leads FOR UPDATE
  USING (assigned_to_user_id = auth.uid() AND company_id = public.get_user_company(auth.uid()));
CREATE POLICY "tl_admin_view_company_leads" ON public.leads FOR SELECT
  USING (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.is_company_admin(auth.uid(), company_id)
      OR public.is_team_leader(auth.uid(), company_id)
    )
  );
CREATE POLICY "tl_admin_update_company_leads" ON public.leads FOR UPDATE
  USING (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.is_company_admin(auth.uid(), company_id)
      OR public.is_team_leader(auth.uid(), company_id)
    )
  );
CREATE POLICY "tl_admin_insert_leads" ON public.leads FOR INSERT
  WITH CHECK (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.is_company_admin(auth.uid(), company_id)
      OR public.is_team_leader(auth.uid(), company_id)
    )
  );
CREATE POLICY "company_admin_delete_leads" ON public.leads FOR DELETE
  USING (public.is_company_admin(auth.uid(), company_id));

-- LEAD ACTIVITIES
CREATE POLICY "super_admin_all_activities" ON public.lead_activities FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "view_activities_via_lead" ON public.lead_activities FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
      l.assigned_to_user_id = auth.uid()
      OR public.is_company_admin(auth.uid(), l.company_id)
      OR public.is_team_leader(auth.uid(), l.company_id)
    )
  ));
CREATE POLICY "insert_activities_via_lead" ON public.lead_activities FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- TASKS
CREATE POLICY "super_admin_all_tasks" ON public.tasks FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "view_tasks_via_lead" ON public.tasks FOR SELECT
  USING (
    assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );
CREATE POLICY "manage_tasks_via_lead" ON public.tasks FOR ALL
  USING (
    assigned_to = auth.uid() OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- WEBHOOK TOKENS
CREATE POLICY "super_admin_all_tokens" ON public.company_webhook_tokens FOR ALL
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "company_admin_view_tokens" ON public.company_webhook_tokens FOR SELECT
  USING (public.is_company_admin(auth.uid(), company_id));
CREATE POLICY "company_admin_manage_tokens" ON public.company_webhook_tokens FOR ALL
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-create webhook token when company is created
CREATE OR REPLACE FUNCTION public.create_company_webhook_token()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.company_webhook_tokens (company_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

CREATE TRIGGER on_company_created
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.create_company_webhook_token();
-- Fix demo user roles that were silently skipped due to RLS during seeding.
-- This migration runs with superuser privileges and bypasses RLS entirely.

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN

  -- â”€â”€ 1. Ensure Acme Sales Co exists â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  SELECT id INTO v_company_id FROM public.companies WHERE name = 'Acme Sales Co' LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, plan, status)
    VALUES ('Acme Sales Co', 'growth', 'active')
    RETURNING id INTO v_company_id;
  END IF;

  -- â”€â”€ 2. Helper: upsert role for a user by email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- super_admin (no company)
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'superadmin@demo.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    -- fix profile
    UPDATE public.profiles SET full_name = 'Super Admin', company_id = NULL WHERE id = v_user_id;
    -- upsert role
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'super_admin', NULL)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- company_admin
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Alice Admin', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'company_admin', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- team_leader 1
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'leader1@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Tom Leader', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'team_leader', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- team_leader 2
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'leader2@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Sara Lead', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'team_leader', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 1
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op1@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Oliver One', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 2
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op2@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Olivia Two', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 3
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op3@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Owen Three', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 4
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op4@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Octavia Four', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

END $$;

-- Also fix the unique constraint for user_roles so NULL company_id works correctly
-- (NULL != NULL in SQL, so the unique constraint on (user_id, role, company_id)
--  doesn't catch duplicates when company_id IS NULL for super_admin)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_super_admin_unique
  ON public.user_roles (user_id, role)
  WHERE company_id IS NULL;
-- â”€â”€ Dental CRM: add dental-specific fields to leads â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS sherbimi TEXT,
  ADD COLUMN IF NOT EXISTS kur_kontaktohet TEXT;

-- â”€â”€ Rename existing English pipeline stages to Albanian dental names â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
UPDATE public.pipeline_stages SET name = 'Kontakt i ParÃ«',       color = '#3b82f6' WHERE name = 'Prospecting';
UPDATE public.pipeline_stages SET name = 'I Interesuar',          color = '#f59e0b' WHERE name = 'First Contact';
UPDATE public.pipeline_stages SET name = 'DÃ«rgoi Foto',           color = '#06b6d4' WHERE name = 'Qualified';
UPDATE public.pipeline_stages SET name = 'DÃ«rgoi Preventiv',      color = '#8b5cf6' WHERE name = 'Demo Scheduled';
UPDATE public.pipeline_stages SET name = 'NÃ« Pritje Vendimi',     color = '#ec4899' WHERE name = 'Proposal Sent';
UPDATE public.pipeline_stages SET name = 'Konfirmuar â€“ VizitÃ«',   color = '#10b981' WHERE name = 'Negotiation';
UPDATE public.pipeline_stages SET name = 'Trajtim nÃ« Kurs',       color = '#a855f7' WHERE name = 'Closed Won';
UPDATE public.pipeline_stages SET name = 'Mbyllur â€“ Pa Interes',  color = '#ef4444' WHERE name = 'Closed Lost';

-- â”€â”€ Super admin: pamela@auravitaclinic.al â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- STEP 1: Run this first â€” wipe + create users via supabase_auth_admin
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- Add dental columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sherbimi TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS kur_kontaktohet TEXT;

-- Wipe all tenant data
DELETE FROM public.lead_activities;
DELETE FROM public.tasks;
DELETE FROM public.leads;
DELETE FROM public.pipeline_stages;
DELETE FROM public.company_webhook_tokens;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM public.companies;

-- Delete old demo users from auth (not super admin)
DELETE FROM auth.users WHERE email LIKE '%@dentaltirana.com'
  OR email LIKE '%@smilepro.com'
  OR email LIKE '%@brightsmile.com'
  OR email IN ('superadmin@demo.com','admin@acme.com','leader1@acme.com','leader2@acme.com',
               'op1@acme.com','op2@acme.com','op3@acme.com','op4@acme.com',
               'ledionemema31@gmail.com','lediomema31@gmail.com');

-- Reset super admin password
UPDATE auth.users SET
  encrypted_password = crypt('Demo1234!', gen_salt('bf')),
  email_confirmed_at = now(),
  raw_user_meta_data = '{"full_name":"Pamela Admin"}',
  updated_at = now()
WHERE email = 'pamela@auravitaclinic.al';

-- Create all users using select from auth.users as template (copies instance_id etc)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  instance_id,
  gen_random_uuid(),
  aud, role,
  u.new_email,
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('full_name', u.full_name)::jsonb,
  now(), now(), '', '', '', ''
FROM (VALUES
  ('admin@dentaltirana.com', 'Arben Krasniqi'),
  ('tl1@dentaltirana.com',   'Besa Hoxha'),
  ('tl2@dentaltirana.com',   'Gentian Leka'),
  ('op1@dentaltirana.com',   'Elira Duka'),
  ('op2@dentaltirana.com',   'Fisnik Rama'),
  ('op3@dentaltirana.com',   'Gresa Berisha'),
  ('admin@smilepro.com',     'Mirela Dervishi'),
  ('tl1@smilepro.com',       'Nertil Ã‡ela'),
  ('tl2@smilepro.com',       'Ornela Vlashi'),
  ('op1@smilepro.com',       'Petrit Gega'),
  ('op2@smilepro.com',       'Rezarta Hyka'),
  ('op3@smilepro.com',       'Sonila Popa'),
  ('admin@brightsmile.com',  'Taulant Xhafa'),
  ('tl1@brightsmile.com',    'UrejtÃ« Shala'),
  ('tl2@brightsmile.com',    'Valon Kelmendi'),
  ('op1@brightsmile.com',    'Xhensila Cara'),
  ('op2@brightsmile.com',    'Yllka Qosja'),
  ('op3@brightsmile.com',    'Zamira Loshi')
) AS u(new_email, full_name)
CROSS JOIN (SELECT instance_id, aud, role FROM auth.users WHERE email='pamela@auravitaclinic.al' LIMIT 1) AS tmpl;

-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- STEP 2: Seed companies, roles, leads
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
DO $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
  c1s1 UUID; c1s2 UUID; c1s3 UUID; c1s4 UUID; c1s5 UUID; c1s6 UUID; c1s7 UUID; c1s8 UUID; c1s9 UUID;
  c2s1 UUID; c2s2 UUID; c2s3 UUID; c2s4 UUID; c2s5 UUID; c2s6 UUID; c2s7 UUID; c2s8 UUID; c2s9 UUID;
  c3s1 UUID; c3s2 UUID; c3s3 UUID; c3s4 UUID; c3s5 UUID; c3s6 UUID; c3s7 UUID; c3s8 UUID; c3s9 UUID;
  u_sa  UUID;
  u_a1  UUID; u_tl1 UUID; u_tl2 UUID; u_op1 UUID; u_op2 UUID; u_op3 UUID;
  u_a2  UUID; u_tl3 UUID; u_tl4 UUID; u_op4 UUID; u_op5 UUID; u_op6 UUID;
  u_a3  UUID; u_tl5 UUID; u_tl6 UUID; u_op7 UUID; u_op8 UUID; u_op9 UUID;
BEGIN
  SELECT id INTO u_sa  FROM auth.users WHERE email='pamela@auravitaclinic.al';
  SELECT id INTO u_a1  FROM auth.users WHERE email='admin@dentaltirana.com';
  SELECT id INTO u_tl1 FROM auth.users WHERE email='tl1@dentaltirana.com';
  SELECT id INTO u_tl2 FROM auth.users WHERE email='tl2@dentaltirana.com';
  SELECT id INTO u_op1 FROM auth.users WHERE email='op1@dentaltirana.com';
  SELECT id INTO u_op2 FROM auth.users WHERE email='op2@dentaltirana.com';
  SELECT id INTO u_op3 FROM auth.users WHERE email='op3@dentaltirana.com';
  SELECT id INTO u_a2  FROM auth.users WHERE email='admin@smilepro.com';
  SELECT id INTO u_tl3 FROM auth.users WHERE email='tl1@smilepro.com';
  SELECT id INTO u_tl4 FROM auth.users WHERE email='tl2@smilepro.com';
  SELECT id INTO u_op4 FROM auth.users WHERE email='op1@smilepro.com';
  SELECT id INTO u_op5 FROM auth.users WHERE email='op2@smilepro.com';
  SELECT id INTO u_op6 FROM auth.users WHERE email='op3@smilepro.com';
  SELECT id INTO u_a3  FROM auth.users WHERE email='admin@brightsmile.com';
  SELECT id INTO u_tl5 FROM auth.users WHERE email='tl1@brightsmile.com';
  SELECT id INTO u_tl6 FROM auth.users WHERE email='tl2@brightsmile.com';
  SELECT id INTO u_op7 FROM auth.users WHERE email='op1@brightsmile.com';
  SELECT id INTO u_op8 FROM auth.users WHERE email='op2@brightsmile.com';
  SELECT id INTO u_op9 FROM auth.users WHERE email='op3@brightsmile.com';

  -- Super admin
  INSERT INTO public.profiles (id,email,full_name) VALUES (u_sa,'pamela@auravitaclinic.al','Pamela Admin') ON CONFLICT (id) DO UPDATE SET full_name='Pamela Admin',company_id=NULL;
  INSERT INTO public.user_roles (user_id,role,company_id) VALUES (u_sa,'super_admin',NULL) ON CONFLICT DO NOTHING;

  -- â”€â”€ COMPANY 1: Dental Tirana â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.companies (name,plan,status) VALUES ('Dental Tirana','growth','active') RETURNING id INTO c1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Kontakt i ParÃ«',      1,'#3b82f6') RETURNING id INTO c1s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c1s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'DÃ«rgoi Foto',          3,'#06b6d4') RETURNING id INTO c1s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'DÃ«rgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c1s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'NÃ« Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c1s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Konfirmuar â€“ VizitÃ«',  6,'#10b981') RETURNING id INTO c1s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Trajtim nÃ« Kurs',      7,'#a855f7') RETURNING id INTO c1s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Mbyllur â€“ Fituar',     8,'#22c55e') RETURNING id INTO c1s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Mbyllur â€“ Pa Interes', 9,'#ef4444') RETURNING id INTO c1s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a1,'admin@dentaltirana.com','Arben Krasniqi',c1),
    (u_tl1,'tl1@dentaltirana.com','Besa Hoxha',c1),
    (u_tl2,'tl2@dentaltirana.com','Gentian Leka',c1),
    (u_op1,'op1@dentaltirana.com','Elira Duka',c1),
    (u_op2,'op2@dentaltirana.com','Fisnik Rama',c1),
    (u_op3,'op3@dentaltirana.com','Gresa Berisha',c1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a1,'company_admin',c1),(u_tl1,'team_leader',c1),(u_tl2,'team_leader',c1),
    (u_op1,'operator',c1),(u_op2,'operator',c1),(u_op3,'operator',c1)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c1,'Andi',    'Shehu',  'andi.shehu@gmail.com',  '+355681001','Implant dentar',       'E HÃ«nÃ« 10:00',   'instagram', 850,c1s1,u_op1,'I kontaktuar nga Instagram. Interes i lartÃ« pÃ«r implant.'),
    (c1,'Blerina', 'MuÃ§a',   'blerina.m@gmail.com',   '+355681002','Ortodonci â€“ Braces',   'E MartÃ« 11:30',  'facebook', 1200,c1s2,u_op1,'Shprehu interes. Pyet Ã§mimin e brecave dhe kohÃ«zgjatjen.'),
    (c1,'Clirim',  'Zeka',   'clirim.z@gmail.com',    '+355681003','Zbardhim dhÃ«mbÃ«sh',    'E MÃ«rkurÃ« 09:00','referral',  300,c1s3,u_op1,'DÃ«rgoi foto dhÃ«mbÃ«sh. Pret preventivÃ«n nga doktori.'),
    (c1,'Donika',  'Prendi', 'donika.p@gmail.com',    '+355681004','ProtezÃ« e plotÃ«',      'E Enjte 14:00',  'website',  1800,c1s4,u_op2,'Preventiva dÃ«rguar me email. Ã‡mimi 1800â‚¬. Pret konfirmim.'),
    (c1,'Erion',   'Malaj',  'erion.m@gmail.com',     '+355681005','Faseta porcelani',     'E Premte 15:00', 'instagram',2200,c1s5,u_op2,'Ka preventivÃ«n. Po mendon. Do japÃ« pÃ«rgjigje brenda javÃ«s.'),
    (c1,'Fatbardha','Gjoka', 'fatbardha@gmail.com',   '+355681006','Implant + KurorÃ«',     'E HÃ«nÃ« 09:30',   'facebook', 2500,c1s6,u_op2,'Konfirmoi vizitÃ«n. I dÃ«rgua reminder SMS.'),
    (c1,'GÃ«zim',   'Hoxhaj','gezim.h@gmail.com',      '+355681007','Ortodonci Invisalign', 'E MartÃ« 10:00',  'referral', 3200,c1s7,u_op3,'Trajtimi ka filluar. Vizita e dytÃ« kontrollit planifikuar.'),
    (c1,'Hajrie',  'Osmani','hajrie.o@gmail.com',      '+355681008','Zbardhim dhÃ«mbÃ«sh',   'E MÃ«rkurÃ« 11:00','website',   300,c1s8,u_op3,'Trajtim i suksesshÃ«m. Pacienti i kÃ«naqur. Feedback pozitiv.'),
    (c1,'Ilir',    'Basha', 'ilir.basha@gmail.com',   '+355681009','Implant dentar',       'E Enjte 16:00',  'instagram', 850,c1s9,u_op3,'Nuk pranoi Ã§mimin. Ka shkuar tek konkurrenti.'),
    (c1,'Jonida',  'Keli',  'jonida.k@gmail.com',     '+355681010','KurorÃ« qeramike',      'E Premte 10:00', 'facebook',  650,c1s2,u_op1,'E interesuar. KÃ«rkon informacion shtesÃ« pÃ«r materialet.'),
    (c1,'Klejd',   'Laci',  'klejd.l@gmail.com',      '+355681011','ProtezÃ« parciale',     'E HÃ«nÃ« 13:00',   'referral',  900,c1s3,u_op2,'DÃ«rgoi foto panoramike. Presim vlerÃ«simin e doktorit.'),
    (c1,'Luljeta', 'Marku', 'luljeta.m@gmail.com',    '+355681012','Faseta + Zbardhim',   'E MartÃ« 15:30',  'website',  2800,c1s5,u_op3,'Ka preventivÃ«n. KÃ«rkon zbritje. Negociim aktiv.');

  -- â”€â”€ COMPANY 2: SmilePro DurrÃ«s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.companies (name,plan,status) VALUES ('SmilePro DurrÃ«s','starter','active') RETURNING id INTO c2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Kontakt i ParÃ«',      1,'#3b82f6') RETURNING id INTO c2s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c2s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'DÃ«rgoi Foto',          3,'#06b6d4') RETURNING id INTO c2s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'DÃ«rgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c2s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'NÃ« Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c2s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Konfirmuar â€“ VizitÃ«',  6,'#10b981') RETURNING id INTO c2s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Trajtim nÃ« Kurs',      7,'#a855f7') RETURNING id INTO c2s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Mbyllur â€“ Fituar',     8,'#22c55e') RETURNING id INTO c2s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Mbyllur â€“ Pa Interes', 9,'#ef4444') RETURNING id INTO c2s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a2,'admin@smilepro.com','Mirela Dervishi',c2),
    (u_tl3,'tl1@smilepro.com','Nertil Ã‡ela',c2),
    (u_tl4,'tl2@smilepro.com','Ornela Vlashi',c2),
    (u_op4,'op1@smilepro.com','Petrit Gega',c2),
    (u_op5,'op2@smilepro.com','Rezarta Hyka',c2),
    (u_op6,'op3@smilepro.com','Sonila Popa',c2)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a2,'company_admin',c2),(u_tl3,'team_leader',c2),(u_tl4,'team_leader',c2),
    (u_op4,'operator',c2),(u_op5,'operator',c2),(u_op6,'operator',c2)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c2,'Armend', 'Syla',    'armend.s@gmail.com',   '+355691001','Implant dentar',       'E HÃ«nÃ« 09:00',   'instagram', 850,c2s1,u_op4,'Kontakt i parÃ« nga Instagram. KÃ«rkon info bazÃ«.'),
    (c2,'Brunilda','Tafa',   'brunilda.t@gmail.com', '+355691002','Zbardhim dhÃ«mbÃ«sh',    'E MartÃ« 10:30',  'facebook',  300,c2s2,u_op4,'I interesuar. KÃ«rkon datÃ« sa mÃ« shpejt.'),
    (c2,'Ã‡lirim', 'Ndoja',   'clirim.n@gmail.com',   '+355691003','Ortodonci braces',     'E MÃ«rkurÃ« 14:00','referral', 1200,c2s3,u_op4,'DÃ«rgoi foto panoramike. Presim ofertÃ«n nga ortodontistja.'),
    (c2,'Drita',  'Kovaci',  'drita.k@gmail.com',    '+355691004','KurorÃ« + Implant',     'E Enjte 11:00',  'website',  1650,c2s4,u_op5,'Preventiva dÃ«rguar. Pret sqarime mbi procesin kirurgjik.'),
    (c2,'Edmond', 'Myrtaj',  'edmond.m@gmail.com',   '+355691005','Faseta porcelani',     'E Premte 09:30', 'instagram',2200,c2s6,u_op5,'Konfirmoi vizitÃ«n. Do vijÃ« me partneren.'),
    (c2,'Fjolla',  'Rexhepi','fjolla.r@gmail.com',   '+355691006','ProtezÃ« e plotÃ«',      'E HÃ«nÃ« 15:00',   'facebook', 1800,c2s7,u_op5,'Trajtimi ka nisur. Etapa e parÃ« e implantit kryer me sukses.'),
    (c2,'Granit', 'Bejko',   'granit.b@gmail.com',   '+355691007','Zbardhim dhÃ«mbÃ«sh',   'E MartÃ« 13:00',  'referral',  300,c2s8,u_op6,'Trajtim i suksesshÃ«m. Rekomandoi 2 miq tÃ« tjerÃ«.'),
    (c2,'Hana',   'Koci',    'hana.k@gmail.com',     '+355691008','Implant dentar',       'E MÃ«rkurÃ« 10:00','website',   850,c2s9,u_op6,'Nuk ishte financiarisht gati. Tha kthehet pas 6 muajsh.'),
    (c2,'Ilva',   'Shehi',   'ilva.s@gmail.com',     '+355691009','Ortodonci Invisalign', 'E Enjte 14:30',  'instagram',3200,c2s5,u_op6,'Ka preventivÃ«n. Krahason me klinika tjera. Ende pa vendosur.');

  -- â”€â”€ COMPANY 3: BrightSmile VlorÃ« â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.companies (name,plan,status) VALUES ('BrightSmile VlorÃ«','enterprise','active') RETURNING id INTO c3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Kontakt i ParÃ«',      1,'#3b82f6') RETURNING id INTO c3s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c3s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'DÃ«rgoi Foto',          3,'#06b6d4') RETURNING id INTO c3s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'DÃ«rgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c3s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'NÃ« Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c3s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Konfirmuar â€“ VizitÃ«',  6,'#10b981') RETURNING id INTO c3s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Trajtim nÃ« Kurs',      7,'#a855f7') RETURNING id INTO c3s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Mbyllur â€“ Fituar',     8,'#22c55e') RETURNING id INTO c3s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Mbyllur â€“ Pa Interes', 9,'#ef4444') RETURNING id INTO c3s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a3,'admin@brightsmile.com','Taulant Xhafa',c3),
    (u_tl5,'tl1@brightsmile.com','UrejtÃ« Shala',c3),
    (u_tl6,'tl2@brightsmile.com','Valon Kelmendi',c3),
    (u_op7,'op1@brightsmile.com','Xhensila Cara',c3),
    (u_op8,'op2@brightsmile.com','Yllka Qosja',c3),
    (u_op9,'op3@brightsmile.com','Zamira Loshi',c3)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a3,'company_admin',c3),(u_tl5,'team_leader',c3),(u_tl6,'team_leader',c3),
    (u_op7,'operator',c3),(u_op8,'operator',c3),(u_op9,'operator',c3)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c3,'Agron',  'Muja',    'agron.m@gmail.com',    '+355671001','Implant dentar',      'E HÃ«nÃ« 08:30',   'instagram', 850,c3s1,u_op7,'Kontakt i parÃ«. KÃ«rkon info pÃ«r procesin e implantit.'),
    (c3,'Bora',   'Hysa',    'bora.h@gmail.com',     '+355671002','Faseta porcelani',    'E MartÃ« 09:00',  'facebook', 2200,c3s2,u_op7,'ShumÃ« e interesuar. KÃ«rkon 6 faseta me kÃ«sti.'),
    (c3,'Ã‡esk',   'Gjini',   'cesk.g@gmail.com',     '+355671003','Ortodonci braces',   'E MÃ«rkurÃ« 11:30','referral', 1200,c3s4,u_op7,'Preventiva dÃ«rguar. Ã‡mim 1200â‚¬. Pret pÃ«rgjigje.'),
    (c3,'Dafina', 'Murati',  'dafina.m2@gmail.com',  '+355671004','Zbardhim + Faseta',  'E Enjte 10:00',  'website',  2500,c3s5,u_op8,'Ka preventivÃ«n. KÃ«rkon zbritje 10%. Negociim aktiv.'),
    (c3,'Edon',   'Islami',  'edon.i@gmail.com',     '+355671005','KurorÃ« qeramike',    'E Premte 14:00', 'instagram',  650,c3s6,u_op8,'Konfirmoi vizitÃ«n tÃ« premten 14:00.'),
    (c3,'Flaka',  'Demiri',  'flaka.d@gmail.com',    '+355671006','Implant + KurorÃ«',   'E HÃ«nÃ« 10:30',   'facebook', 2500,c3s7,u_op8,'Operacioni u krye. Kurorja pas 3 muajsh osteointegrim.'),
    (c3,'Gzim',   'Avdyli',  'gzim.a@gmail.com',     '+355671007','ProtezÃ« e plotÃ«',    'E MartÃ« 15:00',  'referral', 1800,c3s8,u_op9,'Proteza u vendos me sukses. Kontrol pas 1 muaji.'),
    (c3,'Hyrije', 'Bajrami', 'hyrije.b@gmail.com',   '+355671008','Zbardhim dhÃ«mbÃ«sh', 'E MÃ«rkurÃ« 09:30','website',   300,c3s9,u_op9,'Nuk donte tÃ« vazhdonte pas shpjegimit. U mbyll dosja.'),
    (c3,'Ilirjan','Tahiri',  'ilirjan.t@gmail.com',  '+355671009','Invisalign',         'E Enjte 11:30',  'instagram',3200,c3s3,u_op9,'DÃ«rgoi foto panoramike. Pret vlerÃ«simin e ortodontistit.');

END $$;
-- Additional leads for all 3 clinics (run after 20260428100000_full_reset_dental.sql)
DO $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
  c1s1 UUID; c1s2 UUID; c1s3 UUID; c1s4 UUID; c1s5 UUID; c1s6 UUID; c1s7 UUID; c1s8 UUID; c1s9 UUID;
  c2s1 UUID; c2s2 UUID; c2s3 UUID; c2s4 UUID; c2s5 UUID; c2s6 UUID; c2s7 UUID; c2s8 UUID; c2s9 UUID;
  c3s1 UUID; c3s2 UUID; c3s3 UUID; c3s4 UUID; c3s5 UUID; c3s6 UUID; c3s7 UUID; c3s8 UUID; c3s9 UUID;
  u_op1 UUID; u_op2 UUID; u_op3 UUID;
  u_op4 UUID; u_op5 UUID; u_op6 UUID;
  u_op7 UUID; u_op8 UUID; u_op9 UUID;
BEGIN
  SELECT id INTO c1 FROM public.companies WHERE name='Dental Tirana';
  SELECT id INTO c2 FROM public.companies WHERE name='SmilePro DurrÃ«s';
  SELECT id INTO c3 FROM public.companies WHERE name='BrightSmile VlorÃ«';

  SELECT id INTO c1s1 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=1;
  SELECT id INTO c1s2 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=2;
  SELECT id INTO c1s3 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=3;
  SELECT id INTO c1s4 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=4;
  SELECT id INTO c1s5 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=5;
  SELECT id INTO c1s6 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=6;
  SELECT id INTO c1s7 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=7;
  SELECT id INTO c1s8 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=8;
  SELECT id INTO c1s9 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=9;

  SELECT id INTO c2s1 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=1;
  SELECT id INTO c2s2 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=2;
  SELECT id INTO c2s3 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=3;
  SELECT id INTO c2s4 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=4;
  SELECT id INTO c2s5 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=5;
  SELECT id INTO c2s6 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=6;
  SELECT id INTO c2s7 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=7;
  SELECT id INTO c2s8 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=8;
  SELECT id INTO c2s9 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=9;

  SELECT id INTO c3s1 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=1;
  SELECT id INTO c3s2 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=2;
  SELECT id INTO c3s3 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=3;
  SELECT id INTO c3s4 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=4;
  SELECT id INTO c3s5 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=5;
  SELECT id INTO c3s6 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=6;
  SELECT id INTO c3s7 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=7;
  SELECT id INTO c3s8 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=8;
  SELECT id INTO c3s9 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=9;

  SELECT id INTO u_op1 FROM auth.users WHERE email='op1@dentaltirana.com';
  SELECT id INTO u_op2 FROM auth.users WHERE email='op2@dentaltirana.com';
  SELECT id INTO u_op3 FROM auth.users WHERE email='op3@dentaltirana.com';
  SELECT id INTO u_op4 FROM auth.users WHERE email='op1@smilepro.com';
  SELECT id INTO u_op5 FROM auth.users WHERE email='op2@smilepro.com';
  SELECT id INTO u_op6 FROM auth.users WHERE email='op3@smilepro.com';
  SELECT id INTO u_op7 FROM auth.users WHERE email='op1@brightsmile.com';
  SELECT id INTO u_op8 FROM auth.users WHERE email='op2@brightsmile.com';
  SELECT id INTO u_op9 FROM auth.users WHERE email='op3@brightsmile.com';

  -- â”€â”€ EXTRA LEADS: Dental Tirana â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c1,'Manjola', 'Zeqiri',  'manjola.z@gmail.com',   '+355681013','Implant dentar',       'E HÃ«nÃ« 11:00',  'instagram',  850,c1s1,u_op1,'Kontakt i ri nga story. KÃ«rkon takime konsultimi falas.'),
    (c1,'Nertil',  'Cela',    'nertil.c@gmail.com',    '+355681014','Ortodonci braces',     'E MartÃ« 09:30', 'facebook',  1200,c1s2,u_op1,'Interes i konfirmuar. KÃ«rkon plan kÃ«stesh.'),
    (c1,'Ornela',  'Bushi',   'ornela.b@gmail.com',    '+355681015','Faseta dhÃ«mbÃ«sh',      'E MÃ«rkurÃ« 16:00','referral', 2200,c1s3,u_op2,'DÃ«rgoi foto. VlerÃ«simi i doktorit nesÃ«r.'),
    (c1,'Petrit',  'Marashi', 'petrit.m@gmail.com',    '+355681016','Zbardhim profesional', 'E Enjte 10:00', 'website',    300,c1s4,u_op2,'Preventiva dÃ«rguar. Pret konfirmim pagese.'),
    (c1,'Qendresa','Gashi',   'qendresa.g@gmail.com',  '+355681017','ProtezÃ« parciale',     'E Premte 11:00','instagram',  900,c1s6,u_op2,'Konfirmoi. Vizita e parÃ« e konsultimit tÃ« hÃ«nÃ«n.'),
    (c1,'Rina',    'Sulaj',   'rina.s@gmail.com',      '+355681018','Implant + Faseta',     'E HÃ«nÃ« 14:00',  'facebook',  3100,c1s7,u_op3,'Trajtim aktiv. Etapa implantit kryer, faseta pas 4 muajsh.'),
    (c1,'SkÃ«nder', 'Haxhiu',  'skender.h@gmail.com',   '+355681019','KurorÃ« qeramike',      'E MartÃ« 12:00', 'referral',   650,c1s8,u_op3,'Kurorja u vendos. Pacient i kÃ«naqur. LÃ«shoi review pozitiv.'),
    (c1,'Teuta',   'Cara',    'teuta.c@gmail.com',     '+355681020','Implant dentar',       'E MÃ«rkurÃ« 15:00','website',   850,c1s9,u_op3,'U largua pasi mori ofertÃ« mÃ« tÃ« lirÃ« gjetkÃ«.'),
    (c1,'Urim',    'Bajrami', 'urim.b@gmail.com',      '+355681021','Ortodonci Invisalign', 'E Enjte 09:00', 'instagram', 3200,c1s2,u_op1,'ShumÃ« i interesuar. KÃ«rkon konsultim me ortodontisten.'),
    (c1,'Vjosa',   'Kelmendi','vjosa.k@gmail.com',     '+355681022','Zbardhim + KurorÃ«',    'E Premte 13:00','facebook',   950,c1s5,u_op2,'Ka preventivÃ«n. Po mendon. Kontakt tjetÃ«r javÃ«n e ardhshme.');

  -- â”€â”€ EXTRA LEADS: SmilePro DurrÃ«s â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c2,'Jona',    'Demiri',  'jona.d@gmail.com',      '+355691010','Implant dentar',       'E HÃ«nÃ« 10:00',  'instagram',  850,c2s1,u_op4,'Kontakt i parÃ«. Interesim fillestar pas storjes.'),
    (c2,'Klajdi',  'Mema',    'klajdi.m@gmail.com',    '+355691011','Ortodonci braces',     'E MartÃ« 11:00', 'facebook',  1200,c2s2,u_op4,'I interesuar. Ka kontrolluar Ã§mimet online.'),
    (c2,'Laura',   'Prifti',  'laura.p@gmail.com',     '+355691012','Faseta porcelani',     'E MÃ«rkurÃ« 10:30','referral', 2200,c2s3,u_op5,'Foto dÃ«rguar. Ã‡mimi 2200â‚¬. Pret ofertÃ«n finale.'),
    (c2,'Mihail',  'Zoto',    'mihail.z@gmail.com',    '+355691013','ProtezÃ« e plotÃ«',      'E Enjte 14:00', 'website',   1800,c2s4,u_op5,'Preventiva dÃ«rguar me detaje. Pret vendim.'),
    (c2,'Nevila',  'Lamaj',   'nevila.l@gmail.com',    '+355691014','Zbardhim dhÃ«mbÃ«sh',   'E Premte 09:00','instagram',  300,c2s5,u_op5,'Ka preventivÃ«n. I dÃ«rgua zbritje speciale 15%.'),
    (c2,'Orgest',  'Tosku',   'orgest.t@gmail.com',    '+355691015','Implant + KurorÃ«',    'E HÃ«nÃ« 15:00',  'facebook',  2500,c2s6,u_op6,'Konfirmoi vizitÃ«n. Rasti kompleks 2 implante.'),
    (c2,'Pranvera','Kaziu',   'pranvera.k@gmail.com',  '+355691016','Ortodonci Invisalign','E MartÃ« 10:00', 'referral',  3200,c2s7,u_op6,'Trajtim aktiv. Aligners faza e dytÃ«.'),
    (c2,'Qirjako', 'Caci',    'qirjako.c@gmail.com',   '+355691017','KurorÃ« qeramike',     'E MÃ«rkurÃ« 13:00','website',   650,c2s8,u_op6,'Trajtim pÃ«rfundoi. Pacienti shumÃ« i kÃ«naqur.'),
    (c2,'Rozana',  'Hysa',    'rozana.h@gmail.com',    '+355691018','Faseta dhÃ«mbÃ«sh',     'E Enjte 11:30', 'instagram', 2200,c2s9,u_op4,'U largua. Tha Ã§mimi ishte mbi buxhetin.'),
    (c2,'ShpÃ«tim', 'Arapi',   'shpetim.a@gmail.com',  '+355691019','Implant dentar',       'E Premte 14:00','facebook',   850,c2s2,u_op5,'I interesuar. KÃ«rkon informacion shtesÃ« nga doktori.');

  -- â”€â”€ EXTRA LEADS: BrightSmile VlorÃ« â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c3,'Jonuzi',  'Beqiri',  'jonuzi.b@gmail.com',   '+355671010','Implant dentar',        'E HÃ«nÃ« 08:00',  'instagram',  850,c3s1,u_op7,'Kontakt i parÃ«. Klient potencial i lartÃ«.'),
    (c3,'Kaltrina','Rama',    'kaltrina.r@gmail.com', '+355671011','Faseta + Zbardhim',     'E MartÃ« 10:00', 'facebook',  2500,c3s2,u_op7,'ShumÃ« e interesuar. KÃ«rkon paketÃ« komplete.'),
    (c3,'Liridon', 'Gashi',   'liridon.g@gmail.com',  '+355671012','Ortodonci braces',     'E MÃ«rkurÃ« 15:00','referral', 1200,c3s4,u_op7,'Preventiva dÃ«rguar. NdÃ«rhyrje e nevojshme gjerÃ«sisht.'),
    (c3,'Mimoza',  'Hyseni',  'mimoza.h@gmail.com',   '+355671013','ProtezÃ« parciale',      'E Enjte 09:30', 'website',    900,c3s5,u_op8,'Ka preventivÃ«n. KÃ«rkon tÃ« paguajÃ« me kÃ«ste.'),
    (c3,'Naim',    'Krasniqi','naim.k@gmail.com',     '+355671014','KurorÃ« qeramike',       'E Premte 11:00','instagram',  650,c3s6,u_op8,'Konfirmoi. Trajtimi fillon tÃ« hÃ«nÃ«n.'),
    (c3,'Ollga',   'Xhelo',   'ollga.x@gmail.com',    '+355671015','Implant + Faseta',      'E HÃ«nÃ« 13:00',  'facebook',  3100,c3s7,u_op8,'Trajtim aktiv. Faza e implantit kryer pa komplikime.'),
    (c3,'PÃ«rparim','Latifi',  'perparim.l@gmail.com', '+355671016','Zbardhim profesional',  'E MartÃ« 14:30', 'referral',   300,c3s8,u_op9,'Trajtim i suksesshÃ«m. Pacienti i lumtur. Ka rekomanduar 3 miq.'),
    (c3,'Qamile',  'Deda',    'qamile.d@gmail.com',   '+355671017','Implant dentar',        'E MÃ«rkurÃ« 10:30','website',   850,c3s9,u_op9,'Refuzoi trajtimin pas konsultimit. Arsyeja: frika nga kirurgjia.'),
    (c3,'Rezart',  'Ã‡upi',    'rezart.c@gmail.com',   '+355671018','Ortodonci Invisalign', 'E Enjte 15:00', 'instagram', 3200,c3s3,u_op9,'Foto panoramike dÃ«rguar. Rast kompleks, pret vlerÃ«simin.'),
    (c3,'Sonja',   'Leka',    'sonja.l@gmail.com',    '+355671019','Faseta porcelani',      'E Premte 09:00','facebook',  2200,c3s2,u_op7,'I interesuar. Do vijÃ« me bashkÃ«shorten pÃ«r konsultim.');

END $$;
-- Allow super_admin to read ALL leads, pipeline_stages, profiles, companies

-- LEADS
DROP POLICY IF EXISTS "super_admin_read_all_leads" ON public.leads;
CREATE POLICY "super_admin_read_all_leads" ON public.leads
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- PIPELINE_STAGES
DROP POLICY IF EXISTS "super_admin_read_all_stages" ON public.pipeline_stages;
CREATE POLICY "super_admin_read_all_stages" ON public.pipeline_stages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- PROFILES
DROP POLICY IF EXISTS "super_admin_read_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_read_all_profiles" ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );

-- COMPANIES
DROP POLICY IF EXISTS "super_admin_read_all_companies" ON public.companies;
CREATE POLICY "super_admin_read_all_companies" ON public.companies
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'super_admin'
    )
  );
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- RLS REDESIGN + PERFORMANCE
-- Hierarchy: super_admin > company_admin > team_leader > operator
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ 1. INDEXES for performance â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id   ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_company   ON public.user_roles(company_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role      ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_company     ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_company        ON public.leads(company_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned       ON public.leads(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage          ON public.leads(pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_stages_company       ON public.pipeline_stages(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned       ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_activities_lead      ON public.lead_activities(lead_id);

-- â”€â”€ 2. HELPER FUNCTIONS (SECURITY DEFINER = bypass RLS, fast) â”€â”€â”€

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role::TEXT FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_my_company()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
$$;

-- â”€â”€ 3. DROP ALL OLD POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- companies
DROP POLICY IF EXISTS "super_admin_all_companies"        ON public.companies;
DROP POLICY IF EXISTS "company_members_view"             ON public.companies;
DROP POLICY IF EXISTS "super_admin_read_all_companies"   ON public.companies;

-- profiles
DROP POLICY IF EXISTS "users_view_own_profile"           ON public.profiles;
DROP POLICY IF EXISTS "users_update_own_profile"         ON public.profiles;
DROP POLICY IF EXISTS "company_members_view_profiles"    ON public.profiles;
DROP POLICY IF EXISTS "super_admin_all_profiles"         ON public.profiles;
DROP POLICY IF EXISTS "super_admin_read_all_profiles"    ON public.profiles;

-- user_roles
DROP POLICY IF EXISTS "super_admin_all_roles"            ON public.user_roles;
DROP POLICY IF EXISTS "users_view_own_role"              ON public.user_roles;
DROP POLICY IF EXISTS "company_admin_manage_roles"       ON public.user_roles;

-- pipeline_stages
DROP POLICY IF EXISTS "company_members_view_stages"      ON public.pipeline_stages;
DROP POLICY IF EXISTS "company_admin_manage_stages"      ON public.pipeline_stages;
DROP POLICY IF EXISTS "super_admin_read_all_stages"      ON public.pipeline_stages;

-- leads
DROP POLICY IF EXISTS "super_admin_all_leads"            ON public.leads;
DROP POLICY IF EXISTS "super_admin_read_all_leads"       ON public.leads;
DROP POLICY IF EXISTS "operators_view_assigned_leads"    ON public.leads;
DROP POLICY IF EXISTS "operators_update_assigned_leads"  ON public.leads;
DROP POLICY IF EXISTS "tl_admin_view_company_leads"      ON public.leads;
DROP POLICY IF EXISTS "tl_admin_update_company_leads"    ON public.leads;
DROP POLICY IF EXISTS "tl_admin_insert_leads"            ON public.leads;
DROP POLICY IF EXISTS "company_admin_delete_leads"       ON public.leads;

-- lead_activities
DROP POLICY IF EXISTS "super_admin_all_activities"       ON public.lead_activities;
DROP POLICY IF EXISTS "view_activities_via_lead"         ON public.lead_activities;
DROP POLICY IF EXISTS "insert_activity_via_lead"         ON public.lead_activities;

-- tasks
DROP POLICY IF EXISTS "super_admin_all_tasks"            ON public.tasks;
DROP POLICY IF EXISTS "view_tasks_via_lead"              ON public.tasks;
DROP POLICY IF EXISTS "manage_tasks_tl_admin"            ON public.tasks;

-- â”€â”€ 4. COMPANIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin: full access
CREATE POLICY "sa_companies_all" ON public.companies FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- others: see only their own company
CREATE POLICY "member_view_own_company" ON public.companies FOR SELECT
  USING (id = public.get_my_company());

-- super_admin can insert/update companies (already covered by sa_companies_all)

-- â”€â”€ 5. PROFILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin: see all
CREATE POLICY "sa_profiles_all" ON public.profiles FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- own profile: always readable + updatable
CREATE POLICY "own_profile_select" ON public.profiles FOR SELECT
  USING (id = auth.uid());
CREATE POLICY "own_profile_update" ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- company_admin + team_leader: see all profiles in same company
CREATE POLICY "admin_tl_view_company_profiles" ON public.profiles FOR SELECT
  USING (
    company_id = public.get_my_company()
    AND (
      public.is_company_admin(auth.uid(), company_id)
      OR public.is_team_leader(auth.uid(), company_id)
    )
  );

-- operator: see profiles in same company (to show assignee names)
CREATE POLICY "operator_view_company_profiles" ON public.profiles FOR SELECT
  USING (company_id = public.get_my_company());

-- â”€â”€ 6. USER ROLES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin: full
CREATE POLICY "sa_roles_all" ON public.user_roles FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- own role: always readable
CREATE POLICY "own_role_select" ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- company_admin: see + manage roles in their company
CREATE POLICY "ca_manage_company_roles" ON public.user_roles FOR ALL
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- team_leader: see roles in their company
CREATE POLICY "tl_view_company_roles" ON public.user_roles FOR SELECT
  USING (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));

-- â”€â”€ 7. PIPELINE STAGES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin
CREATE POLICY "sa_stages_all" ON public.pipeline_stages FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- all company members can read their stages
CREATE POLICY "company_member_view_stages" ON public.pipeline_stages FOR SELECT
  USING (company_id = public.get_my_company());

-- company_admin: full manage
CREATE POLICY "ca_manage_stages" ON public.pipeline_stages FOR ALL
  USING (public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin(auth.uid(), company_id));

-- â”€â”€ 8. LEADS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin: see all
CREATE POLICY "sa_leads_all" ON public.leads FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- company_admin: full access to all leads in their company
CREATE POLICY "ca_leads_all" ON public.leads FOR ALL
  USING (company_id = public.get_my_company() AND public.is_company_admin(auth.uid(), company_id))
  WITH CHECK (company_id = public.get_my_company() AND public.is_company_admin(auth.uid(), company_id));

-- team_leader: see ALL leads in company, update assigned ones
CREATE POLICY "tl_view_company_leads" ON public.leads FOR SELECT
  USING (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));

CREATE POLICY "tl_update_company_leads" ON public.leads FOR UPDATE
  USING (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));

-- operator: see + update only their assigned leads
CREATE POLICY "op_view_assigned_leads" ON public.leads FOR SELECT
  USING (
    assigned_to_user_id = auth.uid()
    AND company_id = public.get_my_company()
  );

CREATE POLICY "op_update_assigned_leads" ON public.leads FOR UPDATE
  USING (
    assigned_to_user_id = auth.uid()
    AND company_id = public.get_my_company()
  );

-- â”€â”€ 9. LEAD ACTIVITIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin
CREATE POLICY "sa_activities_all" ON public.lead_activities FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- anyone who can see the lead can see its activities
CREATE POLICY "view_activities" ON public.lead_activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- anyone who can see the lead can insert activities
CREATE POLICY "insert_activities" ON public.lead_activities FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        l.assigned_to_user_id = auth.uid()
        OR public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- â”€â”€ 10. TASKS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- super_admin
CREATE POLICY "sa_tasks_all" ON public.tasks FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- see tasks on leads you can access
CREATE POLICY "view_tasks" ON public.tasks FOR SELECT
  USING (
    assigned_to = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- company_admin + team_leader: manage tasks
CREATE POLICY "manage_tasks" ON public.tasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leads l WHERE l.id = lead_id AND (
        public.is_company_admin(auth.uid(), l.company_id)
        OR public.is_team_leader(auth.uid(), l.company_id)
      )
    )
  );

-- operator: update their own tasks
CREATE POLICY "op_update_own_tasks" ON public.tasks FOR UPDATE
  USING (assigned_to = auth.uid());
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
-- Update passwords for operator1 and operator2 to "password01"
UPDATE auth.users
SET
  encrypted_password = crypt('password01', gen_salt('bf')),
  updated_at = now()
WHERE email IN ('operator1@medique.com', 'operator2@medique.com');
-- Add team_leader_id to profiles so operators are linked to a team leader
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_leader_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_team_leader ON public.profiles(team_leader_id);
-- team_leader: allow INSERT on leads within their company
CREATE POLICY "tl_insert_leads" ON public.leads FOR INSERT
  WITH CHECK (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));
-- team_leader: allow DELETE on leads within their company
CREATE POLICY "tl_delete_leads" ON public.leads FOR DELETE
  USING (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- SECURITY HARDENING
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- 1. Make lead-attachments storage bucket PRIVATE
--    Files are now only accessible via signed URLs (generated server-side)
UPDATE storage.buckets SET public = false WHERE id = 'lead-attachments';

-- 2. Storage object RLS policies
--    Authenticated users can upload/download/delete within lead-attachments.
--    Business-logic access control is enforced by lead_attachments table RLS.
DROP POLICY IF EXISTS "storage_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_auth_delete" ON storage.objects;

CREATE POLICY "storage_auth_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lead-attachments');

CREATE POLICY "storage_auth_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lead-attachments');

CREATE POLICY "storage_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lead-attachments');

-- 3. Fix attachment DELETE policy:
--    company_admin and team_leader can delete any attachment in their company,
--    operators can only delete attachments they uploaded themselves.
DROP POLICY IF EXISTS "delete_attachments" ON public.lead_attachments;

CREATE POLICY "delete_attachments" ON public.lead_attachments FOR DELETE
  USING (
    public.is_super_admin(auth.uid())
    OR uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_id
        AND (
          public.is_company_admin(auth.uid(), l.company_id)
          OR public.is_team_leader(auth.uid(), l.company_id)
        )
    )
  );

-- 4. Index on webhook token column for fast lookups
CREATE INDEX IF NOT EXISTS idx_company_webhook_tokens_token
  ON public.company_webhook_tokens(token);
-- Track when a lead's pipeline stage last changed so we can sort by it
-- (status-changed leads sink to the bottom; new/unprocessed leads stay at top)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;
-- Performance indexes for leads table queries
CREATE INDEX IF NOT EXISTS idx_leads_company_id        ON public.leads (company_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to       ON public.leads (assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage    ON public.leads (pipeline_stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_updated_at        ON public.leads (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_company_updated   ON public.leads (company_id, updated_at DESC);
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
-- COMPREHENSIVE PERFORMANCE UPGRADE
-- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

-- â”€â”€ 1. MISSING INDEXES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

-- partial index â€” the app always queries WHERE completed = false
CREATE INDEX IF NOT EXISTS idx_tasks_open_due
  ON public.tasks(completed, due_date)
  WHERE completed = false;

-- calendar events
CREATE INDEX IF NOT EXISTS idx_calendar_user_id
  ON public.calendar_events(user_id);


-- â”€â”€ 2. ADD company_id TO lead_activities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ 3. ADD company_id TO tasks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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


-- â”€â”€ 4. REWRITE EXPENSIVE RLS POLICIES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Old policies did EXISTS(SELECT 1 FROM leads ...) for every row.
-- New policies use the direct company_id column â€” one index lookup.

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
