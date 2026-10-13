import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import {
  DEFAULT_DELIVERABLE_STATUS,
  DELIVERABLE_STATUSES,
} from "@/lib/deliverables/status";
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

/**
 * One line of a project's agreed scope: a thing to be delivered, what it was
 * estimated at, and where it stands.
 *
 * This is the contract side of the product. Time is logged against a project
 * and attributed to a deliverable, and the gap between what a deliverable was
 * estimated at and what it has cost is the measurement the whole scope-creep
 * phase is built on. A project without deliverables can only say it is over
 * budget; a project with them can say which part of the work ate it.
 *
 * `estimatedMinutes` is whole minutes, never hours — the repo's time unit —
 * and zero means "not estimated yet" rather than "free", because no real
 * deliverable takes no time. Scope summaries flag the zeroes rather than
 * quietly totalling them as nothing.
 *
 * `sortOrder` is a position, not a priority: dense integers from zero that the
 * data layer renumbers, because the order a scope list is read in is the order
 * the two parties agreed it in. Ties are impossible by construction, so the
 * list cannot shuffle between reloads.
 *
 * Rows cascade with the project. A deliverable is part of an engagement, not
 * a record of one, so there is nothing to keep once the project is gone.
 */
export const deliverables = sqliteTable(
  "deliverables",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** The detail behind the title. NULL when the title said it all. */
    description: text("description"),
    /** The estimate in whole minutes. Zero means nobody has estimated it. */
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    status: text("status", { enum: DELIVERABLE_STATUSES })
      .notNull()
      .default(DEFAULT_DELIVERABLE_STATUS),
    /** Position in the project's list, dense from zero. */
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  /**
   * A scope list is only ever read one project at a time and always in order,
   * so the index covers both halves of that query and the list comes back
   * without a sort.
   */
  (table) => [
    index("deliverables_project_id_sort_order_idx").on(
      table.projectId,
      table.sortOrder,
    ),
  ],
);

export type Deliverable = typeof deliverables.$inferSelect;
export type NewDeliverable = typeof deliverables.$inferInsert;

/**
 * A saved set of deliverables, reusable as the starting scope of a project.
 *
 * Agencies and freelancers do the same engagement repeatedly — a brand
 * refresh, a site build, a retainer month — and the scope list is the part
 * that barely changes between them. Retyping it is how a line gets left off
 * the fourth one, and the line left off is the one nobody is paid for.
 *
 * The template is not attached to the project it was captured from, and there
 * is deliberately no `sourceProjectId`. A template outlives the engagement it
 * came from: the project gets closed, archived, eventually deleted, and the
 * template is still the right starting point for the next one. A column
 * pointing at a row that cascades away would make every read of this table
 * either nullable or wrong, to record a fact nothing asks for.
 *
 * `name` is what the picker shows and the only thing that distinguishes two
 * templates, which is why it is required where a deliverable's description is
 * not. Nothing enforces uniqueness: "Website build" and "Website build" are a
 * person's problem to name apart, and refusing the second one would refuse a
 * genuine variant mid-save with nowhere to put the work.
 */
export const deliverableTemplates = sqliteTable("deliverable_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** What the template is for, when the name does not say it. NULL if it does. */
  description: text("description"),
  ...timestamps,
});

export type DeliverableTemplate = typeof deliverableTemplates.$inferSelect;
export type NewDeliverableTemplate = typeof deliverableTemplates.$inferInsert;

/**
 * One line of a template: a deliverable without a project.
 *
 * It carries exactly the three things a person decides about a deliverable —
 * what it is, the detail behind it, and how long it was estimated at — and
 * none of the three that belong to an engagement. There is no status, because
 * a template describes work to be agreed rather than work in progress, and a
 * template saved off a half-finished project would otherwise hand the next
 * engagement two lines already marked done. There is no project, which is the
 * point of the table. And `sortOrder` is the template's own dense order rather
 * than the positions the source project happened to hold, so a template
 * captured from a list with a gap in it still applies as 1, 2, 3.
 *
 * Rows cascade with the template, for the same reason a deliverable cascades
 * with its project: a line is part of a template, not a record of one.
 */
