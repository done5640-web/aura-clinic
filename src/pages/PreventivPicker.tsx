import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronRight, Sparkles, Inbox } from "lucide-react";
import { fetchAll } from "@/lib/fetchAll";

interface Lead {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null;
  company_id: string | null;
}

export default function PreventivPicker() {
  const { user, companyId, primaryRole } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!primaryRole) return;
    if (primaryRole !== "super_admin" && !companyId) return;
    (async () => {
      setLoading(true);
      let data: Lead[] = [];
      if (primaryRole === "super_admin") {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id").order("first_name").range(from, to)
        );
      } else if (primaryRole === "operator") {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id")
            .eq("assigned_to_user_id", user?.id ?? "").order("first_name").range(from, to)
        );
      } else {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id")
            .eq("company_id", companyId).order("first_name").range(from, to)
        );
      }
      setLeads(data);
      setLoading(false);
    })();
  }, [companyId, primaryRole, user?.id]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) => `${l.first_name} ${l.last_name ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase().includes(q));
  }, [leads, search]);

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[hsl(38,62%,52%)]/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[hsl(38,62%,52%)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Preventiv</h1>
            <p className="text-sm text-muted-foreground">Zgjidh pacientin për të krijuar një preventiv</p>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
          placeholder="Kërko pacientin me emër, telefon, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Asnjë pacient nuk u gjet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((l) => (
            <button
              key={l.id}
              onClick={() => nav(`/leads/${l.id}/preventiv`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  {l.first_name[0]?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{l.first_name} {l.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">{l.phone || l.email || "—"}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
