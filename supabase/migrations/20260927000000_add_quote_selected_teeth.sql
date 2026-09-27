-- ═══════════════════════════════════════════════════════════════════
-- PREVENTIV — tooth chart selection (shown on the generated PDF)
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.quotes
  -- FDI tooth numbers selected on the tooth chart, e.g. [11, 12, 46]
  ADD COLUMN IF NOT EXISTS selected_teeth JSONB NOT NULL DEFAULT '[]'::jsonb;
