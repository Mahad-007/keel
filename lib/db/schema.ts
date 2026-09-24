import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  DEFAULT_PROJECT_STATUS,
  PROJECT_STATUSES,
} from "@/lib/projects/status";

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

/**
 * A project is one engagement for one client: the thing scope is agreed on,
 * time is logged against, and creep is measured against.
 *
 * `contractValueCents` is what was agreed for the whole project, not a rate.
 * `rateCents` is the per-hour override, and NULL means "use the client's
 * default" rather than "free" — which is why it is nullable while the client's
 * own rate is a not-null zero.
 *
 * `startedAt` and `closedAt` record the lifecycle rather than duplicating the
 * status: a closed project still has to say when it ran.
 */
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    name: text("name").notNull(),
    status: text("status", { enum: PROJECT_STATUSES })
      .notNull()
      .default(DEFAULT_PROJECT_STATUS),
    /** The whole agreed value of the engagement, in cents. */
    contractValueCents: integer("contract_value_cents").notNull().default(0),
    /** Hourly rate override in cents. NULL defers to the client's default. */
    rateCents: integer("rate_cents"),
    /** When the work actually began; NULL while the project is still a draft. */
    startedAt: text("started_at"),
    /** When it was closed; NULL for anything still open. */
    closedAt: text("closed_at"),
    ...timestamps,
  },
  /** Every project list is either "all of them" or "this client's". */
  (table) => [index("projects_client_id_idx").on(table.clientId)],
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
