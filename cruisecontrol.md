# Cruise Control Mode - Implementatieplan

## Overzicht
Cruise Control Mode voor bodybuilding workouts: gestroomlijnde, timer-gestuurde flow die gebruikers door alle sets leidt met automatische rusttijden.

## Requirements
- Knop "Cruise Control" in bodybuilding card header
- Full-screen overlay met donkere achtergrond, lichte tekst
- Stap 1: Rusttijd invoeren (seconden)
- Stap 2+: Voor elke set: oefening tonen + reps/gewicht invoeren
- Timer countdown tijdens rust met geluid bij afloop
- Auto-focus op weight veld
- Pauze en Skip knoppen
- Wake Lock API om scherm aan te houden
- Auto-save na elke set

## Component Structuur

### `CruiseControlModal` (nieuw, inline in log-edit.tsx)
```
┌─────────────────────────────────────────┐
│  CRUISE CONTROL                      [X]  │
│  ─────────────────────────────────────  │
│                                     ↓    │
│  ┌─────────────────────────────────┐  │
│  │  Bench Press                      │  │
│  │  Set 2 van 4                      │  │
│  │                                 │  │
│  │  Reps: [___]  Weight: [___]  [✓]  │  │
│  │                                 │  │
│  │         [||] Pauze   [⏭] Skip     │  │
│  └─────────────────────────────────┘  │
│                                     ↓    │
│  ┌─────────────────────────────────┐  │
│  │                                 │  │
│  │        Rust: 00:45                │  │
│  │                                 │  │
│  │    [⏸] Pauze   [⏭] Skip          │  │
│  └─────────────────────────────────┘  │
│                                     ↓    │
│  ┌─────────────────────────────────┐  │
│  │   Workout Compleet! ✓             │  │
│  │   [Terug naar Edit]              │  │
│  └─────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## State Management

### Nieuwe state in LogEditPage
```typescript
// Cruise Control state
const [isCruiseActive, setIsCruiseActive] = useState(false);
const [cruiseStep, setCruiseStep] = useState<'restInput' | 'setInput' | 'timer'>('restInput');
const [cruiseExerciseIdx, setCruiseExerciseIdx] = useState(0);
const [cruiseSetIdx, setCruiseSetIdx] = useState(0);
const [restSeconds, setRestSeconds] = useState(60);
const [timerActive, setTimerActive] = useState(false);
const [timeLeft, setTimeLeft] = useState(0);
const [isPaused, setIsPaused] = useState(false);
const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

// Input state voor huidige set
const [currentReps, setCurrentReps] = useState('');
const [currentWeight, setCurrentWeight] = useState('');
```

## Flow Logic

### Main Flow
```
START (isCruiseActive = true)
  ↓
Stap: restInput
  → Toon input voor restSeconds (default: 60)
  → Op Submit: startCruise()
  ↓
Stap: setInput (eerste set)
  → Toon: oefening[0].name, Set 1 van X
  → Input: reps, weight (auto-focus op weight)
  → Op Submit: saveSet(), nextSetOrRest()
  ↓
Stap: timer (als er nog sets/oefeningen zijn)
  → Start timer: timeLeft = restSeconds, timerActive = true
  → Countdown elke seconde
  → Bij 0: timerDone() → volgende setInput
  ↓
Stap: setInput (volgende set)
  → Herhaal tot alle sets van alle oefeningen klaar
  ↓
Stap: complete
  → Toon "Workout Compleet!"
  → Knop om terug te gaan
```

### Helper Functions
```typescript
// Navigeer naar volgende set of rust
const nextSetOrRest = () => {
  const currentExercise = bbResults[cruiseExerciseIdx];
  const nextSet = cruiseSetIdx + 1;
  
  // Nog sets in deze oefening?
  if (nextSet < currentExercise.sets.length) {
    setCruiseSetIdx(nextSet);
    setCruiseStep('setInput');
    return;
  }
  
  // Volgende oefening?
  const nextExercise = cruiseExerciseIdx + 1;
  if (nextExercise < bbResults.length) {
    setCruiseExerciseIdx(nextExercise);
    setCruiseSetIdx(0);
    setCruiseStep('timer');  // Rust na oefening wissel
    setTimeLeft(restSeconds);
    setTimerActive(true);
    return;
  }
  
  // Klaar!
  setCruiseStep('complete');
};

// Timer afgelopen
const timerDone = () => {
  playBeep();
  setCruiseStep('setInput');
};

