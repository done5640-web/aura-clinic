-- ═══════════════════════════════════════════════════════════════════
-- STEP 1: Run this first — wipe + create users via supabase_auth_admin
-- ═══════════════════════════════════════════════════════════════════

-- Add dental columns
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS sherbimi TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS kur_kontaktohet TEXT;

-- Wipe all tenant data
DELETE FROM public.lead_activities;
DELETE FROM public.tasks;
DELETE FROM public.leads;
DELETE FROM public.pipeline_stages;
DELETE FROM public.company_webhook_tokens;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;
DELETE FROM public.companies;

-- Delete old demo users from auth (not super admin)
DELETE FROM auth.users WHERE email LIKE '%@dentaltirana.com'
  OR email LIKE '%@smilepro.com'
  OR email LIKE '%@brightsmile.com'
  OR email IN ('superadmin@demo.com','admin@acme.com','leader1@acme.com','leader2@acme.com',
               'op1@acme.com','op2@acme.com','op3@acme.com','op4@acme.com',
               'ledionemema31@gmail.com','lediomema31@gmail.com');

-- Reset super admin password
UPDATE auth.users SET
  encrypted_password = crypt('Demo1234!', gen_salt('bf')),
  email_confirmed_at = now(),
  raw_user_meta_data = '{"full_name":"Pamela Admin"}',
  updated_at = now()
WHERE email = 'pamela@auravitaclinic.al';

