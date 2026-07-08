import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, PauseCircle, PlayCircle, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_STAGES = [
  { name: "Not Interested",      color: "#ef4444", code: "not_interested" },
  { name: "Not Responding",      color: "#f97316", code: "not_responding" },
  { name: "Quote Sent",          color: "#8b5cf6", code: "quote_sent" },
  { name: "Call Back",           color: "#3b82f6", code: "call_back" },
  { name: "Awaiting Photos",     color: "#06b6d4", code: "awaiting_photos" },
  { name: "Follow Up in Months", color: "#f59e0b", code: "follow_up_months" },
  { name: "Not Eligible",        color: "#6b7280", code: "not_eligible" },
  { name: "Wrong Number",        color: "#ec4899", code: "wrong_number" },
  { name: "WhatsApp Message",    color: "#10b981", code: "whatsapp_message" },
];

export default function AdminCompanies() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);

  // Create company dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", admin_email: "", admin_password: "" });

  const [confirmCompanyId, setConfirmCompanyId] = useState<string | null>(null);

  // Add admin to existing company dialog
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [addAdminCompany, setAddAdminCompany] = useState<any>(null);
  const [addAdminForm, setAddAdminForm] = useState({ email: "", password: "", full_name: "" });
  const [addAdminBusy, setAddAdminBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    const { data: leadCounts } = await supabase.from("leads").select("company_id");
    const { data: userCounts } = await supabase.from("profiles").select("company_id");
    const lc = new Map<string, number>();
    (leadCounts ?? []).forEach((l: any) => lc.set(l.company_id, (lc.get(l.company_id) ?? 0) + 1));
    const uc = new Map<string, number>();
    (userCounts ?? []).forEach((u: any) => u.company_id && uc.set(u.company_id, (uc.get(u.company_id) ?? 0) + 1));
    setRows((data ?? []).map((c: any) => ({ ...c, leads: lc.get(c.id) ?? 0, users: uc.get(c.id) ?? 0 })));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createCompany = async () => {
    if (!form.name.trim()) return toast.error("Emri i klinikës është i detyrueshëm");
    if (!form.admin_email.trim()) return toast.error("Email i adminit është i detyrueshëm");
    if (form.admin_password.length < 6) return toast.error("Fjalëkalimi duhet të ketë të paktën 6 karaktere");
    setBusy(true);

    const { data: company, error: compErr } = await supabase
      .from("companies").insert({ name: form.name.trim(), plan: "starter" }).select().maybeSingle();
    if (compErr || !company) { toast.error(compErr?.message ?? "Gabim"); setBusy(false); return; }

    await supabase.from("pipeline_stages").insert(
      DEFAULT_STAGES.map((s, i) => ({ company_id: company.id, name: s.name, order: i + 1, color: s.color, code: s.code }))
    );

    const { data: createData, error: createErr } = await supabase.functions.invoke("create-user", {
      body: {
        email: form.admin_email.trim(),
        password: form.admin_password,
        full_name: `Admin ${form.name.trim()}`,
        company_id: company.id,
        role: "company_admin",
      },
    });
    if (createErr || createData?.error) {
      toast.error(createData?.error ?? createErr?.message ?? "Gabim në krijimin e admin userit");
      await supabase.from("companies").delete().eq("id", company.id);
      setBusy(false); return;
    }

    toast.success(`Klinika "${company.name}" u krijua!`);
    setCreateOpen(false);
    setForm({ name: "", admin_email: "", admin_password: "" });
    setBusy(false);
    load();
  };

  const addAdminToCompany = async () => {
    if (!addAdminForm.email.trim()) return toast.error("Email është i detyrueshëm");
    if (addAdminForm.password.length < 6) return toast.error("Fjalëkalimi min. 6 karaktere");
    if (!addAdminCompany) return;
    setAddAdminBusy(true);

    const { data, error } = await supabase.functions.invoke("create-user", {
      body: {
        email: addAdminForm.email.trim(),
        password: addAdminForm.password,
        full_name: addAdminForm.full_name.trim() || `Admin ${addAdminCompany.name}`,
        company_id: addAdminCompany.id,
        role: "company_admin",
      },
    });
    if (error || data?.error) {
      toast.error(data?.error ?? error?.message ?? "Gabim në krijimin e userit");
      setAddAdminBusy(false); return;
    }

    toast.success(`Admini u shtua te "${addAdminCompany.name}"`);
    setAddAdminOpen(false);
    setAddAdminForm({ email: "", password: "", full_name: "" });
    setAddAdminCompany(null);
    setAddAdminBusy(false);
    load();
  };

  const setStatus = async (id: string, status: "active" | "suspended") => {
    const { error } = await supabase.from("companies").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(status === "active" ? "Aktivizuar" : "Pezulluar"); load(); }
  };

  const remove = async () => {
    if (!confirmCompanyId) return;
    const { error } = await supabase.from("companies").delete().eq("id", confirmCompanyId);
    setConfirmCompanyId(null);
    if (error) toast.error(error.message); else { toast.success("Klinika u fshi"); load(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Klinika</h1>
          <p className="text-sm text-muted-foreground">{rows.length} klinika</p>
        </div>

        {/* Create company dialog */}
        <Dialog open={createOpen} onOpenChange={(v) => { setCreateOpen(v); if (!v) setForm({ name: "", admin_email: "", admin_password: "" }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Klinikë e re</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Krijo klinikë të re</DialogTitle>
              <DialogDescription>Krijohet klinika me statuset dhe admini i parë automatikisht.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Emri i klinikës *</Label>
                <Input placeholder="p.sh. Dental Roma" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">Admini i parë</p>
                <div>
                  <Label>Email *</Label>
                  <Input type="email" placeholder="admin@klinika.com" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} />
                </div>
                <div>
                  <Label>Fjalëkalimi *</Label>
                  <Input type="password" placeholder="Min. 6 karaktere" value={form.admin_password} onChange={(e) => setForm({ ...form, admin_password: e.target.value })} />
                </div>
              </div>
              <Button onClick={createCompany} disabled={busy} className="w-full">
                {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Krijo klinikën
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Add admin to existing company dialog */}
      <Dialog open={addAdminOpen} onOpenChange={(v) => { setAddAdminOpen(v); if (!v) { setAddAdminForm({ email: "", password: "", full_name: "" }); setAddAdminCompany(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shto admin te "{addAdminCompany?.name}"</DialogTitle>
            <DialogDescription>Krijo një llogari të re admin për këtë klinikë.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Emri i plotë</Label>
              <Input placeholder="p.sh. Mario Rossi" value={addAdminForm.full_name} onChange={(e) => setAddAdminForm({ ...addAdminForm, full_name: e.target.value })} />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" placeholder="admin2@klinika.com" value={addAdminForm.email} onChange={(e) => setAddAdminForm({ ...addAdminForm, email: e.target.value })} />
            </div>
            <div>
              <Label>Fjalëkalimi *</Label>
              <Input type="password" placeholder="Min. 6 karaktere" value={addAdminForm.password} onChange={(e) => setAddAdminForm({ ...addAdminForm, password: e.target.value })} />
            </div>
            <Button onClick={addAdminToCompany} disabled={addAdminBusy} className="w-full">
              {addAdminBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shto adminIn
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Emri</TableHead>
                <TableHead>Statusi</TableHead>
                <TableHead>Përdoruesit</TableHead>
                <TableHead>Pacientët</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.status === "active"
                      ? <Badge className="bg-green-500 text-white">Aktive</Badge>
                      : <Badge variant="destructive">Pezulluar</Badge>}
                  </TableCell>
                  <TableCell>{c.users}</TableCell>
                  <TableCell>{c.leads}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setAddAdminCompany(c); setAddAdminOpen(true); }}>
                          <UserPlus className="w-4 h-4 mr-2" />Shto admin
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {c.status === "active"
                          ? <DropdownMenuItem onClick={() => setStatus(c.id, "suspended")}><PauseCircle className="w-4 h-4 mr-2" />Pezullo</DropdownMenuItem>
                          : <DropdownMenuItem onClick={() => setStatus(c.id, "active")}><PlayCircle className="w-4 h-4 mr-2" />Aktivizo</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => setConfirmCompanyId(c.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />Fshi
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
      <ConfirmDialog
        open={!!confirmCompanyId}
        title="Fshi klinikën"
        description="Jeni të sigurt? Kjo do të fshijë klinikën dhe TË GJITHA të dhënat e saj. Ky veprim nuk mund të kthehet."
        onConfirm={remove}
        onCancel={() => setConfirmCompanyId(null)}
      />
    </div>
  );
}
