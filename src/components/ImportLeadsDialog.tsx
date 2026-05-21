import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, Download } from "lucide-react";

const FIELDS = [
  { key: "first_name", label: "Emri *" },
  { key: "last_name", label: "Mbiemri" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Telefon" },
  { key: "sherbimi", label: "Shërbimi i nevojshëm" },
  { key: "kur_kontaktohet", label: "Kur do kontaktohet" },
  { key: "company_name", label: "Klinika / Kompania" },
  { key: "source", label: "Burimi" },
  { key: "value", label: "Vlera (€)" },
];

/** Parse CSV text into headers + rows */
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const parseLine = (l: string) => {
    const out: string[] = []; let cur = ""; let inQ = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === "," && !inQ) { out.push(cur); cur = ""; continue; }
      cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

/** Parse Excel (.xlsx / .xls) via SheetJS */
function parseXLSX(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header: 1 → returns array of arrays; defval: "" fills empty cells
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (data.length === 0) return { headers: [], rows: [] };
  const headers = data[0].map((h: any) => String(h ?? "").trim());
  const rows = data.slice(1)
    .filter((r) => r.some((c: any) => String(c ?? "").trim() !== ""))
    .map((r) => r.map((c: any) => String(c ?? "").trim()));
  return { headers, rows };
}

const CSV_HEADERS = ["first_name","last_name","email","phone","sherbimi","kur_kontaktohet","source","value"];

function downloadTemplate() {
  const examples = [
    ["Gjon","Leka","gjon.leka@gmail.com","+355691234567","Implant","E Hënë 10:00","Instagram","500"],
    ["Arta","Hoxha","arta.hoxha@gmail.com","+355682345678","Korrektim dhëmbësh","E Martë 14:00","Facebook","300"],
    ["Blerim","Koci","","+355673456789","Zbardhim","E Mërkurë 09:00","Rekomandim","150"],
    ["Dorina","Shehu","dorina.shehu@yahoo.com","+355664567890","Implant","","Google","500"],
  ];
  const content = [CSV_HEADERS.join(","), ...examples.map((r) => r.join(","))].join("\n");
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "shembull-paciente.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function ImportLeadsDialog({ open, onOpenChange, stages, onDone }: any) {
  const { companyId, user } = useAuth();
  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [stageId, setStageId] = useState<string>("");
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => { setStep("upload"); setHeaders([]); setRows([]); setMapping({}); setResult(null); };

  const autoMap = (hdrs: string[], rws: string[][]) => {
    const m: Record<string, string> = {};
    FIELDS.forEach((f) => {
      const needle = f.key.replace(/_/g, "").toLowerCase();
      const found = hdrs.find((h) => h.toLowerCase().replace(/[^a-z]/g, "").includes(needle));
      if (found) m[f.key] = found;
    });
    setHeaders(hdrs);
    setRows(rws);
    setMapping(m);
    setStageId(stages[0]?.id ?? "");
    setStep("map");
  };

  const handleFile = (file: File) => {
    const isExcel = /\.(xlsx|xls|ods)$/i.test(file.name);
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const { headers, rows } = parseXLSX(e.target!.result as ArrayBuffer);
          if (headers.length === 0) { toast.error("Skedari është bosh ose nuk mund të lexohet."); return; }
          autoMap(headers, rows);
        } catch (err) {
          toast.error("Gabim gjatë leximit të skedarit Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV / text
      const reader = new FileReader();
      reader.onload = (e) => {
        const { headers, rows } = parseCSV(String(e.target!.result ?? ""));
        autoMap(headers, rows);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const doImport = async () => {
    if (!companyId || !mapping.first_name) { toast.error("Lidh të paktën fushën 'Emri'"); return; }
    setBusy(true);
    let skipped = 0;

    const objects: any[] = [];
    for (const row of rows) {
      const obj: any = { company_id: companyId, pipeline_stage_id: stageId, assigned_to_user_id: user?.id, source: "csv_import" };
      FIELDS.forEach((f) => {
        const col = mapping[f.key];
        if (!col) return;
        const idx = headers.indexOf(col);
        const val = idx >= 0 ? row[idx] : "";
        if (!val) return;
        if (f.key === "value") obj.value = Number(String(val).replace(/[^0-9.]/g, "")) || 0;
        else obj[f.key] = val;
      });
      if (!obj.first_name) { skipped++; continue; }
      objects.push(obj);
    }

    // Deduplicate by email in one query
    const emails = objects.filter(o => o.email).map(o => o.email as string);
    let existingEmails = new Set<string>();
    if (emails.length > 0) {
      const { data: existing } = await supabase.from("leads")
        .select("email").eq("company_id", companyId).in("email", emails);
      existingEmails = new Set((existing ?? []).map((r: any) => r.email));
    }

    const toInsert = objects.filter(o => {
      if (o.email && existingEmails.has(o.email)) { skipped++; return false; }
      return true;
    });

    // Batch insert in chunks of 100
    let created = 0;
    const CHUNK = 100;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK);
      const { data, error } = await supabase.from("leads").insert(chunk).select("id");
      if (error) { skipped += chunk.length; console.error("Insert error:", error); }
      else created += data?.length ?? chunk.length;
    }

    setResult({ created, skipped });
    setStep("done");
    setBusy(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-lg w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Importo pacientë</DialogTitle>
          <DialogDescription>Ngarko një skedar CSV ose Excel (.xlsx). Do të detektojmë kolonat automatikisht.</DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => document.getElementById("fileupload")?.click()}
          >
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-semibold mb-1">Tërhiq ose kliko për të zgjedhur</p>
            <p className="text-xs text-muted-foreground mb-4">CSV ose Excel (.xlsx, .xls)</p>
            <input
              type="file"
              accept=".csv,.xlsx,.xls,.ods,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              className="hidden"
              id="fileupload"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Button size="sm" type="button">
              <Upload className="w-4 h-4 mr-2" />Zgjidh skedarin
            </Button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); downloadTemplate(); }}
              className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mx-auto"
            >
              <Download className="w-3.5 h-3.5" />Shkarko template CSV
            </button>
          </div>
        )}

        {step === "map" && (
          <div className="flex flex-col min-h-0 gap-3">
            <p className="text-xs text-muted-foreground shrink-0">
              <span className="font-semibold text-foreground">{rows.length}</span> rreshta u gjetën. Lidhi kolonat me fushat e CRM:
            </p>
            <div className="overflow-y-auto flex-1 pr-1 space-y-3">
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">{f.label}</Label>
                    <Select
                      value={mapping[f.key] ?? "__skip__"}
                      onValueChange={(v) => {
                        const next = { ...mapping };
                        if (v === "__skip__") delete next[f.key];
                        else next[f.key] = v;
                        setMapping(next);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="— Skip —" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__" className="text-xs text-muted-foreground">— Skip —</SelectItem>
                        {headers.map((h) => <SelectItem key={h} value={h} className="text-xs">{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Statusi i parazgjedhur</Label>
                <Select value={stageId} onValueChange={setStageId}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{stages.map((s: any) => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Preview */}
              <div className="border rounded-md p-2 bg-muted/30 text-xs space-y-1">
                <p className="font-semibold">Shiko paraprakisht (3 rreshtat e parë):</p>
                {rows.slice(0, 3).map((r, i) => (
                  <div key={i} className="text-muted-foreground truncate">
                    {FIELDS.map((f) => {
                      if (!mapping[f.key]) return null;
                      const val = r[headers.indexOf(mapping[f.key])] || "—";
                      return `${f.key}: ${val}`;
                    }).filter(Boolean).join(" • ")}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 shrink-0 pt-1 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Kthehu</Button>
              <Button size="sm" onClick={doImport} disabled={busy || !mapping.first_name}>
                {busy ? "Po importohet..." : `Importo ${rows.length} pacientë`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="text-center py-6">
            <p className="text-4xl font-bold text-green-600 mb-1">{result.created}</p>
            <p className="text-sm text-muted-foreground">pacientë u shtuan me sukses</p>
            {result.skipped > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {result.skipped} u anashkaluan (duplikata ose pa emër)
              </p>
            )}
            <Button className="mt-6" size="sm" onClick={() => onOpenChange(false)}>Mbyll</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
