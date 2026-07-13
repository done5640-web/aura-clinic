import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ListChecks, Euro, CheckCircle2, Clock, TrendingUp, ArrowUpRight, Users, Activity } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { fetchAll } from "@/lib/fetchAll";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/dateFormat";

const COLORS = ["#6366f1","#8b5cf6","#06b6d4","#10b981","#f59e0b","#ef4444","#ec4899","#3b82f6","#84cc16"];

const ACTIVITY_LABELS: Record<string, string> = {
  note: "Shënim", call: "Telefonatë", email: "Email",
  meeting: "Takim", status_change: "Ndryshim statusi", assignment: "Caktim",
};

export default function Dashboard() {
  const { primaryRole, user, companyId, fullName } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalLeads: 0, totalValue: 0, tasks: 0, wonCount: 0 });
  const [stageData, setStageData] = useState<{ name: string; value: number }[]>([]);
  const [teamData, setTeamData] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !companyId) { setLoading(false); return; }
    (async () => {
      const isOp = primaryRole === "operator";
      const isTL = primaryRole === "team_leader";

      // Team leaders fetch their operators first so we can scope leads correctly
      let teamMemberIds: string[] = [user.id];
      if (isTL) {
        const { data: ops } = await supabase.from("profiles").select("id").eq("team_leader_id", user.id);
        teamMemberIds = [user.id, ...(ops ?? []).map((o: any) => o.id)];
      }

      const leads = await fetchAll((f, t) => {
        let q = supabase.from("leads")
          .select("id, value, pipeline_stage_id, assigned_to_user_id, pipeline_stages(name)")
          .eq("company_id", companyId);
        if (isOp) q = q.eq("assigned_to_user_id", user.id);
        else if (isTL) q = q.in("assigned_to_user_id", teamMemberIds);
        return q.range(f, t);
      });

      const stageMap = new Map<string, number>();
      let totalValue = 0;
      leads.forEach((l: any) => {
        const s = l.pipeline_stages?.name ?? "Pa status";
        stageMap.set(s, (stageMap.get(s) ?? 0) + 1);
        totalValue += Number(l.value || 0);
      });
      setStageData(Array.from(stageMap.entries()).map(([name, value]) => ({ name, value })));

      let tQ = supabase.from("tasks").select("id, title, due_date, lead_id, completed").eq("completed", false).order("due_date").limit(6);
      if (isOp) tQ = tQ.eq("assigned_to", user.id);
      const { data: tdata } = await tQ;
      setTasks(tdata ?? []);

      if (!isOp) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").eq("company_id", companyId);
        const counts = new Map<string, number>();
        leads.forEach((l: any) => { if (l.assigned_to_user_id) counts.set(l.assigned_to_user_id, (counts.get(l.assigned_to_user_id) ?? 0) + 1); });
        setTeamData((profiles ?? []).map((p: any) => ({ ...p, leads: counts.get(p.id) ?? 0 })).sort((a, b) => b.leads - a.leads).slice(0, 6));

        // Filter activities by user_id (team members) — avoids giant .in(lead_id) with thousands of IDs
        let actQ = supabase.from("lead_activities")
          .select("id, type, content, created_at, lead_id, profiles(full_name)")
          .order("created_at", { ascending: false })
          .limit(8);
        if (isTL) actQ = actQ.in("user_id", teamMemberIds);
        const { data: acts } = await actQ;
        setRecent(acts ?? []);
      }

      setStats({ totalLeads: leads.length, totalValue, tasks: tdata?.length ?? 0, wonCount: 0 });
      setLoading(false);
    })();
  }, [user, companyId, primaryRole]);

  const isOp = primaryRole === "operator";

  if (loading) return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64 rounded-lg" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 lg:col-span-2 rounded-xl" />
      </div>
    </div>
  );

  const STATS = [
    { label: isOp ? "Pacientët e mi" : "Gjithsej pacientë", value: stats.totalLeads, icon: ListChecks, color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-500/15" },
    { label: "Vlera totale", value: `€${stats.totalValue.toLocaleString()}`, icon: Euro, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-500/15" },
    { label: "Detyra aktive", value: stats.tasks, icon: Clock, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { label: "Aktivitete sot", value: recent.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length, icon: Activity, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-500/10" },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Mirë se erdhe, {fullName?.split(" ")[0] ?? ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isOp ? "Pamja juaj personale" : "Pasqyrë e performancës"}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-start gap-3">
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("w-4.5 h-4.5", s.color)} size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-foreground leading-none">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts + team */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Pie chart */}
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Shpërndarje sipas statusit</h2>
          {stageData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
              <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Asnjë të dhënë ende.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={stageData} dataKey="value" nameKey="name" outerRadius={75} innerRadius={42} paddingAngle={2} strokeWidth={0}>
                    {stageData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: 12 }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {stageData.slice(0, 6).map((s, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="flex-1 truncate text-muted-foreground">{s.name}</span>
                    <span className="font-semibold tabular-nums">{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Team / Tasks */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border p-5">
          {!isOp ? (
            <>
              <h2 className="text-sm font-semibold mb-4">Performanca e ekipit</h2>
              {teamData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <Users className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Asnjë anëtar ekipi ende.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {teamData.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                      <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">{(m.full_name || m.email || "?")[0].toUpperCase()}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.full_name || m.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">{m.leads}</p>
                        <p className="text-xs text-muted-foreground">pacientë</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 className="text-sm font-semibold mb-4">Detyrat aktive</h2>
              {tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                  <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">Asnjë detyrë e hapur.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {tasks.map((t) => {
                    const overdue = t.due_date && new Date(t.due_date) < new Date();
                    return (
                      <Link key={t.id} to={`/leads/${t.lead_id}`}
                        className="flex items-center justify-between py-2.5 border-b border-border last:border-0 group"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", overdue ? "bg-red-400" : "bg-emerald-500")} />
                          <span className="text-sm truncate">{t.title}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs", overdue ? "text-red-500 font-medium" : "text-muted-foreground")}>
                            {t.due_date ? fmtDate(t.due_date) : ""}
                          </span>
                          <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Recent activity — admins and team leaders only */}
      {!isOp && (
        <div className="bg-card rounded-xl border border-border p-5">
          <h2 className="text-sm font-semibold mb-4">Aktivitetet e fundit të ekipit</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Asnjë aktivitet ende.</p>
          ) : (
            <div className="space-y-0">
              {recent.map((a: any) => (
                <Link key={a.id} to={`/leads/${a.lead_id}`}
                  className="flex items-start gap-3 py-3 border-b border-border last:border-0 hover:bg-muted/30 -mx-1 px-1 rounded-lg transition-colors group"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-[hsl(38,62%,52%)] mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                        {ACTIVITY_LABELS[a.type] ?? a.type}
                      </span>
                      <p className="text-sm text-muted-foreground line-clamp-1">{a.content}</p>
                    </div>
                    {a.profiles?.full_name && (
                      <p className="text-xs text-muted-foreground/60 mt-0.5">{a.profiles.full_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{fmtDate(a.created_at)}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
