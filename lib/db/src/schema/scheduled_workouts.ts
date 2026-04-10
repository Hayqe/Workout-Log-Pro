import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const scheduledWorkoutsTable = pgTable("scheduled_workouts", {
  id: serial("id").primaryKey(),
  workoutId: integer("workout_id"),
  workoutName: text("workout_name").notNull(),
  workoutType: text("workout_type").notNull(),
  scheduledDate: text("scheduled_date").notNull(),
  notes: text("notes"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id"),
});

export const insertScheduledWorkoutSchema = createInsertSchema(scheduledWorkoutsTable).omit({ id: true, createdAt: true, completed: true });
export type InsertScheduledWorkout = z.infer<typeof insertScheduledWorkoutSchema>;
export type ScheduledWorkout = typeof scheduledWorkoutsTable.$inferSelect;
