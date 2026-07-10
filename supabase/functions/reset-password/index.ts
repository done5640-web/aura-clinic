import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace("Bearer ", "");

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: { user: caller }, error: authErr } = await serviceClient.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized: invalid token" }), { status: 401, headers: corsHeaders });
    }
    const callerId = caller.id;

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
    const { user_id: targetId, password } = body;

    if (!targetId || typeof targetId !== "string") {
      return new Response(JSON.stringify({ error: "Mungon përdoruesi" }), { status: 400, headers: corsHeaders });
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "Fjalëkalimi duhet të ketë të paktën 8 karaktere" }), { status: 400, headers: corsHeaders });
    }

    // Load the target's role/company and profile to authorize the reset
    const [{ data: targetRoleRow }, { data: targetProfile }] = await Promise.all([
      serviceClient.from("user_roles").select("role, company_id").eq("user_id", targetId).maybeSingle(),
      serviceClient.from("profiles").select("id, company_id, team_leader_id").eq("id", targetId).maybeSingle(),
    ]);

    if (!targetRoleRow || !targetProfile) {
      return new Response(JSON.stringify({ error: "Përdoruesi nuk u gjet" }), { status: 404, headers: corsHeaders });
    }

    let authorized = false;
    if (callerRole.role === "super_admin") {
      authorized = true;
    } else if (callerRole.role === "company_admin") {
      authorized = targetProfile.company_id === callerRole.company_id;
    } else if (callerRole.role === "team_leader") {
      authorized = targetRoleRow.role === "operator" && targetProfile.team_leader_id === callerId;
    }

    if (!authorized) {
      return new Response(JSON.stringify({ error: "Nuk keni leje të ndryshoni fjalëkalimin e këtij përdoruesi" }), { status: 403, headers: corsHeaders });
    }

    const { error: updateErr } = await serviceClient.auth.admin.updateUserById(targetId, { password });
    if (updateErr) {
      return new Response(JSON.stringify({ error: updateErr.message }), { status: 400, headers: corsHeaders });
    }

    // Revoke the target's existing refresh tokens so already-open sessions can no longer refresh
    await serviceClient.auth.admin.signOut(targetId, "global");

    // Stamp profiles.force_logout_at so any currently-active tab is kicked out instantly via Realtime
    await serviceClient.from("profiles").update({ force_logout_at: new Date().toISOString() }).eq("id", targetId);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("reset-password error:", e.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
