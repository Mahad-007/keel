import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  deliverables,
  projects,
  timeEntries,
  type TimeEntry,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { editRefusedByInvoice } from "@/lib/time/billing";

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

/**
 * One deliverable's time entries, most recent first.
 *
 * The question behind it is the one the whole scope-creep phase asks: this
 * line was estimated at six hours, what has it actually taken. Its own query
 * rather than filtering a project's list, so the `deliverable_id` index does
 * the work and a page showing one line's time does not read every entry the
 * engagement has.
 *
 * Unattributed entries are not reachable through this, which is deliberate:
 * NULL is not a deliverable, and a list of "time against no line" is a
 * question about a project rather than about a deliverable. The project list
 * holds all of it, attributed or not, which is what keeps a total built from
 * these from quietly leaving work out.
 */
export async function listTimeEntriesForDeliverable(
  deliverableId: string,
  database: Database = db,
): Promise<TimeEntry[]> {
  return database
    .select()
    .from(timeEntries)
    .where(eq(timeEntries.deliverableId, deliverableId))
    .orderBy(...NEWEST_FIRST);
}

/**
 * Only the fields present are written, so a patch can touch one column.
 *
 * `projectId` is missing for the reason the module comment gives, and
 * `billedInvoiceId` was never an input. What is left is everything a person
 * can change about a stretch of work they logged: how long it took, what they
 * were doing, the day, whether it is chargeable, and which line of scope it
 * went against.
 */
export type TimeEntryPatch = Partial<Omit<NewTimeEntryInput, "projectId">>;

/**
 * Why a write against a time entry did not happen.
 *
 * Codes rather than sentences, the same arrangement the scope copies use: both
 * of these are reachable from a page that was right when it rendered — the
 * entry deleted in another tab, the invoice raised while the edit form sat
 * open — so the words for a reader belong with the form that shows them.
 */
export type TimeEntryRefusal = "no-such-entry" | "billed";

/**
 * The outcome of changing or removing a time entry: the row as it ended up, or
 * why nothing happened to it.
 *
 * A union rather than a nullable row, because the two refusals are not the
 * same news. "It is gone" means the page is stale and reloading fixes it; "an
 * invoice has it" means the edit will never be accepted and the way out is a
 * credit note. Collapsing them into null would leave the form telling a reader
 * to try again at something that cannot succeed.
 */
export type TimeEntryWrite =
  | { readonly ok: true; readonly entry: TimeEntry }
  | { readonly ok: false; readonly refusal: TimeEntryRefusal };

/**
 * Applies the fields present in the patch and hands back the row as it now
 * reads, or why it was not changed.
 *
 * An empty patch is a no-op rather than a write, so a form submitted without a
 * change does not bump `updatedAt` and make an untouched entry look edited —
 * the same rule `updateDeliverable` follows.
 *
 * Reading the row and writing it are one immediate transaction. The read is
 * what the billed check is made against, and a deferred transaction takes no
 * write lock until the update, so an invoice raised in between would be
 * overwritten by an edit that was refused a moment later on the same figures.
 *
 * The guards run before the transaction is opened: a duration of zero or a
 * date with a time on it costs no round trip, and it is a bug in the caller
 * either way rather than news for the reader.
 */
export async function updateTimeEntry(
  id: string,
  patch: TimeEntryPatch,
  database: Database = db,
): Promise<TimeEntryWrite> {
  const values: Partial<typeof timeEntries.$inferInsert> = {};
  if (patch.minutes !== undefined) {
    values.minutes = positiveMinutes(patch.minutes, "time entry minutes");
  }
  if (patch.note !== undefined) {
    values.note = optionalText(patch.note);
  }
  if (patch.workedOn !== undefined) {
    values.workedOn = calendarDate(patch.workedOn, "time entry worked on");
  }
  if (patch.billable !== undefined) {
    values.billable = patch.billable;
  }
  if (patch.deliverableId !== undefined) {
    values.deliverableId = optionalText(patch.deliverableId);
  }

  return database.transaction(
    async (tx) => {
      const current = await getTimeEntry(id, tx);
      if (current === null) return { ok: false, refusal: "no-such-entry" };
      if (editRefusedByInvoice(current, patch)) {
        return { ok: false, refusal: "billed" };
      }
      if (Object.keys(values).length === 0) return { ok: true, entry: current };

      /**
       * Re-attribution is checked against the project the entry is already on,
       * not against one the caller passes. The project is a fact about the row
       * here, so a patch cannot move time onto another engagement's line by
       * naming that engagement.
       */
      const attribution = values.deliverableId;
      if (attribution !== undefined && attribution !== null) {
        await requireDeliverable(attribution, current.projectId, tx);
      }

      values.updatedAt = new Date().toISOString();
      const [row] = await tx
        .update(timeEntries)
        .set(values)
        .where(eq(timeEntries.id, id))
        .returning();
      return { ok: true, entry: row };
    },
    { behavior: "immediate" },
  );
}

/**
 * Marks one entry as billed by an invoice and hands back the row as written,
 * or null if nothing was written.
 *
 * One statement, so there is no window between checking and writing for the
 * row to change in. The two conditions an invoice needs are in the WHERE
 * clause rather than in a read in front of it: the entry has to be billable,
 * because charging for time somebody marked non-billable is the mistake this
 * column exists to prevent, and it has to be unbilled, because the whole point
 * of the column is that an hour is not charged twice.
 *
 * Unbilled *or already billed by this same invoice*, which is what makes a
 * retried send idempotent. An invoice that wrote half its entries and failed
 * would otherwise be unable to finish: the half it already owns would come
 * back as refusals indistinguishable from somebody else's time.
 *
 * Null is deliberately ambiguous between "no such entry", "not billable" and
 * "another invoice has it". One statement cannot tell them apart, and either
 * way this invoice has not billed the time — the caller that wants to say
 * which reads the row for its message.
 */
export async function markTimeEntryBilled(
  id: string,
  invoiceId: string,
  database: Database = db,
): Promise<TimeEntry | null> {
  const billedInvoiceId = requiredText(invoiceId, "billed invoice");

  const [row] = await database
    .update(timeEntries)
    .set({ billedInvoiceId, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(timeEntries.id, id),
        eq(timeEntries.billable, true),
        or(
          isNull(timeEntries.billedInvoiceId),
          eq(timeEntries.billedInvoiceId, billedInvoiceId),
        ),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Frees one entry from the invoice that billed it and hands back the row as
 * written, or null if there was no billed time to free.
 *
 * The way back out, and Phase 6 needs one: an invoice deleted before it was
 * sent, a credit note, a line billed to the wrong client. Without this the
 * column is a one-way door and the only remedy for a mis-sent invoice is to
 * delete the time it was built from, which would take the record of the work
 * with it.
 *
 * Conditional on the entry actually being billed, so clearing an unbilled one
 * is not a write that changes nothing but bumps `updatedAt` — the same reason
 * an empty patch is a no-op. Null therefore means "there was no billed time
 * here", whether because the entry is gone or because nothing had it.
 *
 * `billable` is left alone. An invoice being withdrawn says nothing about
 * whether the work should be charged for, and the hour this frees is almost
 * always one that belongs on the next invoice.
 */
export async function clearTimeEntryBilled(
  id: string,
  database: Database = db,
): Promise<TimeEntry | null> {
  const [row] = await database
    .update(timeEntries)
    .set({ billedInvoiceId: null, updatedAt: new Date().toISOString() })
    .where(
      and(eq(timeEntries.id, id), isNotNull(timeEntries.billedInvoiceId)),
    )
    .returning();
  return row ?? null;
}