// Sla set op
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
  
  // Auto-save naar backend
  autoSaveLog();
  
  // Reset input
  setCurrentReps('');
  setCurrentWeight('');
};

// Auto-save functie
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
        location: finalLocation,
        weatherJson: finalWeatherJson,
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetWorkoutLogQueryKey(id) });
  } catch (err) {
    console.error('Auto-save failed:', err);
  }
};
```

## Timer Implementation
```typescript
// Timer effect
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

// Beep geluid
const playBeep = () => {
  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleQAA');
  audio.play().catch(() => {});
};
```

## Wake Lock Implementation
```typescript
// Request wake lock
const requestWakeLock = async () => {
  try {
    if ('wakeLock' in navigator) {
      const lock = await navigator.wakeLock.request('screen');
      setWakeLock(lock);
      lock.addEventListener('release', () => {
        setWakeLock(null);
      });
    }
  } catch (err) {
    console.warn('Wake Lock not available:', err);
  }
};

// Cleanup wake lock
useEffect(() => {
  return () => {
    if (wakeLock) wakeLock.release();
  };
}, [wakeLock]);

// Roep aan bij cruise start
useEffect(() => {
  if (isCruiseActive) {
    requestWakeLock();
  }
}, [isCruiseActive]);
```

## UI Componenten

### 1. Cruise Control Knop (in CardHeader)
```tsx
<Button 
  type="button" 
  variant="outline" 
  size="sm" 
  className="font-mono uppercase text-xs gap-1"
  onClick={() => {
    if (bbResults.length === 0) {
      toast({ title: 'No exercises', description: 'Add exercises first', variant: 'destructive' });
      return;
    }
    setIsCruiseActive(true);
    setCruiseStep('restInput');
    setCruiseExerciseIdx(0);
    setCruiseSetIdx(0);
    setCurrentReps('');
    setCurrentWeight('');
  }}
>
  <PlayCircle className="h-3 w-3" /> Cruise
</Button>
```

### 2. Modal Overlay
```tsx
{isCruiseActive && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm">
    <div className="w-full max-w-md px-4 text-center">
      {/* Modal content based on cruiseStep */}
      {cruiseStep === 'restInput' && <CruiseRestInput />}
      {cruiseStep === 'setInput' && <CruiseSetInput />}
      {cruiseStep === 'timer' && <CruiseTimer />}
      {cruiseStep === 'complete' && <CruiseComplete />}
    </div>
  </div>
)}
```

### 3. CruiseRestInput
```tsx
<div className="space-y-6">
  <h2 className="text-2xl font-bold text-white">Cruise Control</h2>
  <p className="text-muted-foreground">Set rest time between sets</p>
  <div className="flex items-center justify-center gap-4">
    <Input
      type="number"
      value={restSeconds}
      onChange={(e) => setRestSeconds(Math.max(1, parseInt(e.target.value) || 60))}
      className="text-center text-2xl font-mono w-24 h-16"
    />
    <span className="text-xl text-muted-foreground">seconds</span>
  </div>
  <Button 
    onClick={() => {
      setCruiseStep('setInput');
      setTimeLeft(restSeconds);
    }}
    className="w-full"
  >
    Start Cruise
  </Button>
  <Button variant="ghost" onClick={() => setIsCruiseActive(false)}>
    Cancel
  </Button>
</div>
```

### 4. CruiseSetInput
```tsx
<div className="space-y-6">
  <h2 className="text-xl font-bold text-white">
    {bbResults[cruiseExerciseIdx].exerciseName || `Exercise ${cruiseExerciseIdx + 1}`}
  </h2>
  <p className="text-muted-foreground">
    Set {cruiseSetIdx + 1} of {bbResults[cruiseExerciseIdx].sets.length}
  </p>
  <div className="grid grid-cols-2 gap-4">
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">Reps</Label>
      <Input
        type="number"
        value={currentReps}
        onChange={(e) => setCurrentReps(e.target.value)}
        placeholder="10"
        className="text-center text-lg font-mono"
      />
    </div>
    <div className="space-y-2">
      <Label className="text-sm text-muted-foreground">Weight (kg)</Label>
      <Input
        type="number"
        value={currentWeight}
        onChange={(e) => setCurrentWeight(e.target.value)}
        placeholder="60"
        className="text-center text-lg font-mono"
        ref={weightInputRef}
      />
    </div>
  </div>
  <div className="flex gap-4">
    <Button 
      onClick={() => {
        saveSet();
        if (cruiseSetIdx + 1 < bbResults[cruiseExerciseIdx].sets.length || 
            cruiseExerciseIdx + 1 < bbResults.length) {
          setTimerActive(true);
          setTimeLeft(restSeconds);
          setCruiseStep('timer');
        } else {
          setCruiseStep('complete');
        }
      }}
      className="flex-1"
    >
      Save & Rest
    </Button>
  </div>
  <div className="flex gap-4 pt-2">
    <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsPaused(!isPaused)}>
      {isPaused ? 'Resume' : 'Pause'}
    </Button>
    <Button variant="outline" size="sm" className="flex-1" onClick={skipSet}>
      Skip
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setIsCruiseActive(false)}>
      Exit
    </Button>
  </div>
