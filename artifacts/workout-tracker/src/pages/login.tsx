import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Activity, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { login, register, error, clearError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError("");
    clearError();
    if (!username.trim() || !password.trim()) {
      setFieldError("Both fields are required.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "login") {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(m => m === "login" ? "register" : "login");
    setFieldError("");
    clearError();
  };

  const displayError = fieldError || error;

  return (
    <div className="min-h-[100dvh] bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-3 mb-10">
          <Activity className="h-8 w-8 text-primary" />
          <span className="font-mono font-black text-3xl tracking-tighter uppercase text-foreground">Stroxx</span>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 space-y-6">
          <div>
            <h1 className="font-mono font-black text-xl uppercase tracking-tight text-foreground">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h1>
            <p className="font-mono text-xs text-muted-foreground mt-1 uppercase tracking-wider">
              {mode === "login" ? "Log in to continue" : "Start tracking your gains"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="athlete_name"
                autoComplete="username"
                className="w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="font-mono text-[10px] text-muted-foreground">Min. 6 characters</p>
              )}
            </div>

            {displayError && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
                <p className="font-mono text-xs text-destructive">{displayError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground font-mono font-bold uppercase tracking-tight py-2.5 rounded-md hover:bg-primary/90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? "..." : mode === "login" ? "Log In" : "Create Account"}
            </button>
          </form>

          <div className="text-center">
            <button onClick={switchMode} className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider">
              {mode === "login" ? "No account? Register" : "Have an account? Log in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
