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
  elbowPain: integer("elbow_pain").notNull().default(0),
  trainedOn: date("trained_on", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  exercise: text("exercise"),
  blockHeight: text("block_height"),
  band: text("band"),
  holdSeconds: integer("hold_seconds"),
});
