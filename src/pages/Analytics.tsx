import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, Legend } from "recharts";
import { fetchAll } from "@/lib/fetchAll";

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#3b82f6"];

export default function Analytics() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stageValue, setStageValue] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [funnel, setFunnel] = useState<any[]>([]);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const [leads, { data: stages }, { data: profs }] = await Promise.all([
        fetchAll((f, t) => supabase.from("leads").select("value, source, pipeline_stage_id, assigned_to_user_id, pipeline_stages(name, order)").eq("company_id", companyId).range(f, t)),
        supabase.from("pipeline_stages").select("*").order("order"),
        supabase.from("profiles").select("id, full_name, email").eq("company_id", companyId),
      ]);
      const stageMap = new Map<string, { name: string; count: number; value: number; order: number }>();
      (stages ?? []).forEach((s: any) => stageMap.set(s.id, { name: s.name, count: 0, value: 0, order: s.order }));
      const sourceMap = new Map<string, number>();
      const userMap = new Map<string, { leads: number; value: number; won: number }>();
      leads.forEach((l: any) => {
        if (l.pipeline_stage_id && stageMap.has(l.pipeline_stage_id)) {
          const s = stageMap.get(l.pipeline_stage_id)!; s.count += 1; s.value += Number(l.value || 0);
        }
        const src = l.source || "i panjohur"; sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
        if (l.assigned_to_user_id) {
          const u = userMap.get(l.assigned_to_user_id) ?? { leads: 0, value: 0, won: 0 };
          u.leads += 1; u.value += Number(l.value || 0);
          const n = (l.pipeline_stages?.name ?? "").toLowerCase();
          if (n.includes("fituar") || n.includes("won")) u.won += 1;
          userMap.set(l.assigned_to_user_id, u);
        }
      });
      const ordered = Array.from(stageMap.values()).sort((a, b) => a.order - b.order);
      setStageValue(ordered.map((s) => ({ name: s.name, value: s.value, count: s.count })));
      setFunnel(ordered);
      setSources(Array.from(sourceMap.entries()).map(([name, value]) => ({ name, value })));
      setLeaderboard((profs ?? []).map((p: any) => {
        const u = userMap.get(p.id) ?? { leads: 0, value: 0, won: 0 };
        return { ...p, ...u };
      }).sort((a, b) => b.value - a.value));
      setLoading(false);
    })();
  }, [companyId]);

  if (loading) return <div className="grid grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72" />)}</div>;

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">Analitika</h1><p className="text-sm text-muted-foreground">Pasqyra e performancës së klinikës</p></div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Vlera sipas statusit (€)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={stageValue}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `€${Number(v).toLocaleString()}`} />
                <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Burimet e pacientëve</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={sources} dataKey="value" nameKey="name" outerRadius={100}>
                  {sources.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Hinkja e konvertimit</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {funnel.map((s, i) => {
              const max = funnel[0]?.count || 1;
              const pct = (s.count / max) * 100;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs w-40 truncate">{s.name}</span>
                  <div className="flex-1 bg-muted rounded h-7 relative overflow-hidden">
                    <div className="absolute inset-y-0 left-0 bg-primary rounded" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="text-xs font-semibold w-10 text-right">{s.count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Renditja e operatorëve</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2">Operatori</th><th>Pacientë</th><th>Konfirmuar</th><th className="text-right">Vlera (€)</th>
              </tr></thead>
              <tbody>
                {leaderboard.map((m) => (
                  <tr key={m.id} className="border-b last:border-0">
                    <td className="py-2">{m.full_name || m.email}</td>
                    <td>{m.leads}</td><td>{m.won}</td>
                    <td className="text-right font-medium">€{Number(m.value).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
