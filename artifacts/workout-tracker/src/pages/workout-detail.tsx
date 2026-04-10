import { useRoute, Link, useLocation } from "wouter";
import { useGetWorkout, getGetWorkoutQueryKey, useDeleteWorkout, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Edit, Trash2, Play, Timer } from "lucide-react";

export default function WorkoutDetailPage() {
  const [, params] = useRoute("/workouts/:id");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: workout, isLoading } = useGetWorkout(id, { query: { enabled: !!id, queryKey: getGetWorkoutQueryKey(id) } });
  const deleteWorkout = useDeleteWorkout();

  const handleDelete = async () => {
    if (!confirm("Delete this workout template?")) return;
    await deleteWorkout.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    navigate("/workouts");
  };

  let exercises: any[] = [];
  let cfFreeText = "";
  try {
    const parsed = workout ? JSON.parse(workout.exercises) : [];
    if (Array.isArray(parsed)) {
      exercises = parsed;
    } else if (parsed && typeof parsed === "object" && parsed.freeText) {
      cfFreeText = parsed.freeText;
    }
  } catch {}

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-60 w-full" />
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground font-mono">Workout not found.</p>
        <Link href="/workouts"><Button variant="outline" className="mt-4 font-mono uppercase">Back to Workouts</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/workouts">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-mono font-black tracking-tighter uppercase text-foreground">{workout.name}</h1>
              <WorkoutBadge type={workout.type} />
            </div>
            {workout.description && <p className="text-muted-foreground font-mono text-sm">{workout.description}</p>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/workouts/${id}/edit`}>
            <Button variant="outline" size="icon" className="h-8 w-8"><Edit className="h-4 w-4" /></Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Info</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-6 flex-wrap text-sm font-mono">
          <div>
            <span className="text-muted-foreground uppercase text-xs">Type</span>
            <div className="mt-1"><WorkoutBadge type={workout.type} /></div>
          </div>
          {workout.duration && (
            <div>
              <span className="text-muted-foreground uppercase text-xs">Duration</span>
              <div className="font-bold flex items-center gap-1 mt-1"><Timer className="h-3 w-3" /> {workout.duration} min</div>
            </div>
          )}
          {workout.rounds && (
            <div>
              <span className="text-muted-foreground uppercase text-xs">Rounds</span>
              <div className="font-bold mt-1">{workout.rounds}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Movements</CardTitle>
        </CardHeader>
        <CardContent>
          {cfFreeText ? (
            <pre className="font-mono text-sm text-foreground whitespace-pre-wrap leading-relaxed">{cfFreeText}</pre>
          ) : exercises.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm">No exercises defined.</p>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded border border-border">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                    <span className="font-bold text-sm">{ex.name}</span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground flex gap-3">
                    {ex.sets && <span>{ex.sets} sets</span>}
                    {ex.reps && <span>{ex.reps} reps</span>}
                    {ex.weight > 0 && <span>{ex.weight} kg</span>}
                    {ex.reps_per_round && <span>{ex.reps_per_round} reps/rd</span>}
                    {ex.distance && <span>{ex.distance}</span>}
                    {ex.duration && <span>{ex.duration} min</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href={`/log/new?workoutId=${id}`} className="flex-1">
          <Button className="w-full font-mono uppercase tracking-tight gap-2">
            <Play className="h-4 w-4" /> Log This Workout
          </Button>
        </Link>
      </div>
    </div>
  );
}
