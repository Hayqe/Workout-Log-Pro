import { useState, useMemo } from "react";
import { useListExercises, getListExercisesQueryKey, useCreateExercise, useDeleteExercise, useListWorkoutLogs, getListWorkoutLogsQueryKey, useListWorkouts, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Trash2, Plus, Dumbbell, Search, TrendingUp, ChevronRight, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Hips", "Cardio"];
const CATEGORIES = ["bodybuilding", "crossfit", "cardio"];
const COLORS = ["#84cc16", "#f97316", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6"];

function ExerciseProgress({ exercise, logs }: { exercise: any; logs: any[] | undefined }) {
  const { chartData, repSeries } = useMemo(() => {
    type DataPoint = { date: string; label: string; [key: string]: string | number };
    const progressByReps: Record<number, DataPoint[]> = {};

    if (logs && exercise) {
      for (const log of logs) {
        if (log.workoutType !== "bodybuilding") continue;
        try {
          const results = JSON.parse(log.results as string) as Array<{ exerciseName: string; sets: { reps: number; weight: number }[] }>;
          for (const ex of results) {
            if (ex.exerciseName.toLowerCase() !== exercise.name.toLowerCase()) continue;
            if (!ex.sets?.length) continue;
            const setsByReps: Record<number, number[]> = {};
            for (const s of ex.sets) {
              const r = s.reps || 0;
              if (!setsByReps[r]) setsByReps[r] = [];
              setsByReps[r].push(s.weight || 0);
            }
            const dateStr = log.loggedAt.split("T")[0];
            const label = format(parseISO(dateStr), "MMM d");
            for (const [repsStr, weights] of Object.entries(setsByReps)) {
              const reps = parseInt(repsStr);
              const maxW = Math.max(...weights);
              if (!progressByReps[reps]) progressByReps[reps] = [];
              const existing = progressByReps[reps].find(d => d.date === dateStr);
              if (existing) {
                existing[`${reps}r`] = Math.max(existing[`${reps}r`] as number || 0, maxW);
              } else {
                progressByReps[reps].push({ date: dateStr, label, [`${reps}r`]: maxW });
              }
            }
          }
        } catch {}
      }
    }

    const allDates = [...new Set(
      Object.values(progressByReps).flatMap(pts => pts.map(p => p.date))
    )].sort();
    const repSeries = Object.keys(progressByReps).map(Number).sort((a, b) => a - b);
    const chartData: DataPoint[] = allDates.map(date => {
      const label = format(parseISO(date), "MMM d");
      const point: DataPoint = { date, label };
      for (const reps of repSeries) {
        const found = progressByReps[reps]?.find(p => p.date === date);
        if (found) point[`${reps}r`] = found[`${reps}r`] as number;
      }
      return point;
    });

    return { chartData, repSeries };
  }, [exercise, logs]);

  if (chartData.length === 0) {
    return (
      <div className="py-8 text-center">
        <TrendingUp className="h-7 w-7 text-muted-foreground mx-auto mb-2" />
        <p className="font-mono text-xs text-muted-foreground">No logged sessions yet for this exercise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <TrendingUp className="h-3 w-3" /> Progress — Max Weight per Rep Count
      </p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}kg`} />
          <Tooltip
            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px", fontFamily: "Space Mono, monospace", fontSize: "11px" }}
            formatter={(value, name) => [`${value}kg`, `${String(name).replace("r", "")} reps`]}
          />
          {repSeries.length > 1 && <Legend formatter={name => `${String(name).replace("r", "")} reps`} wrapperStyle={{ fontFamily: "Space Mono, monospace", fontSize: "10px" }} />}
          {repSeries.map((reps, idx) => (
            <Line key={reps} type="monotone" dataKey={`${reps}r`} name={`${reps}r`} stroke={COLORS[idx % COLORS.length]} strokeWidth={2} dot={{ r: 3, fill: COLORS[idx % COLORS.length], strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="space-y-1.5 pt-1 border-t border-border">
        {[...chartData].reverse().map(point => (
          <div key={point.date} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
            <span className="font-mono text-[10px] text-muted-foreground">{format(parseISO(point.date), "EEE, MMM d yyyy")}</span>
            <div className="flex gap-2">
              {repSeries.map(reps => point[`${reps}r`] ? (
                <span key={reps} className="font-mono text-xs">
                  {reps}×<span className="text-primary font-bold">{point[`${reps}r`]}kg</span>
                </span>
              ) : null)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ExercisesPage() {
  const { data: exercises, isLoading } = useListExercises({ query: { queryKey: getListExercisesQueryKey() } });
  const { data: logs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });
  const { data: workouts } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const createExercise = useCreateExercise();
  const deleteExercise = useDeleteExercise();
  const queryClient = useQueryClient();

  const usedExerciseNames = useMemo(() => {
    const names = new Set<string>();
    for (const w of workouts ?? []) {
      try {
        const parsed = JSON.parse(w.exercises);
        if (Array.isArray(parsed)) {
          for (const ex of parsed) {
            if (typeof ex.name === "string") names.add(ex.name.toLowerCase());
          }
        }
      } catch {}
    }
    return names;
  }, [workouts]);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("Chest");
  const [newCategory, setNewCategory] = useState("bodybuilding");
  const [newDesc, setNewDesc] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = (exercises || []).filter(ex => {
    const matchSearch = !search || ex.name.toLowerCase().includes(search.toLowerCase()) || ex.muscleGroup.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "all" || ex.category === filterCategory;
    return matchSearch && matchCat;
  });

  const handleCreate = async () => {
    if (!newName) return;
    await createExercise.mutateAsync({
      data: { name: newName, muscleGroup: newMuscle, category: newCategory, description: newDesc || null }
    });
    queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
    setNewName("");
    setNewDesc("");
    setDialogOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Remove this exercise?")) return;
    try {
      await deleteExercise.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
      if (expandedId === id) setExpandedId(null);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Could not delete exercise.";
      alert(msg);
    }
  };

  const toggleExpand = (id: number) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Exercises</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">{exercises?.length || 0} in library</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono uppercase tracking-tight gap-2"><Plus className="h-4 w-4" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-mono uppercase tracking-tight">New Exercise</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Incline Bench Press" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Muscle Group</Label>
                <Select value={newMuscle} onValueChange={setNewMuscle}>
                  <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>{MUSCLE_GROUPS.map(m => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Category</Label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Description (optional)</Label>
                <Input value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Brief description..." className="font-mono" />
              </div>
              <Button onClick={handleCreate} disabled={!newName || createExercise.isPending} className="w-full font-mono uppercase tracking-tight">
                {createExercise.isPending ? "Adding..." : "Add Exercise"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="font-mono pl-9" />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="font-mono w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="font-mono">All types</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono capitalize">{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-md">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No exercises found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => {
            const isOpen = expandedId === ex.id;
            const isUsed = usedExerciseNames.has(ex.name.toLowerCase());
            return (
              <Card key={ex.id} className={`bg-card border-border transition-all ${isOpen ? "border-primary/40" : "hover:border-primary/20"}`}>
                <div
                  className="w-full cursor-pointer select-none"
                  onClick={() => toggleExpand(ex.id)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-foreground">{ex.name}</span>
                        <WorkoutBadge type={ex.category} />
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                        <span>{ex.muscleGroup}</span>
                        {ex.description && <span className="truncate max-w-[240px]">{ex.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isUsed ? (
                        <div title="Used in a workout template — cannot be deleted" className="h-8 w-8 flex items-center justify-center text-muted-foreground/50">
                          <Lock className="h-4 w-4" />
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDelete(e, ex.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                      <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
                    </div>
                  </CardContent>
                </div>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-4 animate-in slide-in-from-top-2 duration-200">
                    <ExerciseProgress exercise={ex} logs={logs as any} />
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
