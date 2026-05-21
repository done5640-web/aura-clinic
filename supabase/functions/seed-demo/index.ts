// Edge function to seed demo data + create demo auth users with passwords
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Riley", "Casey", "Jamie", "Avery", "Quinn", "Cameron", "Drew", "Reese", "Skyler", "Hayden", "Rowan", "Sage"];
const LAST_NAMES = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson"];
const COMPANIES = ["Acme Corp", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises", "Wonka Inc", "Cyberdyne", "Soylent", "Dunder Mifflin", "Pied Piper", "Hooli", "Massive Dynamic", "Tyrell Corp", "Vandelay Industries"];
const SOURCES = ["google_sheets", "manual", "web_form", "referral", "linkedin", "cold_email"];

const STAGES = [
  { name: "Prospecting", color: "#3b82f6" },
  { name: "First Contact", color: "#f59e0b" },
  { name: "Qualified", color: "#06b6d4" },
  { name: "Demo Scheduled", color: "#8b5cf6" },
  { name: "Proposal Sent", color: "#a855f7" },
  { name: "Negotiation", color: "#ec4899" },
  { name: "Closed Won", color: "#10b981" },
  { name: "Closed Lost", color: "#ef4444" },
];

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

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    // Idempotency: if Acme exists AND roles exist, return existing creds
    const { data: existingCo } = await supabase.from("companies").select("id").eq("name", "Acme Sales Co").maybeSingle();
    if (existingCo) {
      const { data: existingRoles } = await supabase.from("user_roles").select("id").limit(1);
      if (existingRoles && existingRoles.length > 0) {
        return new Response(JSON.stringify({ ok: true, message: "Already seeded.", credentials: DEMO_USERS.map(u => ({ email: u.email, password: u.password, role: u.role })) }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Company exists but roles are missing — fall through to re-seed roles
    }

    // Create company (trigger creates webhook token)
    const { data: company, error: cErr } = await supabase.from("companies")
      .insert({ name: "Acme Sales Co", plan: "growth" }).select().single();
    if (cErr) throw cErr;

    // Stages
    const { data: stageRows, error: sErr } = await supabase.from("pipeline_stages")
      .insert(STAGES.map((s, i) => ({ company_id: company.id, name: s.name, order: i + 1, color: s.color })))
      .select();
    if (sErr) throw sErr;

    // Create users + assign roles
    const userIds: Record<string, string> = {};
    for (const u of DEMO_USERS) {
      const { data: created, error: uErr } = await supabase.auth.admin.createUser({
        email: u.email, password: u.password, email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });
      if (uErr) {
        // Try fetch existing
        const { data: list } = await supabase.auth.admin.listUsers();
        const found = list.users.find((x) => x.email === u.email);
        if (!found) throw uErr;
        userIds[u.email] = found.id;
      } else {
        userIds[u.email] = created.user.id;
      }

      // attach to company (profile is auto-created by trigger)
      if (u.company) {
        await supabase.from("profiles").update({ company_id: company.id, full_name: u.full_name }).eq("id", userIds[u.email]);
      } else {
        await supabase.from("profiles").update({ full_name: u.full_name }).eq("id", userIds[u.email]);
      }

      // role
      await supabase.from("user_roles").insert({
        user_id: userIds[u.email], role: u.role,
        company_id: u.company ? company.id : null,
      });
    }

    const operatorEmails = ["op1@acme.com", "op2@acme.com", "op3@acme.com", "op4@acme.com"];

    // 50 leads
    const leadRows: any[] = [];
    for (let i = 0; i < 50; i++) {
      const first = pick(FIRST_NAMES);
      const last = pick(LAST_NAMES);
      const stage = pick(stageRows!);
      const op = pick(operatorEmails);
      leadRows.push({
        company_id: company.id,
        assigned_to_user_id: userIds[op],
        first_name: first, last_name: last,
        email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
        phone: `+1 555-${String(1000 + i).padStart(4, "0")}`,
        company_name: pick(COMPANIES),
        source: pick(SOURCES),
        pipeline_stage_id: stage.id,
        value: Math.floor(Math.random() * 50000) + 1000,
      });
    }
    const { data: insertedLeads, error: lErr } = await supabase.from("leads").insert(leadRows).select();
    if (lErr) throw lErr;

    // Activity for ~15 leads
    const activities: any[] = [];
    for (let i = 0; i < 15; i++) {
      const lead = insertedLeads![i];
      activities.push(
        { lead_id: lead.id, user_id: lead.assigned_to_user_id, type: "note", content: "Initial outreach completed." },
        { lead_id: lead.id, user_id: lead.assigned_to_user_id, type: "call", content: "Quick discovery call. Interested in growth plan." },
      );
    }
    await supabase.from("lead_activities").insert(activities);

    // tasks
    const tasks: any[] = [];
    for (let i = 0; i < 12; i++) {
      const lead = insertedLeads![i];
      tasks.push({
        lead_id: lead.id, assigned_to: lead.assigned_to_user_id,
        title: pick(["Follow-up call", "Send proposal", "Schedule demo", "Check in via email"]),
        due_date: new Date(Date.now() + (Math.floor(Math.random() * 7) - 2) * 86400000).toISOString(),
      });
    }
    await supabase.from("tasks").insert(tasks);

    return new Response(JSON.stringify({
      ok: true,
      message: "Seeded Acme Sales Co with 50 leads.",
      credentials: DEMO_USERS.map((u) => ({ email: u.email, password: u.password, role: u.role })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
