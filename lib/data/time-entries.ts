import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import { timeEntries, type TimeEntry } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { editRefusedByInvoice, isBilled } from "@/lib/time/billing";

import {
  deliverableProject,
  foreignDeliverable,
  requireProject,
  requireProjectDeliverable,
} from "./belonging";
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

  const projectId = await requireProject(
    input.projectId,
    database,
    "time entry project",
  );
  if (deliverableId !== null) {
    await requireProjectDeliverable(deliverableId, projectId, database);
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
 * A stretch of days, both ends included: what a timesheet asks for.
 *
 * Calendar dates rather than timestamps, because `worked_on` holds a day. Both
 * ends inclusive, because a week is seven days and a range that excluded its
 * last one would lose every Sunday to an off-by-one nobody would see until a
 * month was short.
 */
export type WorkedOnRange = {
  /** The first day to include: `YYYY-MM-DD`. */
  readonly from: string;
  /** The last day to include. */
  readonly to: string;
};

/**
 * Every project's time entries worked on in a stretch of days, most recent
 * first.
 *
 * The one query in this module that is not scoped to a project, because the
 * timesheet is not: it is a week across the whole studio, and asking per
 * project would mean a query per row and a round trip the page spends waiting.
 *
 * Both ends inclusive, as `WorkedOnRange` says. A range whose `from` is after
 * its `to` holds no days and so comes back empty rather than throwing — that
 * is what the comparison does on its own, and it is the honest answer for a
 * span with nothing in it.
 *
 * The dates go through the same `calendarDate` guard the column itself does.
 * A timestamp would compare as a string against days and silently exclude the
 * whole of its own date, which is the kind of filter that looks like missing
 * data rather than a bad query.
 *
 * The `project_id, worked_on` index does not cover this — the filter is on the
 * second column — so this is a scan of the table restricted by date. For a
 * week of one studio's work that is a handful of rows, and Day 092 is where
 * query shapes get looked at with a plan in hand rather than a guess.
 */
export async function listTimeEntriesInRange(
  range: WorkedOnRange,
  database: Database = db,
): Promise<TimeEntry[]> {
  const from = calendarDate(range.from, "range start");
  const to = calendarDate(range.to, "range end");

  return database
    .select()
    .from(timeEntries)
    .where(and(gte(timeEntries.workedOn, from), lte(timeEntries.workedOn, to)))
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
 * Codes rather than sentences, the same arrangement the scope copies use.
 * Every one of these is reachable from a page that was right when it
 * rendered — the entry deleted in another tab, the line of scope dropped while
 * the edit form sat open, the invoice raised a moment before Save — so the
 * words for a reader belong with the form that shows them.
 *
 * What is *not* here is an attribution to another project's deliverable. No
 * page this app renders offers one, so a submission carrying it is a caller
 * that built the form wrong, and that throws: a refusal code exists to be
 * turned into a sentence, and there is no sentence to write for a reader who
 * did nothing.
 */
export type TimeEntryRefusal =
  | "no-such-entry"
  | "no-such-deliverable"
  | "billed";

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
       *
       * A line that has been dropped since the form was rendered is a refusal
       * rather than a throw, which is where this parts company with
       * `createTimeEntry` and with `updateProject`'s client reassignment. Both
       * of those hand the reader "nothing was written — try again", and trying
       * again cannot bring back a deleted deliverable; this already has a
       * union to put the answer in, so it says which line is gone and the form
       * can offer the ones that are left.
       */
      const attribution = values.deliverableId;
      if (attribution !== undefined && attribution !== null) {
        const owner = await deliverableProject(attribution, tx);
        if (owner === null) {
          return { ok: false, refusal: "no-such-deliverable" };
        }
        if (owner !== current.projectId) {
          throw foreignDeliverable(attribution, current.projectId);
        }
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
 * An entry this invoice already holds is an answer rather than a failure, so a
 * retried send can finish what it started: an invoice that wrote half its
 * entries and failed would otherwise find the half it already owns coming back
 * as refusals indistinguishable from somebody else's time. That case is
 * answered by a read rather than by widening the WHERE clause to accept it,
 * because the row needs no change and a write that changes nothing would still
 * bump `updatedAt` — making every entry on a retried invoice look edited.
 *
 * Null is deliberately ambiguous between "no such entry", "not billable" and
 * "another invoice has it". Neither statement can tell them apart, and either
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
        isNull(timeEntries.billedInvoiceId),
      ),
    )
    .returning();
  if (row) return row;

  /*
    Nothing was written, which is the ordinary outcome of a retry as well as of
    a refusal. The read tells them apart and reports; it writes nothing either
    way, so the hour cannot land on two invoices however the two interleave.
  */
  const current = await getTimeEntry(id, database);
  return current?.billedInvoiceId === billedInvoiceId ? current : null;
}

