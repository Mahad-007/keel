import { desc, eq } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  deliverables,
  projects,
  timeEntries,
  type TimeEntry,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";

import {
  calendarDate,
  optionalText,
  positiveMinutes,
  requiredText,
} from "./fields";

/**
 * Data access for the `time_entries` table: the stretches of work a project
 * has actually cost.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a time entry — the same shape as
 * `deliverables.ts`.
 *
 * Two columns are not among the fields a caller sets. `billedInvoiceId` has
 * its own door, because marking time billed is something an invoice does to it
 * rather than an edit somebody makes, and a patch that could set it would let
 * a form bill an hour by accident. `projectId` is not patchable either: moving
 * time between engagements is not an edit to the entry, it is a claim about
 * whose money paid for it, and it would carry an attribution to a deliverable
 * belonging to the project it came from.
 */

/**
 * What logging a stretch of work needs: which project, how long, and the day
 * it was done on.
 *
 * `workedOn` is required and has no default. "Today" sounds like an obvious
 * one, and it is a timezone decision dressed up as a convenience: the server
 * may be hours away from the person logging, so the only thing that knows
 * which day they mean is the caller that has their clock.
 *
 * `billedInvoiceId` is absent by construction — an entry is not billed at the
 * moment it is logged, and the only way to a non-NULL value is the write that
 * an invoice makes.
 */
export type NewTimeEntryInput = {
  /** The engagement the work was done for. Must already exist. */
  projectId: string;
  /**
   * The line of scope it went against, if any. Must belong to the same
   * project. Absent and null both mean project-level work, which is a real
   * answer rather than a missing one.
   */
  deliverableId?: string | null;
  /** How long it took, in whole minutes. Never zero and never negative. */
  minutes: number;
  /** What was done, in a person's words. Blank and absent both store NULL. */
  note?: string | null;
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  workedOn: string;
  /** Defaults to true: time logged against a client engagement is chargeable. */
  billable?: boolean;
};

/**
 * Time logged against no project is not logged against anything, and the
 * foreign key would stop it anyway — but it would stop it with a constraint
 * error naming a column. Checking here means the caller gets a message naming
 * the id it passed, which is the one thing that says what went wrong.
 */
async function requireProject(
  id: string,
  database: Database,
): Promise<string> {
  const projectId = requiredText(id, "time entry project");
  const [row] = await database
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!row) throw new Error(`no project with id ${projectId}`);
  return row.id;
}

/**
 * The deliverable's id if it is one of that project's, or a thrown error
 * saying which of the two things was wrong.
 *
 * The foreign key only promises the deliverable exists somewhere. Time
 * attributed to another project's line would be counted against an estimate on
 * an engagement it was not worked for, and the rollup showing it would be
 * wrong on both projects at once — so the relationship is checked here, where
 * it can be named.
 *
 * One query rather than two. The row is read by id and its project compared in
 * JavaScript, which is also what lets the two failures have different
 * sentences: a deliverable that was deleted while the form sat open and one
 * that belongs to somebody else's engagement are different mistakes.
 */
async function requireDeliverable(
  id: string,
  projectId: string,
  database: Database,
): Promise<string> {
  const [row] = await database
    .select({ id: deliverables.id, projectId: deliverables.projectId })
    .from(deliverables)
    .where(eq(deliverables.id, id))
    .limit(1);
  if (!row) throw new Error(`no deliverable with id ${id}`);
  if (row.projectId !== projectId) {
    throw new Error(
      `deliverable ${id} does not belong to project ${projectId}`,
    );
  }
  return row.id;
}

/**
 * Writes one time entry and hands back the saved row.
 *
 * Everything that can be checked without a query is checked first, so the
 * common mistake — a duration of zero, a date with a time on it — costs no
 * round trip, and the project lookup only happens for an entry that is
 * otherwise valid.
 *
 * No transaction. The only write is the insert, and the project lookup in
 * front of it is there for the error message rather than for correctness: if
 * the project is deleted between the two, the foreign key refuses the insert,
 * which is the same answer reached less politely.
 *
 * An absent attribution and a blank one are the same thing, so `deliverableId`
 * goes through `optionalText`. A form with a "no deliverable" option submits
 * it as an empty string, and storing that would be a third state meaning what
 * NULL already means.
 */
export async function createTimeEntry(
  input: NewTimeEntryInput,
  database: Database = db,
): Promise<TimeEntry> {
  const now = new Date().toISOString();
  const minutes = positiveMinutes(input.minutes, "time entry minutes");
  const note = optionalText(input.note);
  const workedOn = calendarDate(input.workedOn, "time entry worked on");
  const deliverableId = optionalText(input.deliverableId);
  const billable = input.billable ?? true;

  const projectId = await requireProject(input.projectId, database);
  if (deliverableId !== null) {
    await requireDeliverable(deliverableId, projectId, database);
  }

  const [row] = await database
    .insert(timeEntries)
    .values({
      id: newId("tme"),
      projectId,
      deliverableId,
      minutes,
      note,
      workedOn,
      billable,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

/** One time entry by id, or null if there is no entry with that id. */
export async function getTimeEntry(
  id: string,
  database: Database = db,
): Promise<TimeEntry | null> {
  const [row] = await database
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * The order every list of time comes back in: the most recent work first,
 * then the most recently logged, with the id breaking ties.
 *
 * Most recent first because the question asked of a time list is almost always
 * about now — what went on this week, what is not yet invoiced — and a list
 * that starts at the beginning of a six-month engagement makes the reader
 * scroll to reach it.
 *
 * Three keys, because the first two can both tie. Several entries share a day
 * routinely, which is what `createdAt` separates: within a day they read in
 * the reverse of the order they were typed, so the one just logged is at the
 * top of the day it belongs to. Two logged in the same millisecond — a
 * double-pressed button, a bulk write — are what the id is for, and without it
 * the list would reorder itself between reloads.
 *
 * One constant, so the project list and the deliverable list cannot drift into
 * disagreeing about which entry is the latest.
 */
const NEWEST_FIRST = [
  desc(timeEntries.workedOn),
  desc(timeEntries.createdAt),
  desc(timeEntries.id),
] as const;

/**
 * One project's time entries, most recent first.
 *
 * Scoped to a project rather than listing the table, because that is how time
 * is read: a project's own list, a rollup against its estimates, an invoice
 * drawn from its unbilled hours. The `project_id, worked_on` index covers both
 * halves of the query, so the rows come back already in date order and only
 * the within-day tie-break is sorted.
 */
export async function listTimeEntries(
  projectId: string,
  database: Database = db,
): Promise<TimeEntry[]> {
  return database
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId))
    .orderBy(...NEWEST_FIRST);
}
