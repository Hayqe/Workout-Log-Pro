import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation, Link, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { RestTimer } from "@/components/ui/rest-timer";
import { useCreateWorkoutLog, useUpdateWorkoutLog, getListWorkoutLogsQueryKey, useListWorkoutLogs, useListWorkouts, getListWorkoutsQueryKey, useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { WorkoutTemplateSelect } from "@/components/ui/workout-template-select";
import { ArrowLeft, Star, Plus, X, History, Clock, Play, Square, RotateCcw, Minus, Maximize2, PlayCircle, PauseCircle, SkipForward, Check } from "lucide-react";
import { format, parseISO } from "date-fns";

// Type for Wake Lock API
declare global {
  interface WakeLockSentinel {
    release: () => Promise<void>;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  }
  interface Navigator {
    wakeLock?: {
      request: (type: string) => Promise<WakeLockSentinel>;
    };
  }
}

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
    <div className="absolute inset-0 countdown-overlay flex flex-col items-center justify-center gap-3">
      <p className="font-mono text-[10px] uppercase tracking-widest opacity-60">Starting in…</p>
      <div className={`font-mono font-black tabular-nums transition-all ${isGo ? "text-8xl scale-125" : "text-8xl"}`}>
        {isGo ? "GO!" : count}
      </div>
    </div>
  );
}

/* ─── Fullscreen timer overlay with Wake Lock ─── */
function FullscreenTimerOverlay({ onClose, onTap, tapHint, children, onFullscreenChange }:
  { onClose: () => void; onTap?: () => void; tapHint?: string; children: React.ReactNode; onFullscreenChange?: (isFullscreen: boolean) => void }) {
  const lockRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try { lockRef.current = await (navigator as any).wakeLock?.request("screen"); } catch {}
    })();
    onFullscreenChange?.(true);
    return () => {
      lockRef.current?.release?.().catch?.(() => {});
      lockRef.current = null;
      onFullscreenChange?.(false);
    };
  }, [onFullscreenChange]);

  return (
    <div
      className="fixed inset-0 z-[300] bg-black flex flex-col items-center justify-center select-none"
      onClick={onTap}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-5 right-5 z-10 h-11 w-11 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>
      {children}
      {tapHint && (
        <p className="absolute bottom-6 font-mono text-[10px] uppercase tracking-widest text-white/30 pointer-events-none">
          {tapHint}
        </p>
      )}
    </div>
  );
}

/* ─── Shared stopwatch + round counter (used by both RFT and AMRAP) ─── */
function StopwatchTracker({
  onStop,
  onFullscreenChange,
}: {
  onStop: (rounds: number, time: string) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
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
      <div className={`font-mono font-black tabular-nums tracking-tighter transition-colors ${running ? "text-primary" : saved ? "text-green-400" : fs ? "text-white" : "text-foreground"} ${fs ? "text-[96px]" : "text-6xl"}`}>
        {fmtTime(elapsed)}
      </div>
      {saved && !fs && <p className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Saved ✓</p>}

      <div className="flex flex-col items-center gap-2">
        <p className={`font-mono uppercase tracking-widest ${fs ? "text-sm text-white/50" : "text-[10px] text-muted-foreground"}`}>Rounds</p>
        {/* stopPropagation on +/− row so these buttons don't also trigger onTap */}
        <div className="flex items-center gap-5" onClick={fs ? e => e.stopPropagation() : undefined}>
          <Button type="button" variant="outline" size="icon" className={`${fs ? "h-14 w-14 border-white/20 text-white hover:bg-white/10" : "h-9 w-9"}`} onClick={() => setRounds(r => Math.max(0, r - 1))}><Minus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
          <span className={`font-mono font-black tabular-nums text-center ${fs ? "text-7xl w-24 text-white" : "text-5xl w-16"}`}>{rounds}</span>
          <Button type="button" variant="outline" size="icon" className={`${fs ? "h-14 w-14 border-white/20 text-white hover:bg-white/10" : "h-9 w-9"}`} onClick={() => setRounds(r => r + 1)}><Plus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
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
        <Button type="button" variant="outline" onClick={handleReset} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base border-white/20 text-white hover:bg-white/10" : ""}`}>
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
        tapHint="Tap to add a round"
        onFullscreenChange={onFullscreenChange}
      >
        {timerBody(true)}
      </FullscreenTimerOverlay>
    );
  }

  return timerBody(false);
}

