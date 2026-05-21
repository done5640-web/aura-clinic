-- team_leader: allow INSERT on leads within their company
CREATE POLICY "tl_insert_leads" ON public.leads FOR INSERT
  WITH CHECK (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));
