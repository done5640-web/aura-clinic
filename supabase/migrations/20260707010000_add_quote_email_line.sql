-- ═══════════════════════════════════════════════════════════════════
-- PREVENTIV — footer email line
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS email_line TEXT NOT NULL DEFAULT 'Email: clinicauravita@gmail.com';
