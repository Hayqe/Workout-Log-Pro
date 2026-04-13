import { useState } from "react";
import {
  useListScheduledWorkouts, getListScheduledWorkoutsQueryKey,
  useCreateScheduledWorkout, useDeleteScheduledWorkout,
  useListWorkouts, getListWorkoutsQueryKey,
  useListWorkoutLogs, getListWorkoutLogsQueryKey,
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
import { ChevronLeft, ChevronRight, Plus, Trash2, Globe, Lock, Check } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, isToday } from "date-fns";
import { useLocation } from "wouter";

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"];

const TYPE_CHIP: Record<string, { label: string; bg: string; text: string }> = {
  bodybuilding: { label: "BB",  bg: "bg-blue-900/60",   text: "text-blue-300" },
  amrap:        { label: "AM",  bg: "bg-orange-900/60", text: "text-orange-300" },
  emom:         { label: "EM",  bg: "bg-purple-900/60", text: "text-purple-300" },
  rft:          { label: "RFT", bg: "bg-red-900/60",    text: "text-red-300" },
  cardio:       { label: "CA",  bg: "bg-green-900/60",  text: "text-green-300" },
};

function WorkoutTypeChip({ type, done }: { type: string; done: boolean }) {
  const chip = TYPE_CHIP[type] ?? { label: type.slice(0, 2).toUpperCase(), bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1 py-0 font-mono text-[8px] font-bold leading-4 ${chip.bg} ${chip.text} ${done ? "opacity-60" : ""} w-full justify-center`}>
      {done ? "✓" : chip.label}
    </span>
  );
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWorkoutName, setNewWorkoutName] = useState("");
  const [newWorkoutType, setNewWorkoutType] = useState("bodybuilding");
  const [newWorkoutId, setNewWorkoutId] = useState<string>("");
  const [newNotes, setNewNotes] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: scheduled } = useListScheduledWorkouts(undefined, { query: { queryKey: getListScheduledWorkoutsQueryKey({}) } });
  const { data: workouts } = useListWorkouts({ query: { queryKey: getListWorkoutsQueryKey() } });
  const { data: allLogs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });
  const createScheduled = useCreateScheduledWorkout();
  const deleteScheduled = useDeleteScheduledWorkout();

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const firstDayOfWeek = (startOfMonth(currentMonth).getDay() + 6) % 7;

  const getScheduledForDay = (day: Date) =>
    (scheduled || []).filter(s => {
      try { return isSameDay(parseISO(s.scheduledDate), day); } catch { return false; }
    });

  const getUserLog = (workoutId: number | null | undefined, dateStr: string) => {
    if (!workoutId) return null;
    return (allLogs || []).find((log: any) =>
      log.workoutId === workoutId && (log.loggedAt || "").split("T")[0] === dateStr
    ) ?? null;
  };

  const getAdHocLogsForDay = (day: Date) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const scheduledWorkoutIds = new Set(
      getScheduledForDay(day).map(s => s.workoutId).filter(Boolean)
    );
    return (allLogs || []).filter((log: any) => {
      const logDate = (log.loggedAt || "").split("T")[0];
      return logDate === dateStr && !scheduledWorkoutIds.has(log.workoutId);
    });
  };

  const isOwn = (s: { userId?: number | null }) => s.userId === user?.id;

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
    setAddOpen(false);
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

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await deleteScheduled.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListScheduledWorkoutsQueryKey({}) });
  };

  const handleRowClick = (href: string) => {
    setDialogOpen(false);
    navigate(href);
  };

  const selectedDateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedDayScheduled = selectedDate ? getScheduledForDay(selectedDate) : [];
  const selectedAdHocLogs = selectedDate ? getAdHocLogsForDay(selectedDate) : [];

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
              const dayStr = format(day, "yyyy-MM-dd");
              const dayScheduled = getScheduledForDay(day);
              const adHocLogs = getAdHocLogsForDay(day);
              const hasWorkout = dayScheduled.length > 0 || adHocLogs.length > 0;
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
                    <div className="mt-0.5 flex flex-col gap-0.5 w-full items-center">
                      {dayScheduled.slice(0, 2).map(s => {
                        const logged = !!getUserLog(s.workoutId, dayStr);
                        return <WorkoutTypeChip key={s.id} type={s.workoutType} done={logged} />;
                      })}
                      {adHocLogs.slice(0, 2).map((log: any) => (
                        <span key={log.id} className="inline-flex items-center rounded px-1 py-0 font-mono text-[8px] font-bold leading-4 bg-green-900/70 text-green-300 w-full justify-center">✓</span>
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
            {(selectedDayScheduled.length > 0 || selectedAdHocLogs.length > 0) && (
              <div className="space-y-2">
                <p className="font-mono text-xs uppercase text-muted-foreground">Workouts this day</p>

                {selectedDayScheduled.map(s => {
                  const own = isOwn(s);
                  const pub = (s as any).isPublic;
                  const log = getUserLog(s.workoutId, selectedDateStr);
                  const logged = !!log;
                  const rowHref = logged
                    ? `/log/${(log as any).id}`
                    : s.workoutId
                      ? `/log/new?workoutId=${s.workoutId}`
                      : null;

                  return (
                    <div
                      key={s.id}
                      onClick={() => rowHref && handleRowClick(rowHref)}
                      className={`flex items-center justify-between p-3 rounded border transition-all
                        ${rowHref ? "cursor-pointer hover:bg-muted/40" : ""}
                        ${logged ? "border-green-500/30 bg-green-500/5" : own ? "border-border" : "border-muted-foreground/30 bg-muted/20"}
                      `}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-bold text-sm ${logged ? "text-muted-foreground" : ""}`}>{s.workoutName}</span>
                          <WorkoutBadge type={s.workoutType} />
                          {!own && pub && (
                            <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-muted-foreground border border-muted-foreground/30 rounded px-1 py-0.5">
                              <Globe className="h-2.5 w-2.5" /> Public
                            </span>
                          )}
                          {logged && (
                            <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-green-500 border border-green-500/30 rounded px-1 py-0.5">
                              <Check className="h-2.5 w-2.5" /> Done
                            </span>
                          )}
                        </div>
                        {s.notes && <p className="text-xs text-muted-foreground font-mono mt-1">{s.notes}</p>}
                      </div>
                      <div className="flex gap-1 shrink-0 ml-2" onClick={e => e.stopPropagation()}>
                        {own && (
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => handleDelete(e, s.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                        {rowHref && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 px-2 font-mono text-[10px] uppercase ${logged ? "text-muted-foreground" : "text-primary"}`}
                            onClick={() => handleRowClick(rowHref)}
                          >
                            {logged ? "View" : "Log"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {selectedAdHocLogs.map((log: any) => (
                  <div
                    key={log.id}
                    onClick={() => handleRowClick(`/log/${log.id}`)}
                    className="flex items-center justify-between p-3 rounded border border-green-500/30 bg-green-500/5 cursor-pointer hover:bg-green-500/10 transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-muted-foreground">{log.workoutName || "Workout"}</span>
                        {log.workoutType && <WorkoutBadge type={log.workoutType} />}
                        <span className="flex items-center gap-1 text-[9px] font-mono uppercase text-green-500 border border-green-500/30 rounded px-1 py-0.5">
                          <Check className="h-2.5 w-2.5" /> Done
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 font-mono text-[10px] uppercase text-muted-foreground"
                      onClick={() => handleRowClick(`/log/${log.id}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setAddOpen(o => !o)}
                className="w-full flex items-center justify-between py-1 font-mono text-xs uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                <span>Plan workout</span>
                <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-200 ${addOpen ? "rotate-90" : ""}`} />
              </button>
              {addOpen && (
              <div className="space-y-3 mt-3">
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
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
