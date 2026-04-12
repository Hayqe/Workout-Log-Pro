import { useState, useEffect } from "react";
import { useCreateExercise, getListExercisesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Hips", "Cardio"];
const CATEGORIES = ["bodybuilding", "crossfit", "cardio"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName?: string;
  initialCategory?: string;
  onCreated?: (name: string) => void;
}

export function NewExerciseDialog({ open, onOpenChange, initialName = "", initialCategory = "bodybuilding", onCreated }: Props) {
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState("Chest");
  const [category, setCategory] = useState(initialCategory);
  const [desc, setDesc] = useState("");

  const createExercise = useCreateExercise();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setName(initialName);
      setCategory(initialCategory);
      setMuscle("Chest");
      setDesc("");
    }
  }, [open, initialName, initialCategory]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createExercise.mutateAsync({
      data: { name: name.trim(), muscleGroup: muscle, category, description: desc.trim() || null }
    });
    queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
    onCreated?.(name.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="font-mono uppercase tracking-tight">New Exercise</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Incline Bench Press"
              className="font-mono"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">Muscle Group</Label>
            <Select value={muscle} onValueChange={setMuscle}>
              <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>{MUSCLE_GROUPS.map(m => <SelectItem key={m} value={m} className="font-mono">{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-mono capitalize">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">Description (optional)</Label>
            <Input
              value={desc}
              onChange={e => setDesc(e.target.value)}
              placeholder="Brief description..."
              className="font-mono"
            />
          </div>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createExercise.isPending}
            className="w-full font-mono uppercase tracking-tight"
          >
            {createExercise.isPending ? "Adding..." : "Add Exercise"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
