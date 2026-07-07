-- ═══════════════════════════════════════════════════════════════════
-- PREVENTIV — fix phone number typo in contact_line default (missing digit)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.quotes
  ALTER COLUMN contact_line SET DEFAULT 'Contact: +355696062711';
