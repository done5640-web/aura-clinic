import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, ArrowRight, ChevronLeft, ChevronRight,
  Phone, Mail, Wrench, Clock, Euro, User, Upload,
  Trash2, FileText, ImageIcon, File as FileIcon, Plus, StickyNote,
  PhoneCall, CalendarCheck, RefreshCw, CheckSquare, CalendarDays, Pencil,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPhoneCountry } from "@/lib/phoneCountry";
import { recentStatusChanges } from "@/lib/recentStatusChanges";
import PhoneInput from "@/components/PhoneInput";
import ConfirmDialog from "@/components/ConfirmDialog";
import { stageColorClass } from "@/lib/stage-colors";
import { compressForUpload } from "@/lib/compressFile";

const ACTIVITY_LABELS: Record<string, string> = {
  note: "Shënim", call: "Telefonatë", email: "Email",
  meeting: "Takim", status_change: "Ndryshim statusi", assignment: "Caktim",
};
const ACTIVITY_ICONS: Record<string, any> = {
  note: StickyNote, call: PhoneCall, email: Mail,
  meeting: CalendarCheck, status_change: RefreshCw, assignment: User,
};

function fileIcon(mime: string) {
  if (mime?.startsWith("image/")) return ImageIcon;
  if (mime?.includes("pdf")) return FileText;
  return FileIcon;
}

const TABS = [
  { key: "activities", label: "Aktivitete" },
  { key: "tasks",      label: "Detyra" },
  { key: "calendar",   label: "Telefonata" },
  { key: "files",      label: "Skedarë" },
  { key: "quotes",     label: "Preventiva" },
];


