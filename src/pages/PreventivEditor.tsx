import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  ArrowLeft, Plus, Trash2, Download, Save, FileText, GripVertical, Sparkles, Languages,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generatePreventivPdf, QuoteItem } from "@/lib/generatePreventivPdf";
import { PreventivLang } from "@/lib/preventivTranslations";

const LANGUAGE_OPTIONS: { value: PreventivLang; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇬🇧" },
  { value: "it", label: "Italiano", flag: "🇮🇹" },
  { value: "fr", label: "Français", flag: "🇫🇷" },
];

interface Row extends QuoteItem {
  _key: string;
}

const SECTION_PRESETS = ["Preventiv", "Harku Sipëror", "Harku Inferior", "Shtesa"];

let keySeq = 0;
const newKey = () => `r${Date.now()}_${keySeq++}`;

function emptyRow(section: string): Row {
  return { _key: newKey(), section, service: "", qty: "1", unit_price: "", total: "" };
}

function calcTotal(qty: string, unitPrice: string): string {
  const q = Number(String(qty).replace(",", ".")) || 0;
  const p = Number(String(unitPrice).replace(/[^0-9.,-]/g, "").replace(",", ".")) || 0;
  const t = q * p;
  return t ? String(Number(t.toFixed(2))) : "";
}

export default function PreventivEditor() {
  // Two route shapes feed this component:
  //  /leads/:id/preventiv        -> id = lead id, quoteId undefined (new)
  //  /leads/:id/preventiv/:quoteId -> editing an existing saved quote
  const { id: leadId, quoteId } = useParams();
  const nav = useNavigate();
  const { companyId, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [title, setTitle] = useState("Preventiv");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pastQuotes, setPastQuotes] = useState<any[]>([]);
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null);
  const [langDialogOpen, setLangDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: l } = await supabase.from("leads").select("*").eq("id", leadId).maybeSingle();
      if (cancelled || !l) { setLoading(false); return; }
      const { data: c } = await supabase.from("companies").select("*").eq("id", l.company_id).maybeSingle();
      if (cancelled) return;
      setLead(l);
      setCompany(c);

      const { data: quotes } = await supabase.from("quotes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
      if (cancelled) return;
      setPastQuotes(quotes ?? []);

      if (quoteId) {
        const existing = (quotes ?? []).find((q: any) => q.id === quoteId);
        if (existing) {
          setTitle(existing.title);
          setNotes(existing.notes ?? "");
          setRows((existing.items as unknown as QuoteItem[]).map((it) => ({ ...it, _key: newKey() })));
        }
      } else {
        setRows([emptyRow("Preventiv")]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [leadId, quoteId]);

  const grandTotal = useMemo(() => {
    return rows.reduce((sum, r) => sum + (Number(String(r.total).replace(/[^0-9.-]/g, "")) || 0), 0);
  }, [rows]);

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => {
      if (r._key !== key) return r;
      const next = { ...r, ...patch };
      if (patch.qty !== undefined || patch.unit_price !== undefined) {
        next.total = calcTotal(next.qty, next.unit_price);
      }
      return next;
    }));
  };

  const addRow = (section?: string) => {
    setRows((prev) => [...prev, emptyRow(section ?? prev[prev.length - 1]?.section ?? "Preventiv")]);
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r._key !== key));

  const buildPdfData = (language: PreventivLang) => ({
    clinicName: company?.name ?? "Klinika",
    clinicPhone: company?.phone,
    clinicEmail: company?.email,
    clinicWebsite: company?.website,
    clinicAddress: company?.address,
    patientName: `${lead?.first_name ?? ""} ${lead?.last_name ?? ""}`.trim(),
    date: new Date().toLocaleDateString("sq-AL", { day: "2-digit", month: "2-digit", year: "numeric" }),
    items: rows.filter((r) => r.service.trim()).map(({ _key, ...rest }) => rest),
    notes,
    language,
  });

  const openLanguagePicker = () => {
    if (rows.every((r) => !r.service.trim())) { toast.error("Shto të paktën një shërbim"); return; }
    setLangDialogOpen(true);
  };

  const downloadPdf = async (language: PreventivLang) => {
    setLangDialogOpen(false);
    setGenerating(true);
    try {
      const bytes = await generatePreventivPdf(buildPdfData(language));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Preventiv_${(lead?.first_name ?? "pacient")}_${(lead?.last_name ?? "")}_${language}.pdf`.replace(/\s+/g, "_");
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error("Gabim gjatë krijimit të PDF: " + (err?.message ?? ""));
    } finally {
      setGenerating(false);
    }
  };

  const saveQuote = async () => {
    if (!companyId || !leadId) return;
    if (rows.every((r) => !r.service.trim())) { toast.error("Shto të paktën një shërbim"); return; }
    setSaving(true);
    const items = rows.filter((r) => r.service.trim()).map(({ _key, ...rest }) => rest);
    const payload = {
      lead_id: leadId, company_id: companyId, created_by: user?.id,
      title: title.trim() || "Preventiv", items, total: grandTotal, notes: notes || null,
    };
    let error;
    if (quoteId) {
      ({ error } = await supabase.from("quotes").update(payload).eq("id", quoteId));
    } else {
      const { data, error: insErr } = await supabase.from("quotes").insert(payload).select("id").single();
      error = insErr;
      if (!error && data) {
        nav(`/leads/${leadId}/preventiv/${data.id}`, { replace: true });
      }
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Preventivi u ruajt");
    const { data: quotes } = await supabase.from("quotes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    setPastQuotes(quotes ?? []);
  };

  const loadQuote = (q: any) => {
    nav(`/leads/${leadId}/preventiv/${q.id}`);
  };

  const deleteQuote = async () => {
    if (!deleteQuoteId) return;
    const { error } = await supabase.from("quotes").delete().eq("id", deleteQuoteId);
    setDeleteQuoteId(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Preventivi u fshi");
    setPastQuotes((prev) => prev.filter((q) => q.id !== deleteQuoteId));
    if (quoteId === deleteQuoteId) nav(`/leads/${leadId}/preventiv`, { replace: true });
  };

  if (loading) return (
    <div className="space-y-4 max-w-5xl">
      <Skeleton className="h-7 w-40 rounded" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
  if (!lead) return <div className="p-12 text-center text-muted-foreground text-sm">Pacienti nuk u gjet.</div>;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => nav(`/leads/${leadId}`)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kthehu te pacienti
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[hsl(38,62%,52%)]/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-[hsl(38,62%,52%)]" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Krijo Preventiv</h1>
            <p className="text-sm text-muted-foreground">
              Për <span className="font-semibold text-foreground">{lead.first_name} {lead.last_name}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Past quotes for this lead */}
      {pastQuotes.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Preventivat e mëparshëm</p>
          <div className="flex flex-wrap gap-2">
            {pastQuotes.map((q) => (
              <button
                key={q.id}
                onClick={() => loadQuote(q)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                  q.id === quoteId ? "border-[hsl(38,62%,52%)] bg-[hsl(38,62%,52%)]/10" : "border-border hover:bg-muted"
                )}
              >
                <FileText className="w-3.5 h-3.5" />
                {q.title} · €{Number(q.total).toLocaleString()}
                <span className="text-muted-foreground">{new Date(q.created_at).toLocaleDateString("sq-AL")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Titulli</Label>
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
        </div>

        {/* Items table */}
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[1fr_90px_110px_110px_32px] gap-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Shërbimi</span><span>Sasia</span><span>Çmimi</span><span>Totali</span><span />
          </div>
          {rows.map((r, idx) => {
            const showSectionHeader = idx === 0 || rows[idx - 1].section !== r.section;
            return (
              <div key={r._key}>
                {showSectionHeader && (
                  <div className="flex items-center gap-2 mt-3 mb-1.5">
                    <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Input
                      value={r.section}
                      onChange={(e) => updateRow(r._key, { section: e.target.value })}
                      placeholder="Emri i seksionit (p.sh. Harku Sipëror)"
                      list="section-presets"
                      className="h-7 text-xs font-semibold max-w-xs"
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-[1fr_90px_110px_110px_32px] gap-2 items-center bg-muted/30 rounded-lg p-2 md:p-1.5">
                  <Input
                    placeholder="Shërbimi (p.sh. Implant dentar)"
                    value={r.service}
                    onChange={(e) => updateRow(r._key, { service: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="1"
                    value={r.qty}
                    onChange={(e) => updateRow(r._key, { qty: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="€0"
                    value={r.unit_price}
                    onChange={(e) => updateRow(r._key, { unit_price: e.target.value })}
                    className="h-8 text-sm"
                  />
                  <Input
                    placeholder="€0"
                    value={r.total}
                    onChange={(e) => updateRow(r._key, { total: e.target.value })}
                    className="h-8 text-sm font-semibold"
                  />
                  <button
                    onClick={() => removeRow(r._key)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors justify-self-end md:justify-self-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
          <datalist id="section-presets">
            {SECTION_PRESETS.map((s) => <option key={s} value={s} />)}
          </datalist>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => addRow()}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Shto rresht
            </Button>
            <Button variant="outline" size="sm" onClick={() => addRow(`Seksion i ri ${rows.length + 1}`)}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Shto seksion të ri
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Shënime (opsionale)</Label>
          <Textarea className="mt-1 resize-none" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Shënime shtesë për pacientin..." />
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Totali</p>
            <p className="text-2xl font-bold">€{grandTotal.toLocaleString()}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveQuote} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />{saving ? "Duke ruajtur..." : "Ruaj"}
            </Button>
            <Button onClick={openLanguagePicker} disabled={generating} className="bg-[hsl(25,12%,26%)] hover:bg-[hsl(25,12%,18%)] text-white">
              <Download className="w-4 h-4 mr-2" />{generating ? "Duke krijuar..." : "Shkarko PDF"}
            </Button>
          </div>
        </div>
      </div>

      {quoteId && (
        <button
          onClick={() => setDeleteQuoteId(quoteId)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-500 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Fshi këtë preventiv
        </button>
      )}

      <ConfirmDialog
        open={!!deleteQuoteId}
        title="Fshi preventivin"
        description="Jeni të sigurt që doni të fshini këtë preventiv? Ky veprim nuk mund të kthehet."
        onConfirm={deleteQuote}
        onCancel={() => setDeleteQuoteId(null)}
      />

      {/* Dialog: pick PDF language */}
      <Dialog open={langDialogOpen} onOpenChange={setLangDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              Zgjidh gjuhën e PDF-së
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 pt-1">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => downloadPdf(opt.value)}
                disabled={generating}
                className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
              >
                <span className="text-xl">{opt.flag}</span>
                <span className="font-semibold text-sm">{opt.label}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
