import { useState } from "react";
import { useCreateWorkout, getListWorkoutsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExerciseAutocomplete } from "@/components/ui/exercise-autocomplete";
import { ArrowLeft, Plus, X } from "lucide-react";
import { Link } from "wouter";

const WORKOUT_TYPES = [
  { value: "bodybuilding", label: "Bodybuilding" },
  { value: "amrap", label: "AMRAP" },
  { value: "emom", label: "EMOM" },
  { value: "rft", label: "RFT (Rounds For Time)" },
  { value: "cardio", label: "Cardio" },
];

const ZONES = ["Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"];

type Exercise = {
  name: string;
  sets?: number;
  reps?: number;
  maxReps?: boolean;
  weight?: number;
  reps_per_round?: number;
  distance?: string;
  duration?: number;
  zone?: string;
};

export default function WorkoutNewPage() {
  const [, navigate] = useLocation();
  const createWorkout = useCreateWorkout();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState("bodybuilding");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [rounds, setRounds] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([{ name: "" }]);
  const [cfDescription, setCfDescription] = useState("");

  const handleAddExercise = () => setExercises([...exercises, { name: "" }]);
  const handleRemoveExercise = (i: number) => setExercises(exercises.filter((_, idx) => idx !== i));
  const updateExercise = (i: number, field: string, value: string | number | boolean) => {
    setExercises(exercises.map((ex, idx) => idx === i ? { ...ex, [field]: value } : ex));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !type) return;

    const isCrossfit = ["amrap", "emom", "rft"].includes(type);
    const exercisesJson = isCrossfit
      ? JSON.stringify({ freeText: cfDescription })
      : JSON.stringify(exercises.filter(ex => ex.name.trim()));

    await createWorkout.mutateAsync({
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
    navigate("/workouts");
  };

  const isBodybuilding = type === "bodybuilding";
  const isCrossfit = ["amrap", "emom", "rft"].includes(type);
  const isCardio = type === "cardio";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/workouts">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">New Workout</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Create a template</p>
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
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Push Day A"
                required
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WORKOUT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="font-mono">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Description (optional)</Label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description..."
                className="font-mono text-sm resize-none"
                rows={2}
              />
            </div>

            {(type === "amrap" || type === "emom") && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Duration (minutes)</Label>
                <Input
                  type="number"
                  value={duration}
                  onChange={e => setDuration(e.target.value)}
                  placeholder="20"
                  className="font-mono"
                />
              </div>
            )}
            {type === "rft" && (
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Number of Rounds</Label>
                <Input
                  type="number"
                  value={rounds}
                  onChange={e => setRounds(e.target.value)}
                  placeholder="3"
                  className="font-mono"
                />
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
                      value={ex.name}
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
                    <div className="space-y-2 pl-6">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Sets</Label>
                          <Input type="number" value={ex.sets || ""} onChange={e => updateExercise(i, "sets", parseInt(e.target.value))} placeholder="4" className="font-mono h-8 mt-1" />
                        </div>
                        <div>
                          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            {ex.maxReps ? "Min Reps" : "Reps"}
                          </Label>
                          <Input type="number" value={ex.reps || ""} onChange={e => updateExercise(i, "reps", parseInt(e.target.value))} placeholder="8" className="font-mono h-8 mt-1" />
                        </div>
                        <div>
                          <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Weight (kg)</Label>
                          <Input type="number" value={ex.weight || ""} onChange={e => updateExercise(i, "weight", parseFloat(e.target.value))} placeholder="leave empty" className="font-mono h-8 mt-1" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`maxreps-${i}`}
                          checked={!!ex.maxReps}
                          onChange={e => updateExercise(i, "maxReps", e.target.checked)}
                          className="accent-primary h-3.5 w-3.5"
                        />
                        <label htmlFor={`maxreps-${i}`} className="font-mono text-[10px] uppercase text-muted-foreground cursor-pointer">
                          Max reps (last set)
                        </label>
                      </div>
                    </div>
                  )}
                  {isCardio && (
                    <div className="grid grid-cols-3 gap-2 pl-6">
                      <div>
                        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Distance</Label>
                        <Input value={ex.distance || ""} onChange={e => updateExercise(i, "distance", e.target.value)} placeholder="5km" className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Duration (min)</Label>
                        <Input type="number" value={ex.duration || ""} onChange={e => updateExercise(i, "duration", parseInt(e.target.value))} placeholder="30" className="font-mono h-8 mt-1" />
                      </div>
                      <div>
                        <Label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Zone</Label>
                        <Select value={ex.zone || ""} onValueChange={val => updateExercise(i, "zone", val)}>
                          <SelectTrigger className="font-mono h-8 mt-1 text-xs">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="" className="font-mono text-xs">None</SelectItem>
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
          <Link href="/workouts">
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Cancel</Button>
          </Link>
          <Button type="submit" disabled={createWorkout.isPending} className="font-mono uppercase tracking-tight">
            {createWorkout.isPending ? "Saving..." : "Save Template"}
          </Button>
        </div>
      </form>
    </div>
  );
}