-- Create all users using select from auth.users as template (copies instance_id etc)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
)
SELECT
  instance_id,
  gen_random_uuid(),
  aud, role,
  u.new_email,
  crypt('Demo1234!', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  json_build_object('full_name', u.full_name)::jsonb,
  now(), now(), '', '', '', ''
FROM (VALUES
  ('admin@dentaltirana.com', 'Arben Krasniqi'),
  ('tl1@dentaltirana.com',   'Besa Hoxha'),
  ('tl2@dentaltirana.com',   'Gentian Leka'),
  ('op1@dentaltirana.com',   'Elira Duka'),
  ('op2@dentaltirana.com',   'Fisnik Rama'),
  ('op3@dentaltirana.com',   'Gresa Berisha'),
  ('admin@smilepro.com',     'Mirela Dervishi'),
  ('tl1@smilepro.com',       'Nertil Çela'),
  ('tl2@smilepro.com',       'Ornela Vlashi'),
  ('op1@smilepro.com',       'Petrit Gega'),
  ('op2@smilepro.com',       'Rezarta Hyka'),
  ('op3@smilepro.com',       'Sonila Popa'),
  ('admin@brightsmile.com',  'Taulant Xhafa'),
  ('tl1@brightsmile.com',    'Urejtë Shala'),
  ('tl2@brightsmile.com',    'Valon Kelmendi'),
  ('op1@brightsmile.com',    'Xhensila Cara'),
  ('op2@brightsmile.com',    'Yllka Qosja'),
  ('op3@brightsmile.com',    'Zamira Loshi')
) AS u(new_email, full_name)
CROSS JOIN (SELECT instance_id, aud, role FROM auth.users WHERE email='pamela@auravitaclinic.al' LIMIT 1) AS tmpl;

-- ═══════════════════════════════════════════════════════════════════
-- STEP 2: Seed companies, roles, leads
-- ═══════════════════════════════════════════════════════════════════
DO $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
  c1s1 UUID; c1s2 UUID; c1s3 UUID; c1s4 UUID; c1s5 UUID; c1s6 UUID; c1s7 UUID; c1s8 UUID; c1s9 UUID;
  c2s1 UUID; c2s2 UUID; c2s3 UUID; c2s4 UUID; c2s5 UUID; c2s6 UUID; c2s7 UUID; c2s8 UUID; c2s9 UUID;
  c3s1 UUID; c3s2 UUID; c3s3 UUID; c3s4 UUID; c3s5 UUID; c3s6 UUID; c3s7 UUID; c3s8 UUID; c3s9 UUID;
  u_sa  UUID;
  u_a1  UUID; u_tl1 UUID; u_tl2 UUID; u_op1 UUID; u_op2 UUID; u_op3 UUID;
  u_a2  UUID; u_tl3 UUID; u_tl4 UUID; u_op4 UUID; u_op5 UUID; u_op6 UUID;
  u_a3  UUID; u_tl5 UUID; u_tl6 UUID; u_op7 UUID; u_op8 UUID; u_op9 UUID;
BEGIN
  SELECT id INTO u_sa  FROM auth.users WHERE email='pamela@auravitaclinic.al';
  SELECT id INTO u_a1  FROM auth.users WHERE email='admin@dentaltirana.com';
  SELECT id INTO u_tl1 FROM auth.users WHERE email='tl1@dentaltirana.com';
  SELECT id INTO u_tl2 FROM auth.users WHERE email='tl2@dentaltirana.com';
  SELECT id INTO u_op1 FROM auth.users WHERE email='op1@dentaltirana.com';
  SELECT id INTO u_op2 FROM auth.users WHERE email='op2@dentaltirana.com';
  SELECT id INTO u_op3 FROM auth.users WHERE email='op3@dentaltirana.com';
  SELECT id INTO u_a2  FROM auth.users WHERE email='admin@smilepro.com';
  SELECT id INTO u_tl3 FROM auth.users WHERE email='tl1@smilepro.com';
  SELECT id INTO u_tl4 FROM auth.users WHERE email='tl2@smilepro.com';
  SELECT id INTO u_op4 FROM auth.users WHERE email='op1@smilepro.com';
  SELECT id INTO u_op5 FROM auth.users WHERE email='op2@smilepro.com';
  SELECT id INTO u_op6 FROM auth.users WHERE email='op3@smilepro.com';
  SELECT id INTO u_a3  FROM auth.users WHERE email='admin@brightsmile.com';
  SELECT id INTO u_tl5 FROM auth.users WHERE email='tl1@brightsmile.com';
  SELECT id INTO u_tl6 FROM auth.users WHERE email='tl2@brightsmile.com';
  SELECT id INTO u_op7 FROM auth.users WHERE email='op1@brightsmile.com';
  SELECT id INTO u_op8 FROM auth.users WHERE email='op2@brightsmile.com';
  SELECT id INTO u_op9 FROM auth.users WHERE email='op3@brightsmile.com';

  -- Super admin
  INSERT INTO public.profiles (id,email,full_name) VALUES (u_sa,'pamela@auravitaclinic.al','Pamela Admin') ON CONFLICT (id) DO UPDATE SET full_name='Pamela Admin',company_id=NULL;
  INSERT INTO public.user_roles (user_id,role,company_id) VALUES (u_sa,'super_admin',NULL) ON CONFLICT DO NOTHING;

  -- ── COMPANY 1: Dental Tirana ────────────────────────────────────
  INSERT INTO public.companies (name,plan,status) VALUES ('Dental Tirana','growth','active') RETURNING id INTO c1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Kontakt i Parë',      1,'#3b82f6') RETURNING id INTO c1s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c1s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Dërgoi Foto',          3,'#06b6d4') RETURNING id INTO c1s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Dërgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c1s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Në Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c1s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Konfirmuar – Vizitë',  6,'#10b981') RETURNING id INTO c1s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Trajtim në Kurs',      7,'#a855f7') RETURNING id INTO c1s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Mbyllur – Fituar',     8,'#22c55e') RETURNING id INTO c1s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c1,'Mbyllur – Pa Interes', 9,'#ef4444') RETURNING id INTO c1s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a1,'admin@dentaltirana.com','Arben Krasniqi',c1),
    (u_tl1,'tl1@dentaltirana.com','Besa Hoxha',c1),
    (u_tl2,'tl2@dentaltirana.com','Gentian Leka',c1),
    (u_op1,'op1@dentaltirana.com','Elira Duka',c1),
    (u_op2,'op2@dentaltirana.com','Fisnik Rama',c1),
    (u_op3,'op3@dentaltirana.com','Gresa Berisha',c1)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a1,'company_admin',c1),(u_tl1,'team_leader',c1),(u_tl2,'team_leader',c1),
    (u_op1,'operator',c1),(u_op2,'operator',c1),(u_op3,'operator',c1)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c1,'Andi',    'Shehu',  'andi.shehu@gmail.com',  '+355681001','Implant dentar',       'E Hënë 10:00',   'instagram', 850,c1s1,u_op1,'I kontaktuar nga Instagram. Interes i lartë për implant.'),
    (c1,'Blerina', 'Muça',   'blerina.m@gmail.com',   '+355681002','Ortodonci – Braces',   'E Martë 11:30',  'facebook', 1200,c1s2,u_op1,'Shprehu interes. Pyet çmimin e brecave dhe kohëzgjatjen.'),
    (c1,'Clirim',  'Zeka',   'clirim.z@gmail.com',    '+355681003','Zbardhim dhëmbësh',    'E Mërkurë 09:00','referral',  300,c1s3,u_op1,'Dërgoi foto dhëmbësh. Pret preventivën nga doktori.'),
    (c1,'Donika',  'Prendi', 'donika.p@gmail.com',    '+355681004','Protezë e plotë',      'E Enjte 14:00',  'website',  1800,c1s4,u_op2,'Preventiva dërguar me email. Çmimi 1800€. Pret konfirmim.'),
    (c1,'Erion',   'Malaj',  'erion.m@gmail.com',     '+355681005','Faseta porcelani',     'E Premte 15:00', 'instagram',2200,c1s5,u_op2,'Ka preventivën. Po mendon. Do japë përgjigje brenda javës.'),
    (c1,'Fatbardha','Gjoka', 'fatbardha@gmail.com',   '+355681006','Implant + Kurorë',     'E Hënë 09:30',   'facebook', 2500,c1s6,u_op2,'Konfirmoi vizitën. I dërgua reminder SMS.'),
    (c1,'Gëzim',   'Hoxhaj','gezim.h@gmail.com',      '+355681007','Ortodonci Invisalign', 'E Martë 10:00',  'referral', 3200,c1s7,u_op3,'Trajtimi ka filluar. Vizita e dytë kontrollit planifikuar.'),
    (c1,'Hajrie',  'Osmani','hajrie.o@gmail.com',      '+355681008','Zbardhim dhëmbësh',   'E Mërkurë 11:00','website',   300,c1s8,u_op3,'Trajtim i suksesshëm. Pacienti i kënaqur. Feedback pozitiv.'),
    (c1,'Ilir',    'Basha', 'ilir.basha@gmail.com',   '+355681009','Implant dentar',       'E Enjte 16:00',  'instagram', 850,c1s9,u_op3,'Nuk pranoi çmimin. Ka shkuar tek konkurrenti.'),
    (c1,'Jonida',  'Keli',  'jonida.k@gmail.com',     '+355681010','Kurorë qeramike',      'E Premte 10:00', 'facebook',  650,c1s2,u_op1,'E interesuar. Kërkon informacion shtesë për materialet.'),
    (c1,'Klejd',   'Laci',  'klejd.l@gmail.com',      '+355681011','Protezë parciale',     'E Hënë 13:00',   'referral',  900,c1s3,u_op2,'Dërgoi foto panoramike. Presim vlerësimin e doktorit.'),
    (c1,'Luljeta', 'Marku', 'luljeta.m@gmail.com',    '+355681012','Faseta + Zbardhim',   'E Martë 15:30',  'website',  2800,c1s5,u_op3,'Ka preventivën. Kërkon zbritje. Negociim aktiv.');

  -- ── COMPANY 2: SmilePro Durrës ──────────────────────────────────
  INSERT INTO public.companies (name,plan,status) VALUES ('SmilePro Durrës','starter','active') RETURNING id INTO c2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Kontakt i Parë',      1,'#3b82f6') RETURNING id INTO c2s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c2s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Dërgoi Foto',          3,'#06b6d4') RETURNING id INTO c2s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Dërgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c2s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Në Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c2s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Konfirmuar – Vizitë',  6,'#10b981') RETURNING id INTO c2s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Trajtim në Kurs',      7,'#a855f7') RETURNING id INTO c2s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Mbyllur – Fituar',     8,'#22c55e') RETURNING id INTO c2s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c2,'Mbyllur – Pa Interes', 9,'#ef4444') RETURNING id INTO c2s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a2,'admin@smilepro.com','Mirela Dervishi',c2),
    (u_tl3,'tl1@smilepro.com','Nertil Çela',c2),
    (u_tl4,'tl2@smilepro.com','Ornela Vlashi',c2),
    (u_op4,'op1@smilepro.com','Petrit Gega',c2),
    (u_op5,'op2@smilepro.com','Rezarta Hyka',c2),
    (u_op6,'op3@smilepro.com','Sonila Popa',c2)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a2,'company_admin',c2),(u_tl3,'team_leader',c2),(u_tl4,'team_leader',c2),
    (u_op4,'operator',c2),(u_op5,'operator',c2),(u_op6,'operator',c2)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c2,'Armend', 'Syla',    'armend.s@gmail.com',   '+355691001','Implant dentar',       'E Hënë 09:00',   'instagram', 850,c2s1,u_op4,'Kontakt i parë nga Instagram. Kërkon info bazë.'),
    (c2,'Brunilda','Tafa',   'brunilda.t@gmail.com', '+355691002','Zbardhim dhëmbësh',    'E Martë 10:30',  'facebook',  300,c2s2,u_op4,'I interesuar. Kërkon datë sa më shpejt.'),
    (c2,'Çlirim', 'Ndoja',   'clirim.n@gmail.com',   '+355691003','Ortodonci braces',     'E Mërkurë 14:00','referral', 1200,c2s3,u_op4,'Dërgoi foto panoramike. Presim ofertën nga ortodontistja.'),
    (c2,'Drita',  'Kovaci',  'drita.k@gmail.com',    '+355691004','Kurorë + Implant',     'E Enjte 11:00',  'website',  1650,c2s4,u_op5,'Preventiva dërguar. Pret sqarime mbi procesin kirurgjik.'),
    (c2,'Edmond', 'Myrtaj',  'edmond.m@gmail.com',   '+355691005','Faseta porcelani',     'E Premte 09:30', 'instagram',2200,c2s6,u_op5,'Konfirmoi vizitën. Do vijë me partneren.'),
    (c2,'Fjolla',  'Rexhepi','fjolla.r@gmail.com',   '+355691006','Protezë e plotë',      'E Hënë 15:00',   'facebook', 1800,c2s7,u_op5,'Trajtimi ka nisur. Etapa e parë e implantit kryer me sukses.'),
    (c2,'Granit', 'Bejko',   'granit.b@gmail.com',   '+355691007','Zbardhim dhëmbësh',   'E Martë 13:00',  'referral',  300,c2s8,u_op6,'Trajtim i suksesshëm. Rekomandoi 2 miq të tjerë.'),
    (c2,'Hana',   'Koci',    'hana.k@gmail.com',     '+355691008','Implant dentar',       'E Mërkurë 10:00','website',   850,c2s9,u_op6,'Nuk ishte financiarisht gati. Tha kthehet pas 6 muajsh.'),
    (c2,'Ilva',   'Shehi',   'ilva.s@gmail.com',     '+355691009','Ortodonci Invisalign', 'E Enjte 14:30',  'instagram',3200,c2s5,u_op6,'Ka preventivën. Krahason me klinika tjera. Ende pa vendosur.');

  -- ── COMPANY 3: BrightSmile Vlorë ────────────────────────────────
  INSERT INTO public.companies (name,plan,status) VALUES ('BrightSmile Vlorë','enterprise','active') RETURNING id INTO c3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Kontakt i Parë',      1,'#3b82f6') RETURNING id INTO c3s1;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'I Interesuar',         2,'#f59e0b') RETURNING id INTO c3s2;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Dërgoi Foto',          3,'#06b6d4') RETURNING id INTO c3s3;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Dërgoi Preventiv',     4,'#8b5cf6') RETURNING id INTO c3s4;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Në Pritje Vendimi',    5,'#ec4899') RETURNING id INTO c3s5;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Konfirmuar – Vizitë',  6,'#10b981') RETURNING id INTO c3s6;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Trajtim në Kurs',      7,'#a855f7') RETURNING id INTO c3s7;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Mbyllur – Fituar',     8,'#22c55e') RETURNING id INTO c3s8;
  INSERT INTO public.pipeline_stages (company_id,name,"order",color) VALUES (c3,'Mbyllur – Pa Interes', 9,'#ef4444') RETURNING id INTO c3s9;

  INSERT INTO public.profiles (id,email,full_name,company_id) VALUES
    (u_a3,'admin@brightsmile.com','Taulant Xhafa',c3),
    (u_tl5,'tl1@brightsmile.com','Urejtë Shala',c3),
    (u_tl6,'tl2@brightsmile.com','Valon Kelmendi',c3),
    (u_op7,'op1@brightsmile.com','Xhensila Cara',c3),
    (u_op8,'op2@brightsmile.com','Yllka Qosja',c3),
    (u_op9,'op3@brightsmile.com','Zamira Loshi',c3)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id,role,company_id) VALUES
    (u_a3,'company_admin',c3),(u_tl5,'team_leader',c3),(u_tl6,'team_leader',c3),
    (u_op7,'operator',c3),(u_op8,'operator',c3),(u_op9,'operator',c3)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c3,'Agron',  'Muja',    'agron.m@gmail.com',    '+355671001','Implant dentar',      'E Hënë 08:30',   'instagram', 850,c3s1,u_op7,'Kontakt i parë. Kërkon info për procesin e implantit.'),
    (c3,'Bora',   'Hysa',    'bora.h@gmail.com',     '+355671002','Faseta porcelani',    'E Martë 09:00',  'facebook', 2200,c3s2,u_op7,'Shumë e interesuar. Kërkon 6 faseta me kësti.'),
    (c3,'Çesk',   'Gjini',   'cesk.g@gmail.com',     '+355671003','Ortodonci braces',   'E Mërkurë 11:30','referral', 1200,c3s4,u_op7,'Preventiva dërguar. Çmim 1200€. Pret përgjigje.'),
    (c3,'Dafina', 'Murati',  'dafina.m2@gmail.com',  '+355671004','Zbardhim + Faseta',  'E Enjte 10:00',  'website',  2500,c3s5,u_op8,'Ka preventivën. Kërkon zbritje 10%. Negociim aktiv.'),
    (c3,'Edon',   'Islami',  'edon.i@gmail.com',     '+355671005','Kurorë qeramike',    'E Premte 14:00', 'instagram',  650,c3s6,u_op8,'Konfirmoi vizitën të premten 14:00.'),
    (c3,'Flaka',  'Demiri',  'flaka.d@gmail.com',    '+355671006','Implant + Kurorë',   'E Hënë 10:30',   'facebook', 2500,c3s7,u_op8,'Operacioni u krye. Kurorja pas 3 muajsh osteointegrim.'),
    (c3,'Gzim',   'Avdyli',  'gzim.a@gmail.com',     '+355671007','Protezë e plotë',    'E Martë 15:00',  'referral', 1800,c3s8,u_op9,'Proteza u vendos me sukses. Kontrol pas 1 muaji.'),
    (c3,'Hyrije', 'Bajrami', 'hyrije.b@gmail.com',   '+355671008','Zbardhim dhëmbësh', 'E Mërkurë 09:30','website',   300,c3s9,u_op9,'Nuk donte të vazhdonte pas shpjegimit. U mbyll dosja.'),
    (c3,'Ilirjan','Tahiri',  'ilirjan.t@gmail.com',  '+355671009','Invisalign',         'E Enjte 11:30',  'instagram',3200,c3s3,u_op9,'Dërgoi foto panoramike. Pret vlerësimin e ortodontistit.');

END $$;
