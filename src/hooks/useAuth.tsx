import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "company_admin" | "team_leader" | "operator";

export interface UserContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  rolesLoading: boolean;
  roles: AppRole[];
  companyId: string | null;
  fullName: string | null;
  email: string | null;
  primaryRole: AppRole | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<UserContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const loadProfile = async (uid: string, retries = 5): Promise<void> => {
    const [{ data: profile }, { data: roleRows, error: roleErr }] = await Promise.all([
      supabase.from("profiles").select("company_id, full_name").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role, company_id").eq("user_id", uid),
    ]);
    const companyIdFromProfile = profile?.company_id ?? null;
    const companyIdFromRoles = (roleRows ?? []).find((r: any) => r.company_id)?.company_id ?? null;
    setCompanyId(companyIdFromProfile ?? companyIdFromRoles);
    setFullName(profile?.full_name ?? null);
    const fetchedRoles = ((roleRows ?? []).map((r) => r.role)) as AppRole[];
    // If roles came back empty and we have retries left, wait and retry
    // (can happen if JWT hasn't propagated to RLS yet)
    if (fetchedRoles.length === 0 && retries > 0) {
      await new Promise(res => setTimeout(res, 800));
      return loadProfile(uid, retries - 1);
    }
    setRoles(fetchedRoles);
  };

  useEffect(() => {
    let initialLoad = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setRolesLoading(true);
        loadProfile(sess.user.id).finally(() => {
          setRolesLoading(false);
          if (initialLoad) { setLoading(false); initialLoad = false; }
        });
      } else {
        setRoles([]); setCompanyId(null); setFullName(null);
        if (initialLoad) { setLoading(false); initialLoad = false; }
      }
    });

    // Fallback if onAuthStateChange doesn't fire within 3s
    const fallbackTimer = setTimeout(() => {
      if (initialLoad) { setLoading(false); initialLoad = false; }
    }, 3000);

    return () => {
      clearTimeout(fallbackTimer);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Instant force-logout: subscribe to our own profile row and sign out
  // the moment force_logout_at changes (e.g. an admin reset our password).
  useEffect(() => {
    if (!user) return;
    const sessionStartedAt = Date.now();
    const channel = supabase
      .channel(`profile-force-logout-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          const forcedAt = payload.new?.force_logout_at;
          if (forcedAt && new Date(forcedAt).getTime() > sessionStartedAt) {
            supabase.auth.signOut();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const refresh = async () => { if (user) await loadProfile(user.id); };
  const signOut = async () => { await supabase.auth.signOut(); };

  const primaryRole: AppRole | null =
    roles.includes("super_admin") ? "super_admin"
    : roles.includes("company_admin") ? "company_admin"
    : roles.includes("team_leader") ? "team_leader"
    : roles.includes("operator") ? "operator"
    : null;

  return (
    <AuthContext.Provider value={{ user, session, loading, rolesLoading, roles, companyId, fullName, email: user?.email ?? null, primaryRole, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
