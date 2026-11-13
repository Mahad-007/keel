import {
  and,
  count,
  desc,
  eq,
  getTableColumns,
  gte,
  isNull,
  lte,
  sql,
  type SQL,
} from "drizzle-orm";

import { db, type Database } from "@/lib/db";
import {
  clients,
  projects,
  timeEntries,
  type TimeEntry,
} from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { editRefusedByInvoice, isBilled } from "@/lib/time/billing";
import type { LoggedTotals } from "@/lib/time/rollup";

import {
  deliverableProject,
  findProject,
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

/**
 * Why a set of entries was not written.
 *
 * Codes rather than sentences, the same arrangement the rest of this module
 * uses. `no-such-project` is reachable from a page that was right when it
 * rendered — a timesheet left open while a project was deleted somewhere
 * else — so the words for a reader belong with the form that shows them.
 *
 * `no-entries` is not reachable from any page: a grid with nothing typed into
 * it is refused before the write is called. It is here because a caller that
 * managed to ask for a write of nothing has a bug, and reporting success for
 * a write that changed nothing is the kind of answer that hides one.
 */
export type BulkTimeReason = "no-such-project" | "no-entries";

/**
 * The outcome of writing a set of entries: every row, or the reason none of
 * them was written.
 *
 * There is no partial answer in this type, and that is the point of the
 * function. A caller told "nine of your twelve landed" has no way to work out
 * which three are missing and no way to ask for them again without
 * duplicating the nine.
 */
export type BulkTimeResult =
  | { readonly ok: true; readonly entries: TimeEntry[] }
  | { readonly ok: false; readonly reason: BulkTimeReason };

/**
 * Writes a set of time entries and hands back the rows, or refuses the lot.
 *
 * What the timesheet grid presses once for. A week written up on Friday is a
 * dozen entries across several projects, and twelve separate inserts is twelve
 * chances to end up with a sheet that is half filled in — the one state nobody
 * can recover from, because the figures on screen no longer say which of the
 * twelve a reader still owes.
 *
 * One immediate transaction around the lot, so a sheet lands whole or not at
 * all. Immediate rather than deferred because the first thing it does is read:
 * a deferred transaction takes no write lock until the first insert, which
 * would let two presses both find a project that one of them is about to
 * invalidate.
 *
 * Each entry goes through `createTimeEntry` rather than being inserted here.
 * That is the one door time comes through — it is what defaults an entry to
 * chargeable, collapses a blank attribution to NULL, and refuses an
 * attribution belonging to another engagement — and a bulk insert would be a
 * second set of rules for the same table to drift from.
 *
 * The cost is real and worth writing down: every entry is its own savepoint
 * and its own project lookup, on top of the distinct-project pass in front of
 * them. For a week of one studio's work that is tens of statements inside one
 * transaction, which against a local file is nothing and against a hosted
 * libSQL is tens of round trips on a press somebody makes once a week. What
 * bounds it is the grid: the cells a submission may name are the week's days
 * times the studio's projects, and nothing a caller sends can add to that.
 *
 * The projects are checked up front, once each, rather than being left to the
 * insert. `createTimeEntry` throws on a project that is not there, which is
 * the right answer for a form that names one engagement — it is a bug — and
 * the wrong one here: a timesheet names every active project at once, so one
 * closed down in another tab while the sheet sat open is ordinary news that
 * deserves a sentence rather than a stack trace.
 */
export async function createTimeEntries(
  inputs: readonly NewTimeEntryInput[],
  database: Database = db,
): Promise<BulkTimeResult> {
  /*
    Asked before the transaction is opened, like the guards below: a write of
    nothing would report success and change nothing, and the caller that
    managed to ask for one has a bug rather than a studio to blame.
  */
  if (inputs.length === 0) return { ok: false, reason: "no-entries" };

  /*
    The column guards, run over every input before anything is opened. Each is
    the same function `createTimeEntry` applies, so this is the same rule
    earlier rather than a second opinion about it — and a duration of zero or a
    date with a time on it is a bug in the caller that now costs no round trip
    and no rolled-back transaction to find.
  */
  for (const input of inputs) {
    positiveMinutes(input.minutes, "time entry minutes");
    calendarDate(input.workedOn, "time entry worked on");
  }

  return database.transaction(
    async (tx) => {
      /*
        Once per project rather than once per entry. A week of one project is
        seven entries naming the same engagement, and asking seven times would
        be six reads whose answer is already known.
      */
      const known = new Set<string>();
      for (const input of inputs) {
        const projectId = requiredText(input.projectId, "time entry project");
        if (known.has(projectId)) continue;
        if ((await findProject(projectId, tx)) === null) {
          return { ok: false, reason: "no-such-project" };
        }
        known.add(projectId);
      }

      const entries: TimeEntry[] = [];
      for (const input of inputs) {
        entries.push(await createTimeEntry(input, tx));
      }
      return { ok: true, entries };
    },
    { behavior: "immediate" },
  );
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
 * What one project's time comes to, totalled in SQL rather than in JavaScript.
 *
 * The burn summary wants three integers and nothing else: how many entries,
 * how many minutes, and how many of those minutes are meant to be charged
 * for. Reading every row to add them up is the obvious way and it is the wrong
 * one — an engagement that has run for a year is thousands of rows crossing a
 * wire so that one page can print two figures, and the page does not show a
 * single one of them.
 *
 * `LoggedTotals` rather than a shape of this file's own, because that is
 * exactly what `loggedTotals` produces from a list of entries: the same three
 * fields, with the same meanings, so a caller holding the rows and a caller
 * holding only the totals are holding the same kind of thing. Two shapes would
 * drift, and the burn summary would end up reading one and the rollup the
 * other.
 *
 * Both sums are guarded with `coalesce`, because `SUM` over no rows is NULL in
 * SQLite rather than nought. A project nobody has logged against comes back as
 * three zeroes, which is the right answer and is what the figures above it are
 * written to read.
 *
 * The chargeable half is a `CASE` inside the sum rather than a second query
 * with a `WHERE`: two round trips for one row, and a window between them in
 * which an entry could be logged, is how a page comes to show more chargeable
 * minutes than it has logged.
 *
 * It compares the flag against 1 rather than letting SQLite decide what is
 * truthy, because `isChargeable` is strictly `=== true` and Drizzle reads the
 * column back the same way. The column is plain INTEGER, so a hand-edited row
 * can hold 2 — which SQLite calls true and both of those call false, and the
 * entry would then be chargeable to the burn summary and written off on the
 * Time tab. Two panels disagreeing about one row is exactly what sharing
 * `LoggedTotals` is meant to prevent.
 *
 * Counted and summed, rather than counted alone, because the count is the
 * working behind the total — "twelve hours" is one thing as a single entry
 * somebody typed wrong and another as nineteen afternoons.
 */
export async function projectTimeTotals(
  projectId: string,
  database: Database = db,
): Promise<LoggedTotals> {
  const [row] = await database
    .select({
      entryCount: count(),
      loggedMinutes: sql<number>`coalesce(sum(${timeEntries.minutes}), 0)`,
      billableMinutes: sql<number>`coalesce(sum(case when ${timeEntries.billable} = 1 then ${timeEntries.minutes} else 0 end), 0)`,
    })
    .from(timeEntries)
    .where(eq(timeEntries.projectId, projectId));

  return {
    entryCount: Number(row?.entryCount ?? 0),
    loggedMinutes: Number(row?.loggedMinutes ?? 0),
    billableMinutes: Number(row?.billableMinutes ?? 0),
  };
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
 * What the time log asks for: any of the four filters, each optional.
 *
 * Every field absent is every entry there is, which is what `/time/entries`
 * with no params shows. `null` and absent mean the same thing on each of
 * them — no restriction — because the query is built from a parsed URL where
 * an unset filter is null, and making the caller strip those out would be
 * making it build the same object twice.
 *
 * `clientId` is here even though a time entry has no client column. The
 * question "what has Harbour Co cost this month" is the one a studio asks at
 * the end of a month, and answering it by listing their projects and then
 * asking for each one's time would be a query per project and a different
 * answer if a project moved client in between.
 */
export type TimeEntryFilter = {
  /** The first day to include. Absent or null for no lower bound. */
  readonly from?: string | null;
  /** The last day to include, inclusive. Absent or null for no upper bound. */
  readonly to?: string | null;
  /** The one project to show, or absent for every project. */
  readonly projectId?: string | null;
  /** The one client to show, or absent for every client. */
  readonly clientId?: string | null;
  /** The billing state to show, or absent for both of them. */
  readonly billable?: boolean | null;
};

/**
 * A time entry with the names of what it was done for, which is what a log
 * across projects has to show.
 *
 * The project page's list needs none of this — every row there belongs to the
 * project in the heading — but a log filtered by date holds entries from four
 * engagements at once, and a duration with no project beside it is a figure
 * nobody can act on.
 *
 * `clientId` comes back as well as the name, because the rows are what the
 * log's own links are built from: a row naming Harbour Co links to Harbour
 * Co's time, and a link needs the id the filter is written with.
 */
export type TimeEntryWithNames = TimeEntry & {
  projectName: string;
  clientId: string;
  clientName: string;
};

/**
 * Every time entry the filters admit, most recent first, with the project and
 * client it was done for.
 *
 * What `/time/entries` renders. One query however many filters are set: each
 * one that is absent simply contributes no condition, so "Harbour Co's
 * unbilled time in October" and "everything" are the same statement with a
 * different WHERE clause rather than four code paths that can disagree about
 * the ordering.
 *
 * The joins are inner, like the project list's, and for the same reason: the
 * foreign keys guarantee both rows exist, so a left join would add a null case
 * that cannot happen and that every caller would then have to render something
 * for.
 *
 * The dates go through the same `calendarDate` guard the column itself does,
 * for the reason `listTimeEntriesInRange` gives — a timestamp compared as a
 * string against days silently excludes the whole of its own date, which looks
 * like missing data rather than a bad query. A range whose `from` is after its
 * `to` holds no days and comes back empty, which is what the comparison does
 * on its own and the honest answer for a span with nothing in it.
 *
 * An id that names nothing is a filter that matches nothing rather than an
 * error. A project deleted while the log sat open is ordinary news, and an
 * empty list under a picker the page has marked as naming something gone is
 * the right thing to show.
 *
 * No index covers this. The filter may be on any of three tables and the sort
 * is on `worked_on` across the whole table, so it is a scan of the entries
 * joined to their projects. For one studio's ledger that is the right trade
 * against four indexes to maintain, and Day 092 is where query shapes get
 * looked at with a plan in hand rather than a guess.
 */
export async function listFilteredTimeEntries(
  filter: TimeEntryFilter = {},
  database: Database = db,
): Promise<TimeEntryWithNames[]> {
  const conditions: SQL[] = [];
  if (filter.from != null) {
    conditions.push(gte(timeEntries.workedOn, calendarDate(filter.from, "range start")));
  }
  if (filter.to != null) {
    conditions.push(lte(timeEntries.workedOn, calendarDate(filter.to, "range end")));
  }
  if (filter.projectId != null) {
    conditions.push(
      eq(timeEntries.projectId, requiredText(filter.projectId, "filter project")),
    );
  }
  if (filter.clientId != null) {
    conditions.push(
      eq(projects.clientId, requiredText(filter.clientId, "filter client")),
    );
  }
  if (filter.billable != null) {
    conditions.push(eq(timeEntries.billable, filter.billable));
  }

  return database
    .select({
      ...getTableColumns(timeEntries),
      projectName: projects.name,
      clientId: clients.id,
      clientName: clients.name,
    })
    .from(timeEntries)
    .innerJoin(projects, eq(projects.id, timeEntries.projectId))
    .innerJoin(clients, eq(clients.id, projects.clientId))
    .where(conditions.length === 0 ? undefined : and(...conditions))
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
