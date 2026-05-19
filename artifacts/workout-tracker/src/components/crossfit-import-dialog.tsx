import { useState, useEffect, useCallback } from "react";
import { Dumbbell, AlertCircle, Loader2, Check } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { getListWorkoutsQueryKey } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}${path}`, { credentials: "include", ...opts });
}

interface CrossfitWOD {
  date: string;
  content: string;
  workoutName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onOpenSettings?: () => void;
}

type Status = "idle" | "loading" | "error" | "ready" | "importing";

const WORKOUT_TYPES = [
  { value: "amrap", label: "AMRAP" },
  { value: "rft", label: "RFT" },
  { value: "emom", label: "EMOM" },
];

/**
 * Generate date string in yymmdd format from a Date object
 */
function getDateString(date: Date = new Date()): string {
  const year = date.getFullYear().toString().slice(2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}${month}${day}`;
}

export function CrossfitImportDialog({ open, onOpenChange, onOpenSettings }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [wod, setWod] = useState<CrossfitWOD | null>(null);
  const [selectedType, setSelectedType] = useState<string>("amrap");
  const [errorMsg, setErrorMsg] = useState("");
  const queryClient = useQueryClient();

  const loadWOD = useCallback(async () => {
    setStatus("loading");
    setWod(null);
    setErrorMsg("");
    
    try {
      const date = getDateString();
      const r = await apiFetch(`/api/crossfit/wod?date=${date}`);
      
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${r.status}: Failed to load WOD`);
      }
      
      const data = await r.json() as CrossfitWOD;
      setWod(data);
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to load Crossfit WOD");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadWOD();
    }
  }, [open, loadWOD]);

  const handleImport = async () => {
    if (!wod) return;
    
    setStatus("importing");
    setErrorMsg("");
    
    try {
      const body = {
        workoutType: selectedType,
        workoutName: wod.workoutName,
        description: wod.content,
      };
      
      const r = await apiFetch("/api/crossfit/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        throw new Error(data.message ?? `HTTP ${r.status}: Import failed`);
      }
      
      // Invalidate workouts cache to refresh the list
      queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      
      // Close dialog on success
      onOpenChange(false);
      setStatus("ready");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Failed to import workout");
      setStatus("error");
    }
  };

  const handleRetry = () => {
    setStatus("idle");
    loadWOD();
  };

  // Disable import button if not ready or already importing
  const isImportDisabled = status !== "ready" || !wod;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle className="font-mono uppercase tracking-tight flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-primary" />
            <span>Crossfit Mainsite</span>
          </SheetTitle>
          <SheetDescription className="font-mono text-sm text-muted-foreground mt-1">
            Import today&apos;s Workout of the Day
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Loading */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-mono text-sm text-muted-foreground">
                Loading Crossfit WOD…
              </p>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="flex flex-col items-center justify-center h-48 gap-4 px-8 text-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-mono text-sm text-muted-foreground">{errorMsg}</p>
              <Button variant="outline" className="font-mono uppercase" onClick={handleRetry}>
                Retry
              </Button>
            </div>
          )}

          {/* Ready - WOD Content */}
          {status === "ready" && wod && (
            <div className="space-y-4 p-6">
              {/* Workout Name (already includes the date) */}
              <div className="font-bold text-lg">{wod.workoutName}</div>

              {/* Content in pre-formatted text with proper spacing */}
              <div className="bg-muted/30 rounded-md p-4">
                <pre className="font-mono text-sm whitespace-pre-wrap leading-relaxed break-words">
                  {wod.content}
                </pre>
              </div>

              {/* Workout Type Selector */}
              <div className="space-y-2">
                <label className="font-mono text-sm font-bold uppercase tracking-tight text-foreground">
                  Workout Type
                </label>
                <Select 
                  value={selectedType} 
                  onValueChange={setSelectedType}
                  disabled={status === "importing"}
                >
                  <SelectTrigger className="w-full font-mono text-sm">
                    <SelectValue placeholder="Select workout type" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map((type) => (
                      <SelectItem 
                        key={type.value} 
                        value={type.value} 
                        className="font-mono text-sm"
                      >
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        {/* Footer - Import Button */}
        {(status === "ready" || status === "error") && (
          <div className="px-6 py-4 border-t border-border shrink-0">
            <Button
              className="w-full font-mono uppercase tracking-tight gap-2"
              onClick={handleImport}
              disabled={isImportDisabled || status === "importing"}
            >
              {status === "importing" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Import Workout</span>
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
