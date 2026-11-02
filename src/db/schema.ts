import { date, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const handles = pgTable("handles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  vector: text("vector").notNull(),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sets = pgTable("sets", {
  id: text("id").primaryKey(),
  handleId: text("handle_id")
    .notNull()
    .references(() => handles.id),
  arm: text("arm").notNull(),
  weightGrams: integer("weight_grams").notNull(),
  reps: integer("reps").notNull(),
  setCount: integer("set_count").notNull().default(1),
  trainedOn: date("trained_on", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  exercise: text("exercise"),
  blockHeight: text("block_height"),
  band: text("band"),
  holdSeconds: integer("hold_seconds"),
  videoUrl: text("video_url"),
});

// id тут не сам токен з cookie, а його SHA-256. Якщо таблицю хтось прочитає,
// увійти з цими значеннями він не зможе.
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
