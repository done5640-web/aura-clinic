-- Track when a lead's pipeline stage last changed so we can sort by it
-- (status-changed leads sink to the bottom; new/unprocessed leads stay at top)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ DEFAULT NULL;
