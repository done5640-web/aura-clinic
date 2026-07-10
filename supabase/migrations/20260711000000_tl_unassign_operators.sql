-- ═══════════════════════════════════════════════════════════════════
-- PROFILES — let a team_leader remove their own operators from their
-- team (clear team_leader_id). Scoped to rows currently assigned to
-- the caller, so a team_leader can only touch their own operators.
-- ═══════════════════════════════════════════════════════════════════

CREATE POLICY "tl_unassign_own_operators" ON public.profiles FOR UPDATE
  USING (
    team_leader_id = auth.uid()
    AND public.is_team_leader(auth.uid(), company_id)
  )
  WITH CHECK (
    public.is_team_leader(auth.uid(), company_id)
  );
