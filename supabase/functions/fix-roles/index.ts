// Edge function to fix missing roles/profiles for demo users
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_USERS = [
  { email: "superadmin@demo.com", password: "Demo1234!", full_name: "Super Admin", role: "super_admin", company: false },
  { email: "admin@acme.com", password: "Demo1234!", full_name: "Alice Admin", role: "company_admin", company: true },
  { email: "leader1@acme.com", password: "Demo1234!", full_name: "Tom Leader", role: "team_leader", company: true },
  { email: "leader2@acme.com", password: "Demo1234!", full_name: "Sara Lead", role: "team_leader", company: true },
  { email: "op1@acme.com", password: "Demo1234!", full_name: "Oliver One", role: "operator", company: true },
  { email: "op2@acme.com", password: "Demo1234!", full_name: "Olivia Two", role: "operator", company: true },
  { email: "op3@acme.com", password: "Demo1234!", full_name: "Owen Three", role: "operator", company: true },
  { email: "op4@acme.com", password: "Demo1234!", full_name: "Octavia Four", role: "operator", company: true },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Must use service role key to bypass RLS
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const log: string[] = [];

  try {
    // 1. Get or create Acme company
    let { data: company } = await supabase.from("companies").select("id").eq("name", "Acme Sales Co").maybeSingle();
    if (!company) {
      const { data: newCo, error: cErr } = await supabase.from("companies").insert({ name: "Acme Sales Co", plan: "growth" }).select().single();
      if (cErr) throw new Error("Create company: " + cErr.message);
      company = newCo;
      log.push("Created Acme Sales Co");
    } else {
      log.push("Found Acme Sales Co: " + company.id);
    }

    // 2. List all auth users
    const { data: userList, error: listErr } = await supabase.auth.admin.listUsers();
    if (listErr) throw new Error("List users: " + listErr.message);
    log.push(`Found ${userList.users.length} auth users`);

    // 3. For each demo user: create if missing, fix profile, fix role
    for (const u of DEMO_USERS) {
      let userId: string;

      const existing = userList.users.find((x) => x.email === u.email);
      if (!existing) {
        const { data: created, error: uErr } = await supabase.auth.admin.createUser({
          email: u.email, password: u.password, email_confirm: true,
          user_metadata: { full_name: u.full_name },
        });
        if (uErr) throw new Error(`Create user ${u.email}: ` + uErr.message);
        userId = created.user.id;
        log.push(`Created user ${u.email} → ${userId}`);
      } else {
        userId = existing.id;
        log.push(`Found user ${u.email} → ${userId}`);
      }

      // 4. Upsert profile
      const { error: pErr } = await supabase.from("profiles").upsert({
        id: userId,
        email: u.email,
        full_name: u.full_name,
        company_id: u.company ? company.id : null,
      }, { onConflict: "id" });
      if (pErr) log.push(`  Profile upsert error for ${u.email}: ${pErr.message}`);
      else log.push(`  Profile OK for ${u.email}`);

      // 5. Upsert role
      const { error: rErr } = await supabase.from("user_roles").upsert({
        user_id: userId,
        role: u.role,
        company_id: u.company ? company.id : null,
      }, { onConflict: "user_id,role,company_id" });
      if (rErr) log.push(`  Role upsert error for ${u.email}: ${rErr.message}`);
      else log.push(`  Role OK for ${u.email} → ${u.role}`);
    }

    // 6. Verify
    const { data: roles, error: verifyErr } = await supabase.from("user_roles").select("*");
    if (verifyErr) log.push("Verify error: " + verifyErr.message);
    else log.push(`Total roles in DB: ${roles?.length ?? 0}`);

    return new Response(JSON.stringify({ ok: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
