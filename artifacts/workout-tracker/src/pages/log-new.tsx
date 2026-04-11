import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { RestTimer } from "@/components/ui/rest-timer";
import { useCreateWorkoutLog, getListWorkoutLogsQueryKey, useListWorkoutLogs, useListWorkouts, getListWorkoutsQueryKey, useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { ArrowLeft, Star, Plus, X, History, Clock, Play, Square, RotateCcw, Minus, Maximize2 } from "lucide-react";
import { format, parseISO } from "date-fns";

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"];

type ExerciseResult = { exerciseName: string; sets: { reps: number; weight: number }[] };
type PrevSet = { reps: number; weight: number };
type PrevMap = Record<string, { sets: PrevSet[]; date: string }>;

function fmtTime(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

/* ─── 10-second countdown overlay ─── */
function CountdownToStart({ count }: { count: number }) {
  const isGo = count === 0;
  return (
    <div className="absolute inset-0 bg-primary flex flex-col items-center justify-center gap-3">
      <p className="font-mono text-[10px] uppercase tracking-widest text-primary-foreground/70">Starting in…</p>
      <div className={`font-mono font-black tabular-nums transition-all text-primary-foreground ${isGo ? "text-8xl scale-125" : "text-8xl"}`}>
        {isGo ? "GO!" : count}
      </div>
    </div>
  );
}

/* ─── Fullscreen timer overlay with Wake Lock ─── */
function FullscreenTimerOverlay({ onClose, onTap, tapHint, children }: { onClose: () => void; onTap?: () => void; tapHint?: string; children: React.ReactNode }) {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try { lockRef.current = await (navigator as any).wakeLock?.request("screen"); } catch {}
    })();
    return () => {
      lockRef.current?.release?.().catch?.(() => {});
      lockRef.current = null;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[300] bg-background flex flex-col items-center justify-center select-none"
      onClick={onTap}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-5 right-5 z-10 h-11 w-11 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {children}
      {tapHint && (
        <p className="absolute bottom-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 pointer-events-none">
          {tapHint}
        </p>
      )}
    </div>
  );
}