/**
 * Frees one entry from the invoice that billed it and hands back the row as
 * written, or null if that invoice did not have it.
 *
 * The way back out, and Phase 6 needs one: an invoice deleted before it was
 * sent, a credit note, a line billed to the wrong client. Without this the
 * column is a one-way door and the only remedy for a mis-sent invoice is to
 * delete the time it was built from, which would take the record of the work
 * with it.
 *
 * The invoice has to name itself, which is the mirror of `markTimeEntryBilled`
 * accepting only unbilled time or its own. An hour can be billed, freed, and
 * billed again by a second invoice; a withdrawal that matched on "billed by
 * anybody" would then let the first invoice free time the second one is
 * charging for, and nothing downstream would notice until the hour was on two
 * invoices at once.
 *
 * Conditional, so freeing time an invoice does not have is not a write that
 * changes nothing but bumps `updatedAt` — the same reason an empty patch is a
 * no-op. Null therefore means "this invoice has no time here", whether because
 * the entry is gone, was never billed, or has since moved to another invoice.
 *
 * `billable` is left alone. An invoice being withdrawn says nothing about
 * whether the work should be charged for, and the hour this frees is almost
 * always one that belongs on the next invoice.
 */
export async function clearTimeEntryBilled(
  id: string,
  invoiceId: string,
  database: Database = db,
): Promise<TimeEntry | null> {
  const billedInvoiceId = requiredText(invoiceId, "billed invoice");

  const [row] = await database
    .update(timeEntries)
    .set({ billedInvoiceId: null, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(timeEntries.id, id),
        eq(timeEntries.billedInvoiceId, billedInvoiceId),
      ),
    )
    .returning();
  return row ?? null;
}

/**
 * Removes the entry and hands back the row it removed, or why it did not.
 *
 * Deleted outright rather than archived. A stretch of work that happened and
 * should not be charged for is a non-billable entry, which keeps the record
 * and the attribution; what is left to delete is a mistake — the wrong
 * project, the duplicate of a double-pressed button, the forty minutes typed
 * as forty hours — and keeping those is how a time list stops being read.
 *
 * Billed time is refused. An invoice has already charged for it, and deleting
 * the entry would leave a line on a document somebody has been sent with
 * nothing behind it: the project would show less time than it was paid for,
 * and nothing anywhere would say why. The way to undo a bad invoice is a
 * credit note, after which `clearTimeEntryBilled` frees the time and this
 * will remove it.
 *
 * The read and the delete are one immediate transaction rather than a single
 * conditional DELETE, because the two refusals are different news and one
 * statement cannot tell them apart. Immediate, so no invoice can claim the
 * entry between the read and the delete.
 */
export async function deleteTimeEntry(
  id: string,
  database: Database = db,
): Promise<TimeEntryWrite> {
  return database.transaction(
    async (tx) => {
      const current = await getTimeEntry(id, tx);
      if (current === null) return { ok: false, refusal: "no-such-entry" };
      if (isBilled(current)) return { ok: false, refusal: "billed" };

      await tx.delete(timeEntries).where(eq(timeEntries.id, id));
      return { ok: true, entry: current };
    },
    { behavior: "immediate" },
  );
}
