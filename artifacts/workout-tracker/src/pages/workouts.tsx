import { useState } from "react";
import { useListWorkouts, useDeleteWorkout, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Trash2, ChevronRight, Dumbbell, Timer, Play, Edit, ClipboardList } from "lucide-react";

function parseExercises(raw: string) {
  try { return JSON.parse(raw); } catch { return null; }
}

function ExerciseList({ type, raw }: { type: string; raw: string }) {
  const parsed = parseExercises(raw);

  if (["amrap", "emom", "rft"].includes(type)) {
    const text = parsed?.freeText || raw;
    return (
      <pre className="font-mono text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-3 leading-relaxed">
        {text || <span className="text-muted-foreground italic">No whiteboard content</span>}
      </pre>
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
            {ex.distance && <span>{ex.distance}</span>}
            {ex.duration && <span>{ex.duration} min</span>}
            {ex.zone && ex.zone !== "none" && <span className="text-primary">{ex.zone}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function WorkoutsPage() {
  const { data: workouts, isLoading } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const deleteWorkout = useDeleteWorkout();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this workout template?")) return;
    await deleteWorkout.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    if (expandedId === id) setExpandedId(null);
  };

  const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Workouts</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Your template library</p>
        </div>
        <Link href="/workouts/new">
          <Button className="font-mono uppercase tracking-tight gap-2">
            <Plus className="h-4 w-4" /> New
          </Button>
        </Link>
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
            return (
              <Card key={workout.id} className={`bg-card border-border transition-all ${isOpen ? "border-primary/40" : "hover:border-primary/20"}`}>
                {/* Clickable row header */}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => toggleExpand(workout.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="font-bold text-foreground">{workout.name}</span>
                        <WorkoutBadge type={workout.type} />
                      </div>
                      <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                        {workout.description && <span className="truncate max-w-[280px]">{workout.description}</span>}
                        {workout.duration && (
                          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {workout.duration} min</span>
                        )}
                        {workout.rounds && <span>{workout.rounds} rounds</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(e, workout.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </div>
                  </CardContent>
                </button>

                {/* Expandable detail panel */}
                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                    <ExerciseList type={workout.type} raw={workout.exercises} />

                    <div className="flex gap-2 pt-1">
                      <Link href={`/log/new?workoutId=${workout.id}`} className="flex-1">
                        <Button className="w-full font-mono uppercase tracking-tight gap-2 text-sm">
                          <Play className="h-3.5 w-3.5" /> Log Workout
                        </Button>
                      </Link>
                      <Link href={`/workouts/${workout.id}/edit`}>
                        <Button variant="outline" className="font-mono uppercase tracking-tight gap-2 text-sm">
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