/* ─── Shared stopwatch + round counter (used by both RFT and AMRAP) ─── */
function StopwatchTracker({
  onStop,
}: {
  onStop: (rounds: number, time: string) => void;
}) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [rounds, setRounds] = useState(0);
  const [saved, setSaved] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* countdown → auto go fullscreen when done */
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const id = setTimeout(() => { setCountdown(null); setRunning(true); setFullscreen(true); }, 700);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  /* stopwatch */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = () => { setSaved(false); setCountdown(10); };
  const handleStop = () => {
    setRunning(false);
    setFullscreen(false);
    const t = fmtTime(elapsed);
    onStop(rounds, t);
    setSaved(true);
  };
  const handleReset = () => {
    setRunning(false);
    setCountdown(null);
    setFullscreen(false);
    setElapsed(0);
    setRounds(0);
    setSaved(false);
  };

  if (countdown !== null) return (
    <FullscreenTimerOverlay onClose={() => setCountdown(null)}>
      <CountdownToStart count={countdown} />
    </FullscreenTimerOverlay>
  );

  const timerBody = (fs: boolean) => (
    <div className={`flex flex-col items-center gap-6 ${fs ? "w-full px-8" : "py-2"}`}>
      <div className={`font-mono font-black tabular-nums tracking-tighter transition-colors ${running ? "text-primary" : saved ? "text-green-400" : "text-foreground"} ${fs ? "text-[96px]" : "text-6xl"}`}>
        {fmtTime(elapsed)}
      </div>
      {saved && !fs && <p className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Saved ✓</p>}

      <div className="flex flex-col items-center gap-2">
        <p className={`font-mono uppercase tracking-widest text-muted-foreground ${fs ? "text-sm" : "text-[10px]"}`}>Rounds</p>
        {/* stopPropagation on +/− row so these buttons don't also trigger onTap */}
        <div className="flex items-center gap-5" onClick={fs ? e => e.stopPropagation() : undefined}>
          <Button type="button" variant="outline" size="icon" className={fs ? "h-14 w-14" : "h-9 w-9"} onClick={() => setRounds(r => Math.max(0, r - 1))}><Minus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
          <span className={`font-mono font-black tabular-nums text-center ${fs ? "text-7xl w-24" : "text-5xl w-16"}`}>{rounds}</span>
          <Button type="button" variant="outline" size="icon" className={fs ? "h-14 w-14" : "h-9 w-9"} onClick={() => setRounds(r => r + 1)}><Plus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
        </div>
      </div>

      {/* stopPropagation on control buttons row */}
      <div className="flex gap-3" onClick={fs ? e => e.stopPropagation() : undefined}>
        {!running ? (
          <Button type="button" onClick={handleStart} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`} disabled={saved}>
            <Play className="h-4 w-4" />{elapsed === 0 ? "Start" : "Resume"}
          </Button>
        ) : (
          <Button type="button" onClick={handleStop} variant="destructive" className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Square className="h-4 w-4" />Stop &amp; Save
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handleReset} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
        {running && !fs && (
          <Button type="button" variant="outline" size="icon" onClick={() => setFullscreen(true)} title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <FullscreenTimerOverlay
        onClose={() => setFullscreen(false)}
        onTap={() => setRounds(r => r + 1)}
        tapHint="Tik om ronde +1 toe te voegen"
      >
        {timerBody(true)}
      </FullscreenTimerOverlay>
    );
  }

  return timerBody(false);
}

/* ─── EMOM timer: configurable interval that resets until total time is up ─── */
function EmomTimer() {
  const [intervalMin, setIntervalMin] = useState(1);
  const [totalMin, setTotalMin] = useState(20);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [intervalSec, setIntervalSec] = useState(60);
  const [totalSec, setTotalSec] = useState(1200);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [currentInterval, setCurrentInterval] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const intervalMinRef = useRef(intervalMin);

  useEffect(() => { intervalMinRef.current = intervalMin; }, [intervalMin]);

  /* 10s countdown → auto fullscreen on start */
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const id = setTimeout(() => {
        setCountdown(null);
        setIntervalSec(intervalMinRef.current * 60);
        setTotalSec(totalMin * 60);
        setCurrentInterval(1);
        setDone(false);
        setRunning(true);
        setFullscreen(true);
      }, 700);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(id);
  }, [countdown, totalMin]);

  /* interval tick */
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setIntervalSec(r => {
        if (r <= 1) {
          setCurrentInterval(i => i + 1);
          return intervalMinRef.current * 60;
        }
        return r - 1;
      });
      setTotalSec(r => {
        if (r <= 1) {
          setRunning(false);
          setFullscreen(false);
          setDone(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const totalIntervals = Math.round(totalMin / intervalMin);
  const pct = 1 - intervalSec / (intervalMin * 60);
  const isLastSeconds = intervalSec <= 5 && running;

  const handleStart = () => { setCountdown(10); };
  const handleReset = () => {
    setRunning(false);
    setDone(false);
    setCountdown(null);
    setFullscreen(false);
    setIntervalSec(intervalMin * 60);
    setTotalSec(totalMin * 60);
    setCurrentInterval(1);
  };

  if (countdown !== null) return (
    <FullscreenTimerOverlay onClose={() => setCountdown(null)}>
      <CountdownToStart count={countdown} />
    </FullscreenTimerOverlay>
  );

  const timerBody = (fs: boolean) => (
    <div className={`flex flex-col items-center gap-5 ${fs ? "w-full px-8" : "py-2"}`}>
      {/* Setup (only before start, not fullscreen) */}
      {!running && !done && !fs && (
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <div className="space-y-1 text-center">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Interval (min)</Label>
            <Input type="number" value={intervalMin} onChange={e => { const v = parseInt(e.target.value) || 1; setIntervalMin(v); setIntervalSec(v * 60); }} className="font-mono text-center h-9" min={1} />
          </div>
          <div className="space-y-1 text-center">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Total (min)</Label>
            <Input type="number" value={totalMin} onChange={e => { const v = parseInt(e.target.value) || 1; setTotalMin(v); setTotalSec(v * 60); }} className="font-mono text-center h-9" min={1} />
          </div>
        </div>
      )}

      {/* Interval status */}
      {(running || done) && (
        <p className={`font-mono uppercase tracking-widest text-muted-foreground ${fs ? "text-base" : "text-[11px]"}`}>
          Interval {currentInterval} / {totalIntervals}
        </p>
      )}

      {/* Interval countdown */}
      <div className={`font-mono font-black tabular-nums tracking-tighter transition-colors ${done ? "text-green-400" : isLastSeconds ? "text-destructive" : running ? "text-primary" : "text-foreground"} ${fs ? "text-[110px]" : "text-6xl"}`}>
        {fmtTime(intervalSec)}
      </div>

      {/* Progress bar */}
      {(running || done) && (
        <div className={`w-full bg-muted rounded-full overflow-hidden ${fs ? "h-3 max-w-sm" : "h-2"}`}>
          <div className={`h-full rounded-full transition-all ${isLastSeconds ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct * 100}%` }} />
        </div>
      )}

      {/* Total remaining */}
      {(running || done) && (
        <p className={`font-mono text-muted-foreground ${fs ? "text-lg" : "text-sm"}`}>
          Total remaining: <span className={`font-bold text-foreground`}>{fmtTime(totalSec)}</span>
        </p>
      )}

      {done && <p className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Done — {totalIntervals} intervals ✓</p>}

      {/* Controls */}
      <div className="flex gap-2">
        {!running && !done && (
          <Button type="button" onClick={handleStart} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Play className="h-4 w-4" />Start
          </Button>
        )}
        {running && (
          <Button type="button" onClick={() => setRunning(false)} variant="outline" className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Square className="h-4 w-4" />Pause
          </Button>
        )}
        {!running && !done && intervalSec < intervalMin * 60 && (
          <Button type="button" onClick={() => setRunning(true)} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Play className="h-4 w-4" />Resume
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handleReset} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
          <RotateCcw className="h-3.5 w-3.5" />Reset
        </Button>
        {running && !fs && (
          <Button type="button" variant="outline" size="icon" onClick={() => setFullscreen(true)} title="Fullscreen">
            <Maximize2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <FullscreenTimerOverlay onClose={() => setFullscreen(false)}>
        {timerBody(true)}
      </FullscreenTimerOverlay>
    );
  }

  return timerBody(false);
}

/* ─── helpers ─── */
function buildPrevMap(logs: Array<{ workoutType: string; loggedAt: string; results: unknown }> | undefined): PrevMap {
  if (!logs) return {};
  const map: PrevMap = {};
  const sorted = [...logs].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  for (const log of sorted) {
    if (log.workoutType !== "bodybuilding") continue;
    try {
      const results = JSON.parse(log.results as string) as ExerciseResult[];
      for (const ex of results) {
        const key = ex.exerciseName.toLowerCase().trim();
        if (!map[key]) map[key] = { sets: ex.sets, date: log.loggedAt.split("T")[0] };
      }
    } catch {}
  }
  return map;
}

function PrevWeightHint({ exerciseName, prevMap }: { exerciseName: string; prevMap: PrevMap }) {
  const key = exerciseName.toLowerCase().trim();
  const prev = prevMap[key];
  if (!prev || !exerciseName) return null;
  const dateLabel = format(parseISO(prev.date), "MMM d");
  const setsLabel = prev.sets.map(s => `${s.reps}×${s.weight}kg`).join(", ");
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground bg-muted/30 rounded px-2 py-1 mt-1">
      <History className="h-3 w-3 shrink-0" />
      <span>{dateLabel}: {setsLabel}</span>
    </div>
  );
}

function formatCfResult(type: string, results: string): string {
  try {
    const r = JSON.parse(results);
    if (type === "amrap") return `${r.rounds ?? r.roundsCompleted ?? "—"} rounds${r.partialReps ? ` + ${r.partialReps} reps` : ""}`;
    if (type === "emom") return r.score ? `${r.score}` : (r.kg ? `${r.kg} kg` : "—");
    if (type === "rft") return r.time ? `${r.time}` : "—";
  } catch {}
  return "—";
}

function PrevCfResults({ logs, workoutId, workoutType }: { logs: any[] | undefined; workoutId: string; workoutType: string }) {
  const prev = (logs || [])
    .filter((l: any) => l.workoutId?.toString() === workoutId && l.workoutType === workoutType)
    .sort((a: any, b: any) => b.loggedAt.localeCompare(a.loggedAt))
    .slice(0, 4);
  if (!prev.length) return null;
  return (
    <Card className="bg-muted/20 border-border">
      <CardHeader className="pb-2">
        <CardTitle className="font-mono text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <History className="h-3.5 w-3.5" /> Previous results
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {prev.map((log: any, i: number) => (
          <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
            <span className="font-mono text-[11px] text-muted-foreground">{format(parseISO(log.loggedAt.split("T")[0]), "MMM d yyyy")}</span>
            <span className="font-mono text-sm font-bold text-primary">{formatCfResult(workoutType, log.results)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── main page ─── */
export default function LogNewPage() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const workoutIdFromUrl = params.get("workoutId");
  const fromTemplate = !!workoutIdFromUrl;

  const queryClient = useQueryClient();
  const createLog = useCreateWorkoutLog();
  const { data: workouts } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const { data: allLogs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });

  const prevMap = useMemo(() => buildPrevMap(allLogs), [allLogs]);

  const selectedWorkoutId = workoutIdFromUrl ? parseInt(workoutIdFromUrl) : 0;

  /* Resolve template synchronously from React Query cache on first render */
  const getInitialTemplate = () => {
    if (!workoutIdFromUrl) return null;
    const cached = queryClient.getQueryData<any[]>(getListWorkoutsQueryKey());
    return cached?.find((w: any) => w.id === selectedWorkoutId) ?? null;
  };
  const initialTemplate = useMemo(getInitialTemplate, []); // eslint-disable-line

  const [selectedTemplateId, setSelectedTemplateId] = useState(workoutIdFromUrl || "");
  const [workoutName, setWorkoutName] = useState(initialTemplate?.name ?? "");
  const [workoutType, setWorkoutType] = useState(initialTemplate?.type ?? "bodybuilding");
  const [loggedAt, setLoggedAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(4);

  const [bbResults, setBbResults] = useState<ExerciseResult[]>(() => {
    if (initialTemplate?.type === "bodybuilding") {
      try {
        const exs = JSON.parse(initialTemplate.exercises);
        if (Array.isArray(exs) && exs.length > 0) {
          return exs.map((ex: any) => ({
            exerciseName: ex.name,
            sets: Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 0, weight: ex.weight || 0 }))
          }));
        }
      } catch {}
    }
    return [{ exerciseName: "", sets: [{ reps: 0, weight: 0 }] }];
  });

  const [amrapRounds, setAmrapRounds] = useState("");
  const [amrapPartialReps, setAmrapPartialReps] = useState("");
  const [emomScore, setEmomScore] = useState("");
  const [rftTime, setRftTime] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioHR, setCardioHR] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");
  const [cardioExercises, setCardioExercises] = useState<any[]>(() => {
    if (initialTemplate?.type === "cardio") {
      try {
        const exs = JSON.parse(initialTemplate.exercises);
        return Array.isArray(exs) ? exs : [];
      } catch {}
    }
    return [];
  });
  const [cfText, setCfText] = useState(() => {
    if (initialTemplate && ["amrap", "emom", "rft"].includes(initialTemplate.type)) {
      try {
        const parsed = JSON.parse(initialTemplate.exercises);
        return parsed?.freeText ?? "";
      } catch {}
    }
    return "";
  });

  /* Fallback 1: apply template if cache was empty on mount but own workouts load later */
  const appliedRef = useRef(!!initialTemplate);
  const templateFromList = useMemo(
    () => workoutIdFromUrl && workouts ? workouts.find(w => w.id === selectedWorkoutId) ?? null : null,
    [workouts, workoutIdFromUrl, selectedWorkoutId]
  );
  useEffect(() => {
    if (!templateFromList || appliedRef.current) return;
    appliedRef.current = true;
    setWorkoutName(templateFromList.name);
    setWorkoutType(templateFromList.type);
    setSelectedTemplateId(templateFromList.id.toString());
    if (templateFromList.type === "bodybuilding") {
      try {
        const exs = JSON.parse(templateFromList.exercises);
        if (Array.isArray(exs) && exs.length > 0) {
          setBbResults(exs.map((ex: any) => ({
            exerciseName: ex.name,
            sets: Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 0, weight: ex.weight || 0 }))
          })));
        }
      } catch {}
    }
    if (["amrap", "emom", "rft"].includes(templateFromList.type)) {
      try {
        const parsed = JSON.parse(templateFromList.exercises);
        if (parsed?.freeText) setCfText(parsed.freeText);
      } catch {}
    }
    if (templateFromList.type === "cardio") {
      try {
        const exs = JSON.parse(templateFromList.exercises);
        if (Array.isArray(exs)) setCardioExercises(exs);
      } catch {}
    }
  }, [templateFromList]);

  /* Fallback 2: fetch by ID for shared workouts owned by another user */
  const { data: fetchedWorkout } = useGetWorkout(selectedWorkoutId, {
    query: {
      enabled: !!workoutIdFromUrl && selectedWorkoutId > 0,
      queryKey: getGetWorkoutQueryKey(selectedWorkoutId),
    }
  });
  useEffect(() => {
    if (!fetchedWorkout || appliedRef.current) return;
    appliedRef.current = true;
    setWorkoutName(fetchedWorkout.name);
    setWorkoutType(fetchedWorkout.type);
    setSelectedTemplateId(fetchedWorkout.id.toString());
    if (fetchedWorkout.type === "bodybuilding") {
      try {
        const exs = JSON.parse(fetchedWorkout.exercises);
        if (Array.isArray(exs) && exs.length > 0) {
          setBbResults(exs.map((ex: any) => ({
            exerciseName: ex.name,
            sets: Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 0, weight: ex.weight || 0 }))
          })));
        }
      } catch {}
    }
    if (["amrap", "emom", "rft"].includes(fetchedWorkout.type)) {
      try {
        const parsed = JSON.parse(fetchedWorkout.exercises);
        if (parsed?.freeText) setCfText(parsed.freeText);
      } catch {}
    }
    if (fetchedWorkout.type === "cardio") {
      try {
        const exs = JSON.parse(fetchedWorkout.exercises);
        if (Array.isArray(exs)) setCardioExercises(exs);
      } catch {}
    }
  }, [fetchedWorkout]);

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplateId(id);
    if (id && workouts) {
      const w = workouts.find(w => w.id.toString() === id);
      if (w) {
        setWorkoutName(w.name);
        setWorkoutType(w.type);
        if (w.type === "bodybuilding") {
          try {
            const exs = JSON.parse(w.exercises);
            if (Array.isArray(exs) && exs.length > 0) {
              setBbResults(exs.map((ex: any) => ({
                exerciseName: ex.name,
                sets: Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 0, weight: ex.weight || 0 }))
              })));
            }
          } catch {}
        }
        if (["amrap", "emom", "rft"].includes(w.type)) {
          try {
            const parsed = JSON.parse(w.exercises);
            if (parsed?.freeText) setCfText(parsed.freeText);
          } catch {}
        }
        if (w.type === "cardio") {
          try {
            const exs = JSON.parse(w.exercises);
            if (Array.isArray(exs)) setCardioExercises(exs);
          } catch {}
        }
      }
    }
  };

  const buildResults = () => {
    const type = workoutType;
    if (type === "bodybuilding") return JSON.stringify(bbResults);
    if (type === "amrap") return JSON.stringify({ rounds: parseInt(amrapRounds) || 0, partialReps: parseInt(amrapPartialReps) || 0 });
    if (type === "emom") return JSON.stringify({ score: emomScore });
    if (type === "rft") return JSON.stringify({ time: rftTime });
    if (type === "cardio") return JSON.stringify({ distance: parseFloat(cardioDistance) || 0, duration: parseInt(cardioDuration) || 0, avgHeartRate: parseInt(cardioHR) || null, elevationGain: parseInt(cardioElevation) || null });
    return "{}";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutName) return;
    await createLog.mutateAsync({
      data: {
        workoutId: selectedTemplateId ? parseInt(selectedTemplateId) : null,
        workoutName,
        workoutType,
        loggedAt: new Date(loggedAt).toISOString(),
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        notes: notes || null,
        results: buildResults(),
        rating,
      }
    });
    queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
    navigate("/log");
  };

  const isCrossfit = ["amrap", "emom", "rft"].includes(workoutType);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/log">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Log Session</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Record your performance</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template mode: compact header */}
        {fromTemplate ? (
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Logging from template</p>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-lg uppercase tracking-tight">{workoutName || "Loading…"}</span>
                    {workoutName && <WorkoutBadge type={workoutType} />}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Date &amp; Time</Label>
                  <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Duration (min)</Label>
                  <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="60" className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Ad-hoc mode: full session info card */
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Session Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Load from template</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateSelect}>
                  <SelectTrigger className="font-mono"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {workouts?.map(w => <SelectItem key={w.id} value={w.id.toString()} className="font-mono">{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Workout Name</Label>
                <Input value={workoutName} onChange={e => setWorkoutName(e.target.value)} placeholder="e.g. Push Day A" required className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
                <Select value={workoutType} onValueChange={setWorkoutType}>
                  <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map(t => <SelectItem key={t} value={t} className="font-mono capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Date &amp; Time</Label>
                  <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase tracking-wider">Duration (min)</Label>
                  <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="60" className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CrossFit whiteboard */}
        {isCrossfit && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Whiteboard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={cfText}
                onChange={e => setCfText(e.target.value)}
                placeholder={"Write the workout:\n\n21-15-9\nThrusters 43kg\nPull-ups"}
                className="font-mono text-sm resize-none"
                rows={5}
              />
              <p className="font-mono text-[10px] text-muted-foreground">Loaded from template — edit freely, not saved to the template</p>
            </CardContent>
          </Card>
        )}

        {/* Previous results */}
        {isCrossfit && selectedTemplateId && (
          <PrevCfResults logs={allLogs as any} workoutId={selectedTemplateId} workoutType={workoutType} />
        )}

        {/* Bodybuilding */}
        {workoutType === "bodybuilding" && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Sets &amp; Reps</CardTitle>
              <Button type="button" variant="outline" size="sm" className="font-mono uppercase text-xs gap-1"
                onClick={() => setBbResults([...bbResults, { exerciseName: "", sets: [{ reps: 0, weight: 0 }] }])}>
                <Plus className="h-3 w-3" /> Add Exercise
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {bbResults.map((ex, i) => (
                <div key={i} className="p-4 rounded border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ex.exerciseName}
                      onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, exerciseName: e.target.value } : r))}
                      placeholder="Exercise name"
                      className="font-mono"
                    />
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => setBbResults(bbResults.filter((_, ri) => ri !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <PrevWeightHint exerciseName={ex.exerciseName} prevMap={prevMap} />
                  <div className="space-y-2 pt-1">
                    {ex.sets.map((set, si) => (
                      <div key={si} className="flex items-center gap-2 pl-4">
                        <span className="font-mono text-xs text-muted-foreground w-12">Set {si + 1}</span>
                        <Input type="number" value={set.reps || ""} onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.map((s, sj) => sj === si ? { ...s, reps: parseInt(e.target.value) || 0 } : s) } : r))} placeholder="Reps" className="font-mono h-8 w-20" />
                        <Input type="number" value={set.weight || ""} onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.map((s, sj) => sj === si ? { ...s, weight: parseFloat(e.target.value) || 0 } : s) } : r))} placeholder="kg" className="font-mono h-8 w-20" />
                        {ex.sets.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                            onClick={() => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.filter((_, sj) => sj !== si) } : r))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="font-mono uppercase text-xs text-muted-foreground ml-4 gap-1"
                      onClick={() => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: [...r.sets, { reps: 0, weight: 0 }] } : r))}>
                      <Plus className="h-3 w-3" /> Add Set
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {workoutType === "bodybuilding" && <RestTimer />}

        {/* RFT tracker */}
        {workoutType === "rft" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" /> RFT — Rounds For Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StopwatchTracker onStop={(rounds, time) => { setRftTime(time); }} />
              <div className="mt-5 border-t border-border pt-4 space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Time (mm:ss)</Label>
                <Input value={rftTime} onChange={e => setRftTime(e.target.value)} placeholder="11:30" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* AMRAP tracker — same stopwatch as RFT, rounds auto-saved */}
        {workoutType === "amrap" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">AMRAP Score</CardTitle>
            </CardHeader>
            <CardContent>
              <StopwatchTracker onStop={(rounds, _time) => { setAmrapRounds(rounds.toString()); }} />
              <div className="mt-5 border-t border-border pt-4 grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Rounds</Label>
                  <Input type="number" value={amrapRounds} onChange={e => setAmrapRounds(e.target.value)} placeholder="14" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">+ Partial Reps</Label>
                  <Input type="number" value={amrapPartialReps} onChange={e => setAmrapPartialReps(e.target.value)} placeholder="6" className="font-mono" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* EMOM timer */}
        {workoutType === "emom" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">EMOM Timer</CardTitle>
            </CardHeader>
            <CardContent>
              <EmomTimer />
              <div className="mt-5 border-t border-border pt-4 space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Weight / Score</Label>
                <Input
                  value={emomScore}
                  onChange={e => setEmomScore(e.target.value)}
                  placeholder="e.g. 50kg  or  3×50kg / 20kg"
                  className="font-mono"
                />
                <p className="font-mono text-[10px] text-muted-foreground">Record the weight(s) used</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cardio plan (from template exercises) */}
        {workoutType === "cardio" && cardioExercises.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Trainingsplan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {cardioExercises.map((ex: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 rounded border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <span className="font-bold text-sm">{ex.name}</span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground flex gap-3">
                    {ex.distance && <span>{ex.distance} km</span>}
                    {ex.duration && <span>{ex.duration} min</span>}
                    {ex.zone && ex.zone !== "none" && <span className="text-primary">{ex.zone}</span>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Cardio */}
        {workoutType === "cardio" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Cardio Results</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Distance (km)</Label>
                <Input type="number" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} placeholder="5.0" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Duration (min)</Label>
                <Input type="number" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} placeholder="32" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Avg Heart Rate (bpm)</Label>
                <Input type="number" value={cardioHR} onChange={e => setCardioHR(e.target.value)} placeholder="148" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Elevation (m)</Label>
                <Input type="number" value={cardioElevation} onChange={e => setCardioElevation(e.target.value)} placeholder="45" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Session Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="How did it feel? PRs? Notes for next time..." className="font-mono text-sm resize-none" rows={3} />
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                Rating <span className="flex">{[1, 2, 3, 4, 5].map(n => <Star key={n} className={`h-4 w-4 ${n <= rating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`} />)}</span>
              </Label>
              <Slider min={1} max={5} step={1} value={[rating]} onValueChange={([v]) => setRating(v)} className="max-w-xs" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/log">
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createLog.isPending} className="font-mono uppercase tracking-tight">
            {createLog.isPending ? "Saving..." : "Save Log"}
          </Button>
        </div>
      </form>
    </div>
  );
}
