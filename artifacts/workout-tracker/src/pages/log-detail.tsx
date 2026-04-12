import { useRoute, Link, useLocation } from "wouter";
import { useGetWorkoutLog, getGetWorkoutLogQueryKey, useDeleteWorkoutLog, getListWorkoutLogsQueryKey, useGetWorkout, getGetWorkoutQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { SportTag } from "@/components/ui/sport-tag";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Trash2, Pencil, Clock, Star, Bike, Heart, Mountain, Timer, MapPin, Wind, Droplets, Thermometer } from "lucide-react";
import { format } from "date-fns";

function kmhToBft(kmh: number): number {
  const thresholds = [1, 5.5, 11.9, 19.7, 28.7, 38.8, 49.9, 61.8, 74.6, 87.4, 102.4, 117.4];
  return thresholds.findIndex(t => kmh < t) === -1 ? 12 : thresholds.findIndex(t => kmh < t);
}

function degToCompass(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

/* WMO weather interpretation codes → icon + label */
function wmoLabel(code: number | null): { emoji: string; label: string } {
  if (code === null) return { emoji: "❓", label: "Unknown" };
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code <= 2) return { emoji: "🌤️", label: "Partly cloudy" };
  if (code === 3) return { emoji: "☁️", label: "Overcast" };
  if (code <= 49) return { emoji: "🌫️", label: "Fog" };
  if (code <= 59) return { emoji: "🌧️", label: "Drizzle" };
  if (code <= 69) return { emoji: "🌧️", label: "Rain" };
  if (code <= 79) return { emoji: "❄️", label: "Snow" };
  if (code <= 82) return { emoji: "🌦️", label: "Rain showers" };
  if (code <= 84) return { emoji: "🌨️", label: "Hail showers" };
  if (code <= 99) return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "🌡️", label: `Code ${code}` };
}