export default function LeadDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, primaryRole } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prev / Next navigation — read ordered list written by Leads page
  const leadNavIds: string[] = useMemo(() => {
    try { return JSON.parse(sessionStorage.getItem("leadNavIds") ?? "[]"); } catch { return []; }
  }, [id]);
  const currentNavIdx = leadNavIds.indexOf(id ?? "");
  const prevId = currentNavIdx > 0 ? leadNavIds[currentNavIdx - 1] : null;
  const nextId = currentNavIdx !== -1 && currentNavIdx < leadNavIds.length - 1 ? leadNavIds[currentNavIdx + 1] : null;

  const [loading, setLoading]       = useState(true);
  const [lead, setLead]             = useState<any>(null);
  const [stages, setStages]         = useState<any[]>([]);
  const [members, setMembers]       = useState<any[]>([]);
  const [acts, setActs]             = useState<any[]>([]);
  const [tasks, setTasks]           = useState<any[]>([]);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [calEvents, setCalEvents]   = useState<any[]>([]);
  const [quotes, setQuotes]         = useState<any[]>([]);
  const [activeTab, setActiveTab]   = useState("activities");

  const [activityType, setActivityType]     = useState("note");
  const [activityContent, setActivityContent] = useState("");
  const [taskTitle, setTaskTitle]   = useState("");
  const [taskDue, setTaskDue]       = useState("");
  const [uploading, setUploading]   = useState(false);
  const [calOpen, setCalOpen]       = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [calForm, setCalForm]       = useState({ title: "", scheduled_at: "", type: "call", notes: "" });
  const [calBusy, setCalBusy]       = useState(false);

  const canManage = primaryRole === "company_admin" || primaryRole === "team_leader" || primaryRole === "super_admin";
  const canEdit   = canManage || primaryRole === "operator" || primaryRole === "super_admin";
  const canDelete = canManage;

  const loadActivities = async () => {
    if (!id) return;
    const { data } = await supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false });
    setActs(data ?? []);
  };
  const loadTasks = async () => {
    if (!id) return;
    const { data } = await supabase.from("tasks").select("*").eq("lead_id", id).order("due_date");
    setTasks(data ?? []);
  };
  const loadCalEvents = async () => {
    if (!id) return;
    const { data } = await supabase.from("calendar_events").select("*").eq("lead_id", id).order("scheduled_at");
    setCalEvents(data ?? []);
  };
  const loadQuotes = async () => {
    if (!id) return;
    const { data } = await supabase.from("quotes").select("*").eq("lead_id", id).order("created_at", { ascending: false });
    setQuotes(data ?? []);
  };
  const loadAttachments = async () => {
    if (!id) return;
    const { data } = await supabase.from("lead_attachments").select("*").eq("lead_id", id).order("created_at", { ascending: false });
    if (!data) { setAttachments([]); return; }
    // Generate short-lived signed URLs (1 hour) — bucket is private
    const withUrls = await Promise.all(
      data.map(async (att) => {
        const { data: signed } = await supabase.storage.from("lead-attachments").createSignedUrl(att.file_path, 3600);
        return { ...att, signedUrl: signed?.signedUrl ?? null };
      })
    );
    setAttachments(withUrls);
  };

  const load = async (cancelled: { current: boolean }) => {
    if (!id) return;
    setLoading(true);
    const { data: l } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
    if (cancelled.current) return;
    if (!l) { setLoading(false); return; }
    const [{ data: s }, { data: p }, { data: a }, { data: t }, { data: att }, { data: cal }, { data: q }] = await Promise.all([
      supabase.from("pipeline_stages").select("*").eq("company_id", l.company_id).order("order"),
      supabase.from("profiles").select("id, full_name, email").eq("company_id", l.company_id),
      supabase.from("lead_activities").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("tasks").select("*").eq("lead_id", id).order("due_date"),
      supabase.from("lead_attachments").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      supabase.from("calendar_events").select("*").eq("lead_id", id).order("scheduled_at"),
      supabase.from("quotes").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
    ]);
    if (cancelled.current) return;
    setLead(l); setStages(s ?? []); setMembers(p ?? []);
    setActs(a ?? []); setTasks(t ?? []); setAttachments(att ?? []);
    setCalEvents(cal ?? []);
    setQuotes(q ?? []);
    setLoading(false);
  };

  useEffect(() => {
    const cancelled = { current: false };
    load(cancelled);
    return () => { cancelled.current = true; };
  }, [id]);

  const updateLead = async (patch: any) => {
    const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    setLead({ ...lead, ...patch });
    toast.success("Ruajtur");
  };

  const changeStage = async (stageId: string) => {
    const newStage = stages.find((s) => s.id === stageId);
    const { error } = await supabase.from("leads").update({ pipeline_stage_id: stageId }).eq("id", lead.id);
    if (error) { toast.error(error.message); return; }
    recentStatusChanges.add(lead.id);
    setLead({ ...lead, pipeline_stage_id: stageId });
    await supabase.from("lead_activities").insert({
      lead_id: lead.id, user_id: user?.id, type: "status_change",
      content: `Statusi ndryshoi → ${newStage?.name}`,
    });
    loadActivities();
    toast.success(`Statusi → ${newStage?.name}`);
  };

  const addActivity = async () => {
    if (!activityContent.trim()) { toast.error("Shkruaj diçka para se të ruash"); return; }
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: lead.id, user_id: user?.id,
      type: activityType, content: activityContent.trim(),
    });
    if (error) { toast.error(error.message); return; }
    setActivityContent("");
    toast.success("Aktiviteti u regjistrua");
    loadActivities();
  };

  const addTask = async () => {
    if (!taskTitle.trim()) { toast.error("Shkruaj titullin e detyrës"); return; }
    const { error } = await supabase.from("tasks").insert({
      lead_id: lead.id,
      assigned_to: lead.assigned_to_user_id ?? user?.id,
      title: taskTitle.trim(),
      due_date: taskDue || null,
      completed: false,
    });
    if (error) { toast.error(error.message); return; }
    setTaskTitle(""); setTaskDue("");
    toast.success("Detyra u shtua");
    loadTasks();
  };

  const toggleTask = async (t: any) => {
    const { error } = await supabase.from("tasks").update({ completed: !t.completed }).eq("id", t.id);
    if (error) { toast.error(error.message); return; }
    loadTasks();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !lead) return;
    setUploading(true);
    const file = await compressForUpload(rawFile);
    const path = `leads/${lead.id}/${Date.now()}_${file.name}`;
    const { error: upErr } = await supabase.storage.from("lead-attachments").upload(path, file);
    if (upErr) { toast.error(upErr.message); setUploading(false); return; }
    await supabase.from("lead_attachments").insert({
      lead_id: lead.id, uploaded_by: user?.id,
      file_name: file.name, file_path: path, file_size: file.size, mime_type: file.type,
    });
    toast.success("Skedari u ngarkua");
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    loadAttachments();
  };

  const deleteAttachment = async (att: any) => {
    const { error: storageErr } = await supabase.storage.from("lead-attachments").remove([att.file_path]);
    if (storageErr) { toast.error(storageErr.message); return; }
    const { error: dbErr } = await supabase.from("lead_attachments").delete().eq("id", att.id);
    if (dbErr) { toast.error(dbErr.message); return; }
    toast.success("Skedari u fshi");
    loadAttachments();
  };


  const addCalEvent = async () => {
    if (!calForm.title.trim() || !calForm.scheduled_at) { toast.error("Titulli dhe data janë të detyrueshme"); return; }
    setCalBusy(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user?.id, company_id: lead.company_id, lead_id: lead.id,
      title: calForm.title.trim(), scheduled_at: calForm.scheduled_at,
      type: calForm.type, notes: calForm.notes || null,
    });
    setCalBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Telefonata u planifikua");
    setCalOpen(false);
    setCalForm({ title: "", scheduled_at: "", type: "call", notes: "" });
    loadCalEvents();
  };

  const deleteCalEvent = async (evId: string) => {
    const { error } = await supabase.from("calendar_events").delete().eq("id", evId);
    if (error) { toast.error(error.message); return; }
    toast.success("Ngjarja u fshi");
    loadCalEvents();
  };

  const deleteLead = async () => {
    const { error } = await supabase.from("leads").delete().eq("id", lead.id);
    setDeleteOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Pacienti u fshi");
    nav("/leads");
  };

  if (loading) return (
    <div className="space-y-4 max-w-6xl">
      <Skeleton className="h-7 w-40 rounded" />
      <Skeleton className="h-28 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 lg:col-span-2 rounded-xl" />
      </div>
    </div>
  );
  if (!lead) return <div className="p-12 text-center text-muted-foreground text-sm">Pacienti nuk u gjet.</div>;

  const currentStage = stages.find((s) => s.id === lead.pipeline_stage_id);
  const assignedMember = members.find((m) => m.id === lead.assigned_to_user_id);

  const tabCounts: Record<string, number> = {
    activities: acts.length, tasks: tasks.length,
    calendar: calEvents.length, files: attachments.length,
    quotes: quotes.length,
  };

  return (
    <div className="space-y-5 max-w-6xl">

      {/* Back + Prev/Next + Delete */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            onClick={() => nav("/leads")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kthehu
          </button>

          {/* Prev / Next — only shown when coming from the leads list */}
          {leadNavIds.length > 0 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => prevId && nav(`/leads/${prevId}`)}
                disabled={!prevId}
                title="Pacienti i mëparshëm"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Para
              </button>
              {currentNavIdx !== -1 && (
                <span className="text-xs text-muted-foreground px-1 tabular-nums">
                  {currentNavIdx + 1} / {leadNavIds.length}
                </span>
              )}
              <button
                onClick={() => nextId && nav(`/leads/${nextId}`)}
                disabled={!nextId}
                title="Pacienti tjetër"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Pas
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {canDelete && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Fshi pacientin
          </button>
        )}
      </div>

      {/* ── Hero card ── */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">

          {/* Avatar + name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-xl bg-[hsl(25,12%,26%)] text-white flex items-center justify-center text-xl font-bold shrink-0">
              {lead.first_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl font-bold tracking-tight">{lead.first_name} {lead.last_name}</h1>
                {lead.value > 0 && (
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">€{Number(lead.value).toLocaleString()}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                {lead.phone && (() => {
                  const country = getPhoneCountry(lead.phone);
                  return (
                    <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                      {country && <span title={country.name}>{country.flag}</span>}
                      {lead.phone}
                      {country && <span className="text-xs opacity-70">({country.name})</span>}
                    </a>
                  );
                })()}
                {lead.email && (
                  <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />{lead.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Operator + Status — aligned right, same row */}
          <div className="flex items-start gap-3 shrink-0">

            {/* Krijo Preventiv */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground opacity-0 select-none">·</p>
              <Button
                size="sm"
                onClick={() => nav(`/leads/${lead.id}/preventiv`)}
                className="h-9 gap-1.5 bg-[hsl(38,62%,52%)] hover:bg-[hsl(38,62%,45%)] text-white"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Krijo Preventiv
              </Button>
            </div>

            {/* Operator */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Operatori</p>
              {canManage ? (
                <Select value={lead.assigned_to_user_id ?? ""} onValueChange={(v) => updateLead({ assigned_to_user_id: v })}>
                  <SelectTrigger className="h-9 w-[180px] text-sm border border-border">
                    <SelectValue placeholder="Asnjë" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name || m.email}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/30 w-[180px]">
                  <div className="w-6 h-6 rounded-md bg-amber-50 dark:bg-amber-500/15 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      {(assignedMember?.full_name || assignedMember?.email || "?")[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium truncate">{assignedMember?.full_name || assignedMember?.email || "Asnjë"}</span>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Statusi</p>
              {canEdit ? (
                <Select value={lead.pipeline_stage_id ?? ""} onValueChange={changeStage}>
                  <SelectTrigger className="h-9 w-[200px] font-semibold text-sm border border-border">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {currentStage && <span className={cn("w-2 h-2 rounded-full shrink-0", stageColorClass(currentStage.name))} />}
                      <span className="truncate">{currentStage?.name ?? "Zgjidh"}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", stageColorClass(s.name))} />
                          {s.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border bg-muted/40">
                  {currentStage && <span className={cn("w-2 h-2 rounded-full shrink-0", stageColorClass(currentStage.name))} />}
                  <span className="text-sm font-semibold">{currentStage?.name ?? "Pa status"}</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* ── Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* COL 1 — Info */}
        <div className="space-y-3">

          {/* Patient data */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Të dhënat</p>
            </div>
            <div className="px-4 py-1">
              <InfoRow icon={Phone}  label="Telefon"            value={lead.phone}           onSave={canEdit   ? (v) => updateLead({ phone: v })             : undefined}
                renderDisplay={(val) => {
                  const c = getPhoneCountry(val);
                  return <span className="inline-flex items-center gap-1.5">{c && <span title={c.name}>{c.flag}</span>}{val}{c && <span className="text-xs text-muted-foreground">({c.name})</span>}</span>;
                }}
                renderEdit={(v, setV, save) => (
                  <div className="space-y-1">
                    <PhoneInput value={v} onChange={setV} />
                    <div className="flex gap-1">
                      <button type="button" onClick={save} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">Ruaj</button>
                      <button type="button" onClick={() => setV(lead.phone ?? "")} className="text-xs px-2 py-1 rounded border hover:bg-muted">Anulo</button>
                    </div>
                  </div>
                )}
              />
              <InfoRow icon={Mail}   label="Email"              value={lead.email}           onSave={canEdit   ? (v) => updateLead({ email: v })             : undefined} />
              <InfoRow icon={Wrench} label="Shërbimi"           value={lead.sherbimi}        onSave={canEdit   ? (v) => updateLead({ sherbimi: v })          : undefined} />
              <InfoRow icon={Clock}  label="Kur të kontaktohet" value={lead.kur_kontaktohet} onSave={canEdit   ? (v) => updateLead({ kur_kontaktohet: v })   : undefined} />
              <InfoRow icon={Euro}   label="Vlera (€)"          value={lead.value ? String(lead.value) : ""} onSave={canManage ? (v) => updateLead({ value: Number(v) }) : undefined} />
              <InfoRow icon={User}   label="Burimi"             value={lead.source}          onSave={canManage ? (v) => updateLead({ source: v })            : undefined} />
              <div className="flex items-start gap-3 py-2.5">
                <CalendarDays className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Data e shtimit</p>
                  <p className="text-sm">{new Date(lead.created_at).toLocaleDateString("sq-AL", { day: "2-digit", month: "long", year: "numeric" })}</p>
                  <p className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* COL 2 — Tabs */}
        <div className="lg:col-span-2 space-y-3">

          {/* Tab bar */}
          <div className="flex bg-muted/60 rounded-lg p-1 gap-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all",
                  activeTab === tab.key
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tabCounts[tab.key] > 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                    activeTab === tab.key ? "bg-foreground/10 text-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                  )}>
                    {tabCounts[tab.key]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── TAB: Aktivitete ── */}
          {activeTab === "activities" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="bg-card rounded-xl border border-border p-4 space-y-3">
                  <div className="flex gap-1.5 flex-wrap">
                    {[
                      { v: "note",    l: "Shënim" },
                      { v: "call",    l: "Telefonatë" },
                      { v: "email",   l: "Email" },
                      { v: "meeting", l: "Takim" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        onClick={() => setActivityType(opt.v)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                          activityType === opt.v
                            ? "bg-[hsl(25,12%,26%)] text-white border-[hsl(25,12%,26%)]"
                            : "bg-background text-muted-foreground border-border hover:border-amber-300 hover:text-foreground"
                        )}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Çfarë ndodhi? Shkruaj detajet këtu..."
                    value={activityContent}
                    onChange={(e) => setActivityContent(e.target.value)}
                    rows={3}
                    maxLength={2000}
                    className="resize-none text-sm"
                    onKeyDown={(e) => { if (e.key === "Enter" && e.ctrlKey) addActivity(); }}
                  />
                  <Button onClick={addActivity} size="sm" className="w-full">
                    Regjistro aktivitetin
                  </Button>
                </div>
              )}
              <div className="bg-card rounded-xl border border-border">
                {acts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Asnjë aktivitet ende.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {acts.map((a: any) => {
                      const Icon = ACTIVITY_ICONS[a.type] ?? StickyNote;
                      const author = members.find(m => m.id === a.user_id);
                      return (
                        <div key={a.id} className="flex gap-3 p-4">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold">
                                {ACTIVITY_LABELS[a.type] ?? a.type}
                              </span>
                              <span className="text-xs font-semibold text-foreground">{author?.full_name || author?.email || "Sistemi"}</span>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(a.created_at).toLocaleString("sq-AL")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Detyra ── */}
          {activeTab === "tasks" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="bg-card rounded-xl border border-border p-4 space-y-2">
                  <Input
                    placeholder="Titulli i detyrës..."
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addTask(); }}
                    className="text-sm"
                  />
                  <Input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} className="text-sm" />
                  <Button onClick={addTask} size="sm" className="w-full">
                    <CheckSquare className="w-4 h-4 mr-2" />Shto detyrë
                  </Button>
                </div>
              )}
              <div className="bg-card rounded-xl border border-border">
                {tasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Asnjë detyrë.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {tasks.map((t) => {
                      const overdue = !t.completed && t.due_date && new Date(t.due_date) < new Date();
                      return (
                        <div key={t.id} className="flex items-start gap-3 p-4">
                          <Checkbox checked={t.completed} onCheckedChange={() => toggleTask(t)} className="mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm font-medium", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
                            {t.due_date && (
                              <p className={cn("text-xs mt-0.5", overdue ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                                {overdue && "Afati kaloi — "}{new Date(t.due_date).toLocaleString("sq-AL")}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Telefonata ── */}
          {activeTab === "calendar" && (
            <div className="space-y-3">
              {canEdit && (
                <Button onClick={() => setCalOpen(true)} size="sm" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />Planifiko telefonatë / takim
                </Button>
              )}
              <div className="bg-card rounded-xl border border-border">
                {calEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Asnjë telefonatë e planifikuar.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {calEvents.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 p-4">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <PhoneCall className="w-3.5 h-3.5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">{ev.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{new Date(ev.scheduled_at).toLocaleString("sq-AL")}</p>
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`} className="text-xs text-foreground hover:underline font-medium mt-0.5 block">
                              {lead.phone}
                            </a>
                          )}
                          {ev.notes && <p className="text-xs text-muted-foreground mt-1">{ev.notes}</p>}
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground font-semibold shrink-0">
                          {ev.type === "call" ? "Telefonatë" : ev.type === "meeting" ? "Takim" : "Tjetër"}
                        </span>
                        {canEdit && (
                          <button onClick={() => deleteCalEvent(ev.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Skedarë ── */}
          {activeTab === "files" && (
            <div className="space-y-3">
              {canEdit && (
                <div className="bg-card rounded-xl border border-border p-4">
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv" />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    <Upload className="w-5 h-5" />
                    <span className="text-sm font-semibold">{uploading ? "Duke ngarkuar..." : "Kliko për të ngarkuar skedar"}</span>
                    <span className="text-xs">Foto, PDF, Word, Excel — maks. 50MB</span>
                  </button>
                </div>
              )}
              <div className="bg-card rounded-xl border border-border">
                {attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Asnjë skedar i bashkangjitur.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {attachments.map((att) => {
                      const Icon = fileIcon(att.mime_type);
                      const isImage = att.mime_type?.startsWith("image/");
                      const url = att.signedUrl;
                      return (
                        <div key={att.id} className="flex items-center gap-3 p-4">
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            {url ? (
                              <a href={url} target="_blank" rel="noopener noreferrer"
                                className="text-sm font-semibold hover:underline truncate block transition-colors">
                                {att.file_name}
                              </a>
                            ) : (
                              <p className="text-sm font-semibold truncate">{att.file_name}</p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {att.file_size ? `${(att.file_size / 1024).toFixed(1)} KB · ` : ""}
                              {new Date(att.created_at).toLocaleDateString("sq-AL")}
                            </p>
                          </div>
                          {isImage && url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                              <img src={url} className="w-10 h-10 object-cover rounded-lg border border-border" alt={att.file_name} />
                            </a>
                          )}
                          {canEdit && (
                            <button onClick={() => deleteAttachment(att)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB: Preventiva ── */}
          {activeTab === "quotes" && (
            <div className="space-y-3">
              <Button
                size="sm"
                className="w-full bg-[hsl(38,62%,52%)] hover:bg-[hsl(38,62%,45%)] text-white"
                onClick={() => nav(`/leads/${lead.id}/preventiv`)}
              >
                <Sparkles className="w-4 h-4 mr-2" />Krijo Preventiv të ri
              </Button>
              <div className="bg-card rounded-xl border border-border">
                {quotes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-12">Asnjë preventiv i ruajtur ende.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {quotes.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => nav(`/leads/${lead.id}/preventiv/${q.id}`)}
                        className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[hsl(38,62%,52%)]/15 flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5 text-[hsl(38,62%,52%)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{q.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(q.created_at).toLocaleDateString("sq-AL")} · {Array.isArray(q.items) ? q.items.length : 0} shërbime
                          </p>
                        </div>
                        <span className="text-sm font-bold text-foreground shrink-0">€{Number(q.total).toLocaleString()}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Fshi pacientin"
        description={`Jeni të sigurt që doni të fshini "${lead.first_name} ${lead.last_name ?? ""}"? Ky veprim nuk mund të kthehet.`}
        onConfirm={deleteLead}
        onCancel={() => setDeleteOpen(false)}
      />

      {/* Dialog: Planifiko telefonatë */}
      <Dialog open={calOpen} onOpenChange={setCalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Planifiko telefonatë / takim</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titulli *</Label>
              <Input className="mt-1" value={calForm.title} onChange={(e) => setCalForm({ ...calForm, title: e.target.value })} placeholder="p.sh. Telefonatë kontrolli" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data dhe ora *</Label>
              <Input className="mt-1" type="datetime-local" value={calForm.scheduled_at} onChange={(e) => setCalForm({ ...calForm, scheduled_at: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lloji</Label>
              <Select value={calForm.type} onValueChange={(v) => setCalForm({ ...calForm, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Telefonatë</SelectItem>
                  <SelectItem value="meeting">Takim</SelectItem>
                  <SelectItem value="other">Tjetër</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shënime</Label>
              <Input className="mt-1" value={calForm.notes} onChange={(e) => setCalForm({ ...calForm, notes: e.target.value })} placeholder="Opsionale..." />
            </div>
            {lead.phone && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">Numri:</span>
                <a href={`tel:${lead.phone}`} className="text-sm font-bold hover:underline">{lead.phone}</a>
              </div>
            )}
            <Button onClick={addCalEvent} disabled={calBusy} className="w-full">
              {calBusy ? "Duke ruajtur..." : "Ruaj"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, onSave, renderDisplay, renderEdit }: {
  icon: any; label: string; value: any; onSave?: (v: string) => void;
  renderDisplay?: (val: string) => React.ReactNode;
  renderEdit?: (v: string, setV: (s: string) => void, save: () => void, cancel: () => void) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(String(value ?? ""));
  useEffect(() => { setV(String(value ?? "")); }, [value]);
  const save = () => { onSave?.(v); setEditing(false); };
  const cancel = () => setEditing(false);
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
      <Icon className="w-3.5 h-3.5 text-muted-foreground mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
        {editing ? (
          renderEdit ? renderEdit(v, setV, save, cancel) : (
            <Input className="h-7 text-sm px-2" value={v} autoFocus
              onChange={(e) => setV(e.target.value)}
              onBlur={save}
              onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            />
          )
        ) : (
          <div
            className={cn("flex items-center gap-1.5 group/row", onSave ? "cursor-pointer" : "")}
            onClick={() => onSave && setEditing(true)}
          >
            <span className={cn("text-sm truncate", onSave ? "group-hover/row:underline decoration-dashed underline-offset-2" : "")}>
              {value
                ? (renderDisplay ? renderDisplay(String(value)) : <span>{value}</span>)
                : <span className="text-muted-foreground text-xs italic">{onSave ? "kliko për të ndryshuar" : "—"}</span>
              }
            </span>
            {onSave && value && (
              <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover/row:opacity-100 shrink-0 transition-opacity" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
