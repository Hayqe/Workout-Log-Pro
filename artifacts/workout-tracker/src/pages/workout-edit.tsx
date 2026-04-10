import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useGetWorkout, getGetWorkoutQueryKey, useUpdateWorkout, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ExerciseAutocomplete } from "@/components/ui/exercise-autocomplete";
import { ArrowLeft, Plus, X } from "lucide-react";

const WORKOUT_TYPES = [
  { value: "bodybuilding", label: "Bodybuilding" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "rft", label: "RFT (Rounds For Time)" },
  { value: "cardio", label: "Cardio" },
];

const ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

export default function WorkoutEditPage() {
  const [, params] = useRoute("/workouts/:id/edit");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: workout, isLoading } = useGetWorkout(id, { query: { enabled: !!id, queryKey: getGetWorkoutQueryKey(id) } });
  const updateWorkout = useUpdateWorkout();

  const [name, setName] = useState("");
  const [type, setType] = useState("bodybuilding");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [rounds, setRounds] = useState("");
  const [exercises, setExercises] = useState<any[]>([{ name: "" }]);
  const [cfDescription, setCfDescription] = useState("");

  useEffect(() => {
    if (workout) {
      setName(workout.name);
      setType(workout.type);
      setDescription(workout.description || "");
      setDuration(workout.duration?.toString() || "");
      setRounds(workout.rounds?.toString() || "");
      try {
        const parsed = JSON.parse(workout.exercises);
        if (Array.isArray(parsed)) {
          setExercises(parsed);
        } else if (parsed?.freeText !== undefined) {
          setCfDescription(parsed.freeText);
        }
      } catch {}
    }
  }, [workout]);

  const handleAddExercise = () => setExercises([...exercises, { name: "" }]);
  const handleRemoveExercise = (i: number) => setExercises(exercises.filter((_, idx) => idx !== i));
  const updateExercise = (i: number, field: string, value: any) => {
    setExercises(exercises.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCf = ["amrap", "emom", "rft"].includes(type);
    const exercisesJson = isCf
      ? JSON.stringify({ freeText: cfDescription })
      : JSON.stringify(exercises.filter(ex => ex.name?.trim()));

    await updateWorkout.mutateAsync({
      id,
      data: {
        name,
        type,
        description: description || null,
        duration: duration ? parseInt(duration) : null,
        rounds: rounds ? parseInt(rounds) : null,
        exercises: exercisesJson,
      }
    });
    queryClient.invalidateQueries({ queryKey: getListWorkoutsQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetWorkoutQueryKey(id) });
    navigate(`/workouts/${id}`);
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;

  const isBodybuilding = type === "bodybuilding";
  const isCrossfit = ["amrap", "emom", "rft"].includes(type);
  const isCardio = type === "cardio";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/workouts/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Edit Workout</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Workout Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} required className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WORKOUT_TYPES.map(t => <SelectItem key={t.value} value={t.value} className="font-mono">{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} className="font-mono text-sm resize-none" rows={2} />
            </div>
            {(type === "amrap" || type === "emom") && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Duration (minutes)</Label>
                <Input type="number" value={duration} onChange={e => setDuration(e.target.value)} className="font-mono" />
              </div>
            )}
            {type === "rft" && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Rounds</Label>
                <Input type="number" value={rounds} onChange={e => setRounds(e.target.value)} className="font-mono" />
              </div>
            )}
          </CardContent>
        </Card>

        {isCrossfit && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Workout Description</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={cfDescription}
                onChange={e => setCfDescription(e.target.value)}
                placeholder={"Write the workout as you would on a whiteboard:\n\n21-15-9\nThrusters 43kg\nPull-ups"}
                className="font-mono text-sm resize-none"
                rows={6}
              />
              <p className="font-mono text-[10px] text-muted-foreground">Free format — movements, reps, weights, rest intervals</p>
            </CardContent>
          </Card>
        )}

        {(isBodybuilding || isCardio) && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">
                {isBodybuilding ? "Movements" : "Activities"}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleAddExercise} className="font-mono uppercase text-xs gap-1">
                <Plus className="h-3 w-3" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {exercises.map((ex, i) => (
                <div key={i} className="space-y-3 p-4 rounded border border-border bg-background/50">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground w-4">{i + 1}</span>
                    <ExerciseAutocomplete
                      value={ex.name || ""}
                      onChange={val => updateExercise(i, "name", val)}
                      category={isBodybuilding ? "bodybuilding" : "cardio"}
                      placeholder={isBodybuilding ? "Exercise name" : "e.g. Cycling, Running"}
                    />
                    {exercises.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveExercise(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {isBodybuilding && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Sets</Label>
                        <Input type="number" value={ex.sets || ""} onChange={e => updateExercise(i, "sets", parseInt(e.target.value))} className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Reps</Label>
                        <Input type="number" value={ex.reps || ""} onChange={e => updateExercise(i, "reps", parseInt(e.target.value))} className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Weight (kg)</Label>
                        <Input type="number" value={ex.weight || ""} onChange={e => updateExercise(i, "weight", parseFloat(e.target.value))} className="font-mono h-8 mt-1" />
                      </div>
                    </div>
                  )}
                  {isCardio && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Distance</Label>
                        <Input value={ex.distance || ""} onChange={e => updateExercise(i, "distance", e.target.value)} className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Duration (min)</Label>
                        <Input type="number" value={ex.duration || ""} onChange={e => updateExercise(i, "duration", parseInt(e.target.value))} className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase text-muted-foreground">Zone</Label>
                        <Select value={ex.zone || "none"} onValueChange={val => updateExercise(i, "zone", val === "none" ? "" : val)}>
                          <SelectTrigger className="font-mono h-8 mt-1 text-xs">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" className="font-mono text-xs">None</SelectItem>
                            {ZONES.map(z => <SelectItem key={z} value={z} className="font-mono text-xs">{z}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link href={`/workouts/${id}`}>
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Cancel</Button>
          </Link>
          <Button type="submit" disabled={updateWorkout.isPending} className="font-mono uppercase tracking-tight">
            {updateWorkout.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
