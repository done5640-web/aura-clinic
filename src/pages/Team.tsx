import { useEffect, useState } from "react";
import { supabase, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreHorizontal, Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";
import { fetchAll } from "@/lib/fetchAll";

const fetchAllRows = fetchAll;

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Admin",
  team_leader: "Team Leader",
  operator: "Operator",
};

interface Member {
  id: string; full_name: string | null; email: string;
  role: string; leads: number; overdue: number;
  company_name?: string; company_id?: string;
  team_leader_id?: string | null;
}

export default function Team() {
  const { companyId, primaryRole, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState(0);

  // Add member dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [addForm, setAddForm] = useState({ email: "", password: "", full_name: "", role: "operator", company_id: "", team_leader_id: "" });
  const [teamLeaders, setTeamLeaders] = useState<{ id: string; full_name: string | null; email: string }[]>([]);
  const [confirmMember, setConfirmMember] = useState<Member | null>(null);

  // Edit member dialog
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState({ team_leader_id: "", company_id: "", role: "" });
  const [editBusy, setEditBusy] = useState(false);

  const isSuperAdmin = primaryRole === "super_admin";
  const canManageTeam = isSuperAdmin || primaryRole === "company_admin";

  const load = async () => {
    if (!user) return;
    setLoading(true);

    if (isSuperAdmin) {
      const [profs, roleRows, leadRows, taskRows, comps] = await Promise.all([
        fetchAllRows((f, t) => supabase.from("profiles").select("id, full_name, email, company_id, team_leader_id").range(f, t)),
        fetchAllRows((f, t) => supabase.from("user_roles").select("user_id, role, company_id").range(f, t)),
        fetchAllRows((f, t) => supabase.from("leads").select("assigned_to_user_id").range(f, t)),
        fetchAllRows((f, t) => supabase.from("tasks").select("assigned_to, completed, due_date").range(f, t)),
        fetchAllRows((f, t) => supabase.from("companies").select("id, name").range(f, t)),
      ]);
      const companyMap = new Map<string, string>(comps.map((c: any) => [c.id, c.name]));
      setCompanies(comps);
      const roleMap = new Map<string, string>();
      roleRows.forEach((r: any) => { if (!roleMap.has(r.user_id)) roleMap.set(r.user_id, r.role); });
      const leadCount = new Map<string, number>();
      let unassigned = 0;
      leadRows.forEach((l: any) => {
        if (l.assigned_to_user_id) leadCount.set(l.assigned_to_user_id, (leadCount.get(l.assigned_to_user_id) ?? 0) + 1);
        else unassigned++;
      });
      setUnassignedLeads(unassigned);
      const overdue = new Map<string, number>();
      taskRows.forEach((t: any) => {
        if (t.completed || !t.assigned_to) return;
        if (t.due_date && new Date(t.due_date) < new Date()) overdue.set(t.assigned_to, (overdue.get(t.assigned_to) ?? 0) + 1);
      });
      const allMembers = profs.filter((p: any) => roleMap.get(p.id) !== "super_admin");
      setTeamLeaders(allMembers.filter((p: any) => roleMap.get(p.id) === "team_leader").map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email })));
      setMembers(allMembers.map((p: any) => ({
          ...p,
          role: roleMap.get(p.id) ?? "—",
          leads: leadCount.get(p.id) ?? 0,
          overdue: overdue.get(p.id) ?? 0,
          company_name: p.company_id ? companyMap.get(p.company_id) : undefined,
        }))
      );

    } else if (primaryRole === "company_admin") {
      if (!companyId) { setLoading(false); return; }
      const [profs, roleRows, leadRows, taskRows] = await Promise.all([
        fetchAllRows((f, t) => supabase.from("profiles").select("id, full_name, email, team_leader_id").eq("company_id", companyId).range(f, t)),
        fetchAllRows((f, t) => supabase.from("user_roles").select("user_id, role").eq("company_id", companyId).range(f, t)),
        fetchAllRows((f, t) => supabase.from("leads").select("assigned_to_user_id").eq("company_id", companyId).range(f, t)),
        fetchAllRows((f, t) => supabase.from("tasks").select("assigned_to, completed, due_date").range(f, t)),
      ]);
      const roleMap = new Map<string, string>();
      roleRows.forEach((r: any) => roleMap.set(r.user_id, r.role));
      const leadCount = new Map<string, number>();
      let unassigned = 0;
      leadRows.forEach((l: any) => {
        if (l.assigned_to_user_id) leadCount.set(l.assigned_to_user_id, (leadCount.get(l.assigned_to_user_id) ?? 0) + 1);
        else unassigned++;
      });
      setUnassignedLeads(unassigned);
      const overdue = new Map<string, number>();
      taskRows.forEach((t: any) => {
        if (t.completed || !t.assigned_to) return;
        if (t.due_date && new Date(t.due_date) < new Date()) overdue.set(t.assigned_to, (overdue.get(t.assigned_to) ?? 0) + 1);
      });
      const allMembers = profs.filter((p: any) => { const r = roleMap.get(p.id); return r === "company_admin" || r === "team_leader" || r === "operator"; });
      setTeamLeaders(allMembers.filter((p: any) => roleMap.get(p.id) === "team_leader").map((p: any) => ({ id: p.id, full_name: p.full_name, email: p.email })));
      setMembers(allMembers.map((p: any) => ({ ...p, role: roleMap.get(p.id) ?? "—", leads: leadCount.get(p.id) ?? 0, overdue: overdue.get(p.id) ?? 0 })));

    } else if (primaryRole === "team_leader") {
      if (!companyId) { setLoading(false); return; }
      const [myProfile, operatorProfs, roleRows, leadRows] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, team_leader_id").eq("id", user.id).single(),
        fetchAllRows((f, t) => supabase.from("profiles").select("id, full_name, email, team_leader_id").eq("company_id", companyId).eq("team_leader_id", user.id).range(f, t)),
        fetchAllRows((f, t) => supabase.from("user_roles").select("user_id, role").eq("company_id", companyId).range(f, t)),
        fetchAllRows((f, t) => supabase.from("leads").select("assigned_to_user_id").eq("company_id", companyId).range(f, t)),
      ]);
      const roleMap = new Map<string, string>();
      roleRows.forEach((r: any) => roleMap.set(r.user_id, r.role));
      const leadCount = new Map<string, number>();
      let unassigned = 0;
      leadRows.forEach((l: any) => {
        if (l.assigned_to_user_id) leadCount.set(l.assigned_to_user_id, (leadCount.get(l.assigned_to_user_id) ?? 0) + 1);
        else unassigned++;
      });
      setUnassignedLeads(unassigned);
      const operators = operatorProfs
        .filter((p: any) => roleMap.get(p.id) === "operator")
        .map((p: any) => ({ ...p, role: "operator", leads: leadCount.get(p.id) ?? 0, overdue: 0 }));
      // Include the TL themselves at the top
      const tlEntry = myProfile.data ? [{
        ...myProfile.data,
        role: "team_leader",
        leads: leadCount.get(user.id) ?? 0,
        overdue: 0,
      }] : [];
      setMembers([...tlEntry, ...operators]);
    }

    setLoading(false);
  };

  useEffect(() => { load(); }, [user, companyId, primaryRole]);

  const addMember = async () => {
    if (!addForm.email.trim()) return toast.error("Email është i detyrueshëm");
    if (addForm.password.length < 8) return toast.error("Fjalëkalimi min. 8 karaktere");

    let targetCompany = companyId ?? companies[0]?.id;
    if (!targetCompany) {
      const { data } = await supabase.from("companies").select("id").limit(1).single();
      targetCompany = data?.id;
    }
    if (!targetCompany) return toast.error("Nuk u gjet klinika");

    setAddBusy(true);

    const { data: { session } } = await supabase.auth.getSession();
    console.log("session token:", session?.access_token?.slice(0, 20));
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL ?? "https://yaoaulvxrxgcitbfpapy.supabase.co"}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session?.access_token}`,
        "apikey": SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        email: addForm.email.trim(),
        password: addForm.password,
        full_name: addForm.full_name.trim(),
        role: addForm.role,
        company_id: targetCompany,
      }),
    });
    const resData = await res.json();
    console.error("create-user response:", res.status, resData);
    if (!res.ok || resData?.error) {
      toast.error(resData?.error ?? `Gabim (${res.status}): ${JSON.stringify(resData)}`);
      setAddBusy(false);
      return;
    }

    // If operator, save the team_leader_id linkage
    if (addForm.role === "operator" && addForm.team_leader_id && resData.user_id) {
      await supabase.from("profiles").update({ team_leader_id: addForm.team_leader_id }).eq("id", resData.user_id);
    }

    toast.success("Anëtari u shtua");
    setAddOpen(false);
    setAddForm({ email: "", password: "", full_name: "", role: "operator", company_id: "", team_leader_id: "" });
    setAddBusy(false);
    load();
  };

  const openEdit = (m: Member) => {
    setEditMember(m);
    setEditForm({
      team_leader_id: m.team_leader_id ?? "",
      company_id: m.company_id ?? "",
      role: m.role,
    });
  };

  const saveEdit = async () => {
    if (!editMember) return;
    setEditBusy(true);

    const updates: Record<string, any> = {};

    if (isSuperAdmin && editForm.company_id) {
      updates.company_id = editForm.company_id;
    }

    // Clear team_leader_id when promoting away from operator
    updates.team_leader_id = editForm.role === "operator" ? (editForm.team_leader_id || null) : null;

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", editMember.id);

    if (error) {
      toast.error("Gabim në ruajtje: " + error.message);
      setEditBusy(false);
      return;
    }

    const targetCompanyId = isSuperAdmin ? (editForm.company_id || editMember.company_id) : companyId;

    // If company changed for super_admin, update user_roles company
    if (isSuperAdmin && editForm.company_id && editForm.company_id !== editMember.company_id) {
      await supabase
        .from("user_roles")
        .update({ company_id: editForm.company_id })
        .eq("user_id", editMember.id);
    }

    // If role changed, replace the role row
    if (editForm.role && editForm.role !== editMember.role) {
      await supabase.from("user_roles").delete().eq("user_id", editMember.id);
      await supabase.from("user_roles").insert({ user_id: editMember.id, role: editForm.role, company_id: targetCompanyId });
    }

    toast.success("Ndryshimet u ruajtën");
    setEditMember(null);
    load();
    setEditBusy(false);
  };

  const removeMember = async () => {
    if (!confirmMember) return;
    await supabase.from("user_roles").delete().eq("user_id", confirmMember.id);
    await supabase.from("profiles").delete().eq("id", confirmMember.id);
    setConfirmMember(null);
    toast.success("Anëtari u hoq");
    load();
  };

  if (loading) return <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ekipi</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-sm text-muted-foreground">{members.length} anëtarë</p>
            {unassignedLeads > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {unassignedLeads} pa operator
              </span>
            )}
          </div>
        </div>
        {canManageTeam && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />Shto anëtar
          </Button>
        )}
      </div>

      {/* Add member dialog */}
      <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) setAddForm({ email: "", password: "", full_name: "", role: "operator", company_id: "", team_leader_id: "" }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Shto anëtar</DialogTitle>
            <DialogDescription>Krijo një llogari të re për këtë anëtar të ekipit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div><Label>Emri i plotë</Label><Input value={addForm.full_name} onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })} placeholder="p.sh. Erjon Hoxha" /></div>
            <div><Label>Email *</Label><Input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} placeholder="erjon@klinika.com" /></div>
            <div><Label>Fjalëkalimi *</Label><Input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} placeholder="Min. 8 karaktere" /></div>
            <div>
              <Label>Roli *</Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm({ ...addForm, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(isSuperAdmin || primaryRole === "company_admin") && <SelectItem value="company_admin">Admin</SelectItem>}
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="operator">Operator</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(primaryRole === "company_admin" || isSuperAdmin) && addForm.role === "operator" && teamLeaders.length > 0 && (
              <div>
                <Label>Team Leader</Label>
                <Select value={addForm.team_leader_id} onValueChange={(v) => setAddForm({ ...addForm, team_leader_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Zgjidh team leaderin" /></SelectTrigger>
                  <SelectContent>
                    {teamLeaders.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>{tl.full_name || tl.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button onClick={addMember} disabled={addBusy} className="w-full">
              {addBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Shto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit member dialog */}
      <Dialog open={!!editMember} onOpenChange={(v) => { if (!v) setEditMember(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ndrysho anëtarin</DialogTitle>
            <DialogDescription>
              {editMember?.full_name || editMember?.email} — {ROLE_LABELS[editMember?.role ?? ""] ?? editMember?.role}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Role change — admin can promote/change roles */}
            {canManageTeam && editMember?.role !== "super_admin" && (
              <div>
                <Label>Roli</Label>
                <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company_admin">Admin</SelectItem>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Team leader assignment — show for operators */}
            {editForm.role === "operator" && (
              <div>
                <Label>Team Leader</Label>
                <Select
                  value={editForm.team_leader_id || "__none__"}
                  onValueChange={(v) => setEditForm({ ...editForm, team_leader_id: v === "__none__" ? "" : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pa team leader" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— Pa team leader —</SelectItem>
                    {teamLeaders.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>{tl.full_name || tl.email}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Cakto operatorin te një team leader.</p>
              </div>
            )}


            {editForm.role === "operator" && teamLeaders.length === 0 && (
              <p className="text-sm text-muted-foreground">Nuk ka team leaders në këtë kompani.</p>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setEditMember(null)}>Anulo</Button>
              <Button className="flex-1" onClick={saveEdit} disabled={editBusy}>
                {editBusy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ruaj
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member list */}
      <MemberList
        members={members}
        canManage={canManageTeam}
        teamLeaders={teamLeaders}
        onRemove={(m) => setConfirmMember(m)}
        onEdit={openEdit}
      />
      <ConfirmDialog
        open={!!confirmMember}
        title="Hiq nga ekipi"
        description={confirmMember ? `Jeni të sigurt që doni të hiqni "${confirmMember.full_name || confirmMember.email}" nga ekipit?` : ""}
        confirmLabel="Hiq"
        onConfirm={removeMember}
        onCancel={() => setConfirmMember(null)}
      />
    </div>
  );
}

function MemberList({
  members,
  canManage,
  teamLeaders,
  onRemove,
  onEdit,
}: {
  members: Member[];
  canManage: boolean;
  teamLeaders: { id: string; full_name: string | null; email: string }[];
  onRemove: (m: Member) => void;
  onEdit: (m: Member) => void;
}) {
  if (members.length === 0) return (
    <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Asnjë anëtar.</CardContent></Card>
  );

  const tlMap = new Map(teamLeaders.map((tl) => [tl.id, tl.full_name || tl.email]));

  return (
    <Card>
      <CardContent className="p-0">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-4 border-b last:border-0">
            <Avatar>
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {(m.full_name || m.email)[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{m.full_name || m.email}</p>
              <p className="text-xs text-muted-foreground truncate">{m.email}</p>
              {m.role === "operator" && m.team_leader_id && tlMap.has(m.team_leader_id) && (
                <p className="text-xs text-muted-foreground truncate">
                  Team Leader: <span className="font-medium">{tlMap.get(m.team_leader_id)}</span>
                </p>
              )}
              {m.role === "operator" && !m.team_leader_id && (
                <p className="text-xs text-amber-600 truncate">Pa team leader</p>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0">{ROLE_LABELS[m.role] ?? m.role}</Badge>
            <div className="text-right shrink-0 hidden sm:block">
              <p className="text-sm font-semibold">{m.leads}</p>
              <p className="text-xs text-muted-foreground">pacientë</p>
            </div>
            {m.overdue > 0 && (
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-sm font-semibold text-destructive">{m.overdue}</p>
                <p className="text-xs text-muted-foreground">të skaduara</p>
              </div>
            )}
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0"><MoreHorizontal className="w-4 h-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(m)}>
                    <Pencil className="w-4 h-4 mr-2" />Ndrysho
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onRemove(m)}>
                    <Trash2 className="w-4 h-4 mr-2" />Hiq nga ekipi
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
