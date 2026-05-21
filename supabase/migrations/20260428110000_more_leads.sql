-- Additional leads for all 3 clinics (run after 20260428100000_full_reset_dental.sql)
DO $$
DECLARE
  c1 UUID; c2 UUID; c3 UUID;
  c1s1 UUID; c1s2 UUID; c1s3 UUID; c1s4 UUID; c1s5 UUID; c1s6 UUID; c1s7 UUID; c1s8 UUID; c1s9 UUID;
  c2s1 UUID; c2s2 UUID; c2s3 UUID; c2s4 UUID; c2s5 UUID; c2s6 UUID; c2s7 UUID; c2s8 UUID; c2s9 UUID;
  c3s1 UUID; c3s2 UUID; c3s3 UUID; c3s4 UUID; c3s5 UUID; c3s6 UUID; c3s7 UUID; c3s8 UUID; c3s9 UUID;
  u_op1 UUID; u_op2 UUID; u_op3 UUID;
  u_op4 UUID; u_op5 UUID; u_op6 UUID;
  u_op7 UUID; u_op8 UUID; u_op9 UUID;
BEGIN
  SELECT id INTO c1 FROM public.companies WHERE name='Dental Tirana';
  SELECT id INTO c2 FROM public.companies WHERE name='SmilePro Durrës';
  SELECT id INTO c3 FROM public.companies WHERE name='BrightSmile Vlorë';

  SELECT id INTO c1s1 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=1;
  SELECT id INTO c1s2 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=2;
  SELECT id INTO c1s3 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=3;
  SELECT id INTO c1s4 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=4;
  SELECT id INTO c1s5 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=5;
  SELECT id INTO c1s6 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=6;
  SELECT id INTO c1s7 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=7;
  SELECT id INTO c1s8 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=8;
  SELECT id INTO c1s9 FROM public.pipeline_stages WHERE company_id=c1 AND "order"=9;

  SELECT id INTO c2s1 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=1;
  SELECT id INTO c2s2 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=2;
  SELECT id INTO c2s3 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=3;
  SELECT id INTO c2s4 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=4;
  SELECT id INTO c2s5 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=5;
  SELECT id INTO c2s6 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=6;
  SELECT id INTO c2s7 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=7;
  SELECT id INTO c2s8 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=8;
  SELECT id INTO c2s9 FROM public.pipeline_stages WHERE company_id=c2 AND "order"=9;

  SELECT id INTO c3s1 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=1;
  SELECT id INTO c3s2 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=2;
  SELECT id INTO c3s3 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=3;
  SELECT id INTO c3s4 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=4;
  SELECT id INTO c3s5 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=5;
  SELECT id INTO c3s6 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=6;
  SELECT id INTO c3s7 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=7;
  SELECT id INTO c3s8 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=8;
  SELECT id INTO c3s9 FROM public.pipeline_stages WHERE company_id=c3 AND "order"=9;

  SELECT id INTO u_op1 FROM auth.users WHERE email='op1@dentaltirana.com';
  SELECT id INTO u_op2 FROM auth.users WHERE email='op2@dentaltirana.com';
  SELECT id INTO u_op3 FROM auth.users WHERE email='op3@dentaltirana.com';
  SELECT id INTO u_op4 FROM auth.users WHERE email='op1@smilepro.com';
  SELECT id INTO u_op5 FROM auth.users WHERE email='op2@smilepro.com';
  SELECT id INTO u_op6 FROM auth.users WHERE email='op3@smilepro.com';
  SELECT id INTO u_op7 FROM auth.users WHERE email='op1@brightsmile.com';
  SELECT id INTO u_op8 FROM auth.users WHERE email='op2@brightsmile.com';
  SELECT id INTO u_op9 FROM auth.users WHERE email='op3@brightsmile.com';

  -- ── EXTRA LEADS: Dental Tirana ──────────────────────────────────
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c1,'Manjola', 'Zeqiri',  'manjola.z@gmail.com',   '+355681013','Implant dentar',       'E Hënë 11:00',  'instagram',  850,c1s1,u_op1,'Kontakt i ri nga story. Kërkon takime konsultimi falas.'),
    (c1,'Nertil',  'Cela',    'nertil.c@gmail.com',    '+355681014','Ortodonci braces',     'E Martë 09:30', 'facebook',  1200,c1s2,u_op1,'Interes i konfirmuar. Kërkon plan këstesh.'),
    (c1,'Ornela',  'Bushi',   'ornela.b@gmail.com',    '+355681015','Faseta dhëmbësh',      'E Mërkurë 16:00','referral', 2200,c1s3,u_op2,'Dërgoi foto. Vlerësimi i doktorit nesër.'),
    (c1,'Petrit',  'Marashi', 'petrit.m@gmail.com',    '+355681016','Zbardhim profesional', 'E Enjte 10:00', 'website',    300,c1s4,u_op2,'Preventiva dërguar. Pret konfirmim pagese.'),
    (c1,'Qendresa','Gashi',   'qendresa.g@gmail.com',  '+355681017','Protezë parciale',     'E Premte 11:00','instagram',  900,c1s6,u_op2,'Konfirmoi. Vizita e parë e konsultimit të hënën.'),
    (c1,'Rina',    'Sulaj',   'rina.s@gmail.com',      '+355681018','Implant + Faseta',     'E Hënë 14:00',  'facebook',  3100,c1s7,u_op3,'Trajtim aktiv. Etapa implantit kryer, faseta pas 4 muajsh.'),
    (c1,'Skënder', 'Haxhiu',  'skender.h@gmail.com',   '+355681019','Kurorë qeramike',      'E Martë 12:00', 'referral',   650,c1s8,u_op3,'Kurorja u vendos. Pacient i kënaqur. Lëshoi review pozitiv.'),
    (c1,'Teuta',   'Cara',    'teuta.c@gmail.com',     '+355681020','Implant dentar',       'E Mërkurë 15:00','website',   850,c1s9,u_op3,'U largua pasi mori ofertë më të lirë gjetkë.'),
    (c1,'Urim',    'Bajrami', 'urim.b@gmail.com',      '+355681021','Ortodonci Invisalign', 'E Enjte 09:00', 'instagram', 3200,c1s2,u_op1,'Shumë i interesuar. Kërkon konsultim me ortodontisten.'),
    (c1,'Vjosa',   'Kelmendi','vjosa.k@gmail.com',     '+355681022','Zbardhim + Kurorë',    'E Premte 13:00','facebook',   950,c1s5,u_op2,'Ka preventivën. Po mendon. Kontakt tjetër javën e ardhshme.');

  -- ── EXTRA LEADS: SmilePro Durrës ────────────────────────────────
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c2,'Jona',    'Demiri',  'jona.d@gmail.com',      '+355691010','Implant dentar',       'E Hënë 10:00',  'instagram',  850,c2s1,u_op4,'Kontakt i parë. Interesim fillestar pas storjes.'),
    (c2,'Klajdi',  'Mema',    'klajdi.m@gmail.com',    '+355691011','Ortodonci braces',     'E Martë 11:00', 'facebook',  1200,c2s2,u_op4,'I interesuar. Ka kontrolluar çmimet online.'),
    (c2,'Laura',   'Prifti',  'laura.p@gmail.com',     '+355691012','Faseta porcelani',     'E Mërkurë 10:30','referral', 2200,c2s3,u_op5,'Foto dërguar. Çmimi 2200€. Pret ofertën finale.'),
    (c2,'Mihail',  'Zoto',    'mihail.z@gmail.com',    '+355691013','Protezë e plotë',      'E Enjte 14:00', 'website',   1800,c2s4,u_op5,'Preventiva dërguar me detaje. Pret vendim.'),
    (c2,'Nevila',  'Lamaj',   'nevila.l@gmail.com',    '+355691014','Zbardhim dhëmbësh',   'E Premte 09:00','instagram',  300,c2s5,u_op5,'Ka preventivën. I dërgua zbritje speciale 15%.'),
    (c2,'Orgest',  'Tosku',   'orgest.t@gmail.com',    '+355691015','Implant + Kurorë',    'E Hënë 15:00',  'facebook',  2500,c2s6,u_op6,'Konfirmoi vizitën. Rasti kompleks 2 implante.'),
    (c2,'Pranvera','Kaziu',   'pranvera.k@gmail.com',  '+355691016','Ortodonci Invisalign','E Martë 10:00', 'referral',  3200,c2s7,u_op6,'Trajtim aktiv. Aligners faza e dytë.'),
    (c2,'Qirjako', 'Caci',    'qirjako.c@gmail.com',   '+355691017','Kurorë qeramike',     'E Mërkurë 13:00','website',   650,c2s8,u_op6,'Trajtim përfundoi. Pacienti shumë i kënaqur.'),
    (c2,'Rozana',  'Hysa',    'rozana.h@gmail.com',    '+355691018','Faseta dhëmbësh',     'E Enjte 11:30', 'instagram', 2200,c2s9,u_op4,'U largua. Tha çmimi ishte mbi buxhetin.'),
    (c2,'Shpëtim', 'Arapi',   'shpetim.a@gmail.com',  '+355691019','Implant dentar',       'E Premte 14:00','facebook',   850,c2s2,u_op5,'I interesuar. Kërkon informacion shtesë nga doktori.');

  -- ── EXTRA LEADS: BrightSmile Vlorë ──────────────────────────────
  INSERT INTO public.leads (company_id,first_name,last_name,email,phone,sherbimi,kur_kontaktohet,source,value,pipeline_stage_id,assigned_to_user_id,notes) VALUES
    (c3,'Jonuzi',  'Beqiri',  'jonuzi.b@gmail.com',   '+355671010','Implant dentar',        'E Hënë 08:00',  'instagram',  850,c3s1,u_op7,'Kontakt i parë. Klient potencial i lartë.'),
    (c3,'Kaltrina','Rama',    'kaltrina.r@gmail.com', '+355671011','Faseta + Zbardhim',     'E Martë 10:00', 'facebook',  2500,c3s2,u_op7,'Shumë e interesuar. Kërkon paketë komplete.'),
    (c3,'Liridon', 'Gashi',   'liridon.g@gmail.com',  '+355671012','Ortodonci braces',     'E Mërkurë 15:00','referral', 1200,c3s4,u_op7,'Preventiva dërguar. Ndërhyrje e nevojshme gjerësisht.'),
    (c3,'Mimoza',  'Hyseni',  'mimoza.h@gmail.com',   '+355671013','Protezë parciale',      'E Enjte 09:30', 'website',    900,c3s5,u_op8,'Ka preventivën. Kërkon të paguajë me këste.'),
    (c3,'Naim',    'Krasniqi','naim.k@gmail.com',     '+355671014','Kurorë qeramike',       'E Premte 11:00','instagram',  650,c3s6,u_op8,'Konfirmoi. Trajtimi fillon të hënën.'),
    (c3,'Ollga',   'Xhelo',   'ollga.x@gmail.com',    '+355671015','Implant + Faseta',      'E Hënë 13:00',  'facebook',  3100,c3s7,u_op8,'Trajtim aktiv. Faza e implantit kryer pa komplikime.'),
    (c3,'Përparim','Latifi',  'perparim.l@gmail.com', '+355671016','Zbardhim profesional',  'E Martë 14:30', 'referral',   300,c3s8,u_op9,'Trajtim i suksesshëm. Pacienti i lumtur. Ka rekomanduar 3 miq.'),
    (c3,'Qamile',  'Deda',    'qamile.d@gmail.com',   '+355671017','Implant dentar',        'E Mërkurë 10:30','website',   850,c3s9,u_op9,'Refuzoi trajtimin pas konsultimit. Arsyeja: frika nga kirurgjia.'),
    (c3,'Rezart',  'Çupi',    'rezart.c@gmail.com',   '+355671018','Ortodonci Invisalign', 'E Enjte 15:00', 'instagram', 3200,c3s3,u_op9,'Foto panoramike dërguar. Rast kompleks, pret vlerësimin.'),
    (c3,'Sonja',   'Leka',    'sonja.l@gmail.com',    '+355671019','Faseta porcelani',      'E Premte 09:00','facebook',  2200,c3s2,u_op7,'I interesuar. Do vijë me bashkëshorten për konsultim.');

END $$;
