import { ReactNode, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth, AppRole } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
  LayoutDashboard, Users, BarChart3, Settings, LogOut,
  Building2, ListChecks, Sparkles, CalendarDays,
  ChevronLeft, ChevronRight, Sun, Moon, UserCircle2
} from "lucide-react";
import { MediqueLogo } from "@/components/MediqueLogo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface NavItem { to: string; label: string; icon: any; roles: AppRole[]; }

const NAV: NavItem[] = [
  { to: "/admin",           label: "Platforma",          icon: Sparkles,       roles: ["super_admin"] },
  { to: "/admin/companies", label: "Klinika",             icon: Building2,      roles: ["super_admin"] },
  { to: "/leads",           label: "Të gjithë pacientët", icon: ListChecks,     roles: ["super_admin"] },
  { to: "/team",            label: "Të gjithë anëtarët",  icon: Users,          roles: ["super_admin"] },
  { to: "/dashboard",       label: "Paneli",              icon: LayoutDashboard,roles: ["company_admin","team_leader","operator"] },
  { to: "/leads",           label: "Pacientët",           icon: ListChecks,     roles: ["company_admin","team_leader","operator"] },
  { to: "/team",            label: "Ekipi",               icon: Users,          roles: ["company_admin","team_leader"] },
  { to: "/analytics",       label: "Analitika",           icon: BarChart3,      roles: ["company_admin","team_leader"] },
  { to: "/calendar",        label: "Kalendar",            icon: CalendarDays,   roles: ["super_admin","company_admin","team_leader","operator"] },
  { to: "/settings",        label: "Cilësimet",           icon: Settings,       roles: ["super_admin","company_admin","team_leader","operator"] },
];

export function RequireAuth({ children, allow }: { children?: ReactNode; allow?: AppRole[] }) {
  const { user, loading, primaryRole } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (allow && primaryRole && !allow.includes(primaryRole)) return <Navigate to="/" replace />;
  return <>{children ?? <Outlet />}</>;
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <MediqueLogo className="h-10 w-auto text-foreground" />
        <div className="space-y-2 w-40">
          <Skeleton className="h-2.5 w-full rounded" />
          <Skeleton className="h-2.5 w-3/4 rounded" />
        </div>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const { primaryRole, fullName, email, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const items = NAV.filter((n) => primaryRole && n.roles.includes(primaryRole));
  const initials = (fullName || email || "U").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen flex w-full bg-background">

      {/* ── Sidebar ── */}
      <aside className={cn(
        "hidden md:flex flex-col shrink-0 transition-all duration-200",
        "bg-[hsl(var(--sidebar-background))]",
        "border-r border-[hsl(var(--sidebar-border))]",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}>

        {/* Logo */}
        <div className={cn(
          "h-14 flex items-center shrink-0 border-b border-[hsl(var(--sidebar-border))]",
          collapsed ? "justify-center px-2" : "px-4"
        )}>
          {collapsed ? (
            <div className="w-7 h-7 rounded-lg bg-[hsl(38,62%,52%)] flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
          ) : (
            <MediqueLogo className="h-8 w-auto text-white" />
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to + it.label}
              to={it.to}
              end={it.to === "/admin" || it.to === "/dashboard"}
              title={collapsed ? it.label : undefined}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                collapsed && "justify-center",
                isActive
                  ? "bg-[hsl(38,62%,52%)]/15 text-[hsl(38,62%,72%)] border border-[hsl(38,62%,52%)]/20"
                  : "text-[hsl(var(--sidebar-foreground))] hover:bg-white/5 hover:text-white"
              )}
            >
              <it.icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">{it.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Bottom: role + collapse */}
        <div className={cn(
          "p-2 border-t border-[hsl(var(--sidebar-border))] flex items-center",
          collapsed ? "justify-center" : "justify-between gap-2"
        )}>
          {!collapsed && (
            <span className="text-[11px] text-[hsl(var(--sidebar-foreground))]/40 font-medium uppercase tracking-wider truncate px-0.5">
              {primaryRole?.replace(/_/g, " ")}
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[hsl(var(--sidebar-foreground))]/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <header className="h-14 bg-background border-b flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          {/* Mobile logo */}
          <div className="md:hidden flex items-center">
            <MediqueLogo className="h-7 w-auto text-foreground" />
          </div>

          <div className="hidden md:block flex-1" />

          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
                  <Avatar className="w-7 h-7">
                    <AvatarFallback className="text-xs bg-[hsl(25,12%,26%)] text-white font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block text-sm font-medium max-w-[120px] truncate">{fullName || email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel className="text-xs text-muted-foreground font-normal truncate">{email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => nav("/settings")}>
                  <UserCircle2 className="w-4 h-4 mr-2" />Cilësimet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await signOut(); nav("/auth"); }} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />Dil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t z-20 flex">
          {items.slice(0, 5).map((it) => (
            <NavLink key={it.to + it.label} to={it.to} end={it.to === "/admin" || it.to === "/dashboard"}
              className={({ isActive }) => cn(
                "flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors",
                isActive ? "text-indigo-600" : "text-muted-foreground"
              )}>
              <it.icon className="w-4 h-4" />
              <span className="truncate max-w-[56px]">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto" key={location.pathname}>
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
