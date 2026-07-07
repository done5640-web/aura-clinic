-- ═══════════════════════════════════════════════════════════════════
-- PREVENTIV — validity date, footer contact line, editable services checklist
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS valid_until DATE,
  ADD COLUMN IF NOT EXISTS contact_line TEXT NOT NULL DEFAULT 'Contact: +35569606271',
  ADD COLUMN IF NOT EXISTS website_line TEXT NOT NULL DEFAULT 'Website: www.auravitaclinic.al',
  -- Each entry: { text, checked }
  ADD COLUMN IF NOT EXISTS services_checklist JSONB;
