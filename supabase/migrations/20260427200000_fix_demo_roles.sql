-- Fix demo user roles that were silently skipped due to RLS during seeding.
-- This migration runs with superuser privileges and bypasses RLS entirely.

DO $$
DECLARE
  v_company_id UUID;
  v_user_id UUID;
BEGIN

  -- ── 1. Ensure Acme Sales Co exists ──────────────────────────────────────
  SELECT id INTO v_company_id FROM public.companies WHERE name = 'Acme Sales Co' LIMIT 1;
  IF v_company_id IS NULL THEN
    INSERT INTO public.companies (name, plan, status)
    VALUES ('Acme Sales Co', 'growth', 'active')
    RETURNING id INTO v_company_id;
  END IF;

  -- ── 2. Helper: upsert role for a user by email ───────────────────────────
  -- super_admin (no company)
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'superadmin@demo.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    -- fix profile
    UPDATE public.profiles SET full_name = 'Super Admin', company_id = NULL WHERE id = v_user_id;
    -- upsert role
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'super_admin', NULL)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- company_admin
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'admin@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Alice Admin', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'company_admin', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- team_leader 1
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'leader1@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Tom Leader', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'team_leader', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- team_leader 2
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'leader2@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Sara Lead', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'team_leader', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 1
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op1@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Oliver One', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 2
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op2@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Olivia Two', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 3
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op3@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Owen Three', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

  -- operator 4
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'op4@acme.com' LIMIT 1;
  IF v_user_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Octavia Four', company_id = v_company_id WHERE id = v_user_id;
    INSERT INTO public.user_roles (user_id, role, company_id)
    VALUES (v_user_id, 'operator', v_company_id)
    ON CONFLICT (user_id, role, company_id) DO NOTHING;
  END IF;

END $$;

-- Also fix the unique constraint for user_roles so NULL company_id works correctly
-- (NULL != NULL in SQL, so the unique constraint on (user_id, role, company_id)
--  doesn't catch duplicates when company_id IS NULL for super_admin)
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_super_admin_unique
  ON public.user_roles (user_id, role)
  WHERE company_id IS NULL;
