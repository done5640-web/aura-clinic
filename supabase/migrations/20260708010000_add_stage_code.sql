-- ═══════════════════════════════════════════════════════════════════
-- PIPELINE STAGES — stable "code" column decoupled from display name
-- Lets stage names be freely renamed/translated without breaking
-- badge color logic, which now keys off `code` instead of `name`.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS code TEXT;

-- Backfill the known default stages (matched by current name) with a
-- stable code. Custom/renamed stages are left with code = NULL, which
-- the app treats as "no special color" (default/grey).
UPDATE public.pipeline_stages SET code = 'no_answer'        WHERE name = 'No Answer';
UPDATE public.pipeline_stages SET code = 'not_interested'   WHERE name = 'Non interesato';
UPDATE public.pipeline_stages SET code = 'not_responding'   WHERE name = 'Non risponde';
UPDATE public.pipeline_stages SET code = 'quote_sent'       WHERE name = 'Preventivo inviato';
UPDATE public.pipeline_stages SET code = 'call_back'        WHERE name = 'Call back';
UPDATE public.pipeline_stages SET code = 'awaiting_photos'  WHERE name = 'Attesa photo';
UPDATE public.pipeline_stages SET code = 'follow_up_months' WHERE name = 'Richiamo piu mesi';
UPDATE public.pipeline_stages SET code = 'not_eligible'     WHERE name = 'Non idoneo';
UPDATE public.pipeline_stages SET code = 'wrong_number'     WHERE name = 'Numero sbagliato';
UPDATE public.pipeline_stages SET code = 'whatsapp_message' WHERE name = 'Messagio whatsApp';
UPDATE public.pipeline_stages SET code = 'new_lead'         WHERE name = 'New Lead';

-- Now translate the display names to English. Safe to run even though
-- code is now stable, since color lookups no longer depend on name.
UPDATE public.pipeline_stages SET name = 'Not Interested'      WHERE code = 'not_interested';
UPDATE public.pipeline_stages SET name = 'Not Responding'      WHERE code = 'not_responding';
UPDATE public.pipeline_stages SET name = 'Quote Sent'          WHERE code = 'quote_sent';
UPDATE public.pipeline_stages SET name = 'Call Back'           WHERE code = 'call_back';
UPDATE public.pipeline_stages SET name = 'Awaiting Photos'     WHERE code = 'awaiting_photos';
UPDATE public.pipeline_stages SET name = 'Follow Up in Months' WHERE code = 'follow_up_months';
UPDATE public.pipeline_stages SET name = 'Not Eligible'        WHERE code = 'not_eligible';
UPDATE public.pipeline_stages SET name = 'Wrong Number'        WHERE code = 'wrong_number';
UPDATE public.pipeline_stages SET name = 'WhatsApp Message'    WHERE code = 'whatsapp_message';
