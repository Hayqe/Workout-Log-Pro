import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutLogsTable = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id"),
  workoutName: text("workout_name").notNull(),
  workoutType: text("workout_type").notNull(),
  loggedAt: text("logged_at").notNull(),
  durationMinutes: integer("duration_minutes"),
  notes: text("notes"),
  results: text("results").notNull().default("{}"),
  rating: integer("rating"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id"),
});

export const insertWorkoutLogSchema = createInsertSchema(workoutLogsTable).omit({ id: true, createdAt: true });
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;
export type WorkoutLog = typeof workoutLogsTable.$inferSelect;
