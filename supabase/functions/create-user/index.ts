import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASSIGNABLE_ROLES: Record<string, string[]> = {
  super_admin:   ["company_admin", "team_leader", "operator"],
  company_admin: ["company_admin", "team_leader", "operator"],
  team_leader:   ["operator"],
};

function decodeJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(payload);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");

    // Decode JWT to get user id without algorithm verification
    const payload = decodeJWT(token);
    if (!payload?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), { status: 401, headers: corsHeaders });
    }
    const callerId = payload.sub;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get caller's roles from DB
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

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email i pavlefshëm" }), { status: 400, headers: corsHeaders });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere" }), { status: 400, headers: corsHeaders });
    }

    const assignable = ASSIGNABLE_ROLES[callerRole.role] ?? [];
    if (role && !assignable.includes(role)) {
      return new Response(JSON.stringify({ error: "Nuk mund të caktoni këtë rol" }), { status: 403, headers: corsHeaders });
    }

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
