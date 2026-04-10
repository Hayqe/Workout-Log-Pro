# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

- **Workout Tracker** (`artifacts/workout-tracker`) — React + Vite web app at `/`
- **API Server** (`artifacts/api-server`) — Express 5 backend at `/api`

## Features

GainLog — A multi-user workout tracking web platform with:
- **Authentication** — username/password login and registration, bcrypt-hashed passwords, session-based auth (express-session)
- **Per-user data** — all workouts, logs, scheduled workouts, and exercises are scoped to the logged-in user
- **Bodybuilding workouts** — exercises with sets, reps (+ optional max reps flag), and weight (can be empty in template, filled at log time)
- **CrossFit-style workouts** — AMRAP, EMOM, and RFT formats
- **Cardio workouts** — cycling/running with distance, duration, heart rate, elevation
- **Workout planner** — monthly calendar view with scheduled workouts
- **Log book** — record results for every session; bodybuilding logs include a built-in rest timer
- **Dashboard** — summary stats, weekly volume chart, upcoming sessions, recent logs
- **Exercise library** — searchable list with click-through to individual exercise progress pages
- **Exercise autocomplete** — typing in the workout builder shows a dropdown of matching exercises from the library; quick-add adds a new one inline
- **Exercise progress chart** — clicking an exercise shows a Recharts line chart of max weight over time, grouped by rep count (separate line per rep range)
- **Previous weights hint** — when logging a bodybuilding session, each exercise shows the last session's sets (date + reps×weight) as a subtle hint below the name
- **Calendar visibility** — when scheduling a workout, choose "Only me" (private) or "Everyone" (public); public workouts from other users appear on your calendar marked "shared" and are read-only

## Database Schema

- `users` — accounts with hashed passwords
- `exercises` — exercise library (per user + shared)
- `workouts` — workout templates (per user)
- `scheduled_workouts` — calendar entries (per user)
- `workout_logs` — logged sessions with results (per user)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
