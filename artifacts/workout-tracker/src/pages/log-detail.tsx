import { useRoute, Link, useLocation } from "wouter";
import { useGetWorkoutLog, getGetWorkoutLogQueryKey, useDeleteWorkoutLog, getListWorkoutLogsQueryKey, useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { SportTag } from "@/components/ui/sport-tag";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, Clock, Star, Bike, Heart, Mountain, Timer } from "lucide-react";
import { format } from "date-fns";

export default function LogDetailPage() {
  const [, params] = useRoute("/log/:id");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: log, isLoading } = useGetWorkoutLog(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutLogQueryKey(id) }
  });
  const deleteLog = useDeleteWorkoutLog();

  const handleDelete = async () => {
    if (!confirm("Delete this log entry?")) return;
    await deleteLog.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
    navigate("/log");
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!log) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground font-mono">Log not found.</p>
      <Link href="/log"><Button variant="outline" className="mt-4 font-mono uppercase">Back to Log Book</Button></Link>
    </div>
  );

  const { data: linkedWorkout } = useGetWorkout(log.workoutId ?? 0, {
    query: { enabled: !!log.workoutId, queryKey: getGetWorkoutQueryKey(log.workoutId ?? 0) }
  });

  let results: any = {};
  try { results = JSON.parse(log.results); } catch {}

  let templateExercises: any[] = [];
  if (linkedWorkout?.exercises) {
    try {
      const parsed = JSON.parse(linkedWorkout.exercises);
      if (Array.isArray(parsed)) templateExercises = parsed;
    } catch {}
  }

  const isBb = log.workoutType === "bodybuilding";
  const isCf = ["amrap", "emom", "rft"].includes(log.workoutType);
  const isCardio = log.workoutType === "cardio";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/log">
            <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-mono font-black tracking-tighter uppercase text-foreground">{log.workoutName}</h1>
              <WorkoutBadge type={log.workoutType} />
              {log.workoutType === "cardio" && log.sport && (
                <SportTag sport={log.sport} />
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm">{format(new Date(log.loggedAt), "EEEE, MMMM d yyyy — HH:mm")}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        {log.durationMinutes && (
          <div className="flex items-center gap-2 bg-card border border-border rounded px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-bold">{log.durationMinutes} min</span>
          </div>
        )}
        {log.rating && (
          <div className="flex items-center gap-1 bg-card border border-border rounded px-3 py-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < log.rating! ? "text-yellow-400 fill-current" : "text-muted-foreground"}`} />
            ))}
          </div>
        )}
      </div>

      {isBb && Array.isArray(results) && results.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Sets &amp; Reps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((ex: any, i: number) => (
              <div key={i} className="space-y-2">
                <p className="font-bold text-sm">{ex.exerciseName}</p>
                <div className="space-y-1 pl-4">
                  {ex.sets?.map((set: any, si: number) => (
                    <div key={si} className="flex items-center gap-4 font-mono text-sm">
                      <span className="text-muted-foreground text-xs w-12">Set {si + 1}</span>
                      <span className="text-foreground">{set.reps} reps</span>
                      {set.weight > 0 && <span className="text-primary font-bold">{set.weight} kg</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isCf && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{log.workoutType.toUpperCase()} Results</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 font-mono">
            {results.roundsCompleted != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Rounds</p>
                <p className="text-2xl font-black text-primary">{results.roundsCompleted}</p>
              </div>
            )}
            {results.rounds != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Rounds</p>
                <p className="text-2xl font-black text-primary">{results.rounds}</p>
              </div>
            )}
            {results.totalTime != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Total Time (min)</p>
                <p className="text-2xl font-black">{results.totalTime}</p>
              </div>
            )}
            {results.timeCap != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Time Cap (min)</p>
                <p className="text-2xl font-black">{results.timeCap}</p>
              </div>
            )}
            {results.time && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs uppercase">Time</p>
                <p className="text-3xl font-black text-primary">{results.time}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isCardio && templateExercises.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Trainingsplan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {templateExercises.map((ex: any, i: number) => (
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

      {isCardio && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Cardio Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
            {results.distance != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Bike className="h-3 w-3" /> Distance</div>
                <p className="text-2xl font-black text-primary">{results.distance}<span className="text-sm ml-1">km</span></p>
              </div>
            )}
            {results.duration != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Timer className="h-3 w-3" /> Duration</div>
                <p className="text-2xl font-black">{results.duration}<span className="text-sm ml-1">min</span></p>
              </div>
            )}
            {results.avgHeartRate != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Heart className="h-3 w-3" /> Avg HR</div>
                <p className="text-2xl font-black">{results.avgHeartRate}<span className="text-sm ml-1">bpm</span></p>
              </div>
            )}
            {results.elevationGain != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Mountain className="h-3 w-3" /> Elevation</div>
                <p className="text-2xl font-black">{results.elevationGain}<span className="text-sm ml-1">m</span></p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {log.notes && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-muted-foreground">{log.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
