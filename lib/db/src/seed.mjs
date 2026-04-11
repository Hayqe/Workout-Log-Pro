#!/usr/bin/env node
/**
 * Idempotent seed for system exercises.
 * Safe to run on every startup — uses ON CONFLICT DO NOTHING.
 */
import pg from "pg";

const { Client } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const EXERCISES = [
  [1,  "Bench Press",      "Chest",      "bodybuilding", "Barbell bench press, compound pushing movement"],
  [2,  "Squat",            "Legs",       "bodybuilding", "Barbell back squat, king of leg exercises"],
  [3,  "Deadlift",         "Back",       "bodybuilding", "Conventional deadlift"],
  [4,  "Pull-up",          "Back",       "bodybuilding", "Bodyweight pull-up, overhand grip"],
  [5,  "Shoulder Press",   "Shoulders",  "bodybuilding", "Overhead barbell press"],
  [6,  "Barbell Row",      "Back",       "bodybuilding", "Bent-over barbell row"],
  [7,  "Box Jump",         "Legs",       "crossfit",     "Explosive box jump"],
  [8,  "Burpee",           "Full Body",  "crossfit",     "Burpee, full body movement"],
  [9,  "Kettlebell Swing", "Hips",       "crossfit",     "Russian kettlebell swing"],
  [10, "Double Under",     "Cardio",     "crossfit",     "Jump rope double under"],
  [11, "Wall Ball",        "Full Body",  "crossfit",     "20lb wall ball shot"],
  [12, "Running",          "Cardio",     "cardio",       "Outdoor or treadmill running"],
  [13, "Cycling",          "Cardio",     "cardio",       "Road or indoor cycling"],
];

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

// Ensure the session table exists before the app starts.
// connect-pg-simple reads table.sql from its own package directory at runtime;
// when the package is bundled by esbuild that file is missing, so we create
// the table here ourselves to guarantee it always exists.
await client.query(`
  CREATE TABLE IF NOT EXISTS "user_sessions" (
    "sid"    varchar NOT NULL,
    "sess"   json    NOT NULL,
    "expire" timestamp(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
  );
  CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "user_sessions" ("expire");
`);

console.log("Seeding system exercises...");
for (const [id, name, muscleGroup, category, description] of EXERCISES) {
  await client.query(
    `INSERT INTO exercises (id, name, muscle_group, category, description)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [id, name, muscleGroup, category, description]
  );
}

await client.query(
  `SELECT setval('exercises_id_seq', GREATEST(MAX(id), 1)) FROM exercises`
);

console.log("Seed complete — system exercises ready.");
await client.end();
