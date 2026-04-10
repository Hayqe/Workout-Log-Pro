import { useListWorkouts, useDeleteWorkout, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, Trash2, ChevronRight, Dumbbell, Timer } from "lucide-react";

export default function WorkoutsPage() {
  const { data: workouts, isLoading } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const deleteWorkout = useDeleteWorkout();
  const queryClient = useQueryClient();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this workout template?")) return;
    await deleteWorkout.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
  };

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
        <div className="space-y-3">
          {workouts?.map((workout) => (
            <Card key={workout.id} className="bg-card border-border hover:border-primary/30 transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-foreground">{workout.name}</span>
                    <WorkoutBadge type={workout.type} />
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    {workout.description && <span className="truncate max-w-[300px]">{workout.description}</span>}
                    {workout.duration && (
                      <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> {workout.duration} min</span>
                    )}
                    {workout.rounds && (
                      <span>{workout.rounds} rounds</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(workout.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link href={`/workouts/${workout.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
