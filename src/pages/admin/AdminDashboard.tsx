import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Users, ListChecks, DollarSign } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const PRICE: Record<string, number> = { free: 0, starter: 49, growth: 149, enterprise: 499 };

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<any>({});
  const [growth, setGrowth] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: companies }, { count: leadCount }, { count: userCount }] = await Promise.all([
        supabase.from("companies").select("plan, created_at, status"),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      const mrr = (companies ?? []).reduce((acc: number, c: any) => acc + (PRICE[c.plan] ?? 0), 0);
      // 12-month growth
      const now = new Date();
      const buckets: any[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({ month: d.toLocaleString("default", { month: "short" }), companies: 0 });
      }
      (companies ?? []).forEach((c: any) => {
        const d = new Date(c.created_at);
        const monthsAgo = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
        if (monthsAgo >= 0 && monthsAgo < 12) buckets[11 - monthsAgo].companies += 1;
      });
      // cumulative
      let total = 0;
      buckets.forEach((b) => { total += b.companies; b.total = total; });
      setGrowth(buckets);
      setS({ companies: companies?.length ?? 0, leads: leadCount ?? 0, users: userCount ?? 0, mrr });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="grid grid-cols-4 gap-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight">Pasqyra e platformës</h1><p className="text-sm text-muted-foreground">Të gjitha klinika</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Klinika" value={s.companies} icon={Building2} />
        <Stat label="Gjithsej përdorues" value={s.users} icon={Users} />
        <Stat label="Gjithsej pacientë" value={s.leads} icon={ListChecks} />
        <Stat label="MRR" value={`€${s.mrr.toLocaleString()}`} icon={DollarSign} />
      </div>
      <Card>
        <CardHeader><CardTitle>Rritja e klinikave (12 muajt e fundit)</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
function Stat({ label, value, icon: Icon }: any) {
  return (
    <Card><CardContent className="p-5 flex items-center justify-between">
      <div><p className="text-xs text-muted-foreground uppercase">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>
      <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center"><Icon className="w-5 h-5" /></div>
    </CardContent></Card>
  );
}
