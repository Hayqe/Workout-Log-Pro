import { useState } from "react";
import {
  useListWorkouts, useDeleteWorkout, getListWorkoutsQueryKey,
  useListScheduledWorkouts, getListScheduledWorkoutsQueryKey,
  useListWorkoutLogs, getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import type { WorkoutLog } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Trash2, ChevronRight, Dumbbell, Timer, Play, Edit, Lock, Download, History, Star, TrendingUp, Mountain, Bike, Heart } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { useAuth } from "@/contexts/auth-context";
import { KomootImportDialog } from "@/components/komoot-import-dialog";
import { SettingsDialog } from "@/components/settings-dialog";
import { SportTag } from "@/components/ui/sport-tag";

function parseExercises(raw: string) {
  try { return JSON.parse(raw); } catch { return null; }
}

function parseResults(raw: string): Record<string, any> | any[] | null {
  try { return JSON.parse(raw); } catch { return null; }
}

/* ── Result summary helpers ── */

function CardioResultSummary({ results }: { results: Record<string, any> }) {
  const dist = results.distance != null ? `${Number(results.distance).toFixed(1)} km` : null;
  const elev = results.elevationGain != null && results.elevationGain > 0
    ? `↑${Math.round(results.elevationGain)}m`
    : null;
  const hr = results.avgHeartRate != null ? `${Math.round(results.avgHeartRate)} bpm` : null;
  return (
    <span className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
      {dist && <span className="flex items-center gap-1"><Bike className="h-3 w-3" />{dist}</span>}
      {elev && <span className="flex items-center gap-1"><Mountain className="h-3 w-3" />{elev}</span>}
      {hr && <span className="flex items-center gap-1 text-red-400/80"><Heart className="h-3 w-3" />{hr}</span>}
    </span>
  );
}

function BBResultSummary({ results }: { results: any[] }) {
  const totalSets = results.reduce((acc, ex) => {
    if (Array.isArray(ex.sets)) return acc + ex.sets.length;
    if (typeof ex.sets === "number") return acc + ex.sets;
    return acc;
  }, 0);
  const totalVol = results.reduce((acc, ex) => {
    if (Array.isArray(ex.sets)) {
      return acc + ex.sets.reduce((s: number, set: any) => s + (set.reps ?? 0) * (set.weight ?? 0), 0);
    }
    return acc;
  }, 0);
  return (
    <span className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground">
      {totalSets > 0 && <span>{totalSets} sets</span>}
      {totalVol > 0 && <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" />{Math.round(totalVol)} kg</span>}
    </span>
  );
}

function CrossfitResultSummary({ results, log }: { results: Record<string, any> | null; log: WorkoutLog }) {
  const rounds = results && typeof results === "object" && !Array.isArray(results) ? results.rounds ?? results.completed ?? null : null;
  return (
    <span className="text-[11px] font-mono text-muted-foreground">
      {rounds != null ? `${rounds} rounds` : log.durationMinutes ? `${log.durationMinutes} min` : "—"}
    </span>
  );
}

function LogResultSummary({ log }: { log: WorkoutLog }) {
  const parsed = parseResults(log.results);
  if (log.workoutType === "cardio" && parsed && !Array.isArray(parsed)) {
    return <CardioResultSummary results={parsed as Record<string, any>} />;
  }
  if (log.workoutType === "bodybuilding" && Array.isArray(parsed) && parsed.length > 0) {
    return <BBResultSummary results={parsed} />;
  }
  if (["amrap", "emom", "rft"].includes(log.workoutType)) {
    return <CrossfitResultSummary results={parsed as any} log={log} />;
  }
  if (log.durationMinutes) return <span className="text-[11px] font-mono text-muted-foreground">{log.durationMinutes} min</span>;
  return null;
}

/* ── History section ── */

function WorkoutHistory({ logs }: { logs: WorkoutLog[] }) {
  const sorted = [...logs].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt));
  const recent = sorted.slice(0, 8);

  if (recent.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 mb-2">
        <History className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">Geschiedenis</span>
        <span className="font-mono text-[10px] text-muted-foreground/50">({logs.length} {logs.length === 1 ? "log" : "logs"})</span>
      </div>
      {recent.map(log => (
        <div key={log.id} className="flex items-center gap-3 py-1.5 px-3 rounded-sm bg-muted/20 border border-border/40">
          <span className="font-mono text-[11px] text-muted-foreground shrink-0 w-20">
            {format(parseISO(log.loggedAt), "d MMM yyyy", { locale: nl })}
          </span>
          <div className="flex-1 min-w-0 flex items-center gap-3">
            {log.durationMinutes && (
              <span className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
                <Timer className="h-3 w-3" />{log.durationMinutes}m
              </span>
            )}
            <LogResultSummary log={log} />
            {log.notes && (
              <span className="text-[11px] font-mono text-muted-foreground/60 truncate hidden sm:block">{log.notes}</span>
            )}
          </div>
          {log.rating != null && (
            <span className="flex items-center gap-0.5 text-[10px] font-mono text-yellow-400 shrink-0">
              <Star className="h-3 w-3 fill-yellow-400" />{log.rating}
            </span>
          )}
        </div>
      ))}
      {logs.length > 8 && (
        <p className="font-mono text-[10px] text-muted-foreground/50 text-right pt-1">
          +{logs.length - 8} oudere logs
        </p>
      )}
    </div>
  );
}

/* ── Exercise list ── */

