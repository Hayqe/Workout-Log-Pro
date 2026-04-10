import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRESETS = [60, 90, 120, 180, 240];

export function RestTimer() {
  const [selected, setSelected] = useState(90);
  const [remaining, setRemaining] = useState(90);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) {
            setRunning(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleSelect = (s: number) => {
    setSelected(s);
    setRemaining(s);
    setRunning(false);
  };

  const handleReset = () => {
    setRemaining(selected);
    setRunning(false);
  };

  const pct = remaining / selected;
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const isDone = remaining === 0;

  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const stroke = circ * (1 - pct);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-mono text-sm uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Timer className="h-4 w-4" /> Rest Timer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 justify-center">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => handleSelect(p)}
              className={`font-mono text-xs rounded px-2.5 py-1 border transition-all ${
                selected === p
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {p < 60 ? `${p}s` : `${p / 60}m`}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-6">
          <div className="relative flex items-center justify-center">
            <svg width="90" height="90" className="-rotate-90">
              <circle cx="45" cy="45" r={radius} fill="none" strokeWidth="6" stroke="hsl(var(--border))" />
              <circle
                cx="45" cy="45" r={radius} fill="none" strokeWidth="6"
                stroke={isDone ? "hsl(var(--primary))" : "hsl(var(--primary))"}
                strokeDasharray={circ}
                strokeDashoffset={stroke}
                strokeLinecap="round"
                className="transition-all duration-1000"
                style={{ opacity: isDone ? 0.3 : 1 }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`font-mono font-black text-lg tabular-nums ${isDone ? "text-muted-foreground" : "text-foreground"}`}>
                {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="icon"
              variant={running ? "outline" : "default"}
              className="h-10 w-10"
              onClick={() => setRunning(r => !r)}
            >
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-10 w-10 text-muted-foreground"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isDone && (
          <p className="text-center font-mono text-xs text-primary uppercase tracking-widest animate-pulse">
            Rest complete — go!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
