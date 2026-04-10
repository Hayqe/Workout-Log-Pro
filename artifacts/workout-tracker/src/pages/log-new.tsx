import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
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
import { ArrowLeft, Star, Plus, X, History } from "lucide-react";
import { format, parseISO } from "date-fns";

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"];

type ExerciseResult = {
  exerciseName: string;
  sets: { reps: number; weight: number }[];
};

type PrevSet = { reps: number; weight: number };
type PrevMap = Record<string, { sets: PrevSet[]; date: string }>;

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
        if (!map[key]) {
          map[key] = { sets: ex.sets, date: log.loggedAt.split("T")[0] };
        }
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

export default function LogNewPage() {
  const [location, navigate] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] || "");
  const workoutIdFromUrl = params.get("workoutId");

  const queryClient = useQueryClient();
  const createLog = useCreateWorkoutLog();
  const { data: workouts } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const { data: allLogs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });

  const prevMap = useMemo(() => buildPrevMap(allLogs), [allLogs]);

  const selectedWorkoutId = workoutIdFromUrl ? parseInt(workoutIdFromUrl) : 0;
  const { data: templateWorkout } = useGetWorkout(selectedWorkoutId, {
    query: { enabled: !!selectedWorkoutId, queryKey: getGetWorkoutQueryKey(selectedWorkoutId) }
  });

  const [selectedTemplateId, setSelectedTemplateId] = useState(workoutIdFromUrl || "");
  const [workoutName, setWorkoutName] = useState(templateWorkout?.name || "");
  const [workoutType, setWorkoutType] = useState(templateWorkout?.type || "bodybuilding");
  const [loggedAt, setLoggedAt] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(4);

  const [bbResults, setBbResults] = useState<ExerciseResult[]>([
    { exerciseName: "", sets: [{ reps: 0, weight: 0 }] }
  ]);

  const [cfRoundsCompleted, setCfRoundsCompleted] = useState("");
  const [cfTime, setCfTime] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioHR, setCardioHR] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");

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
            if (exs.length > 0) {
              setBbResults(exs.map((ex: any) => ({
                exerciseName: ex.name,
                sets: Array.from({ length: ex.sets || 3 }, () => ({ reps: ex.reps || 0, weight: ex.weight || 0 }))
              })));
            }
          } catch {}
        }
      }
    }
  };

  const buildResults = () => {
    const type = workoutType;
    if (type === "bodybuilding") return JSON.stringify(bbResults);
    if (type === "amrap") return JSON.stringify({ roundsCompleted: parseInt(cfRoundsCompleted) || 0, totalTime: parseInt(cfTime) || 0 });
    if (type === "emom") return JSON.stringify({ rounds: parseInt(cfRoundsCompleted) || 0, timeCap: parseInt(cfTime) || 0 });
    if (type === "rft") return JSON.stringify({ time: cfTime });
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
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setBbResults(bbResults.filter((_, ri) => ri !== i))}>
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
                        {ex.sets.length > 1 && <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.filter((_, sj) => sj !== si) } : r))}><X className="h-3 w-3" /></Button>}
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

        {(workoutType === "amrap" || workoutType === "emom") && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{workoutType.toUpperCase()} Results</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">{workoutType === "amrap" ? "Rounds Completed" : "Rounds"}</Label>
                <Input type="number" value={cfRoundsCompleted} onChange={e => setCfRoundsCompleted(e.target.value)} placeholder="14" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">{workoutType === "amrap" ? "Total Time (min)" : "Time Cap (min)"}</Label>
                <Input type="number" value={cfTime} onChange={e => setCfTime(e.target.value)} placeholder="20" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

        {workoutType === "rft" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">RFT Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Total Time (mm:ss)</Label>
                <Input value={cfTime} onChange={e => setCfTime(e.target.value)} placeholder="11:30" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

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
