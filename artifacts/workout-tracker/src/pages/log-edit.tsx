import { useState, useEffect } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  useGetWorkoutLog,
  getGetWorkoutLogQueryKey,
  useUpdateWorkoutLog,
  getListWorkoutLogsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Star, Plus, X, MapPin } from "lucide-react";
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
      { headers: { "Accept-Language": "nl,en" } }
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
  const [cardioHR, setCardioHR] = useState("");
  const [cardioElevation, setCardioElevation] = useState("");
  const [cfText, setCfText] = useState("");

  /* location / weather */
  const [location, setLocation] = useState("");
  const [originalLocation, setOriginalLocation] = useState("");
  const [originalWeatherJson, setOriginalWeatherJson] = useState<string | null>(null);

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
        setCardioDuration(r.duration != null ? String(r.duration) : "");
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

  const buildResults = () => {
    if (workoutType === "bodybuilding") return JSON.stringify(bbResults);
    if (workoutType === "amrap") return JSON.stringify({ rounds: parseInt(amrapRounds) || 0, partialReps: parseInt(amrapPartialReps) || 0 });
    if (workoutType === "emom") return JSON.stringify({ score: emomScore });
    if (workoutType === "rft") return JSON.stringify({ time: rftTime });
    if (workoutType === "cardio") return JSON.stringify({
      distance: parseFloat(cardioDistance) || 0,
      duration: parseInt(cardioDuration) || 0,
      avgHeartRate: parseInt(cardioHR) || null,
      elevationGain: parseInt(cardioElevation) || null,
    });
    return "{}";
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
        "Kon log niet opslaan.";
      toast({ title: "Opslaan mislukt", description: msg, variant: "destructive" });
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
        <p className="text-muted-foreground font-mono">Log niet gevonden.</p>
        <Link href="/log">
          <Button variant="outline" className="mt-4 font-mono uppercase">Terug naar Logboek</Button>
        </Link>
      </div>
    );
  }

  const isCrossfit = ["amrap", "emom", "rft"].includes(workoutType);

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href={`/log/${id}`}>
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">Log Bewerken</h1>
          <p className="text-muted-foreground font-mono text-sm mt-1">Pas de sessiegegevens aan</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Session info */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Sessie Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Naam</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Datum &amp; Tijd</Label>
                <Input type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase tracking-wider">Duur (min)</Label>
                <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} placeholder="60" className="font-mono" />
              </div>
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
                placeholder="Beschrijf de workout…"
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
                <Plus className="h-3 w-3" /> Oefening
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {bbResults.map((ex, i) => (
                <div key={i} className="p-4 rounded border border-border space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={ex.exerciseName}
                      onChange={e => setBbResults(bbResults.map((r, ri) => ri === i ? { ...r, exerciseName: e.target.value } : r))}
                      placeholder="Oefening"
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
                <p className="font-mono text-xs text-muted-foreground">Geen oefeningen. Voeg er een toe.</p>
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
              <Label className="font-mono text-xs uppercase tracking-wider">Gewicht / Score</Label>
              <Input value={emomScore} onChange={e => setEmomScore(e.target.value)} placeholder="bijv. 50kg" className="font-mono" />
            </CardContent>
          </Card>
        )}

        {/* RFT */}
        {workoutType === "rft" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">RFT — Tijd</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Label className="font-mono text-xs uppercase tracking-wider">Tijd (mm:ss)</Label>
              <Input value={rftTime} onChange={e => setRftTime(e.target.value)} placeholder="11:30" className="font-mono" />
            </CardContent>
          </Card>
        )}

        {/* Cardio */}
        {workoutType === "cardio" && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Cardio Resultaten</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Afstand (km)</Label>
                  <Input type="number" value={cardioDistance} onChange={e => setCardioDistance(e.target.value)} placeholder="5.0" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Duur (min)</Label>
                  <Input type="number" value={cardioDuration} onChange={e => setCardioDuration(e.target.value)} placeholder="32" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Gem. Hartslag (bpm)</Label>
                  <Input type="number" value={cardioHR} onChange={e => setCardioHR(e.target.value)} placeholder="148" className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">Hoogteverschil (m)</Label>
                  <Input type="number" value={cardioElevation} onChange={e => setCardioElevation(e.target.value)} placeholder="45" className="font-mono" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-border">
                <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> Locatie
                </Label>
                <Input
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="bijv. Centrum Amsterdam"
                  className="font-mono text-sm"
                />
                {location.trim() !== originalLocation && location.trim() !== "" && (
                  <p className="font-mono text-[10px] text-primary">Locatie gewijzigd — weerbericht wordt opnieuw opgehaald bij opslaan.</p>
                )}
                {location.trim() === originalLocation && originalWeatherJson && (
                  <p className="font-mono text-[10px] text-muted-foreground">Locatie ongewijzigd — bestaand weerbericht blijft behouden.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notes & Rating */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Notities &amp; Beoordeling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Hoe voelde het? PRs? Notities voor volgende keer…"
              className="font-mono text-sm resize-none"
              rows={3}
            />
            <div className="space-y-3">
              <Label className="font-mono text-xs uppercase tracking-wider flex items-center gap-2">
                Beoordeling{" "}
                <span className="flex">
                  {[1, 2, 3, 4, 5].map(n => (
                    <Star key={n} className={`h-4 w-4 ${n <= rating ? "text-yellow-400 fill-current" : "text-muted-foreground"}`} />
                  ))}
                </span>
              </Label>
              <Slider min={1} max={5} step={1} value={[rating]} onValueChange={([v]) => setRating(v)} className="max-w-xs" />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/log/${id}`}>
            <Button type="button" variant="outline" className="font-mono uppercase tracking-tight">Annuleren</Button>
          </Link>
          <Button type="submit" disabled={isSubmitting || updateLog.isPending} className="font-mono uppercase tracking-tight">
            {isSubmitting ? "Weerbericht ophalen…" : updateLog.isPending ? "Opslaan…" : "Wijzigingen opslaan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
