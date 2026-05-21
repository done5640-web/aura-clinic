
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
