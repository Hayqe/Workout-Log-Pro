import { useState } from "react";
import { useListWorkoutLogs, getListWorkoutLogsQueryKey, useDeleteWorkoutLog } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Plus, ChevronRight, Trash2, Clock, Star, History, Bike, Heart, Mountain, Timer } from "lucide-react";
import { format } from "date-fns";

function LogDetail({ log }: { log: any }) {
  let results: any = {};
  try { results = JSON.parse(log.results); } catch {}

  const isBb = log.workoutType === "bodybuilding";
  const isCf = ["amrap", "emom", "rft"].includes(log.workoutType);
  const isCardio = log.workoutType === "cardio";

  return (
    <div className="border-t border-border px-4 pb-4 pt-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
      {/* Meta pills */}
      <div className="flex flex-wrap gap-2">
        {log.durationMinutes && (
          <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded px-2.5 py-1">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs font-bold">{log.durationMinutes} min</span>
          </div>
        )}
        {log.rating && (
          <div className="flex items-center gap-0.5 bg-muted/40 border border-border rounded px-2.5 py-1">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-3 w-3 ${i < log.rating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Bodybuilding */}
      {isBb && Array.isArray(results) && results.length > 0 && (
        <div className="space-y-3">
          {results.map((ex: any, i: number) => (
            <div key={i} className="space-y-1.5">
              <p className="font-bold text-sm">{ex.exerciseName}</p>
              <div className="space-y-1 pl-4">
                {ex.sets?.map((set: any, si: number) => (
                  <div key={si} className="flex items-center gap-4 font-mono text-sm">
                    <span className="text-muted-foreground text-[11px] w-10">Set {si + 1}</span>
                    <span>{set.reps} reps</span>
                    {set.weight > 0 && <span className="text-primary font-bold">{set.weight} kg</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CrossFit */}
      {isCf && (
        <div className="grid grid-cols-2 gap-3 font-mono">
          {results.rounds != null && (
            <div className="bg-muted/30 rounded p-3">
              <p className="text-muted-foreground text-[10px] uppercase mb-1">Rounds</p>
              <p className="text-2xl font-black text-primary">{results.rounds}</p>
            </div>
          )}
          {results.partialReps != null && results.partialReps > 0 && (
            <div className="bg-muted/30 rounded p-3">
              <p className="text-muted-foreground text-[10px] uppercase mb-1">+ Reps</p>
              <p className="text-2xl font-black">{results.partialReps}</p>
            </div>
          )}
          {results.time && (
            <div className="bg-muted/30 rounded p-3 col-span-2">
              <p className="text-muted-foreground text-[10px] uppercase mb-1">Time</p>
              <p className="text-3xl font-black text-primary">{results.time}</p>
            </div>
          )}
          {results.score && (
            <div className="bg-muted/30 rounded p-3 col-span-2">
              <p className="text-muted-foreground text-[10px] uppercase mb-1">Score / Weight</p>
              <p className="text-xl font-black">{results.score}</p>
            </div>
          )}
        </div>
      )}

      {/* Cardio */}
      {isCardio && (
        <div className="grid grid-cols-2 gap-3 font-mono">
          {results.distance != null && (
            <div className="bg-muted/30 rounded p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase mb-1"><Bike className="h-3 w-3" /> Distance</div>
              <p className="text-2xl font-black text-primary">{results.distance}<span className="text-sm ml-1">km</span></p>
            </div>
          )}
          {results.duration != null && (
            <div className="bg-muted/30 rounded p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase mb-1"><Timer className="h-3 w-3" /> Duration</div>
              <p className="text-2xl font-black">{results.duration}<span className="text-sm ml-1">min</span></p>
            </div>
          )}
          {results.avgHeartRate != null && (
            <div className="bg-muted/30 rounded p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase mb-1"><Heart className="h-3 w-3" /> Avg HR</div>
              <p className="text-2xl font-black">{results.avgHeartRate}<span className="text-sm ml-1">bpm</span></p>
            </div>
          )}
          {results.elevationGain != null && (
            <div className="bg-muted/30 rounded p-3">
              <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase mb-1"><Mountain className="h-3 w-3" /> Elevation</div>
              <p className="text-2xl font-black">{results.elevationGain}<span className="text-sm ml-1">m</span></p>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {log.notes && (
        <div className="bg-muted/20 rounded p-3 border border-border">
          <p className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Notes</p>
          <p className="font-mono text-sm text-foreground">{log.notes}</p>
        </div>
      )}
    </div>
  );
}

export default function LogListPage() {
  const { data: logs, isLoading } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });
  const deleteLog = useDeleteWorkoutLog();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this log entry?")) return;
    await deleteLog.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
    if (expandedId === id) setExpandedId(null);
  };

  const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Log Book</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">{(logs?.length || 0)} sessions recorded</p>
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
        <div className="space-y-2">
          {sortedLogs.map((log) => {
            const isOpen = expandedId === log.id;
            return (
              <Card key={log.id} className={`bg-card border-border transition-all ${isOpen ? "border-primary/40" : "hover:border-primary/20"}`}>
                <div
                  className="w-full cursor-pointer select-none"
                  onClick={() => toggleExpand(log.id)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-bold text-foreground">{log.workoutName}</span>
                        <WorkoutBadge type={log.workoutType} />
                        {log.rating && (
                          <div className="flex items-center gap-0.5">
                            <Star className="h-3 w-3 text-yellow-500 fill-current" />
                            <span className="font-mono text-xs text-yellow-500">{log.rating}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                        <span>{format(new Date(log.loggedAt), "EEE, MMM d yyyy")}</span>
                        {log.durationMinutes && (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {log.durationMinutes}m</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDelete(e, log.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </div>
                  </CardContent>
                </div>

                {isOpen && <LogDetail log={log} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
