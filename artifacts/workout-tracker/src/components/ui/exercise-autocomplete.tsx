import { useState, useRef, useEffect } from "react";
import { useListExercises, getListExercisesQueryKey, useCreateExercise } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Check } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  category?: string;
};

export function ExerciseAutocomplete({ value, onChange, placeholder = "Exercise name", className = "", category = "bodybuilding" }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: exercises } = useListExercises({ query: { queryKey: getListExercisesQueryKey() } });
  const createExercise = useCreateExercise();

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = (exercises || []).filter(ex =>
    !query || ex.name.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8);

  const exactMatch = (exercises || []).some(ex => ex.name.toLowerCase() === query.toLowerCase());
  const showQuickAdd = query.trim().length > 1 && !exactMatch;

  const handleSelect = (name: string) => {
    setQuery(name);
    onChange(name);
    setOpen(false);
  };

  const handleQuickAdd = async () => {
    if (!query.trim()) return;
    const muscles = { bodybuilding: "Full Body", crossfit: "Full Body", cardio: "Cardio" };
    await createExercise.mutateAsync({
      data: {
        name: query.trim(),
        muscleGroup: muscles[category as keyof typeof muscles] || "Full Body",
        category,
        description: null,
      }
    });
    queryClient.invalidateQueries({ queryKey: getListExercisesQueryKey() });
    onChange(query.trim());
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <input
        value={query}
        onChange={e => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={`w-full bg-background border border-border rounded-md px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all ${className}`}
      />

      {open && (filtered.length > 0 || showQuickAdd) && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg overflow-hidden max-h-56 overflow-y-auto">
          {filtered.map(ex => (
            <button
              key={ex.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); handleSelect(ex.name); }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors text-left"
            >
              <span className="font-mono text-sm text-foreground">{ex.name}</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase">{ex.muscleGroup}</span>
            </button>
          ))}
          {showQuickAdd && (
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); handleQuickAdd(); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-primary/10 transition-colors text-left border-t border-border"
            >
              <Plus className="h-3 w-3 text-primary shrink-0" />
              <span className="font-mono text-sm text-primary">Add "{query.trim()}" to library</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
