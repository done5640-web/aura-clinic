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

    const allowedCallerRoles = ["super_admin", "company_admin"];
    const callerRole = roles?.find((r: any) => allowedCallerRoles.includes(r.role));

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Nuk keni leje" }), { status: 403, headers: corsHeaders });
    }

    const body = await req.json();
    const { user_id: targetId } = body;

    if (!targetId || typeof targetId !== "string") {
      return new Response(JSON.stringify({ error: "Mungon përdoruesi" }), { status: 400, headers: corsHeaders });
    }
    if (targetId === callerId) {
      return new Response(JSON.stringify({ error: "Nuk mund të fshini veten" }), { status: 400, headers: corsHeaders });
    }

    const [{ data: targetRoleRow }, { data: targetProfile }] = await Promise.all([
      serviceClient.from("user_roles").select("role, company_id").eq("user_id", targetId).maybeSingle(),
      serviceClient.from("profiles").select("id, company_id, team_leader_id").eq("id", targetId).maybeSingle(),
    ]);

    if (!targetRoleRow || !targetProfile) {
      return new Response(JSON.stringify({ error: "Përdoruesi nuk u gjet" }), { status: 404, headers: corsHeaders });
    }

    const authorized = callerRole.role === "super_admin" || targetProfile.company_id === callerRole.company_id;
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Nuk keni leje të fshini këtë përdorues" }), { status: 403, headers: corsHeaders });
    }

    // If the target is an operator with a team leader, hand their open leads back to that team leader.
    if (targetRoleRow.role === "operator" && targetProfile.team_leader_id) {
      await serviceClient
        .from("leads")
        .update({ assigned_to_user_id: targetProfile.team_leader_id })
        .eq("assigned_to_user_id", targetId);
    }

    // Deleting the auth.users row cascades to profiles/user_roles/leads FK ON DELETE SET NULL,
    // but we delete the app rows explicitly first so behavior doesn't depend on FK setup.
    await serviceClient.from("user_roles").delete().eq("user_id", targetId);
    await serviceClient.from("profiles").delete().eq("id", targetId);

    const { error: deleteErr } = await serviceClient.auth.admin.deleteUser(targetId);
    if (deleteErr) {
      return new Response(JSON.stringify({ error: deleteErr.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e: any) {
    console.error("delete-user error:", e.message);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders });
  }
});
