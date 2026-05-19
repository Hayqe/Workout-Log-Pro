"use client"

import { useState, useMemo } from "react"
import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover"
import { WorkoutBadge } from "./workout-badge"

interface Workout {
  id: number
  name: string
  type: string
}

interface WorkoutTemplateSelectProps {
  workouts: Workout[] | undefined
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"]

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  bodybuilding: "BB",
  amrap: "AMRAP",
  emom: "EMOM",
  rft: "RFT",
  cardio: "Cardio",
}

export function WorkoutTemplateSelect({
  workouts,
  value,
  onChange,
  placeholder = "Select template...",
  className,
}: WorkoutTemplateSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedType, setSelectedType] = useState<string | null>(null)

  // Filter workouts based on search query and selected type
  const filteredWorkouts = useMemo(() => {
    if (!workouts) return []
    
    return workouts.filter((w) => {
      const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = selectedType ? w.type === selectedType : true
      return matchesSearch && matchesType
    })
  }, [workouts, searchQuery, selectedType])

  // Get count of workouts per type for filter badges
  const typeCounts = useMemo(() => {
    if (!workouts) return {}
    
    const counts: Record<string, number> = {}
    WORKOUT_TYPES.forEach(type => {
      counts[type] = workouts.filter(w => w.type === type).length
    })
    return counts
  }, [workouts])

  const selectedWorkout = useMemo(() => {
    return workouts?.find(w => w.id.toString() === value)
  }, [workouts, value])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-mono h-9", className)}
        >
          {selectedWorkout ? (
            <span className="flex items-center gap-2 truncate">
              <WorkoutBadge type={selectedWorkout.type} />
              {selectedWorkout.name}
            </span>
          ) : (
            placeholder
          )}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        {/* Search input */}
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 font-mono text-sm h-8"
            />
          </div>
        </div>

        {/* Type filters */}
        <div className="p-2 border-b flex gap-1 flex-wrap">
          {WORKOUT_TYPES.map((type) => {
            const count = typeCounts[type] || 0
            if (count === 0) return null
            
            return (
              <Button
                key={type}
                variant={selectedType === type ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className="font-mono text-xs h-6 px-2"
              >
                {WORKOUT_TYPE_LABELS[type] || type} ({count})
              </Button>
            )
          })}
        </div>

        {/* Workout list with scrolling */}
        <div className="max-h-[300px] overflow-y-auto">
          {filteredWorkouts.length > 0 ? (
            filteredWorkouts.map((workout) => (
              <div
                key={workout.id}
                onClick={() => {
                  onChange(workout.id.toString())
                  setOpen(false)
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-3 py-2 text-sm font-mono cursor-pointer hover:bg-muted",
                  value === workout.id.toString() && "bg-muted"
                )}
              >
                <WorkoutBadge type={workout.type} />
                <span className="truncate">{workout.name}</span>
              </div>
            ))
          ) : (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground font-mono">
              No templates found
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
