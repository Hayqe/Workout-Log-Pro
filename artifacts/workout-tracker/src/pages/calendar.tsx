import { useState } from "react";
import {
  useListScheduledWorkouts, getListScheduledWorkoutsQueryKey,
  useCreateScheduledWorkout, useUpdateScheduledWorkout, useDeleteScheduledWorkout,
  useListWorkouts, getListWorkoutsQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Globe, Lock } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, isToday } from "date-fns";
import { Link } from "wouter";

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"];

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [newWorkoutType, setNewWorkoutType] = useState("bodybuilding");
  const [newWorkoutId, setNewWorkoutId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: scheduled } = useListScheduledWorkouts(undefined, { query: { queryKey: getListScheduledWorkoutsQueryKey({}) } });
  const { data: workouts } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const createScheduled = useCreateScheduledWorkout();
  const updateScheduled = useUpdateScheduledWorkout();
  const deleteScheduled = useDeleteScheduledWorkout();

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7;

  const getScheduledForDay = (day: Date) => {
    return (scheduled || []).filter(s => {
      try { return isSameDay(parseISO(s.scheduledDate), day); } catch { return false; }
    });
  };

  const isOwn = (s: { userId?: number | null }) => s.userId === user?.id;

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
    setNewWorkoutName("");
    setNewWorkoutType("bodybuilding");
    setNewWorkoutId("");
    setNewNotes("");
    setNewIsPublic(false);
  };

  const handleWorkoutSelect = (wId: string) => {
    setNewWorkoutId(wId);
    if (wId && workouts) {
      const w = workouts.find(w => w.id.toString() === wId);
      if (w) {
        setNewWorkoutName(w.name);
        setNewWorkoutType(w.type);
      }
    }
  };

  const handleSchedule = async () => {
    if (!selectedDate || !newWorkoutName) return;
    await createScheduled.mutateAsync({
      data: {
        workoutId: newWorkoutId ? parseInt(newWorkoutId) : null,
        workoutName: newWorkoutName,
        workoutType: newWorkoutType,
        scheduledDate: format(selectedDate, "yyyy-MM-dd"),
        notes: newNotes || null,
        isPublic: newIsPublic,
      }
    });
    queryClient.invalidateQueries({ queryKey: getListScheduledWorkoutsQueryKey({}) });
    setNewWorkoutName("");
    setNewWorkoutId("");
  };

  const handleToggleDone = async (id: number, completed: boolean) => {
    await updateScheduled.mutateAsync({ id, data: { completed: !completed } });
    queryClient.invalidateQueries({ queryKey: getListScheduledWorkoutsQueryKey({}) });
  };

  const handleDelete = async (id: number) => {
    await deleteScheduled.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListScheduledWorkoutsQueryKey({}) });
  };

  const selectedDayScheduled = selectedDate ? getScheduledForDay(selectedDate) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Calendar</h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">Plan your training week</p>
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <CardTitle className="font-mono text-base uppercase tracking-wider">{format(currentMonth, "MMMM yyyy")}</CardTitle>
          <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 mb-2">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map(d => (
              <div key={d} className="text-center text-[10px] font-mono uppercase text-muted-foreground py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {[...Array(firstDayOfWeek)].map((_, i) => <div key={`empty-${i}`} />)}
            {days.map(day => {
              const dayScheduled = getScheduledForDay(day);
              const hasWorkout = dayScheduled.length > 0;
              const allDone = hasWorkout && dayScheduled.every(s => s.completed);
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => handleDayClick(day)}
                  className={`aspect-square flex flex-col items-center justify-start p-1 rounded text-sm font-mono transition-all hover:bg-muted/50 relative
                    ${today ? "ring-1 ring-primary" : ""}
                    ${selectedDate && isSameDay(day, selectedDate) ? "bg-primary/10" : ""}
                  `}
                >
                  <span className={`text-[11px] font-bold ${today ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                  {hasWorkout && (
                    <div className="mt-0.5 flex flex-wrap gap-0.5 justify-center">
                      {dayScheduled.slice(0, 3).map(s => (
                        <div key={s.id} className={`h-1.5 w-1.5 rounded-full ${allDone ? "bg-green-500" : isOwn(s) ? "bg-primary" : "bg-muted-foreground"}`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-mono uppercase tracking-tight">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d") : ""}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedDayScheduled.length > 0 && (
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase text-muted-foreground">Scheduled</p>
                {selectedDayScheduled.map(s => {
                  const own = isOwn(s);
                  const pub = (s as any).isPublic;
                  return (
                    <div key={s.id} className={`flex items-center justify-between p-3 rounded border ${s.completed ? "border-green-500/30 bg-green-500/5" : own ? "border-border" : "border-muted-foreground/30 bg-muted/20"}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${s.completed ? "line-through text-muted-foreground" : ""}`}>{s.workoutName}</span>
                          <WorkoutBadge type={s.workoutType} />
                          {pub && (
                            <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted-foreground border border-muted-foreground/30 rounded px-1 py-0.5">
                              <Globe className="h-2.5 w-2.5" /> Public
                            </span>
                          )}
                          {!own && (
                            <span className="text-[9px] font-mono uppercase text-muted-foreground">shared</span>
                          )}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground font-mono mt-1">{s.notes}</p>}
                      </div>
                      {own && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className={`h-7 w-7 ${s.completed ? "text-green-500" : "text-muted-foreground"}`} onClick={() => handleToggleDone(s.id, s.completed)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          {!s.completed && (
                            <Link href={`/log/new?scheduledId=${s.id}&workoutId=${s.workoutId || ""}`}>
                              <Button variant="ghost" size="sm" className="h-7 px-2 font-mono text-[10px] uppercase text-primary">
                                Log
                              </Button>
                            </Link>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-border">
              <p className="font-mono text-xs uppercase text-muted-foreground">Add workout</p>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">From template</Label>
                <Select value={newWorkoutId} onValueChange={handleWorkoutSelect}>
                  <SelectTrigger className="font-mono"><SelectValue placeholder="Select template..." /></SelectTrigger>
                  <SelectContent>
                    {workouts?.map(w => (
                      <SelectItem key={w.id} value={w.id.toString()} className="font-mono">{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Or custom name</Label>
                <Input value={newWorkoutName} onChange={e => setNewWorkoutName(e.target.value)} placeholder="Workout name" className="font-mono" />
              </div>
              {!newWorkoutId && (
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Type</Label>
                  <Select value={newWorkoutType} onValueChange={setNewWorkoutType}>
                    <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WORKOUT_TYPES.map(t => <SelectItem key={t} value={t} className="font-mono capitalize">{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Notes</Label>
                <Input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Optional notes..." className="font-mono" />
              </div>

              <div className="flex items-center gap-3 py-1">
                <button
                  type="button"
                  onClick={() => setNewIsPublic(false)}
                  className={`flex items-center gap-2 flex-1 p-2.5 rounded border font-mono text-xs uppercase transition-all ${!newIsPublic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                >
                  <Lock className="h-3.5 w-3.5" /> Only me
                </button>
                <button
                  type="button"
                  onClick={() => setNewIsPublic(true)}
                  className={`flex items-center gap-2 flex-1 p-2.5 rounded border font-mono text-xs uppercase transition-all ${newIsPublic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-muted-foreground/50"}`}
                >
                  <Globe className="h-3.5 w-3.5" /> Everyone
                </button>
              </div>

              <Button
                onClick={handleSchedule}
                disabled={!newWorkoutName || createScheduled.isPending}
                className="w-full font-mono uppercase tracking-tight gap-2"
              >
                <Plus className="h-4 w-4" /> Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
