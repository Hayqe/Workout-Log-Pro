import { useListWorkoutLogs, getListWorkoutLogsQueryKey, useDeleteWorkoutLog } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, ChevronRight, Trash2, Clock, Star, History } from "lucide-react";
import { format } from "date-fns";

export default function LogListPage() {
  const { data: logs, isLoading } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });
  const deleteLog = useDeleteWorkoutLog();
  const queryClient = useQueryClient();

  const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this log entry?")) return;
    await deleteLog.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Log Book</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            {(logs?.length || 0)} sessions recorded
          </p>
        </div>
        <Link href="/log/new">
          <Button className="font-mono uppercase tracking-tight gap-2">
            <Plus className="h-4 w-4" /> Log Session
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : sortedLogs.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-md">
          <History className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No logged sessions yet.</p>
          <Link href="/log/new">
            <Button variant="outline" className="mt-4 font-mono uppercase tracking-tight">Log Your First Workout</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedLogs.map((log) => (
            <Card key={log.id} className="bg-card border-border hover:border-primary/20 transition-all">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-bold text-foreground">{log.workoutName}</span>
                    <WorkoutBadge type={log.workoutType} />
                    {log.rating && (
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Star className="h-3 w-3 fill-current" />
                        <span className="font-mono text-xs">{log.rating}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
                    <span>{format(new Date(log.loggedAt), "EEE, MMM d yyyy")}</span>
                    {log.durationMinutes && (
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {log.durationMinutes}m</span>
                    )}
                    {log.notes && <span className="truncate max-w-[200px]">{log.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(log.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <Link href={`/log/${log.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
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
