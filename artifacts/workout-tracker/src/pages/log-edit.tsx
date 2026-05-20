import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// Type for Wake Lock API
declare global {
  interface WakeLockSentinel {
    release: () => Promise<void>;
    addEventListener: (type: string, listener: EventListener) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  }
  interface Navigator {
    wakeLock?: {
      request: (type: string) => Promise<WakeLockSentinel>;
    };
  }
}
import {
  useGetWorkoutLog,
  getGetWorkoutLogQueryKey,
  useUpdateWorkoutLog,
  getListWorkoutLogsQueryKey,
  useListWorkoutLogs,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, Plus, X, MapPin, PlayCircle, PauseCircle, SkipForward, Check } from "lucide-react";
import { format, parseISO } from "date-fns";

const WORKOUT_TYPES = ["bodybuilding", "amrap", "emom", "rft", "cardio"];

type ExerciseResult = { exerciseName: string; sets: { reps: number; weight: number }[] };

async function geocodeAndWeather(
  locationName: string,
  dateIso: string
): Promise<{ confirmedLocation: string; weatherJson: string } | null> {
  try {
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const geoData = await geoRes.json();
    if (!geoData?.[0]) return null;

    const lat = parseFloat(geoData[0].lat);
    const lon = parseFloat(geoData[0].lon);
    const confirmedLocation = geoData[0].display_name as string;

    const date = dateIso.split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    const diffDays = (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
    const baseUrl = diffDays > 5
      ? "https://archive-api.open-meteo.com/v1/archive"
      : "https://api.open-meteo.com/v1/forecast";

    const wRes = await fetch(
      `${baseUrl}?latitude=${lat}&longitude=${lon}` +
      `&hourly=temperature_2m,winddirection_10m` +
      `&daily=precipitation_sum,windspeed_10m_max,winddirection_10m_dominant,weathercode` +
      `&start_date=${date}&end_date=${date}&timezone=auto`
    );
    const wData = await wRes.json();
    const d = wData?.daily;
    const workoutHour = new Date(dateIso).getHours();
    const hourlyTemps: number[] = wData?.hourly?.temperature_2m ?? [];
    const temp = hourlyTemps[workoutHour] ?? null;

    return {
      confirmedLocation,
      weatherJson: JSON.stringify({
        temp,
        precipitation: d?.precipitation_sum?.[0] ?? null,
        windspeed: d?.windspeed_10m_max?.[0] ?? null,
        winddir: d?.winddirection_10m_dominant?.[0] ?? null,
        weathercode: d?.weathercode?.[0] ?? null,
      }),
    };
  } catch {
    return null;
  }
}

export default function LogEditPage() {
  const [, params] = useRoute("/log/:id/edit");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: log, isLoading } = useGetWorkoutLog(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutLogQueryKey(id) },
  });
  const updateLog = useUpdateWorkoutLog();
  const { data: allLogs } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });

  /* ─── form state ─── */
  const [workoutName, setWorkoutName] = useState("");
  const [workoutType, setWorkoutType] = useState("bodybuilding");
  const [loggedAt, setLoggedAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(4);

  /* type-specific */
  const [bbResults, setBbResults] = useState<ExerciseResult[]>([]);
  const [amrapRounds, setAmrapRounds] = useState("");
  const [amrapPartialReps, setAmrapPartialReps] = useState("");
  const [emomScore, setEmomScore] = useState("");
  const [rftTime, setRftTime] = useState("");
  const [cardioDistance, setCardioDistance] = useState("");
  const [cardioDuration, setCardioDuration] = useState("");
  const [cardioDurationSec, setCardioDurationSec] = useState("");
  const [cardioHR, setCardioHR] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");
  const [cfText, setCfText] = useState("");

  /* location / weather */
  const [location, setLocation] = useState("");
  const [originalLocation, setOriginalLocation] = useState("");
  const [originalWeatherJson, setOriginalWeatherJson] = useState<string | null>(null);

  /* Cruise Control state */
  const [isCruiseActive, setIsCruiseActive] = useState(false);
  const [cruiseStep, setCruiseStep] = useState<'restInput' | 'setInput' | 'timer' | 'complete'>('restInput');
  const [cruiseExerciseIdx, setCruiseExerciseIdx] = useState(0);
  const [cruiseSetIdx, setCruiseSetIdx] = useState(0);
  const [restSeconds, setRestSeconds] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [isFullscreenTimer, setIsFullscreenTimer] = useState(false);
  const [currentReps, setCurrentReps] = useState('');
  const [currentWeight, setCurrentWeight] = useState('');
  const weightInputRef = useRef<HTMLInputElement>(null);

  /* Get previous workouts for current exercise */
  const getPreviousWorkoutsForExercise = (exerciseName: string) => {
    if (!allLogs || !exerciseName) return [];
    
    const previousWorkouts: { date: string; rating: number; sets: { reps: number; weight: number }[] }[] = [];
    
    // Filter out the current log
    const otherLogs = allLogs.filter(l => l.id !== id);
    
    otherLogs
      .filter(log => log.workoutType === "bodybuilding")
      .forEach(log => {
        try {
          const results = JSON.parse(log.results);
          if (!Array.isArray(results)) return;
          
          // Find this exercise in the results
          const exerciseData = results.find((ex: any) => ex.exerciseName === exerciseName);
          if (exerciseData && exerciseData.sets) {
            previousWorkouts.push({
              date: format(parseISO(log.loggedAt), 'MMM dd'),
              rating: log.rating || 0,
              sets: exerciseData.sets
            });
          }
        } catch (e) {
          console.warn('Failed to parse log results:', e);
        }
      });
    
    // Sort by date descending and take last 3
    return previousWorkouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 3);
  };

  const [initialised, setInitialised] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* populate form once log data arrives */
  useEffect(() => {
    if (!log || initialised) return;
    setInitialised(true);
    setWorkoutName(log.workoutName);
    setWorkoutType(log.workoutType);
    setLoggedAt(format(parseISO(log.loggedAt), "yyyy-MM-dd'T'HH:mm"));
    setDurationMinutes(log.durationMinutes != null ? String(log.durationMinutes) : "");
    setNotes(log.notes ?? "");
    setRating(log.rating ?? 4);
    setLocation(log.location ?? "");
    setOriginalLocation(log.location ?? "");
    setOriginalWeatherJson(log.weatherJson ?? null);

    try {
      const r = JSON.parse(log.results);
      if (log.workoutType === "bodybuilding" && Array.isArray(r)) {
        setBbResults(r);
      } else if (log.workoutType === "amrap") {
        setAmrapRounds(String(r.rounds ?? r.roundsCompleted ?? ""));
        setAmrapPartialReps(String(r.partialReps ?? ""));
      } else if (log.workoutType === "emom") {
        setEmomScore(r.score ?? "");
      } else if (log.workoutType === "rft") {
        setRftTime(r.time ?? "");
      } else if (log.workoutType === "cardio") {
        setCardioDistance(r.distance != null ? String(r.distance) : "");
        if (r.duration != null) {
          const totalMins = r.duration as number;
          setCardioDuration(String(Math.floor(totalMins)));
          const secs = Math.round((totalMins - Math.floor(totalMins)) * 60);
          setCardioDurationSec(secs > 0 ? String(secs) : "");
        }
        setCardioHR(r.avgHeartRate != null ? String(r.avgHeartRate) : "");
        setCardioElevation(r.elevationGain != null ? String(r.elevationGain) : "");
      }
    } catch {}

    if (["amrap", "emom", "rft"].includes(log.workoutType)) {
      try {
        const ex = JSON.parse(log.results);
        if (ex?.freeText) setCfText(ex.freeText);
      } catch {}
    }
  }, [log, initialised]);

  /* Timer effect for Cruise Control */
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (timerActive && !isPaused && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval!);
            timerDone();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerActive, isPaused, timeLeft]);

  /* Wake Lock cleanup */
  useEffect(() => {
    return () => {
      if (wakeLock) wakeLock.release();
    };
  }, [wakeLock]);

  /* Request wake lock when fullscreen timer is active */
  useEffect(() => {
    if (isFullscreenTimer) {
      requestWakeLock();
    }
  }, [isFullscreenTimer]);

  /* Visibility API: re-request wake lock when page regains focus */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isFullscreenTimer) {
        await requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isFullscreenTimer]);

  /* Periodic wake lock renewal (every 30 seconds) */
  useEffect(() => {
    if (!isFullscreenTimer) return;

    const interval = setInterval(async () => {
      if (!wakeLock) {
        await requestWakeLock();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isFullscreenTimer, wakeLock]);

  /* Auto-focus on weight input when setInput step is active */
  useEffect(() => {
    if (cruiseStep === 'setInput' && weightInputRef.current) {
      weightInputRef.current.focus();
      weightInputRef.current.select();
    }
  }, [cruiseStep]);

  /* Debounced auto-save when form fields change (1 second delay) */
  useEffect(() => {
    const timeout = setTimeout(() => {
      autoSaveLog();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [bbResults, workoutName, workoutType, loggedAt, notes, rating, amrapRounds, amrapPartialReps, emomScore, rftTime, cardioDistance, cardioDuration, cardioDurationSec, cardioHR, cardioElevation, location, cfText]);

  const buildResults = () => {
    if (workoutType === "bodybuilding") return JSON.stringify(bbResults);
    if (workoutType === "amrap") return JSON.stringify({ rounds: parseInt(amrapRounds) || 0, partialReps: parseInt(amrapPartialReps) || 0, freeText: cfText || undefined });
    if (workoutType === "emom") return JSON.stringify({ score: emomScore, freeText: cfText || undefined });
    if (workoutType === "rft") return JSON.stringify({ time: rftTime, freeText: cfText || undefined });
    if (workoutType === "cardio") return JSON.stringify({
      distance: parseFloat(cardioDistance) || 0,
      duration: (parseInt(cardioDuration) || 0) + (parseInt(cardioDurationSec) || 0) / 60,
      avgHeartRate: parseInt(cardioHR) || null,
      elevationGain: parseInt(cardioElevation) || null,
    });
    return "{}";
  };

  /* Cruise Control helper functions */
  const playBeep = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAA');
    audio.play().catch(() => {});
  };

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);
        lock.addEventListener('release', async () => {
          setWakeLock(null);
          // Auto-retry after a short delay if fullscreen timer is still active
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (isFullscreenTimer && document.visibilityState === 'visible') {
            await requestWakeLock();
          }
        });
      }
    } catch (err) {
      console.warn('Wake Lock not available:', err);
      // Retry after delay if fullscreen timer is active
      if (isFullscreenTimer) {
        setTimeout(requestWakeLock, 5000);
      }
    }
  };

  const nextSetOrRest = () => {
    const currentExercise = bbResults[cruiseExerciseIdx];
    const nextSet = cruiseSetIdx + 1;
    
    // Check if this is the last set of the last exercise
    const isLastSetOfExercise = nextSet >= currentExercise.sets.length;
    const isLastExercise = cruiseExerciseIdx >= bbResults.length - 1;
    
    if (isLastSetOfExercise && isLastExercise) {
      // No more sets or exercises - workout complete
      setCruiseStep('complete');
      return;
    }
    
    // Always go to timer after a set (unless complete)
    setCruiseStep('timer');
    setIsFullscreenTimer(true);
    setTimeLeft(restSeconds);
    setTimerActive(true);
    
    // Prepare for next set
    if (!isLastSetOfExercise) {
      // More sets in current exercise
      setCruiseSetIdx(nextSet);
    } else {
      // Move to next exercise
      setCruiseExerciseIdx(cruiseExerciseIdx + 1);
      setCruiseSetIdx(0);
    }
  };

  const timerDone = () => {
    playBeep();
    setCruiseStep('setInput');
    setIsFullscreenTimer(false);
    setTimerActive(false);
    // Pre-fill with existing values from the next set
    if (bbResults.length > 0 && cruiseExerciseIdx < bbResults.length) {
      const nextSet = bbResults[cruiseExerciseIdx].sets[cruiseSetIdx];
      if (nextSet) {
        setCurrentReps(String(nextSet.reps || ''));
        setCurrentWeight(String(nextSet.weight || ''));
      } else {
        setCurrentReps('');
        setCurrentWeight('');
      }
    }
  };

  const saveSet = () => {
    const reps = parseInt(currentReps) || 0;
    const weight = parseFloat(currentWeight) || 0;
    
    setBbResults(prev => {
      const newResults = [...prev];
      newResults[cruiseExerciseIdx] = {
        ...newResults[cruiseExerciseIdx],
        sets: newResults[cruiseExerciseIdx].sets.map((s, i) => 
          i === cruiseSetIdx ? { reps, weight } : s
        )
      };
      return newResults;
    });
    
    autoSaveLog();
    setCurrentReps('');
    setCurrentWeight('');
  };

  const autoSaveLog = async () => {
    try {
      await updateLog.mutateAsync({
        id,
        data: {
          workoutName,
          workoutType,
          loggedAt: new Date(loggedAt).toISOString(),
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes || null,
          results: buildResults(),
          rating,
          location: originalLocation,
          weatherJson: originalWeatherJson,
        },
      });
      queryClient.invalidateQueries({ queryKey: getGetWorkoutLogQueryKey(id) });
      toast({ title: 'Auto-saved', description: 'Changes saved' });
    } catch (err) {
      console.error('Auto-save failed:', err);
      // Don't show toast on every failure to avoid spam
    }
  };

  const skipSet = () => {
    const nextSet = cruiseSetIdx + 1;
    const currentExercise = bbResults[cruiseExerciseIdx];
    
    const isLastSetOfExercise = nextSet >= currentExercise.sets.length;
    const isLastExercise = cruiseExerciseIdx >= bbResults.length - 1;
    
    if (isLastSetOfExercise && isLastExercise) {
      setCruiseStep('complete');
      return;
    }
    
    // Go directly to next set input
    setCurrentReps('');
    setCurrentWeight('');
    
    if (!isLastSetOfExercise) {
      setCruiseSetIdx(nextSet);
      setCruiseStep('setInput');
      setIsFullscreenTimer(false);
    } else {
      setCruiseExerciseIdx(cruiseExerciseIdx + 1);
      setCruiseSetIdx(0);
      setCruiseStep('setInput');
      setIsFullscreenTimer(false);
    }
  };

  const skipRest = () => {
    setTimerActive(false);
    // Go directly to next set input (skip the timer)
    // cruiseSetIdx is already the next set index (set by nextSetOrRest)
    setCurrentReps('');
    setCurrentWeight('');
    setCruiseStep('setInput');
    setIsFullscreenTimer(false);
  };

  const startCruise = () => {
    setCruiseExerciseIdx(0);
    setCruiseSetIdx(0);
    setCruiseStep('setInput');
    // Pre-fill with existing values from the first set
    if (bbResults.length > 0 && bbResults[0].sets.length > 0) {
      setCurrentReps(String(bbResults[0].sets[0].reps || ''));
      setCurrentWeight(String(bbResults[0].sets[0].weight || ''));
    } else {
      setCurrentReps('');
      setCurrentWeight('');
    }
    setTimerActive(false);
    setIsPaused(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalLocation: string | null = location.trim() || null;
      let finalWeatherJson: string | null = originalWeatherJson;

      /* Re-geocode only if location text changed */
      if (workoutType === "cardio" && location.trim() && location.trim() !== originalLocation) {
        const result = await geocodeAndWeather(location.trim(), loggedAt);
        if (result) {
          finalLocation = result.confirmedLocation;
          finalWeatherJson = result.weatherJson;
        } else {
          finalLocation = location.trim();
          finalWeatherJson = null;
        }
      } else if (workoutType !== "cardio") {
        finalLocation = null;
        finalWeatherJson = null;
      }

      await updateLog.mutateAsync({
        id,
        data: {
          workoutName,
          workoutType,
          loggedAt: new Date(loggedAt).toISOString(),
          durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
          notes: notes || null,
          results: buildResults(),
          rating,
          location: finalLocation,
          weatherJson: finalWeatherJson,
        },
      });

      queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetWorkoutLogQueryKey(id) });
      navigate(`/log/${id}`);
    } catch (err: unknown) {
      const msg =
        (err as { data?: { error?: string } })?.data?.error ??
        (err as { message?: string })?.message ??
        "Could not save log.";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !initialised) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
    );
  }

  if (!log) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground font-mono">Log not found.</p>
        <Link href="/log">
          <Button variant="outline" className="mt-4 font-mono uppercase">Back to Log Book</Button>
        </Link>
      </div>
    );
  }

  const isCrossfit = ["amrap", "emom", "rft"].includes(workoutType);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Edit Log</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Update your session data</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session info */}
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Session Info</CardTitle>
            {workoutType === "bodybuilding" && (
              <Button type="button" variant="outline" size="sm" className="font-mono uppercase text-xs gap-1"
                onClick={() => {
                  if (bbResults.length === 0) {
                    toast({ title: 'No exercises', description: 'Add exercises first', variant: 'destructive' });
                    return;
                  }
                  setIsCruiseActive(true);
                  setCruiseStep('restInput');
                }}
              >
                <PlayCircle className="h-3 w-3" /> Cruise
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Name</Label>
              <Input value={workoutName} onChange={e => setWorkoutName(e.target.value)} required className="font-mono" />
            </div>
            <div className="flex items-center gap-3">
              <WorkoutBadge type={workoutType} />
              <div className="space-y-1 flex-1">
                <Label className="font-mono text-xs uppercase tracking-wider">Type</Label>
                <Select value={workoutType} onValueChange={setWorkoutType}>
                  <SelectTrigger className="font-mono"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORKOUT_TYPES.map(t => (
                      <SelectItem key={t} value={t} className="font-mono capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Date &amp; Time</Label>
              <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
            </div>
          </CardContent>
        </Card>

        {/* CrossFit whiteboard */}
        {isCrossfit && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Whiteboard</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={cfText}
                onChange={e => setCfText(e.target.value)}
                placeholder="Describe the workout…"
                className="font-mono text-sm resize-none"
                rows={5}
              />
            </CardContent>
          </Card>
        )}

        {/* Bodybuilding */}
        {workoutType === "bodybuilding" && (
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Sets &amp; Reps</CardTitle>
              <Button type="button" variant="outline" size="sm" className="font-mono uppercase text-xs gap-1"
                onClick={() => setBbResults([...bbResults, { exerciseName: "", sets: [{ reps: 0, weight: 0 }] }])}>
                <Plus className="h-3 w-3" /> Exercise
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
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => setBbResults(bbResults.filter((_, ri) => ri !== i))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 pt-1">
                    {ex.sets.map((set, si) => (
                      <div key={si} className="flex items-center gap-2 pl-4">
                        <span className="font-mono text-xs text-muted-foreground w-12">Set {si + 1}</span>
                        <Input type="number" value={set.reps || ""} onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.map((s, sj) => sj === si ? { ...s, reps: parseInt(e.target.value) || 0 } : s) } : r))} placeholder="Reps" className="font-mono h-8 w-20" />
                        <Input type="number" value={set.weight || ""} onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.map((s, sj) => sj === si ? { ...s, weight: parseFloat(e.target.value) || 0 } : s) } : r))} placeholder="kg" className="font-mono h-8 w-20" />
                        {ex.sets.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                            onClick={() => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: r.sets.filter((_, sj) => sj !== si) } : r))}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" className="font-mono uppercase text-xs text-muted-foreground ml-4 gap-1"
                      onClick={() => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, sets: [...r.sets, { reps: 0, weight: 0 }] } : r))}>
                      <Plus className="h-3 w-3" /> Set
                    </Button>
                  </div>
                </div>
              ))}
              {bbResults.length === 0 && (
                <p className="font-mono text-xs text-muted-foreground">No exercises. Add one.</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* AMRAP */}
        {workoutType === "amrap" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">AMRAP Score</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Rounds</Label>
                <Input type="number" value={amrapRounds} onChange={e => setAmrapRounds(e.target.value)} placeholder="14" className="font-mono" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">+ Partial Reps</Label>
                <Input type="number" value={amrapPartialReps} onChange={e => setAmrapPartialReps(e.target.value)} placeholder="6" className="font-mono" />
              </div>
            </CardContent>
          </Card>
        )}

        {/* EMOM */}
        {workoutType === "emom" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">EMOM Score</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Weight / Score</Label>
              <Input value={emomScore} onChange={e => setEmomScore(e.target.value)} placeholder="e.g. 50kg" className="font-mono" />
            </CardContent>
          </Card>
        )}

        {/* RFT */}
        {workoutType === "rft" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">RFT — Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Time (mm:ss)</Label>
              <Input value={rftTime} onChange={e => setRftTime(e.target.value)} placeholder="11:30" className="font-mono" />
            </CardContent>
          </Card>
        )}

        {/* Cardio */}
        {workoutType === "cardio" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Cardio Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Distance (km)</Label>
                  <Input type="number" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} placeholder="5.0" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Duration (min : sec)</Label>
                  <div className="flex items-center gap-2">
                    <Input type="number" min="0" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} placeholder="32" className="font-mono" />
                    <span className="font-mono text-muted-foreground font-bold">:</span>
                    <Input type="number" min="0" max="59" value={cardioDurationSec} onChange={e => setCardioDurationSec(e.target.value)} placeholder="00" className="font-mono w-20" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Avg Heart Rate (bpm)</Label>
                  <Input type="number" value={cardioHR} onChange={e => setCardioHR(e.target.value)} placeholder="148" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Elevation (m)</Label>
                  <Input type="number" value={cardioElevation} onChange={e => setCardioElevation(e.target.value)} placeholder="45" className="font-mono" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Location
                </Label>
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Central Park, New York"
                  className="font-mono text-sm"
                />
                {location.trim() !== originalLocation && location.trim() !== "" && (
                  <p className="font-mono text-[10px] text-primary">Location changed — weather will be re-fetched on save.</p>
                )}
                {location.trim() === originalLocation && originalWeatherJson && (
                  <p className="font-mono text-[10px] text-muted-foreground">Location unchanged — existing weather data will be kept.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Rating */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Notes &amp; Rating</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="How did it feel? PRs? Notes for next time…"
              className="font-mono text-sm resize-none"
              rows={3}
            />
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setRating(n)} className="transition-colors hover:scale-110">
                    <Star className={`h-6 w-6 ${n <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/log/${id}`}>
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Cancel</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || updateLog.isPending} className="font-mono uppercase tracking-tight">
            {isSubmitting ? "Fetching weather…" : updateLog.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </div>

        {/* Cruise Control Modal */}
        {isCruiseActive && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/98 backdrop-blur-sm p-2">
            <button
              type="button"
              onClick={() => { setIsFullscreenTimer(false); setIsCruiseActive(false); }}
              className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/20 transition-colors z-10"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="w-full max-w-sm px-2 text-center">
              {/* Rest Input Step */}
              {cruiseStep === 'restInput' && (
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold text-white">Cruise Control</h2>
                  <p className="text-lg text-gray-300">Set rest time between sets</p>
                  <div className="grid grid-cols-4 gap-2">
                    {[60, 120, 180, 240].map((secs) => (
                      <button
                        key={secs}
                        type="button"
                        onClick={() => {
                          setRestSeconds(secs);
                          startCruise();
                        }}
                        className={`text-2xl font-mono py-4 rounded-lg transition-colors ${
                          restSeconds === secs 
                            ? 'bg-white text-black' 
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {secs / 60}
                        <span className="text-xs block">min</span>
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="ghost"
                    size="lg"
                    onClick={() => { setIsFullscreenTimer(false); setIsCruiseActive(false); }}
                    className="text-white/70 hover:text-white"
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Set Input Step */}
              {cruiseStep === 'setInput' && bbResults.length > 0 && cruiseExerciseIdx < bbResults.length && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white truncate">
                    {bbResults[cruiseExerciseIdx].exerciseName || `Exercise ${cruiseExerciseIdx + 1}`}
                  </h2>
                  <p className="text-lg text-gray-300">
                    Set {cruiseSetIdx + 1} of {bbResults[cruiseExerciseIdx].sets.length}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-base text-gray-300">Reps</Label>
                      <Input
                        type="number"
                        value={currentReps}
                        onChange={(e) => setCurrentReps(e.target.value)}
                        placeholder="10"
                        className="text-center text-2xl font-mono h-16 bg-white text-black border-2 border-gray-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base text-gray-300">Weight (kg)</Label>
                      <Input
                        type="number"
                        value={currentWeight}
                        onChange={(e) => setCurrentWeight(e.target.value)}
                        placeholder="60"
                        className="text-center text-2xl font-mono h-16 bg-white text-black border-2 border-gray-300"
                        ref={weightInputRef}
                      />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={() => {
                        saveSet();
                        nextSetOrRest();
                      }}
                      className="flex-1 text-lg py-4"
                    >
                      Save & Rest
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="lg" className="flex-1 text-base bg-white/10 border-white/30 hover:bg-white/20 text-white" onClick={skipSet}>
                      <SkipForward className="h-5 w-5" />
                      <span className="ml-1">Skip</span>
                    </Button>
                  </div>
                  {/* Previous workouts reference */}
                  {allLogs && (
                    <div className="pt-4 border-t border-white/10">
                      <p className="text-xs text-white/60 uppercase tracking-wider mb-2">Previous workouts</p>
                      <div className="space-y-2">
                        {getPreviousWorkoutsForExercise(bbResults[cruiseExerciseIdx].exerciseName).map((workout, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-xs font-mono text-white/60">
                            <span className="w-20 text-left pt-0.5">{workout.date}</span>
                            <span className="flex-1">
                              {workout.sets.map((s, si) => (
                                <span key={si} className="mr-1">
                                  Set {si + 1}: {s.reps}×{s.weight}kg
                                </span>
                              ))}
                            </span>
                            <span className="flex gap-0.5 pt-0.5">
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Star
                                  key={n}
                                  className={`h-3 w-3 ${n <= workout.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/30'}`}
                                />
                              ))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timer Step */}
              {cruiseStep === 'timer' && (
                <div className="space-y-4">
                  <h2 className="text-2xl font-bold text-white">Rest Time</h2>
                  <p className="text-lg text-gray-300">
                    Next: {cruiseSetIdx < bbResults[cruiseExerciseIdx]?.sets.length
                      ? `Set ${cruiseSetIdx + 1} of ${bbResults[cruiseExerciseIdx].sets.length}`
                      : bbResults[cruiseExerciseIdx + 1]?.exerciseName || 'Next exercise'}
                  </p>
                  
                  {/* Progress bar */}
                  <div className="w-full bg-white/10 rounded-full h-3">
                    <div
                      className="bg-white h-3 rounded-full transition-all duration-1000"
                      style={{ width: `${((restSeconds - timeLeft) / restSeconds) * 100}%` }}
                    />
                  </div>
                  
                  <div className="text-7xl font-mono font-bold text-white">
                    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                  </div>
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="lg" className="flex-1 text-base" onClick={() => {
                      setIsPaused(!isPaused);
                    }}>
                      {isPaused ? <Check className="h-5 w-5" /> : <PauseCircle className="h-5 w-5" />}
                      <span className="ml-1">{isPaused ? 'Resume' : 'Pause'}</span>
                    </Button>
                    <Button variant="outline" size="lg" className="flex-1 text-base" onClick={skipRest}>
                      <SkipForward className="h-5 w-5" />
                      <span className="ml-1">Skip</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {cruiseStep === 'complete' && (
                <div className="space-y-6">
                  <h2 className="text-4xl font-bold text-green-400">Workout Complete! <Check className="h-10 w-10 inline" /></h2>
                  <p className="text-xl text-gray-300">All exercises logged successfully</p>
                  <Button onClick={() => { setIsFullscreenTimer(false); setIsCruiseActive(false); }} className="w-full text-lg py-4">
                    Back to Edit
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
