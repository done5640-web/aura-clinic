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
