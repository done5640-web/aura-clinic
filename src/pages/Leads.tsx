import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Inbox, Upload, Trash2, CheckSquare, X, ChevronDown, History, CalendarDays, Clock, Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { stageTextBadge, stageColorClass } from "@/lib/stage-colors";
import { getPhoneCountry } from "@/lib/phoneCountry";
import { recentStatusChanges } from "@/lib/recentStatusChanges";
import { toast } from "sonner";
import ImportLeadsDialog from "@/components/ImportLeadsDialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import PhoneInput from "@/components/PhoneInput";
import { cn } from "@/lib/utils";
import { fetchAll } from "@/lib/fetchAll";

interface Lead {
  id: string; first_name: string; last_name: string | null; email: string | null; phone: string | null;
  company_name: string | null; source: string | null; value: number; updated_at: string; created_at: string;
  assigned_to_user_id: string | null; pipeline_stage_id: string | null;
  sherbimi: string | null; kur_kontaktohet: string | null; company_id: string | null;
  status_changed_at: string | null;
}

interface Activity {
  id: string; lead_id: string; user_id: string | null; type: string; content: string; created_at: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  note: "Shënim", call: "Telefonatë", email: "Email",
  meeting: "Takim", status_change: "Ndryshim statusi", assignment: "Caktim",
};

// Month names in Albanian
const MONTHS_SQ = ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"];

async function fetchAllLeads(
  queryFn: (from: number, to: number) => any
): Promise<{ data: Lead[]; error: any }> {
  try {
    const data = await fetchAll<Lead>(queryFn);
    return { data, error: null };
  } catch (error) {
    return { data: [], error };
  }
}

const fmtDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const datePresets = () => {
  const today = new Date();
  return {
    today: { from: fmtDate(today), to: fmtDate(today) },
  };
};

