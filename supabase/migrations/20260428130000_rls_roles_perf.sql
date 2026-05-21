-- ═══════════════════════════════════════════════════════════════════
-- RLS REDESIGN + PERFORMANCE
-- Hierarchy: super_admin > company_admin > team_leader > operator
-- ═══════════════════════════════════════════════════════════════════

-- ── 1. INDEXES for performance ───────────────────────────────────
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

-- ── 2. HELPER FUNCTIONS (SECURITY DEFINER = bypass RLS, fast) ───

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

-- ── 3. DROP ALL OLD POLICIES ─────────────────────────────────────

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

-- ── 4. COMPANIES ─────────────────────────────────────────────────
-- super_admin: full access
CREATE POLICY "sa_companies_all" ON public.companies FOR ALL
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- others: see only their own company
CREATE POLICY "member_view_own_company" ON public.companies FOR SELECT
  USING (id = public.get_my_company());

-- super_admin can insert/update companies (already covered by sa_companies_all)

-- ── 5. PROFILES ──────────────────────────────────────────────────
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

-- ── 6. USER ROLES ────────────────────────────────────────────────
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

-- ── 7. PIPELINE STAGES ───────────────────────────────────────────
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

-- ── 8. LEADS ─────────────────────────────────────────────────────
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

-- ── 9. LEAD ACTIVITIES ───────────────────────────────────────────
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

-- ── 10. TASKS ────────────────────────────────────────────────────
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