function ExerciseList({ type, raw }: { type: string; raw: string }) {
  const parsed = parseExercises(raw);

  if (["amrap", "emom", "rft"].includes(type)) {
    if (parsed?.freeText) {
      return (
        <pre className="font-mono text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-3 leading-relaxed">
          {parsed.freeText}
        </pre>
      );
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return (
        <div className="space-y-1.5">
          {parsed.map((ex: any, i: number) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded border border-border">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                <span className="font-bold text-sm">{ex.name}</span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground flex gap-3">
                {ex.reps_per_round && <span>{ex.reps_per_round}×</span>}
                {ex.distance && <span>{ex.distance}</span>}
                {ex.weight > 0 && <span>{ex.weight} kg</span>}
                {ex.duration && <span>{ex.duration} min</span>}
              </div>
            </div>
          ))}
        </div>
      );
    }
    return (
      <p className="font-mono text-sm text-muted-foreground italic">No whiteboard content</p>
    );
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return <p className="font-mono text-sm text-muted-foreground italic">No exercises defined.</p>;
  }

  return (
    <div className="space-y-1.5">
      {parsed.map((ex: any, i: number) => (
        <div key={i} className="flex items-center justify-between py-2 px-3 rounded border border-border">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
            <span className="font-bold text-sm">{ex.name}</span>
          </div>
          <div className="font-mono text-[11px] text-muted-foreground flex gap-3">
            {ex.sets && <span>{ex.sets}×</span>}
            {ex.reps && <span>{ex.reps} reps</span>}
            {ex.weight > 0 && <span>{ex.weight} kg</span>}
            {ex.reps_per_round && <span>{ex.reps_per_round} reps/rd</span>}
            {ex.distance && <span>{ex.distance}{type === "cardio" ? " km" : ""}</span>}
            {ex.duration && <span>{ex.duration} min</span>}
            {ex.zone && ex.zone !== "none" && <span className="text-primary">{ex.zone}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkoutsPage() {
  const { user } = useAuth();
  const { data: workouts, isLoading } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const { data: scheduled } = useListScheduledWorkouts(undefined, { query: { queryKey: getListScheduledWorkoutsQueryKey({}) } });
  const { data: allLogs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });
  const deleteWorkout = useDeleteWorkout();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [komootOpen, setKomootOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const futureScheduledWorkoutIds = new Set(
    (scheduled ?? [])
      .filter((s) => s.scheduledDate >= today)
      .map((s) => s.workoutId)
      .filter((id): id is number => id != null)
  );

  const logsByWorkoutId = (allLogs ?? []).reduce<Record<number, WorkoutLog[]>>((acc, log) => {
    if (log.workoutId != null) {
      (acc[log.workoutId] ??= []).push(log);
    }
    return acc;
  }, {});

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this workout template?")) return;
    try {
      await deleteWorkout.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Could not delete workout.";
      alert(msg);
    }
  };

  const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Workouts</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">All workout templates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="font-mono uppercase tracking-tight gap-2 text-muted-foreground" onClick={() => setKomootOpen(true)}>
            <Download className="h-4 w-4" /> Komoot Import
          </Button>
          <Link href="/workouts/new">
            <Button className="font-mono uppercase tracking-tight gap-2">
              <Plus className="h-4 w-4" /> New
            </Button>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : workouts?.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-md">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No workout templates yet.</p>
          <Link href="/workouts/new">
            <Button variant="outline" className="mt-4 font-mono uppercase tracking-tight">Create First Workout</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {workouts?.map((workout) => {
            const isOpen = expandedId === workout.id;
            const isOwner = workout.userId === user?.id;
            const isLocked = futureScheduledWorkoutIds.has(workout.id);
            const logs = logsByWorkoutId[workout.id] ?? [];

            return (
              <Card key={workout.id} className={`bg-card border-border transition-all ${isOpen ? "border-primary/40" : "hover:border-primary/20"}`}>
                <div
                  className="w-full cursor-pointer select-none"
                  onClick={() => toggleExpand(workout.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                        <span className="font-bold text-foreground">{workout.name}</span>
                        <WorkoutBadge type={workout.type} />
                        {workout.type === "cardio" && workout.sport && (
                          <SportTag sport={workout.sport} />
                        )}
                        {!isOwner && (
                          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-border rounded px-1.5 py-0.5">shared</span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        {workout.description && <span className="truncate max-w-[280px]">{workout.description}</span>}
                        {workout.duration && (
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {workout.duration} min</span>
                        )}
                        {workout.rounds && <span>{workout.rounds} rounds</span>}
                        {logs.length > 0 && (
                          <span className="flex items-center gap-1 text-primary/70">
                            <History className="h-3 w-3" />{logs.length}×
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isOwner && (
                        isLocked ? (
                          <div title="Scheduled for upcoming workouts — cannot be deleted" className="h-8 w-8 flex items-center justify-center text-muted-foreground/50">
                            <Lock className="h-4 w-4" />
                          </div>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => handleDelete(e, workout.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )
                      )}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </div>
                  </CardContent>
                </div>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    {logs.length > 0 && <WorkoutHistory logs={logs} />}

                    <ExerciseList type={workout.type} raw={workout.exercises} />

                    <div className="flex gap-2 pt-1">
                      <Link href={`/log/new?workoutId=${workout.id}`} className="flex-1">
                        <Button className="w-full font-mono uppercase tracking-tight gap-2 text-sm">
                          <Play className="h-3.5 w-3.5" /> Log Workout
                        </Button>
                      </Link>
                      {isOwner && (
                        <Link href={`/workouts/${workout.id}/edit`}>
                          <Button variant="outline" className="font-mono uppercase tracking-tight gap-2 text-sm">
                            <Edit className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <KomootImportDialog
        open={komootOpen}
        onOpenChange={setKomootOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
