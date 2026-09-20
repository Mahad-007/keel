import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Schema grows one table at a time as the roadmap advances. Two conventions
 * hold everywhere:
 *   - ids are cuid-ish text, generated in the data layer, never autoincrement
 *   - money is stored in whole cents as an integer, never a float
 */

const timestamps = {
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(current_timestamp)`),
};

export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  company: text("company"),
  notes: text("notes"),
  /** Default billing rate in cents per hour. Projects may override it. */
  defaultRateCents: integer("default_rate_cents").notNull().default(0),
  archivedAt: text("archived_at"),
  ...timestamps,
});

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