export const deliverableTemplateLines = sqliteTable(
  "deliverable_template_lines",
  {
    id: text("id").primaryKey(),
    templateId: text("template_id")
      .notNull()
      .references(() => deliverableTemplates.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** The detail behind the title. NULL when the title said it all. */
    description: text("description"),
    /** The estimate in whole minutes. Zero means nobody has estimated it. */
    estimatedMinutes: integer("estimated_minutes").notNull().default(0),
    /** Position in the template's list, dense from zero. */
    sortOrder: integer("sort_order").notNull(),
    ...timestamps,
  },
  /**
   * A template's lines are only ever read one template at a time and always
   * in order, so the index covers both halves of that query — the same shape
   * as the deliverables index, because it is the same query.
   */
  (table) => [
    index("deliverable_template_lines_template_id_sort_order_idx").on(
      table.templateId,
      table.sortOrder,
    ),
  ],
);

export type DeliverableTemplateLine =
  typeof deliverableTemplateLines.$inferSelect;
export type NewDeliverableTemplateLine =
  typeof deliverableTemplateLines.$inferInsert;

/**
 * A project's scope as it stood at one moment, kept so that later changes to
 * it can be named rather than argued about.
 *
 * The deliverables table holds what is agreed *now*. That is the only thing a
 * scope list can hold, and it is why "we never agreed to that" is an
 * unwinnable conversation: the list has already been edited, and nothing
 * anywhere says what it said when the project started. A snapshot is the
 * missing half — take one when the proposal is signed, and every line added,
 * dropped, re-estimated or re-titled since is a fact with a date on it.
 *
 * `contractValueCents` is copied in rather than read off the project, because
 * the contract value moves too and the comparison is meaningless without it. A
 * scope list that grew by thirty hours is one story if the price went up with
 * it and quite another if it did not, and a snapshot that recorded only the
 * deliverables could not tell them apart.
 *
 * `capturedAt` is the only timestamp, and there is deliberately no
 * `updatedAt`: a snapshot that can be edited is not a snapshot. Rows here are
 * written once and never updated, the same rule the status trail follows, for
 * the same reason — a record of what was agreed is worth nothing if it can be
 * brought into line with what is agreed now.
 *
 * Rows cascade with the project. A snapshot is part of an engagement rather
 * than a record of one, and once the project is gone there is no list left for
 * it to be compared against.
 */
export const scopeSnapshots = sqliteTable(
  "scope_snapshots",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    /**
     * What this snapshot is, in the words of whoever took it — "Signed
     * proposal", "Before the March change order". NULL when they did not say,
     * in which case the date is the only thing distinguishing it.
     */
    label: text("label"),
    /** What the project was agreed for at that moment, in cents. */
    contractValueCents: integer("contract_value_cents").notNull(),
    /** The moment the scope list was copied. A snapshot's whole point. */
    capturedAt: text("captured_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  /**
   * Snapshots are only ever read one project at a time, newest first — the
   * picker on the scope tab, and the "what changed since" default. The index
   * covers both halves of that query.
   */
  (table) => [
    index("scope_snapshots_project_id_captured_at_idx").on(
      table.projectId,
      table.capturedAt,
    ),
  ],
);

export type ScopeSnapshot = typeof scopeSnapshots.$inferSelect;
export type NewScopeSnapshot = typeof scopeSnapshots.$inferInsert;

/**
 * One deliverable as it read when the snapshot was taken.
 *
 * A copy, not a reference. The deliverable it came from goes on being edited,
 * re-estimated, marked done and sometimes deleted, and every one of those is
 * the thing a snapshot exists to make visible — so the columns are duplicated
 * here and never read back through the live row.
 *
 * `deliverableId` is deliberately **not** a foreign key. It is the key the
 * comparison pairs the two lists on: a line with the same id in both is the
 * same deliverable, so a retitled one reads as a change rather than as one
 * line removed and another added. A deleted deliverable has to stay nameable
 * here — "Migrate the old posts, estimated at six hours, dropped" is the most
 * useful sentence this table can produce, and a cascade from `deliverables`
 * would take exactly those rows away.
 *
 * `status` is copied too, because scope changes include work being delivered.
 * A line that was pending at signing and is done now has not changed as a
 * promise, but it has changed as a fact about the engagement, and the two
 * readings are worth telling apart on the page rather than in the table.
 *
 * `sortOrder` is the snapshot's own dense order, which exists so the lines
 * come back in the sequence they were agreed in. It is not part of the
 * comparison — see `lib/snapshots/diff.ts` for why a move is not reported as
 * a change.
 *
 * No timestamps. Every line of a snapshot was captured at the instant the
 * snapshot was, and a `created_at` per line would be the same value written
 * repeatedly, inviting the belief that they could differ.
 */
export const scopeSnapshotLines = sqliteTable(
  "scope_snapshot_lines",
  {
    id: text("id").primaryKey(),
    snapshotId: text("snapshot_id")
      .notNull()
      .references(() => scopeSnapshots.id, { onDelete: "cascade" }),
    /** The deliverable this line was copied from. Not a foreign key. */
    deliverableId: text("deliverable_id").notNull(),
    title: text("title").notNull(),
    /** The detail behind the title, as it read. NULL when there was none. */
    description: text("description"),
    /** The estimate as it stood, in whole minutes. Zero means unsized. */
    estimatedMinutes: integer("estimated_minutes").notNull(),
    status: text("status", { enum: DELIVERABLE_STATUSES }).notNull(),
    /** Position in the snapshot's list, dense from zero. */
    sortOrder: integer("sort_order").notNull(),
  },
  /**
   * A snapshot's lines are only ever read one snapshot at a time and always in
   * order — the same shape as the deliverables and template-line indexes,
   * because it is the same query.
   */
  (table) => [
    index("scope_snapshot_lines_snapshot_id_sort_order_idx").on(
      table.snapshotId,
      table.sortOrder,
    ),
  ],
);

export type ScopeSnapshotLine = typeof scopeSnapshotLines.$inferSelect;
export type NewScopeSnapshotLine = typeof scopeSnapshotLines.$inferInsert;
