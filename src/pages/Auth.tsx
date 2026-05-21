import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import { MediqueLogo } from "@/components/MediqueLogo";

export default function AuthPage() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { toast.error("Email ose fjalëkalim i gabuar"); return; }
    nav("/", { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — clinic photo */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden">
        <img
          src="/clinic-room.jpg"
          alt="Aura Vita Clinic"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Warm dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(25,18%,8%)]/80 via-[hsl(25,15%,12%)]/60 to-[hsl(38,30%,20%)]/40" />

        {/* Brand content over photo */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <MediqueLogo className="h-10 w-auto text-white" />

          <div className="space-y-4">
            <p className="text-white/40 text-xs font-medium tracking-[0.2em] uppercase">
              Platforma e menaxhimit
            </p>
            <h2 className="text-white text-4xl font-light leading-snug tracking-tight">
              Kujdes për pacientët,<br />
              <span className="text-[hsl(38,62%,62%)]">pa kompromis.</span>
            </h2>
            <p className="text-white/55 text-sm leading-relaxed max-w-sm">
              Menaxhoni ekipin, pacientët dhe takimet tuaja — gjithçka në një vend.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-[1px] bg-white/20" />
            <p className="text-white/30 text-xs tracking-widest">AURA VITA CLINIC · TIRANË</p>
          </div>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[hsl(36,20%,97%)]">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10">
          <MediqueLogo className="h-10 w-auto text-foreground" />
        </div>

        <div className="w-full max-w-[360px] space-y-8">
          {/* Heading */}
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-[hsl(25,15%,14%)]">
              Mirësevini
            </h1>
            <p className="text-sm text-[hsl(25,10%,48%)]">
              Futni të dhënat tuaja për të vazhduar
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(25,12%,35%)] uppercase tracking-wider">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(25,10%,55%)]" />
                <Input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@klinika.com"
                  className="pl-10 h-11 bg-white border-[hsl(30,15%,87%)] rounded-xl focus-visible:ring-[hsl(38,62%,52%)] focus-visible:border-[hsl(38,62%,52%)] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[hsl(25,12%,35%)] uppercase tracking-wider">
                Fjalëkalimi
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(25,10%,55%)]" />
                <Input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 pr-10 h-11 bg-white border-[hsl(30,15%,87%)] rounded-xl focus-visible:ring-[hsl(38,62%,52%)] focus-visible:border-[hsl(38,62%,52%)] text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[hsl(25,10%,55%)] hover:text-[hsl(25,15%,14%)] transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-white transition-all
                bg-[hsl(25,12%,22%)] hover:bg-[hsl(25,12%,16%)] active:scale-[0.99] shadow-sm disabled:opacity-60"
            >
              {busy
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <>Identifikohu <ArrowRight className="w-4 h-4" /></>
              }
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs text-[hsl(25,10%,55%)] leading-relaxed">
            Kontakto administratorin për kredencialet<br />e llogarisë tënde.
          </p>
        </div>

        {/* Bottom brand mark */}
        <div className="mt-auto pt-12 flex items-center gap-2 opacity-30">
          <div className="w-4 h-[1px] bg-current" />
          <span className="text-[10px] tracking-[0.2em] uppercase font-medium">Aura Vita CRM</span>
          <div className="w-4 h-[1px] bg-current" />
        </div>
      </div>
    </div>
  );
}
