import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { FullPageLoader } from "@/components/AppLayout";

export default function RoleRedirect() {
  const { user, loading, rolesLoading, primaryRole } = useAuth();
  if (loading || rolesLoading) return <FullPageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (primaryRole === "super_admin") return <Navigate to="/admin" replace />;
  if (primaryRole) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/no-access" replace />;
}