/* ─── AMRAP timer: countdown from configurable duration, tap = +1 round ─── */
function AmrapTimer({ onSave, onFullscreenChange }:
  { onSave: (rounds: number, partialReps: number) => void; onFullscreenChange?: (isFullscreen: boolean) => void }) {
  const [durationMin, setDurationMin] = useState(20);
  const [remaining, setRemaining] = useState(20 * 60);
  const [rounds, setRounds] = useState(0);
  const [partialReps, setPartialReps] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  /* 10-second pre-start countdown */
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      const id = setTimeout(() => { setCountdown(null); setRunning(true); setFullscreen(true); }, 700);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setCountdown(c => c !== null ? c - 1 : null), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  /* countdown timer */
  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      setRunning(false);
      setDone(true);
      onSave(rounds, partialReps);
      return;
    }
    const id = setInterval(() => setRemaining(r => {
      if (r <= 1) { setRunning(false); setDone(true); onSave(rounds, partialReps); return 0; }
      return r - 1;
    }), 1000);
    return () => clearInterval(id);
  }, [running]);

  const handleStart = () => { setDone(false); setCountdown(10); };
  const handleReset = () => {
    setRunning(false); setDone(false); setCountdown(null); setFullscreen(false);
    setRemaining(durationMin * 60); setRounds(0); setPartialReps(0);
  };
  const handleDurationChange = (v: number) => {
    setDurationMin(v); setRemaining(v * 60);
  };

  const isLastSeconds = remaining <= 10 && running;
  const pct = remaining / (durationMin * 60);

  if (countdown !== null) return (
    <FullscreenTimerOverlay onClose={() => setCountdown(null)}>
      <CountdownToStart count={countdown} />
    </FullscreenTimerOverlay>
  );

  const timerBody = (fs: boolean) => (
    <div className={`flex flex-col items-center gap-5 ${fs ? "w-full px-8" : "py-2"}`}>
      {/* Duration setup — only before start */}
      {!running && !done && !fs && (
        <div className="flex items-center gap-3 w-full max-w-xs">
          <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground whitespace-nowrap">Duration (min)</label>
          <input
            type="number"
            value={durationMin}
            min={1}
            onChange={e => handleDurationChange(parseInt(e.target.value) || 1)}
            className="font-mono text-center h-9 w-20 border border-input rounded-md bg-background text-foreground px-2"
          />
        </div>
      )}

      {/* Countdown display */}
      <div className={`font-mono font-black tabular-nums tracking-tighter transition-colors
        ${done ? "text-green-400" : isLastSeconds ? "text-destructive" : running ? "text-primary" : fs ? "text-white" : "text-foreground"}
        ${fs ? "text-[96px]" : "text-6xl"}`}>
        {fmtTime(remaining)}
      </div>

      {/* Progress bar */}
      {(running || done) && (
        <div className={`w-full rounded-full overflow-hidden ${fs ? "h-3 max-w-sm bg-white/10" : "h-2 bg-muted"}`}>
          <div className={`h-full rounded-full transition-all ${isLastSeconds ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct * 100}%` }} />
        </div>
      )}

      {/* Round counter */}
      <div className="flex flex-col items-center gap-2">
        <p className={`font-mono uppercase tracking-widest ${fs ? "text-sm text-white/50" : "text-[10px] text-muted-foreground"}`}>Rounds</p>
        <div className="flex items-center gap-5" onClick={fs ? e => e.stopPropagation() : undefined}>
          <Button type="button" variant="outline" size="icon" className={`${fs ? "h-14 w-14 border-white/20 text-white hover:bg-white/10" : "h-9 w-9"}`} onClick={() => setRounds(r => Math.max(0, r - 1))}><Minus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
          <span className={`font-mono font-black tabular-nums text-center ${fs ? "text-7xl w-24 text-white" : "text-5xl w-16"}`}>{rounds}</span>
          <Button type="button" variant="outline" size="icon" className={`${fs ? "h-14 w-14 border-white/20 text-white hover:bg-white/10" : "h-9 w-9"}`} onClick={() => setRounds(r => r + 1)}><Plus className={fs ? "h-6 w-6" : "h-4 w-4"} /></Button>
        </div>
      </div>

      {done && <p className="font-mono text-[10px] text-green-400 uppercase tracking-widest">Time's up — {rounds} rounds ✓</p>}

      {/* Controls */}
      <div className="flex gap-3" onClick={fs ? e => e.stopPropagation() : undefined}>
        {!running && !done && (
          <Button type="button" onClick={handleStart} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Play className="h-4 w-4" />Start
          </Button>
        )}
        {running && (
          <Button type="button" onClick={() => setRunning(false)} variant="outline" className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base border-white/20 text-white hover:bg-white/10" : ""}`}>
            <Square className="h-4 w-4" />Pause
          </Button>
        )}
        {!running && done && (
          <Button type="button" onClick={() => { onSave(rounds, partialReps); }} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            Save
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handleReset} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base border-white/20 text-white hover:bg-white/10" : ""}`}>
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
        tapHint="Tap to add a round"
        onFullscreenChange={onFullscreenChange}
      >
        {timerBody(true)}
      </FullscreenTimerOverlay>
    );
  }

  return timerBody(false);
}

