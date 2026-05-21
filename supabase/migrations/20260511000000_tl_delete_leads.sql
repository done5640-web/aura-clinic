-- team_leader: allow DELETE on leads within their company
CREATE POLICY "tl_delete_leads" ON public.leads FOR DELETE
  USING (company_id = public.get_my_company() AND public.is_team_leader(auth.uid(), company_id));
