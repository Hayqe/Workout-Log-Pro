import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const userSettingsTable = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  komootUsername: text("komoot_username"),
  komootPasswordEncrypted: text("komoot_password_encrypted"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserSettings = typeof userSettingsTable.$inferSelect;
