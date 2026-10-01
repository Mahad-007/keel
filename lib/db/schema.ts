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

/**
 * Every status a project has ever been in, and why it moved.
 *
 * The project row carries the status it is in now, which is all any list or
 * badge needs — and it is exactly the thing that answers "when did this close?"
 * by overwriting the previous answer. An engagement that was paused for two
 * months, resumed, and closed twice is a story the `status` column cannot tell,
 * and it is the story anybody arguing about a late invoice actually wants.
 *
 * Append-only: rows are written by `transitionProject` and never updated. A
 * trail that can be edited is not a trail.
 *
 * `fromStatus` is NULL for the row written when the project is created, which
 * is the one event with nothing before it. Every other row has both ends, so
 * the trail can be read without consulting the row above it.
 */
export const projectStatusEvents = sqliteTable(
  "project_status_events",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** The status left behind. NULL only on the project's opening event. */
    fromStatus: text("from_status", { enum: PROJECT_STATUSES }),
    toStatus: text("to_status", { enum: PROJECT_STATUSES }).notNull(),
    /**
     * Why, in the words of whoever moved it. Optional for most moves and
     * required to reopen a closed project — the whole point of the guard is
     * that reopening leaves a sentence behind.
     */
    reason: text("reason"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  /** The trail is only ever read one project at a time. */
  (table) => [
    index("project_status_events_project_id_idx").on(table.projectId),
  ],
);

export type ProjectStatusEvent = typeof projectStatusEvents.$inferSelect;
export type NewProjectStatusEvent = typeof projectStatusEvents.$inferInsert;
