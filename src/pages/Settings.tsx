import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, Trash2, GripVertical, ExternalLink, Eye, EyeOff } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";

export default function Settings() {
  const { user, primaryRole, companyId, fullName, email, refresh } = useAuth();
  const [name, setName] = useState(fullName ?? "");
  const isAdmin = primaryRole === "company_admin" || primaryRole === "super_admin";
  const showCompanyTab = primaryRole === "company_admin";
  const isAdminOrLeader = primaryRole === "company_admin" || primaryRole === "team_leader";

  useEffect(() => { setName(fullName ?? ""); }, [fullName]);

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
    if (error) toast.error(error.message); else { toast.success("Profili u ruajt"); refresh(); }
  };

  return (
    <div className="space-y-4">
      <div><h1 className="text-2xl font-bold tracking-tight">Cilësimet</h1></div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profili</TabsTrigger>
          {showCompanyTab && <TabsTrigger value="company">Klinika</TabsTrigger>}
          {isAdmin && <TabsTrigger value="pipeline">Statuset</TabsTrigger>}
          {isAdminOrLeader && <TabsTrigger value="integrations">Integrimi</TabsTrigger>}
        </TabsList>
        <TabsContent value="profile">
          <Card>
            <CardHeader><CardTitle>Profili personal</CardTitle></CardHeader>
            <CardContent className="space-y-3 max-w-md">
              <div><Label>Email</Label><Input value={email ?? ""} disabled /></div>
              <div><Label>Emri i plotë</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <Button onClick={saveProfile}>Ruaj</Button>
            </CardContent>
          </Card>
        </TabsContent>
        {showCompanyTab && companyId && <TabsContent value="company"><CompanyProfile companyId={companyId} /></TabsContent>}
        {isAdmin && companyId && <TabsContent value="pipeline"><PipelineEditor companyId={companyId} /></TabsContent>}
        {isAdminOrLeader && companyId && <TabsContent value="integrations"><Integrations companyId={companyId} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function CompanyProfile({ companyId }: { companyId: string }) {
  const [c, setC] = useState<any>(null);
  useEffect(() => { supabase.from("companies").select("*").eq("id", companyId).maybeSingle().then(({ data }) => setC(data)); }, [companyId]);
  if (!c) return null;
  const save = async () => {
    const { error } = await supabase.from("companies").update({
      name: c.name, logo_url: c.logo_url,
      phone: c.phone, email: c.email, website: c.website, address: c.address,
    }).eq("id", c.id);
    if (error) toast.error(error.message); else toast.success("Ruajtur");
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Klinika</CardTitle>
        <CardDescription>Këto të dhëna shfaqen edhe në fund të çdo Preventivi (PDF).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 max-w-md">
        <div><Label>Emri i klinikës</Label><Input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} /></div>
        <div><Label>URL e logos</Label><Input value={c.logo_url ?? ""} onChange={(e) => setC({ ...c, logo_url: e.target.value })} /></div>
        <div><Label>Adresa</Label><Input value={c.address ?? ""} onChange={(e) => setC({ ...c, address: e.target.value })} placeholder="p.sh. Tiranë, Shqipëri" /></div>
        <div><Label>Telefoni</Label><Input value={c.phone ?? ""} onChange={(e) => setC({ ...c, phone: e.target.value })} placeholder="+355..." /></div>
        <div><Label>Email</Label><Input value={c.email ?? ""} onChange={(e) => setC({ ...c, email: e.target.value })} placeholder="info@klinika.com" /></div>
        <div><Label>Website</Label><Input value={c.website ?? ""} onChange={(e) => setC({ ...c, website: e.target.value })} placeholder="https://..." /></div>
        <div><Label>Plani</Label><Input value={c.plan} disabled /></div>
        <Button onClick={save}>Ruaj</Button>
      </CardContent>
    </Card>
  );
}

function PipelineEditor({ companyId }: { companyId: string }) {
  const [stages, setStages] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [confirmStageId, setConfirmStageId] = useState<string | null>(null);
  const load = async () => {
    const { data } = await supabase.from("pipeline_stages").select("*").eq("company_id", companyId).order("order");
    setStages(data ?? []);
  };
  useEffect(() => { load(); }, [companyId]);
  const add = async () => {
    if (!newName.trim()) return;
    const order = (stages[stages.length - 1]?.order ?? 0) + 1;
    const { error } = await supabase.from("pipeline_stages").insert({ company_id: companyId, name: newName.trim(), order, color: "#6366f1" });
    if (error) toast.error(error.message); else { toast.success("Statusi u shtua"); setNewName(""); load(); }
  };
  const update = async (id: string, patch: any) => {
    const { error } = await supabase.from("pipeline_stages").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const remove = async () => {
    if (!confirmStageId) return;
    const { error } = await supabase.from("pipeline_stages").delete().eq("id", confirmStageId);
    setConfirmStageId(null);
    if (error) toast.error(error.message); else load();
  };
  return (
    <>
      <Card>
        <CardHeader><CardTitle>Statuset e pacientëve</CardTitle><CardDescription>Konfiguro statuset e procesit tuaj dentar.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {stages.map((s) => (
            <div key={s.id} className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <Input className="flex-1" value={s.name} onChange={(e) => setStages((p) => p.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x))} onBlur={(e) => update(s.id, { name: e.target.value })} />
              <input type="color" value={s.color || "#6366f1"} onChange={(e) => update(s.id, { color: e.target.value })} className="w-10 h-9 rounded border" />
              <Button variant="ghost" size="icon" onClick={() => setConfirmStageId(s.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          ))}
          <div className="flex gap-2 pt-2 border-t">
            <Input placeholder="Emri i statusit të ri" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Button onClick={add}><Plus className="w-4 h-4 mr-2" />Shto</Button>
          </div>
        </CardContent>
      </Card>
      <ConfirmDialog
        open={!!confirmStageId}
        title="Fshi statusin"
        description="Pacientët me këtë status do të ruajnë ID-në por nuk do ta shfaqin. Ky veprim nuk mund të kthehet."
        onConfirm={remove}
        onCancel={() => setConfirmStageId(null)}
      />
    </>
  );
}

function Integrations({ companyId }: { companyId: string }) {
  const [token, setToken] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    supabase.from("company_webhook_tokens").select("token").eq("company_id", companyId).maybeSingle().then(({ data }) => setToken(data?.token ?? ""));
  }, [companyId]);
  const url = token ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-leads/${token}` : "";
  const maskedUrl = token ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-leads/••••••••` : "";
  const copy = () => { navigator.clipboard.writeText(url); toast.success("URL u kopjua!"); };

  return (
    <div className="space-y-6">

      {/* ── CSV Import ── */}
      <Card>
        <CardHeader>
          <CardTitle>Importo me CSV</CardTitle>
          <CardDescription>Shkarko shembullin, plotëso të dhënat, pastaj importo nga faqja Pacientët.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <a href="/sample-paciente.csv" download className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4">
            Shkarko shembull CSV
          </a>
          <div className="bg-muted/50 border rounded-lg p-4 space-y-2 text-sm">
            <p className="font-semibold mb-1">Kolonat e skedarit CSV:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-4 font-semibold">Kolona</th>
                    <th className="text-left py-1 pr-4 font-semibold">Çfarë shkruhet</th>
                    <th className="text-left py-1 font-semibold">I detyrueshëm?</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">first_name</td><td className="py-1 pr-4">Emri i pacientit</td><td className="py-1 text-destructive font-medium">Po</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">last_name</td><td className="py-1 pr-4">Mbiemri</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">email</td><td className="py-1 pr-4">Email-i (përdoret për të shmangur dublikimet)</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">phone</td><td className="py-1 pr-4">Numri i telefonit</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">sherbimi</td><td className="py-1 pr-4">p.sh. Implant, Zbardhim, Korrektim</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">kur_kontaktohet</td><td className="py-1 pr-4">p.sh. E Hënë 10:00</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">source</td><td className="py-1 pr-4">p.sh. Instagram, Facebook, Rekomandim</td><td className="py-1">Jo</td></tr>
                  <tr><td className="py-1 pr-4 font-mono">value</td><td className="py-1 pr-4">Vlera në euro, p.sh. 500</td><td className="py-1">Jo</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground pt-1">Hapeni skedarin me Excel ose Google Sheets, plotësoni rreshtat, ruajeni si CSV, pastaj klikoni "Importo" në faqen Pacientët.</p>
          </div>
        </CardContent>
      </Card>

      {/* ── Zapier ── */}
      <Card>
        <CardHeader>
          <CardTitle>Lidhja me Zapier</CardTitle>
          <CardDescription>Çdo formë ose burim i jashtëm (Facebook Leads, Google Forms, etj.) mund të dërgojë automatikisht pacientë këtu.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Webhook URL */}
          <div>
            <Label className="mb-1 block">URL-ja juaj e veçantë (Webhook)</Label>
            <div className="flex gap-2">
              <Input value={revealed ? url : maskedUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={() => setRevealed(r => !r)}>
                {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button variant="outline" onClick={copy}><Copy className="w-4 h-4 mr-2" />Kopjo</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Kjo URL është private. Mos e ndaj me askënd jashtë ekipit.</p>
          </div>

          {/* Step by step */}
          <div className="bg-muted/50 border rounded-lg p-4 space-y-3 text-sm">
            <p className="font-semibold">Si funksionon Zapier (hap pas hapi):</p>
            <ol className="space-y-3 text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                <span>Hap <strong className="text-foreground">zapier.com</strong> dhe krijo një llogari falas (nëse nuk e ke). Pastaj kliko <strong className="text-foreground">"Create Zap"</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
                <span><strong className="text-foreground">Zgjidh burimin (Trigger)</strong> — nga ku vijnë pacientët. P.sh: <em>Facebook Lead Ads</em>, <em>Google Forms</em>, <em>Google Sheets</em>, <em>Typeform</em>, etj.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
                <span><strong className="text-foreground">Zgjidh veprimin (Action)</strong> — kërko <strong className="text-foreground">"Webhooks by Zapier"</strong> dhe zgjidh <strong className="text-foreground">"POST"</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">4</span>
                <span><strong className="text-foreground">Ngjit URL-në</strong> e kopjuar më sipër në fushën <em>"URL"</em>. Zgjidh <strong className="text-foreground">Data Format: JSON</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">5</span>
                <span><strong className="text-foreground">Lidh fushat</strong> — në seksionin "Data", shkruaj çelësat e mëposhtëm dhe lidhi me kolonat e burimit tënd.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">6</span>
                <span>Kliko <strong className="text-foreground">"Test Step"</strong> — nëse shikon <code className="text-xs bg-muted px-1 rounded">{`{"created":1,"skipped":0}`}</code> atëherë funksionon. Aktivizo Zap-in.</span>
              </li>
            </ol>
          </div>

          {/* Field reference */}
          <div className="bg-muted/50 border rounded-lg p-4">
            <p className="font-semibold text-sm mb-2">Çelësat që pranon sistemi (për hapin 5):</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-4 font-semibold">Çelësi (Key)</th>
                    <th className="text-left py-1 pr-4 font-semibold">Shembull vlere</th>
                    <th className="text-left py-1 font-semibold">I detyrueshëm?</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">first_name</td><td className="py-1 pr-4">Erjon</td><td className="py-1 text-destructive font-medium">Po</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">last_name</td><td className="py-1 pr-4">Hoxha</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">email</td><td className="py-1 pr-4">erjon@gmail.com</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">phone</td><td className="py-1 pr-4">+355691234567</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">sherbimi</td><td className="py-1 pr-4">Implant</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">kur_kontaktohet</td><td className="py-1 pr-4">E Hënë 10:00</td><td className="py-1">Jo</td></tr>
                  <tr className="border-b"><td className="py-1 pr-4 font-mono">source</td><td className="py-1 pr-4">facebook_leads</td><td className="py-1">Jo</td></tr>
                  <tr><td className="py-1 pr-4 font-mono">value</td><td className="py-1 pr-4">500</td><td className="py-1">Jo</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Nëse dy pacientë kanë të njëjtin email, i dyti anashkalohet automatikisht (pa dublika).</p>
          </div>

          <a
            href="https://zapier.com/apps/webhook/integrations"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Hap Zapier Webhooks
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
