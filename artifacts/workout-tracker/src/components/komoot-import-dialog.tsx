import { useState, useEffect, useCallback } from "react";
import { format, parseISO } from "date-fns";
import { Download, AlertCircle, Loader2, Check, Mountain, Bike, PersonStanding, ChevronRight, Settings } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { getListWorkoutLogsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...opts });
}

interface KomootTour {
  id: string;
  name: string;
  date: string;
  sport: string;
  distanceM: number;
  durationS: number;
  elevationUp: number;
  elevationDown: number;
}

function fmtDistance(m: number) {
  return (m / 1000).toFixed(1) + " km";
}
function fmtDuration(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}u ${m}m` : `${m}m`;
}
const SPORT_LABELS: Record<string, string> = {
  cycling: "Fietsen", touringbicycle: "Toerfietsen", mtb: "MTB", mtb_easy: "MTB",
  mtb_advanced: "MTB", racebike: "Racefiets", e_mtb: "E-MTB", e_touringbicycle: "E-Bike",
  running: "Hardlopen", jogging: "Hardlopen", hiking: "Wandelen", hike: "Wandelen",
  mountaineering: "Bergwandelen", nordic_walking: "Nordic Walking", skating: "Skeeleren",
  swimming: "Zwemmen", other: "Anders",
};
function sportLabel(sport: string) {
  return SPORT_LABELS[sport] ?? sport;
}
// Auto-generated Komoot names follow "{sport} {YYYY-MM-DD HH:MM:SS}".
// For those we use just the sport label so all rides of the same type
// link to the same workout template (= herhalingen).
// User-defined names are kept as-is.
function displayName(tour: KomootTour): string {
  const sportKeys = Object.keys(SPORT_LABELS);
  const nameLower = tour.name.toLowerCase();
  const matchedSport = sportKeys.find(k => nameLower.startsWith(k));
  if (matchedSport) {
    const rest = tour.name.slice(matchedSport.length).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(rest)) {
      return sportLabel(matchedSport); // e.g. "Toerfietsen" — all repeats group together
    }
  }
  return tour.name;
}
function SportIcon({ sport }: { sport: string }) {
  if (sport.includes("cycl") || sport.includes("bike") || sport.includes("mtb")) return <Bike className="h-4 w-4" />;
  if (sport.includes("run") || sport.includes("jog")) return <PersonStanding className="h-4 w-4" />;
  return <Mountain className="h-4 w-4" />;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSettings: () => void;
}

type Status = "idle" | "loading" | "no_credentials" | "auth_failed" | "error" | "ready" | "importing" | "done";

export function KomootImportDialog({ open, onOpenChange, onOpenSettings }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [tours, setTours] = useState<KomootTour[]>([]);
  const [selected, setSelected] = useState<KomootTour | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [importedIds, setImportedIds] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const load = useCallback(async () => {
    setStatus("loading");
    setSelected(null);
    setTours([]);
    try {
      const r = await apiFetch("/api/komoot/tours");
      if (r.status === 422) { setStatus("no_credentials"); return; }
      if (r.status === 401) { setStatus("auth_failed"); return; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json() as { tours: KomootTour[] };
      setTours(data.tours);
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Onbekende fout");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (open) {
      setImportedIds(new Set());
      load();
    }
  }, [open, load]);

  const handleImport = async (tour: KomootTour) => {
    setStatus("importing");
    try {
      const distanceKm = tour.distanceM / 1000;
      const durationMin = Math.round(tour.durationS / 60);
      const results = JSON.stringify({
        distance: parseFloat(distanceKm.toFixed(2)),
        duration: durationMin,
        elevationGain: tour.elevationUp ?? null,
      });
      const loggedAt = tour.date.split("T")[0] ?? new Date().toISOString().split("T")[0];
      const body = {
        workoutName: displayName(tour),
        loggedAt,
        durationMinutes: durationMin,
        notes: `Geïmporteerd via Komoot · ${sportLabel(tour.sport)}`,
        results,
      };
      // Use /api/komoot/import so the server auto-links repeats to the same workout template
      const r = await apiFetch("/api/komoot/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`Import mislukt: HTTP ${r.status}`);
      setImportedIds(prev => new Set([...prev, tour.id]));
      queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Import mislukt");
      setStatus("error");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle className="font-mono uppercase tracking-tight flex items-center gap-2">
            <Download className="h-4 w-4 text-primary" />
            Komoot Import
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-mono text-sm text-muted-foreground">Verbinden met Komoot…</p>
            </div>
          )}

          {/* No credentials */}
          {status === "no_credentials" && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
              <p className="font-mono text-sm text-muted-foreground">
                Geen Komoot-inloggegevens gevonden. Stel je gebruikersnaam en wachtwoord in via de instellingen.
              </p>
              <Button variant="outline" className="font-mono uppercase gap-2" onClick={() => { onOpenChange(false); onOpenSettings(); }}>
                <Settings className="h-4 w-4" /> Naar instellingen
              </Button>
            </div>
          )}

          {/* Auth failed */}
          {status === "auth_failed" && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-mono text-sm text-muted-foreground">
                Inloggen bij Komoot mislukt. Controleer je gebruikersnaam en wachtwoord in de instellingen.
              </p>
              <Button variant="outline" className="font-mono uppercase gap-2" onClick={() => { onOpenChange(false); onOpenSettings(); }}>
                <Settings className="h-4 w-4" /> Instellingen controleren
              </Button>
            </div>
          )}

          {/* Generic error */}
          {status === "error" && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-mono text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" className="font-mono uppercase" onClick={load}>Opnieuw proberen</Button>
            </div>
          )}

          {/* Tour list */}
          {(status === "ready" || status === "importing") && (
            <div className="divide-y divide-border">
              {tours.length === 0 && (
                <div className="py-16 text-center">
                  <p className="font-mono text-sm text-muted-foreground">Geen opgenomen routes gevonden op Komoot.</p>
                </div>
              )}
              {tours.map(tour => {
                const alreadyImported = importedIds.has(tour.id);
                const isImporting = status === "importing" && selected?.id === tour.id;
                return (
                  <div
                    key={tour.id}
                    className={`flex items-center gap-3 px-6 py-4 transition-colors ${alreadyImported ? "opacity-50" : "hover:bg-muted/40 cursor-pointer"}`}
                    onClick={() => { if (!alreadyImported && status === "ready") { setSelected(tour); handleImport(tour); } }}
                  >
                    <div className="text-muted-foreground shrink-0">
                      <SportIcon sport={tour.sport} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold truncate">{displayName(tour)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                        {format(parseISO(tour.date), "d MMM yyyy")}
                        <span className="mx-1.5 opacity-40">·</span>
                        {fmtDistance(tour.distanceM)}
                        <span className="mx-1.5 opacity-40">·</span>
                        {fmtDuration(tour.durationS)}
                        {tour.elevationUp > 0 && <><span className="mx-1.5 opacity-40">·</span>↑{tour.elevationUp}m</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="font-mono text-[9px] uppercase hidden sm:flex">
                        {sportLabel(tour.sport)}
                      </Badge>
                      {alreadyImported
                        ? <Check className="h-4 w-4 text-green-400" />
                        : isImporting
                          ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {(status === "ready" || status === "importing") && tours.length > 0 && (
          <div className="px-6 py-3 border-t border-border shrink-0">
            <p className="font-mono text-[10px] text-muted-foreground text-center">
              Klik op een route om te importeren als cardio workout log
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
