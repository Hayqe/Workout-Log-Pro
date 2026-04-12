import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff, Check, Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...opts });
}

interface SettingsData {
  komootUsername: string | null;
  hasKomootPassword: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [komootUsername, setKomootUsername] = useState("");
  const [komootPassword, setKomootPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaved(false);
    apiFetch("/api/settings")
      .then(r => r.json() as Promise<SettingsData>)
      .then(d => {
        setData(d);
        setKomootUsername(d.komootUsername ?? "");
        setKomootPassword("");
      })
      .catch(() => setError("Could not load settings."));
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body: Record<string, string> = { komootUsername };
      if (komootPassword) body.komootPassword = komootPassword;
      const r = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Save failed");
      setData(d => d ? { ...d, komootUsername: komootUsername || null, hasKomootPassword: !!komootPassword || !!(d.hasKomootPassword) } : d);
      setKomootPassword("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePassword = async () => {
    try {
      await apiFetch("/api/settings/komoot-password", { method: "DELETE" });
      setData(d => d ? { ...d, hasKomootPassword: false } : d);
      setKomootPassword("");
    } catch {
      setError("Failed to delete password.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-border">
          <SheetTitle className="font-mono uppercase tracking-tight flex items-center gap-2">
            <Settings className="h-4 w-4 text-primary" />
            Settings
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
          {/* Komoot section */}
          <div className="space-y-4">
            <div>
              <h3 className="font-mono text-sm font-bold uppercase tracking-tight">Komoot</h3>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                Store your Komoot credentials for importing activities. The password is encrypted.
              </p>
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Komoot username / email
                </Label>
                <Input
                  value={komootUsername}
                  onChange={e => setKomootUsername(e.target.value)}
                  placeholder="e.g. john@example.com"
                  className="font-mono"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Komoot password
                </Label>
                {data?.hasKomootPassword && !komootPassword && (
                  <div className="flex items-center gap-2 text-xs font-mono text-green-400 mb-1">
                    <Check className="h-3.5 w-3.5" />
                    Password saved
                    <button
                      type="button"
                      onClick={handleDeletePassword}
                      className="ml-auto flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                      Remove
                    </button>
                  </div>
                )}
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={komootPassword}
                    onChange={e => setKomootPassword(e.target.value)}
                    placeholder={data?.hasKomootPassword ? "Enter new password to change" : "Password"}
                    className="font-mono pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center gap-3">
          {error && <p className="text-xs text-destructive font-mono flex-1">{error}</p>}
          {saved && !error && (
            <p className="text-xs text-green-400 font-mono flex items-center gap-1 flex-1">
              <Check className="h-3.5 w-3.5" />Saved
            </p>
          )}
          {!error && !saved && <span className="flex-1" />}
          <Button onClick={handleSave} disabled={saving} className="font-mono uppercase gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