/* ─── EMOM timer: configurable interval that resets until total time is up ─── */
function EmomTimer({ onFullscreenChange }: { onFullscreenChange?: (isFullscreen: boolean) => void }) {
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
        <p className={`font-mono uppercase tracking-widest ${fs ? "text-base text-white/50" : "text-[11px] text-muted-foreground"}`}>
          Interval {currentInterval} / {totalIntervals}
        </p>
      )}

      {/* Interval countdown */}
      <div className={`font-mono font-black tabular-nums tracking-tighter transition-colors ${done ? "text-green-400" : isLastSeconds ? "text-destructive" : running ? "text-primary" : fs ? "text-white" : "text-foreground"} ${fs ? "text-[110px]" : "text-6xl"}`}>
        {fmtTime(intervalSec)}
      </div>

      {/* Progress bar */}
      {(running || done) && (
        <div className={`w-full rounded-full overflow-hidden ${fs ? "h-3 max-w-sm bg-white/10" : "h-2 bg-muted"}`}>
          <div className={`h-full rounded-full transition-all ${isLastSeconds ? "bg-destructive" : "bg-primary"}`} style={{ width: `${pct * 100}%` }} />
        </div>
      )}

      {/* Total remaining */}
      {(running || done) && (
        <p className={`font-mono ${fs ? "text-lg text-white/50" : "text-sm text-muted-foreground"}`}>
          Total remaining: <span className={`font-bold ${fs ? "text-white" : "text-foreground"}`}>{fmtTime(totalSec)}</span>
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
          <Button type="button" onClick={() => setRunning(false)} variant="outline" className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base border-white/20 text-white hover:bg-white/10" : ""}`}>
            <Square className="h-4 w-4" />Pause
          </Button>
        )}
        {!running && !done && intervalSec < intervalMin * 60 && (
          <Button type="button" onClick={() => setRunning(true)} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base" : ""}`}>
            <Play className="h-4 w-4" />Resume
          </Button>
        )}
        <Button type="button" variant="outline" onClick={handleReset} className={`font-mono uppercase gap-2 ${fs ? "h-12 px-8 text-base border-white/20 text-white hover:bg-white/10" : ""}`}>
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
      <FullscreenTimerOverlay onClose={() => setFullscreen(false)} onFullscreenChange={onFullscreenChange}>
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
  const updateLog = useUpdateWorkoutLog();
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
  const [logId, setLogId] = useState<number | null>(null);
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

  /* Cruise Control state */
  const [isCruiseActive, setIsCruiseActive] = useState(false);
  const [cruiseStep, setCruiseStep] = useState<'restInput' | 'setInput' | 'timer' | 'complete'>('restInput');
  const [cruiseExerciseIdx, setCruiseExerciseIdx] = useState(0);
  const [cruiseSetIdx, setCruiseSetIdx] = useState(0);
  const [restSeconds, setRestSeconds] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [isFullscreenTimer, setIsFullscreenTimer] = useState(false);
  const [currentReps, setCurrentReps] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  const [location, setLocation] = useState(() => {
    if (initialTemplate?.type === "cardio") return initialTemplate.location ?? "";
    return "";
  });

  const [amrapRounds, setAmrapRounds] = useState("");
  const [amrapPartialReps, setAmrapPartialReps] = useState("");
  const [emomScore, setEmomScore] = useState("");
  const [rftTime, setRftTime] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDurationSec, setCardioDurationSec] = useState("");
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
      setLocation(templateFromList.location ?? "");
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
      setLocation(fetchedWorkout.location ?? "");
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
          setLocation(w.location ?? "");
        }
      }
    }
  };

  /* Timer effect for Cruise Control */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (timerActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval!);
            timerDone();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, isPaused, timeLeft]);

  /* Wake Lock cleanup */
  useEffect(() => {
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [wakeLock]);

  /* Request wake lock when fullscreen timer is active */
  useEffect(() => {
    if (isFullscreenTimer) {
      requestWakeLock();
    }
  }, [isFullscreenTimer]);

  /* Visibility API: re-request wake lock when page regains focus */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isFullscreenTimer) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isFullscreenTimer]);

  /* Periodic wake lock renewal (every 30 seconds) */
  useEffect(() => {
    if (!isFullscreenTimer) return;

    const interval = setInterval(async () => {
      if (!wakeLock) {
        await requestWakeLock();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isFullscreenTimer, wakeLock]);

  /* Auto-focus on weight input when setInput step is active */
  useEffect(() => {
    if (cruiseStep === 'setInput' && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [cruiseStep]);

  /* Debounced auto-save when form fields change (1 second delay) */
  useEffect(() => {
    // Skip for template-based workouts (they're already saved to a real log)
    if (fromTemplate) return;
    if (!workoutName?.trim()) return; // Don't save empty workouts

    const timeout = setTimeout(() => {
      autoSaveLog();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [bbResults, workoutName, workoutType, loggedAt, notes, rating, location, durationMinutes, amrapRounds, amrapPartialReps, emomScore, rftTime, cardioDistance, cardioDuration, cardioDurationSec, cardioHR, cardioElevation, fromTemplate, workoutName]);

  /* Cruise Control helper functions */
  const playBeep = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAA');
    audio.play().catch(() => {});
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        lock.addEventListener('release', async () => {
          setWakeLock(null);
          // Auto-retry after a short delay if fullscreen timer is still active
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isFullscreenTimer && document.visibilityState === 'visible') {
            await requestWakeLock();
          }
        });
      }
    } catch (err) {
      console.warn('Wake Lock not available:', err);
      // Retry after delay if fullscreen timer is active
      if (isFullscreenTimer) {
        setTimeout(requestWakeLock, 5000);
      }
    }
  };

  const nextSetOrRest = () => {
    const currentExercise = bbResults[cruiseExerciseIdx];
    const nextSet = cruiseSetIdx + 1;
    
    // Check if this is the last set of the last exercise
    const isLastSetOfExercise = nextSet >= currentExercise.sets.length;
    const isLastExercise = cruiseExerciseIdx >= bbResults.length - 1;
    
    if (isLastSetOfExercise && isLastExercise) {
      // No more sets or exercises - workout complete
      setCruiseStep('complete');
      return;
    }
    
    // Always go to timer after a set (unless complete)
    setCruiseStep('timer');
    setTimeLeft(restSeconds);
    setTimerActive(true);
    
    // Prepare for next set
    if (!isLastSetOfExercise) {
      // More sets in current exercise
      setCruiseSetIdx(nextSet);
    } else {
      // Move to next exercise
      setCruiseExerciseIdx(cruiseExerciseIdx + 1);
      setCruiseSetIdx(0);
    }
  };

  const timerDone = () => {
    playBeep();
    setCruiseStep('setInput');
    setTimerActive(false);
    // Pre-fill with existing values from the next set
    if (bbResults.length > 0 && cruiseExerciseIdx < bbResults.length) {
      const nextSet = bbResults[cruiseExerciseIdx].sets[cruiseSetIdx];
      if (nextSet) {
        setCurrentReps(String(nextSet.reps || ''));
        setCurrentWeight(String(nextSet.weight || ''));
      } else {
        setCurrentReps('');
        setCurrentWeight('');
      }
    }
  };

  /* Auto-save for ad-hoc workouts when starting cruise or when fields change */
  const autoSaveLog = async () => {
    if (fromTemplate) return; // Template-based workouts are already saved
    if (!workoutName?.trim()) return; // Don't save empty workouts
    
    try {
      // For cardio, try to geocode location
      let confirmedLocation: string | null = null;
      let weatherJson: string | null = null;
      
      if (workoutType === "cardio" && location.trim()) {
        const result = await geocodeAndWeather(location.trim(), loggedAt);
        if (result) {
          confirmedLocation = result.confirmedLocation;
          weatherJson = result.weatherJson;
        } else {
          confirmedLocation = location.trim();
        }
      }
      
      // If we already have a logId, update the existing log
      if (logId) {
        await updateLog.mutateAsync({
          id: logId,
          data: {
            workoutName,
            workoutType,
            loggedAt: new Date(loggedAt).toISOString(),
            durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
            notes: notes || null,
            results: buildResults(),
            rating,
            location: confirmedLocation || location || null,
            weatherJson,
          }
        });
        toast({ title: 'Auto-saved', description: 'Workout progress saved' });
        return { id: logId };
      }
      
      // Otherwise, create a new log
      const newLog = await createLog.mutateAsync({
        data: {
          workoutName,
          workoutType,
          loggedAt: new Date(loggedAt).toISOString(),
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes || null,
          results: buildResults(),
          rating,
          location: confirmedLocation || location || null,
          weatherJson,
        }
      });
      // Update state to mark as saved - store the logId for future updates
      setLogId(newLog.id);
      // Don't set fromTemplate to true - we want to continue auto-saving updates to this log
      toast({ title: 'Auto-saved', description: 'Workout progress saved' });
      return newLog;
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Don't show toast on every failure to avoid spam
      return null;
    }
  };

  /* Get previous workouts for current exercise */
  const getPreviousWorkoutsForExercise = (exerciseName: string) => {
    if (!allLogs || !exerciseName) return [];
    
    const previousWorkouts: { date: string; rating: number; sets: { reps: number; weight: number }[] }[] = [];
    
    // Filter and process logs
    allLogs
      .filter(log => log.workoutType === "bodybuilding")
      .forEach(log => {
        try {
          const results = JSON.parse(log.results);
          if (!Array.isArray(results)) return;
          
          // Find this exercise in the results
          const exerciseData = results.find((ex: any) => ex.exerciseName === exerciseName);
          if (exerciseData && exerciseData.sets) {
            previousWorkouts.push({
              date: format(parseISO(log.loggedAt), 'MMM dd'),
              rating: log.rating || 0,
              sets: exerciseData.sets
            });
          }
        } catch (e) {
          console.warn('Failed to parse log results:', e);
        }
      });
    
    // Sort by date descending and take last 3
    return previousWorkouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  };

  /* Modified startCruise with auto-save for ad-hoc */
  const startCruise = async () => {
    if (!fromTemplate) {
      await autoSaveLog();
    }
    setCruiseExerciseIdx(0);
    setCruiseSetIdx(0);
    setCruiseStep('setInput');
    // Pre-fill with existing values from the first set
    if (bbResults.length > 0 && bbResults[0].sets.length > 0) {
      setCurrentReps(String(bbResults[0].sets[0].reps || ''));
      setCurrentWeight(String(bbResults[0].sets[0].weight || ''));
    } else {
      setCurrentReps('');
      setCurrentWeight('');
    }
    setTimerActive(false);
    setIsPaused(false);
  };

  const saveSet = () => {
    const reps = parseInt(currentReps) || 0;
    const weight = parseFloat(currentWeight) || 0;
    
    setBbResults(prev => {
      const newResults = [...prev];
      newResults[cruiseExerciseIdx] = {
        ...newResults[cruiseExerciseIdx],
        sets: newResults[cruiseExerciseIdx].sets.map((s, i) => 
          i === cruiseSetIdx ? { reps, weight } : s
        )
      };
      return newResults;
    });
    
    setCurrentReps('');
    setCurrentWeight('');
  };

  const skipSet = () => {
    const nextSet = cruiseSetIdx + 1;
    const currentExercise = bbResults[cruiseExerciseIdx];
    
    const isLastSetOfExercise = nextSet >= currentExercise.sets.length;
    const isLastExercise = cruiseExerciseIdx >= bbResults.length - 1;
    
    if (isLastSetOfExercise && isLastExercise) {
      setCruiseStep('complete');
      return;
    }
    
    // Go directly to next set input
    setCurrentReps('');
    setCurrentWeight('');
    
    if (!isLastSetOfExercise) {
      setCruiseSetIdx(nextSet);
      setCruiseStep('setInput');
    } else {
      setCruiseExerciseIdx(cruiseExerciseIdx + 1);
      setCruiseSetIdx(0);
      setCruiseStep('setInput');
    }
  };

  const skipRest = () => {
    setTimerActive(false);
    // Go directly to next set input (skip the timer)
    // cruiseSetIdx is already the next set index (set by nextSetOrRest)
    setCurrentReps('');
    setCurrentWeight('');
    setCruiseStep('setInput');
  };

  const buildResults = () => {
    const type = workoutType;
    if (type === "bodybuilding") return JSON.stringify(bbResults);
    if (type === "amrap") return JSON.stringify({ rounds: parseInt(amrapRounds) || 0, partialReps: parseInt(amrapPartialReps) || 0, freeText: cfText || undefined });
    if (type === "emom") return JSON.stringify({ score: emomScore, freeText: cfText || undefined });
    if (type === "rft") return JSON.stringify({ time: rftTime, freeText: cfText || undefined });
    if (type === "cardio") return JSON.stringify({ distance: parseFloat(cardioDistance) || 0, duration: (parseInt(cardioDuration) || 0) + (parseInt(cardioDurationSec) || 0) / 60, avgHeartRate: parseInt(cardioHR) || null, elevationGain: parseInt(cardioElevation) || null });
    return "{}";
  };

  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const geocodeAndWeather = async (locationName: string, dateIso: string): Promise<{ confirmedLocation: string; weatherJson: string } | null> => {
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
        { headers: { "Accept-Language": "nl,en" } }
      );
      const geoData = await geoRes.json();
      if (!geoData?.[0]) return null;

      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      const confirmedLocation = geoData[0].display_name as string;

      const date = dateIso.split("T")[0];
      const today = new Date().toISOString().split("T")[0];
      const diffDays = (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);

      const baseUrl = diffDays > 5
        ? "https://archive-api.open-meteo.com/v1/archive"
        : "https://api.open-meteo.com/v1/forecast";

      const wRes = await fetch(
        `${baseUrl}?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,winddirection_10m` +
        `&daily=precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,weathercode` +
        `&start_date=${date}&end_date=${date}&timezone=auto`
      );
      const wData = await wRes.json();
      const d = wData?.daily;

      // Find temperature at the workout hour
      const workoutHour = new Date(dateIso).getHours();
      const hourlyTemps: number[] = wData?.hourly?.temperature_2m ?? [];
      const temp = hourlyTemps[workoutHour] ?? null;

      const weather = {
        temp,
        precipitation: d?.precipitation_sum?.[0] ?? null,
        windspeed: d?.windspeed_10m_max?.[0] ?? null,
        winddir: d?.winddirection_10m_dominant?.[0] ?? null,
        weathercode: d?.weathercode?.[0] ?? null,
      };

      return { confirmedLocation, weatherJson: JSON.stringify(weather) };
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutName) return;
    setIsSubmitting(true);
    try {
      let confirmedLocation: string | null = null;
      let weatherJson: string | null = null;

      if (workoutType === "cardio" && location.trim()) {
        const result = await geocodeAndWeather(location.trim(), loggedAt);
        if (result) {
          confirmedLocation = result.confirmedLocation;
          weatherJson = result.weatherJson;
        } else {
          confirmedLocation = location.trim();
        }
      }

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
          location: confirmedLocation,
          weatherJson,
        }
      });
      queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
      navigate("/log");
    } catch (err: unknown) {
      const msg = (err as { data?: { error?: string }; message?: string })?.data?.error
        ?? (err as { message?: string })?.message
        ?? "Could not save log.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCrossfit = ["amrap", "emom", "rft"].includes(workoutType);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Log Session</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Record your performance</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Template mode: compact header */}
        {fromTemplate ? (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <span className="font-mono font-black text-lg uppercase tracking-tight">{workoutName || "Loading…"}</span>
                {workoutName && <WorkoutBadge type={workoutType} />}
              </div>
              {workoutType === "bodybuilding" && (
                <Button type="button" variant="outline" size="sm" className="font-mono uppercase text-xs gap-1"
                  onClick={() => {
                    if (bbResults.length === 0) {
                      toast({ title: 'No exercises', description: 'Add exercises first', variant: 'destructive' });
                      return;
                    }
                    setIsCruiseActive(true);
                    setCruiseStep('restInput');
                  }}
                >
                  <PlayCircle className="h-3 w-3" /> Cruise
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Logging from template</p>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Date &amp; Time</Label>
                <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Ad-hoc mode: full session info card */
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Session Info</CardTitle>
              {workoutType === "bodybuilding" && (
                <Button type="button" variant="outline" size="sm" className="font-mono uppercase text-xs gap-1"
                  onClick={() => {
                    if (bbResults.length === 0) {
                      toast({ title: 'No exercises', description: 'Add exercises first', variant: 'destructive' });
                      return;
                    }
                    setIsCruiseActive(true);
                    setCruiseStep('restInput');
                  }}
                >
                  <PlayCircle className="h-3 w-3" /> Cruise
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Load from template</Label>
                <WorkoutTemplateSelect
                  workouts={workouts}
                  value={selectedTemplateId}
                  onChange={handleTemplateSelect}
                  placeholder="Select template..."
                />
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
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Date &amp; Time</Label>
                <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
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
              <StopwatchTracker onStop={(rounds, time) => { setRftTime(time); }} onFullscreenChange={setIsFullscreenTimer} />
              <div className="mt-5 border-t border-border pt-4 space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Time (mm:ss)</Label>
                <Input value={rftTime} onChange={e => setRftTime(e.target.value)} placeholder="11:30" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* AMRAP tracker — countdown timer with round counter */}
        {workoutType === "amrap" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">AMRAP Timer</CardTitle>
            </CardHeader>
            <CardContent>
              <AmrapTimer onSave={(r, p) => { setAmrapRounds(r.toString()); setAmrapPartialReps(p.toString()); }} onFullscreenChange={setIsFullscreenTimer} />
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
              <EmomTimer onFullscreenChange={setIsFullscreenTimer} />
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Distance (km)</Label>
                  <Input type="number" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} placeholder="5.0" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Duration (min : sec)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} placeholder="32" className="font-mono" />
                    <span className="font-mono text-muted-foreground font-bold">:</span>
                    <Input type="number" min="0" max="59" value={cardioDurationSec} onChange={e => setCardioDurationSec(e.target.value)} placeholder="00" className="font-mono w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Avg Heart Rate (bpm)</Label>
                  <Input type="number" value={cardioHR} onChange={e => setCardioHR(e.target.value)} placeholder="148" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Elevation (m)</Label>
                  <Input type="number" value={cardioElevation} onChange={e => setCardioElevation(e.target.value)} placeholder="45" className="font-mono" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="font-mono text-xs uppercase tracking-wider">Location</Label>
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Central Park, New York"
                  className="font-mono text-sm"
                />
                <p className="font-mono text-[10px] text-muted-foreground">Weather will be automatically fetched on save.</p>
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
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="transition-colors hover:scale-110">
                    <Star className={`h-6 w-6 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href="/log">
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || createLog.isPending} className="font-mono uppercase tracking-tight">
            {isSubmitting ? "Fetching weather…" : createLog.isPending ? "Saving..." : "Save Log"}
          </Button>
        </div>

        {/* Cruise Control Modal */}
        {isCruiseActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/98 backdrop-blur-sm p-2">
            <button
              type="button"
              onClick={() => setIsCruiseActive(false)}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-full max-w-sm px-2 text-center">
              {/* Rest Input Step */}
              {cruiseStep === 'restInput' && (
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-white">Cruise Control</h2>
                  <p className="text-lg text-gray-300">Set rest time between sets</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[60, 120, 180, 240].map((secs) => (
                      <button
                        key={secs}
                        type="button"
                        onClick={async () => {
                          setRestSeconds(secs);
                          await startCruise();
                        }}
                        className={`text-2xl font-mono py-4 rounded-lg transition-colors ${
                          restSeconds === secs 
                            ? 'bg-white text-black' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {secs / 60}
                        <span className="text-xs block">min</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => setIsCruiseActive(false)}
                    className="text-white/70 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Set Input Step */}
              {cruiseStep === 'setInput' && bbResults.length > 0 && cruiseExerciseIdx < bbResults.length && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white truncate">
                    {bbResults[cruiseExerciseIdx].exerciseName || `Exercise ${cruiseExerciseIdx + 1}`}
                  </h2>
                  <p className="text-lg text-gray-300">
                    Set {cruiseSetIdx + 1} of {bbResults[cruiseExerciseIdx].sets.length}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-base text-gray-300">Reps</Label>
                      <Input
                        type="number"
                        value={currentReps}
                        onChange={(e) => setCurrentReps(e.target.value)}
                        placeholder="10"
                        className="text-center text-2xl font-mono h-16 bg-white text-black border-2 border-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base text-gray-300">Weight (kg)</Label>
                      <Input
                        type="number"
                        value={currentWeight}
                        onChange={(e) => setCurrentWeight(e.target.value)}
                        placeholder="60"
                        className="text-center text-2xl font-mono h-16 bg-white text-black border-2 border-gray-300"
                        ref={weightInputRef}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        saveSet();
                        nextSetOrRest();
                      }}
                      className="flex-1 text-lg py-4"
                    >
                      Save & Rest
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="lg" className="flex-1 text-base bg-white/10 border-white/30 hover:bg-white/20 text-white" onClick={skipSet}>
                      <SkipForward className="h-5 w-5" />
                      <span className="ml-1">Skip</span>
                    </Button>
                  </div>
                  {/* Previous workouts reference */}
                  {allLogs && (
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-xs text-white/60 uppercase tracking-wider mb-2">Previous workouts</p>
                      <div className="space-y-2">
                        {getPreviousWorkoutsForExercise(bbResults[cruiseExerciseIdx].exerciseName).map((workout, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs font-mono text-white/60">
                            <span className="w-20 text-left pt-0.5">{workout.date}</span>
                            <span className="flex-1">
                              {workout.sets.map((s, si) => (
                                <span key={si} className="mr-1">
                                  Set {si + 1}: {s.reps}×{s.weight}kg
                                </span>
                              ))}
                            </span>
                            <span className="flex gap-0.5 pt-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3 w-3 ${n <= workout.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
                                />
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timer Step */}
              {cruiseStep === 'timer' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Rest Time</h2>
                  <p className="text-lg text-gray-300">
                    Next: {cruiseSetIdx < bbResults[cruiseExerciseIdx]?.sets.length
                      ? `Set ${cruiseSetIdx + 1} of ${bbResults[cruiseExerciseIdx].sets.length}`
                      : bbResults[cruiseExerciseIdx + 1]?.exerciseName || 'Next exercise'}
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="bg-white h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${((restSeconds - timeLeft) / restSeconds) * 100}%` }}
                    />
                  </div>
                  
                  <div className="text-7xl font-mono font-bold text-white">
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="lg" className="flex-1 text-base" onClick={() => {
                      setIsPaused(!isPaused);
                    }}>
                      {isPaused ? <Check className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
                      <span className="ml-1">{isPaused ? 'Resume' : 'Pause'}</span>
                    </Button>
                    <Button variant="outline" size="lg" className="flex-1 text-base" onClick={skipRest}>
                      <SkipForward className="h-5 w-5" />
                      <span className="ml-1">Skip</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {cruiseStep === 'complete' && (
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-green-400">Workout Complete! <Check className="h-10 w-10 inline" /></h2>
                  <p className="text-xl text-gray-300">All exercises logged successfully</p>
                  <Button onClick={() => setIsCruiseActive(false)} className="w-full text-lg py-4">
                    Back to Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

      </form>
    </div>
  );
}
