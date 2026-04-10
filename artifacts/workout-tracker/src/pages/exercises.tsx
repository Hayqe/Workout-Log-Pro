import { useState } from "react";
import { useListExercises, getListExercisesQueryKey, useCreateExercise, useDeleteExercise } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Trash2, Plus, Dumbbell, Search, TrendingUp } from "lucide-react";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Legs", "Arms", "Core", "Full Body", "Hips", "Cardio"];
const CATEGORIES = ["bodybuilding", "crossfit", "cardio"];

export default function ExercisesPage() {
  const { data: exercises, isLoading } = useListExercises({ query: { queryKey: getListExercisesQueryKey() } });
  const createExercise = useCreateExercise();
  const deleteExercise = useDeleteExercise();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newMuscle, setNewMuscle] = useState("Chest");
  const [newCategory, setNewCategory] = useState("bodybuilding");
  const [newDesc, setNewDesc] = useState("");

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
    await deleteExercise.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Exercises</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">{exercises?.length || 0} in library</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="font-mono uppercase tracking-tight gap-2">
              <Plus className="h-4 w-4" /> Add
            </Button>
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
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-md">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">No exercises found.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((ex) => (
            <Card
              key={ex.id}
              className="bg-card border-border cursor-pointer hover:border-primary/50 hover:bg-card/80 transition-all group"
              onClick={() => navigate(`/exercises/${ex.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-foreground group-hover:text-primary transition-colors">{ex.name}</span>
                    <WorkoutBadge type={ex.category} />
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground">
                    <span>{ex.muscleGroup}</span>
                    {ex.description && <span className="truncate max-w-[300px]">{ex.description}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(e, ex.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
