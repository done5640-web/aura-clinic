-- ════════════════════════════════════════════════════════
-- SECURITY HARDENING
-- ════════════════════════════════════════════════════════

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