export default function LogDetailPage() {
  const [, params] = useRoute("/log/:id");
  const id = parseInt(params?.id || "0");
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const { data: log, isLoading } = useGetWorkoutLog(id, {
    query: { enabled: !!id, queryKey: getGetWorkoutLogQueryKey(id) }
  });
  const deleteLog = useDeleteWorkoutLog();

  // Must be called unconditionally — before any early returns
  const { data: linkedWorkout } = useGetWorkout(log?.workoutId ?? 0, {
    query: { enabled: !!log?.workoutId, queryKey: getGetWorkoutQueryKey(log?.workoutId ?? 0) }
  });

  const handleDelete = async () => {
    if (!confirm("Delete this log entry?")) return;
    await deleteLog.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListWorkoutLogsQueryKey() });
    navigate("/log");
  };

  if (isLoading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (!log) return (
    <div className="text-center py-16">
      <p className="text-muted-foreground font-mono">Log not found.</p>
      <Link href="/log"><Button variant="outline" className="mt-4 font-mono uppercase">Back to Log Book</Button></Link>
    </div>
  );

  let results: any = {};
  try { results = JSON.parse(log.results); } catch {}

  let weather: { temp?: number | null; tempMax?: number | null; tempMin?: number | null; precipitation?: number | null; windspeed?: number | null; winddir?: number | null; weathercode?: number | null } | null = null;
  if (log.weatherJson) {
    try { weather = JSON.parse(log.weatherJson); } catch {}
  }

  let templateExercises: any[] = [];
  let templateFreeText: string | null = null;
  if (linkedWorkout?.exercises) {
    try {
      const parsed = JSON.parse(linkedWorkout.exercises);
      if (Array.isArray(parsed)) templateExercises = parsed;
      else if (parsed?.freeText) templateFreeText = parsed.freeText;
    } catch {}
  }

  // Whiteboard text: prefer the value stored in the log itself, fall back to template
  const cfWhiteboard: string | null = results?.freeText ?? templateFreeText;

  const isBb = log.workoutType === "bodybuilding";
  const isCf = ["amrap", "emom", "rft"].includes(log.workoutType);
  const isCardio = log.workoutType === "cardio";

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-mono font-black tracking-tighter uppercase text-foreground">{log.workoutName}</h1>
              <WorkoutBadge type={log.workoutType} />
              {log.workoutType === "cardio" && log.sport && (
                <SportTag sport={log.sport} />
              )}
            </div>
            <p className="text-muted-foreground font-mono text-sm">{format(new Date(log.loggedAt), "EEEE, MMMM d yyyy — HH:mm")}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Link href={`/log/${id}/edit`}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <Pencil className="h-4 w-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        {log.durationMinutes && (
          <div className="flex items-center gap-2 bg-card border border-border rounded px-3 py-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-sm font-bold">{log.durationMinutes} min</span>
          </div>
        )}
        {log.rating && (
          <div className="flex items-center gap-1 bg-card border border-border rounded px-3 py-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`h-4 w-4 ${i < log.rating! ? "text-yellow-400 fill-current" : "text-muted-foreground"}`} />
            ))}
          </div>
        )}
      </div>

      {isBb && Array.isArray(results) && results.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Sets &amp; Reps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {results.map((ex: any, i: number) => (
              <div key={i} className="space-y-2">
                <p className="font-bold text-sm">{ex.exerciseName}</p>
                <div className="space-y-1 pl-4">
                  {ex.sets?.map((set: any, si: number) => (
                    <div key={si} className="flex items-center gap-4 font-mono text-sm">
                      <span className="text-muted-foreground text-xs w-12">Set {si + 1}</span>
                      <span className="text-foreground">{set.reps} reps</span>
                      {set.weight > 0 && <span className="text-primary font-bold">{set.weight} kg</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isCf && cfWhiteboard && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Whiteboard</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="font-mono text-sm text-foreground whitespace-pre-wrap bg-muted/30 rounded p-3 leading-relaxed">{cfWhiteboard}</pre>
          </CardContent>
        </Card>
      )}

      {isCf && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">{log.workoutType.toUpperCase()} Results</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 font-mono">
            {results.roundsCompleted != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Rounds</p>
                <p className="text-2xl font-black text-primary">{results.roundsCompleted}</p>
              </div>
            )}
            {results.rounds != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Rounds</p>
                <p className="text-2xl font-black text-primary">{results.rounds}</p>
              </div>
            )}
            {results.totalTime != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Total Time (min)</p>
                <p className="text-2xl font-black">{results.totalTime}</p>
              </div>
            )}
            {results.timeCap != null && (
              <div>
                <p className="text-muted-foreground text-xs uppercase">Time Cap (min)</p>
                <p className="text-2xl font-black">{results.timeCap}</p>
              </div>
            )}
            {results.time && (
              <div className="col-span-2">
                <p className="text-muted-foreground text-xs uppercase">Time</p>
                <p className="text-3xl font-black text-primary">{results.time}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isCardio && templateExercises.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Trainingsplan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {templateExercises.map((ex: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded border border-border bg-muted/20">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <span className="font-bold text-sm">{ex.name}</span>
                </div>
                <div className="font-mono text-[11px] text-muted-foreground flex gap-3">
                  {ex.distance && <span>{ex.distance} km</span>}
                  {ex.duration && <span>{ex.duration} min</span>}
                  {ex.zone && ex.zone !== "none" && <span className="text-primary">{ex.zone}</span>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isCardio && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Cardio Stats</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
            {results.distance != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Bike className="h-3 w-3" /> Distance</div>
                <p className="text-2xl font-black text-primary">{results.distance}<span className="text-sm ml-1">km</span></p>
              </div>
            )}
            {results.duration != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Timer className="h-3 w-3" /> Duration</div>
                <p className="text-2xl font-black">{Math.floor(results.duration)}<span className="text-sm ml-1">:</span><span>{String(Math.round((results.duration - Math.floor(results.duration)) * 60)).padStart(2, '0')}</span><span className="text-sm ml-1">min</span></p>
              </div>
            )}
            {results.avgHeartRate != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Heart className="h-3 w-3" /> Avg HR</div>
                <p className="text-2xl font-black">{results.avgHeartRate}<span className="text-sm ml-1">bpm</span></p>
              </div>
            )}
            {results.elevationGain != null && (
              <div>
                <div className="flex items-center gap-1 text-muted-foreground text-xs uppercase mb-1"><Mountain className="h-3 w-3" /> Elevation</div>
                <p className="text-2xl font-black">{results.elevationGain}<span className="text-sm ml-1">m</span></p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Weather + Location card for cardio */}
      {isCardio && (log.location || weather) && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" /> Location &amp; Weather
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {log.location && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <p className="font-mono text-sm text-foreground">{log.location}</p>
              </div>
            )}
            {weather && (
              <div className="grid grid-cols-2 gap-4">
                {weather.weathercode != null && (
                  <div className="col-span-2 flex items-center gap-3">
                    <span className="text-3xl">{wmoLabel(weather.weathercode ?? null).emoji}</span>
                    <span className="font-mono text-sm font-bold text-foreground">{wmoLabel(weather.weathercode ?? null).label}</span>
                  </div>
                )}
                {weather.temp != null && (
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-bold">{weather.temp}°C</span>
                  </div>
                )}
                {weather.temp == null && (weather.tempMin != null || weather.tempMax != null) && (
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-muted-foreground" />
                    <div className="font-mono text-sm">
                      {weather.tempMin != null && <span className="text-blue-400">{weather.tempMin}°</span>}
                      {weather.tempMin != null && weather.tempMax != null && <span className="text-muted-foreground mx-1">–</span>}
                      {weather.tempMax != null && <span className="text-red-400">{weather.tempMax}°C</span>}
                    </div>
                  </div>
                )}
                {weather.windspeed != null && (
                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">
                      {kmhToBft(weather.windspeed)} Bft
                      {weather.winddir != null && <span className="text-muted-foreground ml-1">({degToCompass(weather.winddir)})</span>}
                    </span>
                  </div>
                )}
                {weather.precipitation != null && (
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{weather.precipitation} mm</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {log.notes && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-muted-foreground">{log.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
