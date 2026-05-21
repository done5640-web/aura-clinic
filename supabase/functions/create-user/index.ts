import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Roles a caller is allowed to assign, keyed by their own role
const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin:   ["company_admin", "team_leader", "operator"],
  company_admin: ["company_admin", "team_leader", "operator"],
  team_leader:   ["operator"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the JWT properly by calling Supabase — do NOT trust decoded payload alone
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await serviceClient.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), { status: 401, headers: corsHeaders });
    }
    const callerId = caller.id;

    // Get caller's roles from DB (not from JWT claims)
    const { data: roles } = await serviceClient
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", callerId);

    const allowedCallerRoles = ["super_admin", "company_admin", "team_leader"];
    const callerRole = roles?.find((r: any) => allowedCallerRoles.includes(r.role));

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Nuk keni leje" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { email, password, full_name, role } = body;

    // Input validation
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email i pavlefshëm" }), { status: 400, headers: corsHeaders });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere" }), { status: 400, headers: corsHeaders });
    }

    // Enforce which roles a caller can assign — no privilege escalation
    const assignable = ASSIGNABLE_ROLES[callerRole.role] ?? [];
    if (role && !assignable.includes(role)) {
      return new Response(JSON.stringify({ error: "Nuk mund të caktoni këtë rol" }), { status: 403, headers: corsHeaders });
    }

    // Non-super-admins are always locked to their own company
    const company_id = callerRole.role === "super_admin"
      ? (body.company_id || null)
      : callerRole.company_id;

    const { data: authData, error: createErr } = await serviceClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: (full_name || email).slice(0, 200) },
    });

    if (createErr || !authData?.user) {
      return new Response(JSON.stringify({ error: createErr?.message ?? "Gabim në krijimin e llogarisë" }), { status: 400, headers: corsHeaders });
    }

    const uid = authData.user.id;

    await serviceClient.from("profiles").upsert({
      id: uid,
      email: email.trim().toLowerCase(),
      full_name: (full_name || email).slice(0, 200),
      company_id: company_id || null,
    });

    if (role && company_id) {
      await serviceClient.from("user_roles").insert({ user_id: uid, role, company_id });
    }

    return new Response(JSON.stringify({ user_id: uid }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("create-user error:", e.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
