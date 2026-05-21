import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Phone, Trash2 } from "lucide-react";
import { fetchAll } from "@/lib/fetchAll";
import { toast } from "sonner";

interface CalEvent {
  id: string;
  lead_id: string | null;
  title: string;
  scheduled_at: string;
  type: string;
  notes: string | null;
  lead?: { first_name: string; last_name: string | null; phone: string | null };
}

const MONTHS = ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"];
const DAYS = ["Hën","Mar","Mër","Enj","Pre","Sht","Die"];

export default function CalendarPage() {
  const { user, companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [today] = useState(new Date());
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<Date | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: "", lead_id: "", type: "call", scheduled_at: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: ev }, ld] = await Promise.all([
      supabase.from("calendar_events")
        .select("*, lead:leads(first_name, last_name, phone)")
        .eq("user_id", user?.id ?? "")
        .order("scheduled_at"),
      fetchAll((f, t) => supabase.from("leads").select("id, first_name, last_name, phone")
        .eq("company_id", companyId ?? "")
        .order("first_name")
        .range(f, t)),
    ]);
    setEvents((ev ?? []) as CalEvent[]);
    setLeads(ld);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); }, [user, companyId]);

  const addEvent = async () => {
    if (!form.title.trim() || !form.scheduled_at) { toast.error("Titulli dhe data/ora janë të detyrueshme"); return; }
    setBusy(true);
    const { error } = await supabase.from("calendar_events").insert({
      user_id: user?.id,
      company_id: companyId,
      title: form.title.trim(),
      lead_id: (form.lead_id && form.lead_id !== "none") ? form.lead_id : null,
      type: form.type,
      scheduled_at: form.scheduled_at,
      notes: form.notes || null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ngjarja u shtua");
    setAddOpen(false);
    setForm({ title: "", lead_id: "", type: "call", scheduled_at: "", notes: "" });
    load();
  };

  const deleteEvent = async (id: string) => {
    await supabase.from("calendar_events").delete().eq("id", id);
    toast.success("Ngjarja u fshi");
    load();
  };

  const year = current.getFullYear();
  const month = current.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = [...Array(startPad).fill(null)];
  for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);

  const eventsForDay = (d: Date) =>
    events.filter((e) => {
      const ed = new Date(e.scheduled_at);
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth() && ed.getDate() === d.getDate();
    });

  const selectedEvents = selected ? eventsForDay(selected) : [];
  const isToday = (d: Date) => d.toDateString() === today.toDateString();

  if (loading) return <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Kalendari i telefonatave</h1>
        <Button type="button" size="sm" onClick={(e) => { e.preventDefault(); const dt = selected ? `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,"0")}-${String(selected.getDate()).padStart(2,"0")}T09:00` : ""; setForm({ ...form, scheduled_at: dt }); setAddOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" />Ngjarje e re
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 px-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrent(new Date(year, month - 1, 1))}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-semibold">{MONTHS[month]} {year}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrent(new Date(year, month + 1, 1))}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-4">
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {days.map((d, i) => {
                if (!d) return <div key={i} className="bg-background h-14" />;
                const dayEvs = eventsForDay(d);
                const isSelected = selected?.toDateString() === d.toDateString();
                return (
                  <div
                    key={i}
                    onClick={() => setSelected(d)}
                    className={`bg-background h-14 p-1 cursor-pointer transition-colors hover:bg-muted/60 ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary" : ""}`}
                  >
                    <span className={`text-xs font-medium flex items-center justify-center w-6 h-6 rounded-full ${isToday(d) ? "bg-primary text-primary-foreground" : ""}`}>
                      {d.getDate()}
                    </span>
                    <div className="space-y-0.5 mt-0.5">
                      {dayEvs.slice(0, 2).map((e) => (
                        <div key={e.id} className="text-[10px] bg-primary/20 text-primary rounded px-1 truncate">{e.title}</div>
                      ))}
                      {dayEvs.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvs.length - 2}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm">
              {selected
                ? `${selected.getDate()} ${MONTHS[selected.getMonth()]} ${selected.getFullYear()}`
                : "Zgjidh një ditë"
              }
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {!selected && <p className="text-sm text-muted-foreground text-center py-6">Kliko mbi një ditë për të parë ngjarjet.</p>}
            {selected && selectedEvents.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">Asnjë ngjarje.</p>
                <Button type="button" size="sm" variant="outline" className="mt-3" onClick={(e) => { e.preventDefault(); const dt = `${selected.getFullYear()}-${String(selected.getMonth()+1).padStart(2,"0")}-${String(selected.getDate()).padStart(2,"0")}T09:00`; setForm({ ...form, scheduled_at: dt }); setAddOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1" />Shto
                </Button>
              </div>
            )}
            <div className="space-y-3">
              {selectedEvents.map((e) => (
                <div key={e.id} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground">{new Date(e.scheduled_at).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {e.type === "call" ? "📞 Telefonatë" : e.type === "meeting" ? "📅 Takim" : "📌 Tjetër"}
                    </Badge>
                  </div>
                  {e.lead && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      <span>{e.lead.first_name} {e.lead.last_name}</span>
                      {e.lead.phone && <a href={`tel:${e.lead.phone}`} className="font-medium text-primary hover:underline">{e.lead.phone}</a>}
                    </div>
                  )}
                  {e.notes && <p className="text-xs text-muted-foreground mt-1">{e.notes}</p>}
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive w-full mt-1 h-7" onClick={() => deleteEvent(e.id)}>
                    <Trash2 className="w-3 h-3 mr-1" />Fshi
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ngjarje e re</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Titulli *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="p.sh. Telefonatë me pacientin" /></div>
            <div><Label>Data dhe ora *</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <div>
              <Label>Lloji</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Telefonatë</SelectItem>
                  <SelectItem value="meeting">📅 Takim</SelectItem>
                  <SelectItem value="other">📌 Tjetër</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pacienti i lidhur</Label>
              <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
                <SelectTrigger><SelectValue placeholder="Asnjë (opsionale)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Asnjë</SelectItem>
                  {leads.map((l) => <SelectItem key={l.id} value={l.id}>{l.first_name} {l.last_name} {l.phone ? `— ${l.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Shënime</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsionale..." /></div>
            <Button type="button" onClick={addEvent} disabled={busy} className="w-full">
              {busy ? "Duke ruajtur..." : "Ruaj ngjarjen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
