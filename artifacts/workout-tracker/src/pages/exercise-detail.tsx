import { useParams, Link } from "wouter";
import { useListExercises, getListExercisesQueryKey, useListWorkoutLogs, getListWorkoutLogsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WorkoutBadge } from "@/components/ui/workout-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Dumbbell, TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from "recharts";

const COLORS = ["#84cc16", "#f97316", "#a855f7", "#3b82f6", "#ec4899", "#14b8a6"];

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id || "0");

  const { data: exercises, isLoading: exLoading } = useListExercises({ query: { queryKey: getListExercisesQueryKey() } });
  const { data: logs, isLoading: logsLoading } = useListWorkoutLogs({ query: { queryKey: getListWorkoutLogsQueryKey() } });

  const exercise = exercises?.find(e => e.id === id);

  // Parse logs to find all occurrences of this exercise
  type DataPoint = { date: string; label: string; [key: string]: string | number };
  const progressByReps: Record<number, DataPoint[]> = {}; // eslint-disable-line

  if (logs && exercise) {
    for (const log of logs) {
      if (log.workoutType !== "bodybuilding") continue;
      try {
        const results = JSON.parse(log.results as string) as Array<{ exerciseName: string; sets: { reps: number; weight: number }[] }>;
        for (const ex of results) {
          if (ex.exerciseName.toLowerCase() !== exercise.name.toLowerCase()) continue;
          if (!ex.sets?.length) continue;

          // Group sets by reps
          const setsByReps: Record<number, number[]> = {};
          for (const s of ex.sets) {
            const r = s.reps || 0;
            if (!setsByReps[r]) setsByReps[r] = [];
            setsByReps[r].push(s.weight || 0);
          }

          const dateStr = log.loggedAt.split("T")[0];
          const label = format(parseISO(dateStr), "MMM d");

          for (const [repsStr, weights] of Object.entries(setsByReps)) {
            const reps = parseInt(repsStr);
            const maxW = Math.max(...weights);
            if (!progressByReps[reps]) progressByReps[reps] = [];
            const existing = progressByReps[reps].find(d => d.date === dateStr);
            if (existing) {
              existing[`${reps}r`] = Math.max(existing[`${reps}r`] as number || 0, maxW);
            } else {
              progressByReps[reps].push({ date: dateStr, label, [`${reps}r`]: maxW });
            }
          }
        }
      } catch {}
    }
  }

  // Merge all rep series into one unified timeline
  const allDates = [...new Set(
    Object.values(progressByReps).flatMap(pts => pts.map(p => p.date))
  )].sort();

  const repSeries = Object.keys(progressByReps).map(Number).sort((a, b) => a - b);

  const chartData: DataPoint[] = allDates.map(date => {
    const label = format(parseISO(date), "MMM d");
    const point: DataPoint = { date, label };
    for (const reps of repSeries) {
      const found = progressByReps[reps]?.find(p => p.date === date);
      if (found) point[`${reps}r`] = found[`${reps}r`] as number;
    }
    return point;
  });

  const isLoading = exLoading || logsLoading;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <Link href="/exercises">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="py-16 text-center border border-dashed border-border rounded-md">
          <Dumbbell className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">Exercise not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link href="/exercises">
          <Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-mono font-black tracking-tighter uppercase text-foreground">{exercise.name}</h1>
            <WorkoutBadge type={exercise.category} />
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">{exercise.muscleGroup}{exercise.description ? ` · ${exercise.description}` : ""}</p>
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Progress — Max Weight per Rep Count
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="py-12 text-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="font-mono text-sm text-muted-foreground">No logged sessions for this exercise yet.</p>
              <p className="font-mono text-xs text-muted-foreground mt-1">Log a bodybuilding session that includes {exercise.name} to see progress here.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fontFamily: "Space Mono, monospace", fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => `${v}kg`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontFamily: "Space Mono, monospace",
                    fontSize: "12px",
                  }}
                  formatter={(value, name) => [`${value}kg`, `${String(name).replace("r", "")} reps`]}
                />
                {repSeries.length > 1 && (
                  <Legend
                    formatter={name => `${String(name).replace("r", "")} reps`}
                    wrapperStyle={{ fontFamily: "Space Mono, monospace", fontSize: "11px" }}
                  />
                )}
                {repSeries.map((reps, idx) => (
                  <Line
                    key={reps}
                    type="monotone"
                    dataKey={`${reps}r`}
                    name={`${reps}r`}
                    stroke={COLORS[idx % COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 4, fill: COLORS[idx % COLORS.length], strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {chartData.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground">Session History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {[...chartData].reverse().map(point => (
                <div key={point.date} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <span className="font-mono text-xs text-muted-foreground">{format(parseISO(point.date), "EEEE, MMM d yyyy")}</span>
                  <div className="flex gap-3">
                    {repSeries.map(reps => point[`${reps}r`] ? (
                      <span key={reps} className="font-mono text-xs text-foreground">
                        {reps}×<span className="text-primary font-bold">{point[`${reps}r`]}kg</span>
                      </span>
                    ) : null)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
