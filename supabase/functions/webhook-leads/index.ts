import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const url = new URL(req.url);
    const parts = url.pathname.split("/").filter(Boolean);
    const token = parts[parts.length - 1];
    if (!token || token === "webhook-leads") {
      return new Response(JSON.stringify({ error: "Missing company token" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: tokenRow, error: tErr } = await supabase
      .from("company_webhook_tokens")
      .select("company_id")
      .eq("token", token)
      .maybeSingle();
    if (tErr || !tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const companyId = tokenRow.company_id;

    const body = await req.json();
    const items: any[] = Array.isArray(body) ? body : [body];

    // get default stage
    const { data: stages } = await supabase
      .from("pipeline_stages").select("id").eq("company_id", companyId).order("order").limit(1);
    const defaultStage = stages?.[0]?.id ?? null;

    const sanitizeStr = (v: unknown, maxLen: number): string | null => {
      if (!v) return null;
      const s = String(v).trim().slice(0, maxLen);
      return s || null;
    };
    const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

    let created = 0, skipped = 0;
    for (const it of items) {
      const first = sanitizeStr(it.first_name || it.firstName, 200);
      if (!first) { skipped++; continue; }
      const rawEmail = sanitizeStr(it.email, 255);
      const email = rawEmail && isValidEmail(rawEmail) ? rawEmail.toLowerCase() : null;
      if (email) {
        const { data: dup } = await supabase.from("leads").select("id").eq("company_id", companyId).eq("email", email).maybeSingle();
        if (dup) { skipped++; continue; }
      }
      const { error } = await supabase.from("leads").insert({
        company_id: companyId,
        first_name: first,
        last_name: sanitizeStr(it.last_name || it.lastName, 200),
        email,
        phone: sanitizeStr(it.phone, 30),
        company_name: sanitizeStr(it.company_name || it.company, 300),
        source: sanitizeStr(it.source, 100) || "webhook",
        value: Math.max(0, Math.min(Number(it.value || 0) || 0, 9_999_999)),
        pipeline_stage_id: defaultStage,
        sherbimi: sanitizeStr(it.sherbimi, 300),
        kur_kontaktohet: sanitizeStr(it.kur_kontaktohet, 200),
      });
      if (error) skipped++; else created++;
    }

    return new Response(JSON.stringify({ created, skipped }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