</div>
```

### 5. CruiseTimer
```tsx
<div className="space-y-6">
  <h2 className="text-xl font-bold text-white">Rest Time</h2>
  <p className="text-muted-foreground">
    Next: {cruiseSetIdx + 1 < bbResults[cruiseExerciseIdx].sets.length 
      ? `Set ${cruiseSetIdx + 2}` 
      : bbResults[cruiseExerciseIdx + 1]?.exerciseName || 'Next exercise'}
  </p>
  <div className="text-6xl font-mono font-bold text-white">
    {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
  </div>
  <div className="flex gap-4 pt-4">
    <Button variant="outline" size="sm" className="flex-1" onClick={() => setIsPaused(!isPaused)}>
      {isPaused ? 'Resume' : 'Pause'}
    </Button>
    <Button variant="outline" size="sm" className="flex-1" onClick={skipRest}>
      Skip Rest
    </Button>
    <Button variant="ghost" size="sm" onClick={() => setIsCruiseActive(false)}>
      Exit
    </Button>
  </div>
</div>
```

### 6. CruiseComplete
```tsx
<div className="space-y-6">
  <h2 className="text-3xl font-bold text-green-400">Workout Complete! ✓</h2>
  <p className="text-muted-foreground">All exercises logged successfully</p>
  <Button onClick={() => setIsCruiseActive(false)} className="w-full">
    Back to Edit
  </Button>
</div>
```

## Auto-focus Implementation
```typescript
// Ref voor weight input
const weightInputRef = useRef<HTMLInputElement>(null);

// Focus op weight bij setInput stap
useEffect(() => {
  if (cruiseStep === 'setInput' && weightInputRef.current) {
    weightInputRef.current.focus();
    weightInputRef.current.select();
  }
}, [cruiseStep]);
```

## Skip Functionaliteit
```typescript
const skipSet = () => {
  // Sla huidige set over
  const nextSet = cruiseSetIdx + 1;
  const currentExercise = bbResults[cruiseExerciseIdx];
  
  if (nextSet < currentExercise.sets.length) {
    setCruiseSetIdx(nextSet);
    setCurrentReps('');
    setCurrentWeight('');
    return;
  }
  
  // Sla naar volgende oefening
  const nextExercise = cruiseExerciseIdx + 1;
  if (nextExercise < bbResults.length) {
    setCruiseExerciseIdx(nextExercise);
    setCruiseSetIdx(0);
    setCurrentReps('');
    setCurrentWeight('');
    setCruiseStep('setInput');
    return;
  }
  
  // Alles geskiped
  setCruiseStep('complete');
};

const skipRest = () => {
  setTimerActive(false);
  timerDone();
};
```

## Pauze Functionaliteit
```typescript
// Timer pause logic al geïntegreerd in timer useEffect
// Knoppen tonen isPaused state en togglen deze
```

## Imports Toevoegen
```typescript
// Lucide icons
import { PlayCircle, PauseCircle, SkipForward, Check, X } from 'lucide-react';
```

## Volgorde van Implementatie
1. State toevoegen aan LogEditPage
2. Imports toevoegen (icons)
3. CruiseControlModal component creëren
4. Cruise Control knop toevoegen aan CardHeader
5. Timer logic implementeren
6. Wake Lock implementeren
7. Auto-focus implementeren
8. Skip/Pauze functionaliteit
9. Auto-save implementeren
10. Beep geluid toevoegen
11. Stijl finetuning

## Test Scenarios
- [ ] Cruise start met 1 oefening, 1 set
- [ ] Cruise start met 2 oefeningen, meerdere sets
- [ ] Pauze tijdens timer
- [ ] Skip set
- [ ] Skip rest
- [ ] Exit cruise mode
- [ ] Auto-save na elke set
- [ ] Wake lock actief
- [ ] Geluid bij timer afloop
- [ ] Auto-focus op weight
- [ ] Lege bbResults (moet error tonen)
