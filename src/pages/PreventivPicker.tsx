import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import SearchableSelect from "@/components/SearchableSelect";
import { Search, ChevronRight, Sparkles, Inbox } from "lucide-react";
import { fetchAll } from "@/lib/fetchAll";
import { getPhoneCountry } from "@/lib/phoneCountry";

interface Lead {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null;
  company_id: string | null; created_at: string;
}

const PAGE_SIZE = 10;

export default function PreventivPicker() {
  const { user, companyId, primaryRole } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!primaryRole) return;
    if (primaryRole !== "super_admin" && !companyId) return;
    (async () => {
      setLoading(true);
      let data: Lead[] = [];
      if (primaryRole === "super_admin") {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id, created_at").order("created_at", { ascending: false }).range(from, to)
        );
      } else if (primaryRole === "operator") {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id, created_at")
            .eq("assigned_to_user_id", user?.id ?? "").order("created_at", { ascending: false }).range(from, to)
        );
      } else {
        data = await fetchAll<Lead>((from, to) =>
          supabase.from("leads").select("id, first_name, last_name, email, phone, company_id, created_at")
            .eq("company_id", companyId).order("created_at", { ascending: false }).range(from, to)
        );
      }
      setLeads(data);
      setLoading(false);
    })();
  }, [companyId, primaryRole, user?.id]);

  useEffect(() => { setPage(1); }, [search, countryFilter]);

  // Unique countries (derived from each lead's phone number) for filter
  const uniqueCountries = useMemo(() => {
    const seen = new Map<string, string>(); // name -> flag
    for (const l of leads) {
      const country = getPhoneCountry(l.phone);
      if (country && !seen.has(country.name)) seen.set(country.name, country.flag);
    }
    return [...seen.entries()].map(([name, flag]) => ({ name, flag })).sort((a, b) => a.name.localeCompare(b.name));
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (countryFilter !== "all" && getPhoneCountry(l.phone)?.name !== countryFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const blob = `${l.first_name} ${l.last_name ?? ""} ${l.email ?? ""} ${l.phone ?? ""}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [leads, search, countryFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-10 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
            placeholder="Kërko pacientin me emër, telefon, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
        {uniqueCountries.length > 0 && (
          <SearchableSelect
            className="w-[170px] h-10"
            value={countryFilter}
            onValueChange={setCountryFilter}
            placeholder="Të gjitha shtetet"
            searchPlaceholder="Kërko shtetin..."
            options={[
              { value: "all", label: "Të gjitha shtetet" },
              ...uniqueCountries.map((c) => ({ value: c.name, label: c.name, prefix: c.flag })),
            ]}
          />
        )}
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
        <>
          <div className="space-y-1.5">
            {paginated.map((l) => (
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

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-sm text-muted-foreground">
                Faqja <span className="font-semibold text-foreground">{page}</span> nga <span className="font-semibold text-foreground">{totalPages}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  ← Para
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Pas →
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
