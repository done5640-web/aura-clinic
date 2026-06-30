import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout, { RequireAuth } from "@/components/AppLayout";
import ErrorBoundary from "@/components/ErrorBoundary";
import RoleRedirect from "@/components/RoleRedirect";
import AuthPage from "./pages/Auth";
import NoAccess from "./pages/NoAccess";
import NotFound from "./pages/NotFound";

const Dashboard     = lazy(() => import("./pages/Dashboard"));
const Leads         = lazy(() => import("./pages/Leads"));
const LeadDetail    = lazy(() => import("./pages/LeadDetail"));
const PreventivPicker = lazy(() => import("./pages/PreventivPicker"));
const PreventivEditor = lazy(() => import("./pages/PreventivEditor"));
const Team          = lazy(() => import("./pages/Team"));
const Analytics     = lazy(() => import("./pages/Analytics"));
const Settings      = lazy(() => import("./pages/Settings"));
const CalendarPage  = lazy(() => import("./pages/Calendar"));
const AdminDashboard  = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminCompanies  = lazy(() => import("./pages/admin/AdminCompanies"));

const queryClient = new QueryClient();

const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[200px]">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/no-access" element={<NoAccess />} />
            <Route path="/" element={<RoleRedirect />} />
            <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
              <Route path="/dashboard" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Dashboard /></Suspense></ErrorBoundary>} />
              <Route path="/leads" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><Leads /></Suspense></ErrorBoundary>} />
              <Route path="/leads/:id" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><LeadDetail /></Suspense></ErrorBoundary>} />
              <Route path="/preventiv" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><PreventivPicker /></Suspense></ErrorBoundary>} />
              <Route path="/leads/:id/preventiv" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><PreventivEditor /></Suspense></ErrorBoundary>} />
              <Route path="/leads/:id/preventiv/:quoteId" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><PreventivEditor /></Suspense></ErrorBoundary>} />
              <Route path="/team" element={<RequireAuth allow={["super_admin","company_admin","team_leader"]}><Suspense fallback={<PageLoader />}><Team /></Suspense></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth allow={["super_admin","company_admin","team_leader"]}><Suspense fallback={<PageLoader />}><Analytics /></Suspense></RequireAuth>} />
              <Route path="/calendar" element={<Suspense fallback={<PageLoader />}><CalendarPage /></Suspense>} />
              <Route path="/settings" element={<Suspense fallback={<PageLoader />}><Settings /></Suspense>} />
              <Route path="/admin" element={<RequireAuth allow={["super_admin"]}><Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense></RequireAuth>} />
              <Route path="/admin/companies" element={<RequireAuth allow={["super_admin"]}><Suspense fallback={<PageLoader />}><AdminCompanies /></Suspense></RequireAuth>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
