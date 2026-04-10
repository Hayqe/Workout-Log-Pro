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

GainLog — A workout tracking web platform with:
- **Bodybuilding workouts** — exercises with sets, reps, and weight
- **CrossFit-style workouts** — AMRAP, EMOM, and RFT formats
- **Cardio workouts** — cycling/running with distance, duration, heart rate, elevation
- **Workout planner** — monthly calendar view with scheduled workouts
- **Log book** — record results for every session
- **Dashboard** — summary stats, weekly volume chart, upcoming sessions, recent logs
- **Exercise library** — searchable list of exercises

## Database Schema

- `exercises` — exercise library
- `workouts` — workout templates
- `scheduled_workouts` — calendar entries
- `workout_logs` — logged sessions with results

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