export default function Leads() {
  const { user, companyId, primaryRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<{ id: string; name: string; order: number; color: string; company_id: string }[]>([]);
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [assignTargets, setAssignTargets] = useState<{ id: string; full_name: string | null; email: string; label?: string }[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [openSheet, setOpenSheet] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [confirmLead, setConfirmLead] = useState<Lead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState(false);
  const [bulkConfirmStage, setBulkConfirmStage] = useState<{ stageId: string; stageName: string } | null>(null);
  const [bulkConfirmAssign, setBulkConfirmAssign] = useState<{ userId: string; userName: string } | null>(null);
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [createdFrom, setCreatedFrom] = useState<string>("");
  const [createdTo, setCreatedTo] = useState<string>("");
  const [createdRangeOpen, setCreatedRangeOpen] = useState(false);

  // History modal state
  const [historyLead, setHistoryLead] = useState<Lead | null>(null);
  const [historyActs, setHistoryActs] = useState<Activity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyCalView, setHistoryCalView] = useState<"calendar" | "table">("calendar");
  const [historyCalMonth, setHistoryCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const PAGE_SIZE = 30;
  const [page, setPage] = useState(1);
  const loadCancelRef = useRef(false);

  const isSuperAdmin = primaryRole === "super_admin";
  const canEdit = primaryRole === "company_admin" || primaryRole === "team_leader";
  const canDelete = primaryRole === "company_admin" || primaryRole === "team_leader" || primaryRole === "super_admin";

  const load = async (role: string | null, cid: string | null) => {
    loadCancelRef.current = false;
    setLoading(true);
    let leads: Lead[] = [], stagesData: any[] = [], membersData: any[] = [],
        companiesData: any[] = [], assignTargetsData: any[] = [];

    if (role === "super_admin") {
      const [{ data: l, error: le }, { data: s }, { data: p }, { data: c }] = await Promise.all([
        fetchAllLeads((from, to) => supabase.from("leads").select("*").order("updated_at", { ascending: false }).range(from, to)),
        supabase.from("pipeline_stages").select("*").order("order", { ascending: true }),
        supabase.from("profiles").select("id, full_name, email"),
        supabase.from("companies").select("id, name"),
      ]);
      if (loadCancelRef.current) return;
      if (le) { toast.error("Gabim gjatë ngarkimit: " + le.message); setLoading(false); return; }
      leads = (l ?? []) as Lead[]; stagesData = s ?? []; membersData = p ?? [];
      companiesData = c ?? []; assignTargetsData = p ?? [];

    } else if (role === "company_admin" && cid) {
      const [{ data: l, error: le }, { data: s }, { data: p }, { data: roleRows }] = await Promise.all([
        fetchAllLeads((from, to) => supabase.from("leads").select("*").eq("company_id", cid).order("updated_at", { ascending: false }).range(from, to)),
        supabase.from("pipeline_stages").select("*").eq("company_id", cid).order("order", { ascending: true }),
        supabase.from("profiles").select("id, full_name, email").eq("company_id", cid),
        supabase.from("user_roles").select("user_id, role").eq("company_id", cid),
      ]);
      if (loadCancelRef.current) return;
      if (le) { toast.error("Gabim gjatë ngarkimit: " + le.message); setLoading(false); return; }
      leads = (l ?? []) as Lead[]; stagesData = s ?? []; membersData = p ?? [];
      const roleMap = new Map<string, string>();
      (roleRows ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));
      const tls = (p ?? []).filter((prof: any) => roleMap.get(prof.id) === "team_leader");
      assignTargetsData = tls.map((tl: any) => ({ ...tl, label: "Team Leader" }));

    } else if (role === "team_leader" && cid) {
      const { data: myOperators } = await supabase.from("profiles").select("id, full_name, email").eq("team_leader_id", user?.id ?? "");
      if (loadCancelRef.current) return;
      const operatorIds = (myOperators ?? []).map((p: any) => p.id);
      const allIds = [user?.id ?? "", ...operatorIds].filter(Boolean);
      const [{ data: l }, { data: s }, { data: p }] = await Promise.all([
        allIds.length > 0
          ? fetchAllLeads((from, to) => supabase.from("leads").select("*").eq("company_id", cid).in("assigned_to_user_id", allIds).order("updated_at", { ascending: false }).range(from, to))
          : fetchAllLeads((from, to) => supabase.from("leads").select("*").eq("company_id", cid).eq("assigned_to_user_id", user?.id ?? "").order("updated_at", { ascending: false }).range(from, to)),
        supabase.from("pipeline_stages").select("*").eq("company_id", cid).order("order", { ascending: true }),
        supabase.from("profiles").select("id, full_name, email").in("id", allIds.length > 0 ? allIds : [user?.id ?? ""]),
      ]);
      if (loadCancelRef.current) return;
      leads = (l ?? []) as Lead[]; stagesData = s ?? []; membersData = p ?? [];
      assignTargetsData = (myOperators ?? []).map((op: any) => ({ ...op, label: "Operator" }));

    } else if (role === "operator" && cid) {
      const [{ data: l }, { data: s }] = await Promise.all([
        fetchAllLeads((from, to) => supabase.from("leads").select("*").eq("assigned_to_user_id", user?.id ?? "").order("updated_at", { ascending: false }).range(from, to)),
        supabase.from("pipeline_stages").select("*").eq("company_id", cid).order("order", { ascending: true }),
      ]);
      if (loadCancelRef.current) return;
      leads = (l ?? []) as Lead[]; stagesData = s ?? [];
    } else {
      setLoading(false);
      return;
    }

    setLeads(leads);
    setStages(stagesData as any);
    setMembers(membersData as any);
    setCompanies(companiesData as any);
    setAssignTargets(assignTargetsData as any);
    setLoading(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [stageFilter, assigneeFilter, sourceFilter, search, dateFrom, dateTo, createdFrom, createdTo]);

  useEffect(() => {
    if (!primaryRole) return;
    if (primaryRole !== "super_admin" && !companyId) return;
    loadCancelRef.current = true;
    load(primaryRole, companyId);
  }, [companyId, primaryRole]);

  // Unique sources for filter
  const uniqueSources = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const l of leads) {
      if (l.source && !seen.has(l.source)) { seen.add(l.source); result.push(l.source); }
    }
    return result.sort();
  }, [leads]);

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toMs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    const cFromMs = createdFrom ? new Date(createdFrom).getTime() : null;
    const cToMs = createdTo ? new Date(createdTo + "T23:59:59").getTime() : null;
    return leads
      .filter((l) => {
        if (stageFilter !== "all" && l.pipeline_stage_id !== stageFilter) return false;
        if (assigneeFilter !== "all" && l.assigned_to_user_id !== assigneeFilter) return false;
        if (sourceFilter !== "all" && l.source !== sourceFilter) return false;
        if (fromMs !== null && new Date(l.updated_at).getTime() < fromMs) return false;
        if (toMs !== null && new Date(l.updated_at).getTime() > toMs) return false;
        if (cFromMs !== null && new Date(l.created_at).getTime() < cFromMs) return false;
        if (cToMs !== null && new Date(l.created_at).getTime() > cToMs) return false;
        if (search) {
          const q = search.toLowerCase();
          const blob = `${l.first_name} ${l.last_name ?? ""} ${l.email ?? ""} ${l.phone ?? ""} ${l.sherbimi ?? ""}`.toLowerCase();
          if (!blob.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (recentStatusChanges.has(a.id) ? 1 : 0) - (recentStatusChanges.has(b.id) ? 1 : 0));
  }, [leads, stageFilter, assigneeFilter, sourceFilter, search, dateFrom, dateTo, createdFrom, createdTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stageById = (id: string | null) => stages.find((s) => s.id === id);
  const memberById = (id: string | null) => members.find((m) => m.id === id);
  const companyById = (id: string | null) => companies.find((c) => c.id === id);

  const handleDelete = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setConfirmLead(lead);
  };

  const confirmDelete = async () => {
    if (!confirmLead) return;
    const { error } = await supabase.from("leads").delete().eq("id", confirmLead.id);
    setConfirmLead(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacienti u fshi");
    load(primaryRole, companyId);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    const allPageSelected = paginated.length > 0 && paginated.every((l) => selected.has(l.id));
    if (allPageSelected) {
      setSelected((prev) => { const n = new Set(prev); paginated.forEach((l) => n.delete(l.id)); return n; });
    } else {
      setSelected((prev) => { const n = new Set(prev); paginated.forEach((l) => n.add(l.id)); return n; });
    }
  };
  const clearSelection = () => setSelected(new Set());

  const bulkChangeStage = async (stageId: string) => {
    await Promise.all([...selected].map((id) => supabase.from("leads").update({ pipeline_stage_id: stageId }).eq("id", id)));
    selected.forEach(id => recentStatusChanges.add(id));
    setLeads(prev => [
      ...prev.filter(l => !selected.has(l.id)),
      ...prev.filter(l => selected.has(l.id)).map(l => ({ ...l, pipeline_stage_id: stageId })),
    ]);
    toast.success(`Statusi u ndryshua për ${selected.size} pacientë`);
    clearSelection();
  };

  const bulkAssign = async (userId: string) => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => supabase.from("leads").update({ assigned_to_user_id: userId }).eq("id", id)));
    setLeads(prev => prev.map(l => ids.includes(l.id) ? { ...l, assigned_to_user_id: userId } : l));
    toast.success(`${ids.length} pacientë u caktuan`);
    clearSelection();
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    await Promise.all(ids.map((id) => supabase.from("leads").delete().eq("id", id)));
    setLeads(prev => prev.filter(l => !ids.includes(l.id)));
    toast.success(`${ids.length} pacientë u fshinë`);
    clearSelection();
    setBulkConfirmDelete(false);
  };

  const handleAdd = async (form: any) => {
    if (!companyId) return;
    const { error } = await supabase.from("leads").insert({
      company_id: companyId,
      first_name: form.first_name,
      last_name: form.last_name || null,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source || "manuale",
      value: Number(form.value || 0),
      pipeline_stage_id: form.pipeline_stage_id || stages[0]?.id,
      assigned_to_user_id: form.assigned_to_user_id || user?.id,
      sherbimi: form.sherbimi || null,
      kur_kontaktohet: form.kur_kontaktohet || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Pacienti u shtua");
    setOpenSheet(false);
    load(primaryRole, companyId);
  };

  // Open history modal — load activities for that lead
  const openHistory = async (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setHistoryLead(lead);
    setHistoryLoading(true);
    const now = new Date(lead.updated_at);
    setHistoryCalMonth({ year: now.getFullYear(), month: now.getMonth() });
    const { data } = await supabase
      .from("lead_activities")
      .select("*")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false });
    setHistoryActs((data ?? []) as Activity[]);
    setHistoryLoading(false);
  };

  // Group activities by day for calendar view
  const actsGroupedByDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of historyActs) {
      const key = a.created_at.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [historyActs]);

  // Build calendar grid for current month
  const calendarGrid = useMemo(() => {
    const { year, month } = historyCalMonth;
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    // Start week on Monday
    const startOffset = (firstDay + 6) % 7;
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [historyCalMonth]);

  if (loading) return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>
      <Skeleton className="h-14 rounded-xl" />
      {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Pacientët</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-semibold text-foreground">{filtered.length}</span> nga {leads.length} pacientë
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="rounded-xl gap-2">
                <Upload className="w-4 h-4" />Importo
              </Button>
              <Sheet open={openSheet} onOpenChange={setOpenSheet}>
                <SheetTrigger asChild>
                  <Button size="sm" className="rounded-xl gap-2 bg-[hsl(25,12%,26%)] hover:bg-[hsl(25,12%,18%)] text-white">
                    <Plus className="w-4 h-4" />Pacient i ri
                  </Button>
                </SheetTrigger>
                <SheetContent className="overflow-y-auto">
                  <SheetHeader><SheetTitle>Pacient i ri</SheetTitle></SheetHeader>
                  <AddLeadForm stages={stages} members={members} onSubmit={handleAdd} />
                </SheetContent>
              </Sheet>
            </>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card className="rounded-2xl border shadow-sm">
        <CardContent className="p-3 flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9 h-9 rounded-xl bg-muted/50 border-0 focus-visible:ring-1 focus-visible:ring-primary"
              placeholder="Kërko emër, telefon, shërbim..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[170px] h-9 rounded-xl">
              <SelectValue placeholder="Të gjithë statuset" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Të gjithë statuset</SelectItem>
              {stages.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Operator filter */}
          {(canEdit || isSuperAdmin) && members.length > 0 && (
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[170px] h-9 rounded-xl">
                <SelectValue placeholder="Të gjithë operatorët" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjithë operatorët</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {/* Source filter */}
          {uniqueSources.length > 0 && (
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px] h-9 rounded-xl">
                <SelectValue placeholder="Të gjitha burimet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Të gjitha burimet</SelectItem>
                {uniqueSources.map((src) => (
                  <SelectItem key={src} value={src}>{src}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear filters button — only when any filter is active */}
          {(stageFilter !== "all" || assigneeFilter !== "all" || sourceFilter !== "all" || search || dateFrom || dateTo || createdFrom || createdTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl text-muted-foreground hover:text-foreground gap-1.5"
              onClick={() => { setStageFilter("all"); setAssigneeFilter("all"); setSourceFilter("all"); setSearchInput(""); setDateFrom(""); setDateTo(""); setCreatedFrom(""); setCreatedTo(""); }}
            >
              <X className="w-3.5 h-3.5" />Pastro
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Bulk action toolbar */}
      {canEdit && selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-[hsl(25,12%,22%)] text-white rounded-xl shadow-lg flex-wrap">
          <CheckSquare className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">{selected.size} të zgjedhur</span>
          <div className="flex-1" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                Ndrysho statusin <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {stages.filter((s, i, arr) => arr.findIndex(x => x.name === s.name) === i).map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => selected.size > 1 ? setBulkConfirmStage({ stageId: s.id, stageName: s.name }) : bulkChangeStage(s.id)}>
                  {s.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {assignTargets.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                  {primaryRole === "company_admin" ? "Cakto te Team Leader" : primaryRole === "team_leader" ? "Cakto te Operator" : "Cakto"} <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {assignTargets.map((t) => (
                  <DropdownMenuItem key={t.id} onClick={() => selected.size > 1 ? setBulkConfirmAssign({ userId: t.id, userName: t.full_name || t.email }) : bulkAssign(t.id)}>
                    <div className="flex flex-col">
                      <span>{t.full_name || t.email}</span>
                      {t.label && <span className="text-[10px] text-muted-foreground">{t.label}</span>}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {canDelete && (
            <button
              onClick={() => setBulkConfirmDelete(true)}
              className="flex items-center gap-1.5 text-xs font-medium bg-red-500/80 hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> Fshi
            </button>
          )}

          <button onClick={clearSelection} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table — always rendered so headers stay stable while filters change */}
      {leads.length === 0 && !loading ? (
        <Card className="rounded-2xl border shadow-sm">
          <CardContent className="py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Inbox className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-base font-semibold mb-1">Asnjë pacient</p>
            <p className="text-sm text-muted-foreground mb-4">Nuk ka asnjë pacient të regjistruar.</p>
            {canEdit && (
              <Button className="rounded-xl gap-2 bg-[hsl(25,12%,26%)] text-white border-0" onClick={() => setOpenSheet(true)}>
                <Plus className="w-4 h-4" />Shto pacientin e parë
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  {canEdit && (
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={paginated.length > 0 && paginated.every((l) => selected.has(l.id))}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                  )}
                  <TableHead className="min-w-[140px] font-semibold text-xs uppercase tracking-wide">Emri</TableHead>
                  <TableHead className="min-w-[120px] font-semibold text-xs uppercase tracking-wide">Telefoni</TableHead>
                  <TableHead className="min-w-[160px] hidden md:table-cell font-semibold text-xs uppercase tracking-wide">Email</TableHead>
                  <TableHead className="min-w-[120px] font-semibold text-xs uppercase tracking-wide">
                    <Popover open={createdRangeOpen} onOpenChange={setCreatedRangeOpen}>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:text-foreground transition-colors",
                          (createdFrom || createdTo) ? "text-primary" : ""
                        )}>
                          Data e shtimit
                          {(createdFrom || createdTo) ? <Filter className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {/* Presets */}
                        <div className="p-3 border-b border-border space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data e shtimit</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { label: "Sot", key: "today" },
                            ] as const).map(({ label, key }) => {
                              const p = datePresets()[key];
                              const active = createdFrom === p.from && createdTo === p.to;
                              return (
                                <button
                                  key={key}
                                  onClick={() => { setCreatedFrom(p.from); setCreatedTo(p.to); }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                    active
                                      ? "bg-foreground text-background border-foreground"
                                      : "bg-muted/50 border-border hover:bg-muted text-foreground"
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <Calendar
                          mode="range"
                          selected={{
                            from: createdFrom ? new Date(createdFrom + "T12:00:00") : undefined,
                            to: createdTo ? new Date(createdTo + "T12:00:00") : undefined,
                          }}
                          onSelect={(range) => {
                            setCreatedFrom(range?.from ? fmtDate(range.from) : "");
                            setCreatedTo(range?.to ? fmtDate(range.to) : "");
                          }}
                          initialFocus
                          classNames={{ day_today: "font-normal" }}
                        />
                        <div className="p-3 border-t border-border flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {createdFrom || createdTo
                              ? <>
                                  {createdFrom && new Date(createdFrom + "T12:00:00").toLocaleDateString("sq-AL")}
                                  {createdFrom && createdTo && <span className="mx-1 opacity-50">→</span>}
                                  {createdTo && new Date(createdTo + "T12:00:00").toLocaleDateString("sq-AL")}
                                </>
                              : <span className="italic">Asnjë datë e zgjedhur</span>
                            }
                          </span>
                          {(createdFrom || createdTo) && (
                            <button
                              onClick={() => { setCreatedFrom(""); setCreatedTo(""); setCreatedRangeOpen(false); }}
                              className="text-xs text-destructive hover:underline shrink-0"
                            >
                              Pastro
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                  <TableHead className="min-w-[120px] font-semibold text-xs uppercase tracking-wide">
                    <Popover open={dateRangeOpen} onOpenChange={setDateRangeOpen}>
                      <PopoverTrigger asChild>
                        <button className={cn(
                          "flex items-center gap-1 font-semibold text-xs uppercase tracking-wide hover:text-foreground transition-colors",
                          (dateFrom || dateTo) ? "text-primary" : ""
                        )}>
                          Ndryshuar
                          {(dateFrom || dateTo) ? <Filter className="w-3 h-3" /> : <ChevronDown className="w-3 h-3 opacity-50" />}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {/* Presets */}
                        <div className="p-3 border-b border-border space-y-2">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data e ndryshimit</p>
                          <div className="flex flex-wrap gap-1.5">
                            {([
                              { label: "Sot", key: "today" },
                            ] as const).map(({ label, key }) => {
                              const p = datePresets()[key];
                              const active = dateFrom === p.from && dateTo === p.to;
                              return (
                                <button
                                  key={key}
                                  onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
                                    active
                                      ? "bg-foreground text-background border-foreground"
                                      : "bg-muted/50 border-border hover:bg-muted text-foreground"
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                        <Calendar
                          mode="range"
                          selected={{
                            from: dateFrom ? new Date(dateFrom + "T12:00:00") : undefined,
                            to: dateTo ? new Date(dateTo + "T12:00:00") : undefined,
                          }}
                          onSelect={(range) => {
                            setDateFrom(range?.from ? fmtDate(range.from) : "");
                            setDateTo(range?.to ? fmtDate(range.to) : "");
                          }}
                          initialFocus
                          classNames={{ day_today: "font-normal" }}
                        />
                        <div className="p-3 border-t border-border flex items-center justify-between gap-3">
                          <span className="text-xs text-muted-foreground">
                            {dateFrom || dateTo
                              ? <>
                                  {dateFrom && new Date(dateFrom + "T12:00:00").toLocaleDateString("sq-AL")}
                                  {dateFrom && dateTo && <span className="mx-1 opacity-50">→</span>}
                                  {dateTo && new Date(dateTo + "T12:00:00").toLocaleDateString("sq-AL")}
                                </>
                              : <span className="italic">Asnjë datë e zgjedhur</span>
                            }
                          </span>
                          {(dateFrom || dateTo) && (
                            <button
                              onClick={() => { setDateFrom(""); setDateTo(""); setDateRangeOpen(false); }}
                              className="text-xs text-destructive hover:underline shrink-0"
                            >
                              Pastro
                            </button>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </TableHead>
                  <TableHead className="min-w-[150px] font-semibold text-xs uppercase tracking-wide">Statusi</TableHead>
                  <TableHead className="min-w-[120px] hidden lg:table-cell font-semibold text-xs uppercase tracking-wide">Operatori</TableHead>
                  {isSuperAdmin && <TableHead className="min-w-[120px] font-semibold text-xs uppercase tracking-wide">Klinika</TableHead>}
                  {canDelete && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="py-16 text-center text-sm text-muted-foreground">
                      Asnjë pacient nuk u gjet me këto filtra.
                    </TableCell>
                  </TableRow>
                )}
                {paginated.map((l) => {
                  const s = stageById(l.pipeline_stage_id);
                  const m = memberById(l.assigned_to_user_id);
                  return (
                    <TableRow
                      key={l.id}
                      className={cn("hover:bg-muted/50 transition-colors group", selected.has(l.id) && "bg-amber-50/60 dark:bg-amber-500/5")}
                      onClick={() => {
                        if (canEdit) { toggleSelect(l.id); }
                        else {
                          sessionStorage.setItem("leadNavIds", JSON.stringify(filtered.map(x => x.id)));
                          navigate(`/leads/${l.id}`);
                        }
                      }}
                    >
                      {canEdit && (
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selected.has(l.id)}
                            onCheckedChange={() => toggleSelect(l.id)}
                          />
                        </TableCell>
                      )}
                      <TableCell className="cursor-pointer" onClick={() => {
                        // Persist current ordered list so detail page can nav prev/next
                        sessionStorage.setItem("leadNavIds", JSON.stringify(filtered.map(x => x.id)));
                        navigate(`/leads/${l.id}`);
                      }}>
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                              {l.first_name[0]?.toUpperCase()}
                            </span>
                          </div>
                          <span className="font-semibold text-sm whitespace-nowrap">{l.first_name} {l.last_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                        {l.phone ? <PhoneCell phone={l.phone} /> : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground hidden md:table-cell max-w-[160px] truncate cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>{l.email || "—"}</TableCell>

                      {/* Data e shtimit — right after Email */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
                        <div>{new Date(l.created_at).toLocaleDateString("sq-AL")}</div>
                        <div className="opacity-60">{new Date(l.created_at).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</div>
                      </TableCell>

                      {/* Ndryshuar — clickable, opens history modal */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <button
                          onClick={(e) => openHistory(e, l)}
                          className="flex flex-col items-start gap-0.5 hover:text-foreground transition-colors group/hist"
                          title="Shiko historikun e ndryshimeve"
                        >
                          <div className="flex items-center gap-1">
                            <span>{new Date(l.updated_at).toLocaleDateString("sq-AL")}</span>
                            <History className="w-3 h-3 opacity-0 group-hover/hist:opacity-100 transition-opacity" />
                          </div>
                          <div className="opacity-60">{new Date(l.updated_at).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</div>
                        </button>
                      </TableCell>

                      <TableCell>
                        {s ? (
                          <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap", stageTextBadge(s.name, s.code))}>
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", stageColorClass(s.name, s.code))} />
                            {s.name}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </TableCell>
                      <TableCell className="text-sm hidden lg:table-cell whitespace-nowrap text-muted-foreground">{m?.full_name || m?.email || "—"}</TableCell>
                      {isSuperAdmin && <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{companyById(l.company_id)?.name || "—"}</TableCell>}
                      {canDelete && (
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleDelete(e, l)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Faqja <span className="font-semibold text-foreground">{page}</span> nga <span className="font-semibold text-foreground">{totalPages}</span>
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              ← Para
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Pas →
            </Button>
          </div>
        </div>
      )}

      {/* ── History modal ── */}
      <Dialog open={!!historyLead} onOpenChange={(o) => { if (!o) setHistoryLead(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Historiku — {historyLead?.first_name} {historyLead?.last_name}
            </DialogTitle>
          </DialogHeader>

          {/* View toggle */}
          <div className="flex gap-1 bg-muted/60 rounded-lg p-1 w-fit shrink-0">
            {(["calendar", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setHistoryCalView(v)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                  historyCalView === v ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {v === "calendar" ? "Kalendar" : "Tabelë"}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 min-h-0">
            {historyLoading ? (
              <div className="space-y-2 p-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : historyActs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">Asnjë ndryshim i regjistruar.</p>
            ) : historyCalView === "calendar" ? (
              /* ── Calendar view ── */
              <div className="space-y-4 p-1">
                {/* Month nav */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setHistoryCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    ←
                  </button>
                  <span className="font-semibold text-sm">
                    {MONTHS_SQ[historyCalMonth.month]} {historyCalMonth.year}
                  </span>
                  <button
                    onClick={() => setHistoryCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  >
                    →
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Hë","Ma","Më","En","Pr","Sh","Di"].map((d) => (
                    <div key={d} className="text-[10px] font-semibold text-muted-foreground uppercase py-1">{d}</div>
                  ))}
                  {calendarGrid.map((day, idx) => {
                    if (day === null) return <div key={`e-${idx}`} />;
                    const { year, month } = historyCalMonth;
                    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayActs = actsGroupedByDay.get(key) ?? [];
                    const isToday = key === new Date().toISOString().slice(0, 10);
                    return (
                      <div
                        key={key}
                        className={cn(
                          "min-h-[52px] rounded-lg p-1 border transition-colors",
                          dayActs.length > 0 ? "border-amber-300 bg-amber-50/60 dark:bg-amber-500/10 dark:border-amber-600/40" : "border-border bg-muted/20",
                          isToday && "ring-1 ring-primary"
                        )}
                      >
                        <div className={cn("text-[11px] font-semibold mb-0.5", isToday ? "text-primary" : "text-muted-foreground")}>{day}</div>
                        {dayActs.slice(0, 2).map((a) => (
                          <div key={a.id} className="text-[9px] leading-tight truncate text-amber-700 dark:text-amber-400 font-medium">
                            {ACTIVITY_LABELS[a.type] ?? a.type}
                          </div>
                        ))}
                        {dayActs.length > 2 && (
                          <div className="text-[9px] text-muted-foreground">+{dayActs.length - 2}</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend for active days */}
                {actsGroupedByDay.size > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Ndryshimet këtë muaj</p>
                    {[...actsGroupedByDay.entries()]
                      .filter(([k]) => k.startsWith(`${historyCalMonth.year}-${String(historyCalMonth.month + 1).padStart(2, "0")}`))
                      .sort(([a], [b]) => b.localeCompare(a))
                      .map(([date, acts]) => (
                        <div key={date} className="flex gap-2 text-xs">
                          <span className="font-semibold text-muted-foreground shrink-0 w-20">
                            {new Date(date).toLocaleDateString("sq-AL", { day: "2-digit", month: "short" })}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {acts.map((a) => (
                              <span key={a.id} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                                {ACTIVITY_LABELS[a.type] ?? a.type}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              /* ── Table view ── */
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lloji</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Përshkrimi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {historyActs.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString("sq-AL")}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-xs font-semibold whitespace-nowrap">
                          {ACTIVITY_LABELS[a.type] ?? a.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-foreground/80 max-w-[300px]">{a.content}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ImportLeadsDialog open={importOpen} onOpenChange={setImportOpen} stages={stages} onDone={() => load(primaryRole, companyId)} />
      <ConfirmDialog
        open={!!confirmLead}
        title="Fshi pacientin"
        description={confirmLead ? `Jeni të sigurt që doni të fshini "${confirmLead.first_name} ${confirmLead.last_name ?? ""}"? Ky veprim nuk mund të kthehet.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmLead(null)}
      />
      <ConfirmDialog
        open={bulkConfirmDelete}
        title={`Fshi ${selected.size} pacientë`}
        description={`Jeni të sigurt që doni të fshini ${selected.size} pacientë të zgjedhur? Ky veprim nuk mund të kthehet.`}
        onConfirm={bulkDelete}
        onCancel={() => setBulkConfirmDelete(false)}
      />
      <ConfirmDialog
        open={!!bulkConfirmStage}
        title="Ndrysho statusin"
        description={bulkConfirmStage ? `Jeni të sigurt që doni të ndryshoni statusin e ${selected.size} pacientëve të zgjedhur në "${bulkConfirmStage.stageName}"?` : ""}
        onConfirm={() => { if (bulkConfirmStage) { bulkChangeStage(bulkConfirmStage.stageId); setBulkConfirmStage(null); } }}
        onCancel={() => setBulkConfirmStage(null)}
      />
      <ConfirmDialog
        open={!!bulkConfirmAssign}
        title="Cakto operatorin"
        description={bulkConfirmAssign ? `Jeni të sigurt që doni të caktoni ${selected.size} pacientë tek "${bulkConfirmAssign.userName}"?` : ""}
        onConfirm={() => { if (bulkConfirmAssign) { bulkAssign(bulkConfirmAssign.userId); setBulkConfirmAssign(null); } }}
        onCancel={() => setBulkConfirmAssign(null)}
      />
    </div>
  );
}

function PhoneCell({ phone }: { phone: string }) {
  const country = getPhoneCountry(phone);
  return (
    <span className="inline-flex items-center gap-1.5">
      {country && <span title={country.name}>{country.flag}</span>}
      <span>{phone}</span>
    </span>
  );
}

function AddLeadForm({ stages, members, onSubmit }: any) {
  const [form, setForm] = useState<any>({
    first_name: "", last_name: "", email: "", phone: "",
    source: "manuale", value: 0, sherbimi: "", kur_kontaktohet: "",
    pipeline_stage_id: "", assigned_to_user_id: "",
  });

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <form className="space-y-4 mt-4 pb-6" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Emri *</Label><Input required value={form.first_name} onChange={f("first_name")} className="mt-1" /></div>
        <div><Label>Mbiemri</Label><Input value={form.last_name} onChange={f("last_name")} className="mt-1" /></div>
      </div>
      <div>
        <Label>Telefoni</Label>
        <PhoneInput value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} className="mt-1" />
      </div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={f("email")} className="mt-1" /></div>
      <div><Label>Shërbimi i kërkuar</Label><Input value={form.sherbimi} placeholder="p.sh. Implant, Ortodonci..." onChange={f("sherbimi")} className="mt-1" /></div>
      <div><Label>Kur të kontaktohet</Label><Input value={form.kur_kontaktohet} placeholder="p.sh. E Hënë 10:00" onChange={f("kur_kontaktohet")} className="mt-1" /></div>
      <div><Label>Burimi</Label><Input value={form.source} onChange={f("source")} className="mt-1" /></div>
      <div><Label>Vlera (€)</Label><Input type="number" value={form.value} onChange={f("value")} className="mt-1" /></div>
      <div>
        <Label>Statusi</Label>
        <Select value={form.pipeline_stage_id} onValueChange={(v) => setForm({ ...form, pipeline_stage_id: v })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Zgjidh statusin" /></SelectTrigger>
          <SelectContent>{stages.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label>Cakto operator</Label>
        <Select value={form.assigned_to_user_id} onValueChange={(v) => setForm({ ...form, assigned_to_user_id: v })}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Zgjidh operatorin..." /></SelectTrigger>
          <SelectContent>{members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button type="submit" className="w-full rounded-xl bg-[hsl(25,12%,26%)] hover:bg-[hsl(25,12%,18%)] text-white">
        Krijo pacientin
      </Button>
    </form>
  );
}
