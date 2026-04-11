import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workoutsTable = pgTable("workouts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  description: text("description"),
  duration: integer("duration"),
  rounds: integer("rounds"),
  exercises: text("exercises").notNull().default("[]"),
  sport: text("sport"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id"),
});

export const insertWorkoutSchema = createInsertSchema(workoutsTable).omit({ id: true, createdAt: true });
export type InsertWorkout = z.infer<typeof insertWorkoutSchema>;
export type Workout = typeof workoutsTable.$inferSelect;
