import { asc, eq, sql } from "drizzle-orm";

import {
  DEFAULT_BURN_SNAPSHOT_ORIGIN,
  type BurnSnapshotOrigin,
} from "@/lib/burndown/origin";
import { planBurnBackfill } from "@/lib/burndown/plan";
import type {
  BurnDay,
  BurnPoint,
  ProjectBurnDay,
} from "@/lib/burndown/series";
import { summariseBurn } from "@/lib/burn";
import { utcCalendarDate } from "@/lib/dates";
import { db, type Database } from "@/lib/db";
import { burnSnapshots, type BurnSnapshot } from "@/lib/db/schema";
import { newId } from "@/lib/id";
import { resolveJoinedRate } from "@/lib/rates";

import {
  calendarDate,
  isRecordableCents,
  isRecordableMinutes,
  isWholeCount,
  recordedCents,
  recordedMinutes,
  requiredText,
  wholeCount,
} from "./fields";
import { getProjectWithClient, listProjectsWithClient } from "./projects";
import {
  dailyProjectTimeTotals,
  dailyTimeTotalsByProject,
  projectTimeTotalsThrough,
} from "./time-entries";

/**
 * Data access for the `burn_snapshots` table: what each project had burned at
 * the end of each day.
 *
 * Plain async functions, one optional database handle each, and nothing
 * outside this file touches Drizzle for a burn reading. The table is written
 * two ways and read one way, which is the shape of the whole milestone: a
 * reading taken for a day as it happens, a reconstruction of the days that
 * happened before the table existed, and a list of a project's readings in
 * date order for whatever wants to draw them.
 *
 * The arithmetic is not here. A reading is a `BurnPoint` — Day 032's burn
 * summary with a date on it — and this module stores one and reads one back,
 * so the figures a chart plots are the figures the overview panel would have
 * shown on the day. What this file owns is the columns: which of them the
 * point maps onto, and what happens when a day is recorded twice.
 */

/**
 * What writing a reading needs: which project, the reading, and whether it was
 * measured or reconstructed.
 *
 * The point carries the day along with the figures, because they are one
 * thing: a burn summary dated to the wrong day is not a reading of anything,
 * and a separate `onDate` argument is exactly how a backfill writing a hundred
 * days comes to write them all under one date.
 *
 * `origin` defaults to `recorded`, the stronger claim, which is safe only
 * because the one caller that cannot make it — the backfill — names its origin
 * explicitly. See `lib/burndown/origin.ts` for why that is the right way
 * round.
 */
export type NewBurnSnapshotInput = {
  /** The project this is a reading of. Must already exist. */
  readonly projectId: string;
  /** The day, and the burn as it stood at the end of it. */
  readonly point: BurnPoint;
  /** Whether the reading was measured on the day or reconstructed later. */
  readonly origin?: BurnSnapshotOrigin;
};

/**
 * The columns a reading writes, guarded, with the day and the figures taken
 * off the point.
 *
 * The one place the burn summary's names and the table's names meet:
 * `contractedCents` is what a summary calls the price and
 * `contract_value_cents` is what the project calls it, and the translation
 * happens here so that the two writes below cannot disagree about it.
 *
 * The money goes through `recordedCents` rather than `wholeCents`, and the
 * minutes through `recordedMinutes` rather than `wholeMinutes`. A reading
 * records what the figures were, including the ones no form could produce: a
 * project hand-edited to a negative rate burns backwards, and that is the
 * engagement whose history somebody needs to see. Only a value too large to
 * read back is refused, because a row the driver cannot decode poisons every
 * later read of the table.
 *
 * `entryCount` is the exception and takes the ordinary guard, because there is
 * no such thing as recording minus one stretch of work.
 */
function burnSnapshotValues(
  input: NewBurnSnapshotInput,
  capturedAt: string,
): typeof burnSnapshots.$inferInsert {
  const { point } = input;

  return {
    id: newId("brn"),
    projectId: requiredText(input.projectId, "burn reading project"),
    onDate: calendarDate(point.onDate, "burn reading day"),
    contractValueCents: recordedCents(
      point.contractedCents,
      "recorded contract value",
    ),
    rateCents: recordedCents(point.rate.cents, "recorded rate"),
    rateSource: point.rate.source,
    entryCount: wholeCount(point.entryCount, "recorded entry count"),
    loggedMinutes: recordedMinutes(point.loggedMinutes, "recorded minutes"),
    billableMinutes: recordedMinutes(
      point.billableMinutes,
      "recorded chargeable minutes",
    ),
    burnedCents: recordedCents(point.burnedCents, "recorded burn"),
    chargeableCents: recordedCents(
      point.chargeableCents,
      "recorded chargeable burn",
    ),
    origin: input.origin ?? DEFAULT_BURN_SNAPSHOT_ORIGIN,
    capturedAt,
  };
}

/**
 * What a replaced reading takes from the reading that replaced it: every
 * column but the id and the two that identify the day.
 *
 * Read off `excluded` — SQLite's name for the row the insert offered — rather
 * than interpolated from the values. With one row the two are the same thing;
 * with several, interpolation would set every conflicting day to the figures
 * of whichever row the object was built from, which is the quiet way a repair
 * of ten days writes one day's figures ten times.
 *
 * The id is deliberately not refreshed, so a reading keeps the id it was first
 * written with: the row is the same reading, better informed, and anything
 * holding a reference to it still resolves to the day it named.
 */
const REFRESHED_FROM_THE_READING = {
  contractValueCents: sql`excluded.contract_value_cents`,
  rateCents: sql`excluded.rate_cents`,
  rateSource: sql`excluded.rate_source`,
  entryCount: sql`excluded.entry_count`,
  loggedMinutes: sql`excluded.logged_minutes`,
  billableMinutes: sql`excluded.billable_minutes`,
  burnedCents: sql`excluded.burned_cents`,
  chargeableCents: sql`excluded.chargeable_cents`,
  origin: sql`excluded.origin`,
  capturedAt: sql`excluded.captured_at`,
};

/**
 * Writes one day's reading, replacing any reading that day already had.
 *
 * An upsert, which is the one place this table departs from `scope_snapshots`
 * — and the departure is the point. A scope snapshot records what was agreed
 * at a moment somebody chose, so a second one is a second fact and editing one
 * destroys a record. A burn reading records the state of a *day*, and a day
 * has one state: a reading taken at lunchtime is the same day's reading as one
 * taken at six, and the second is simply better informed. Two rows would plot
 * one day at two heights, and the unique index refuses that — so the write has
 * to say what it means by a repeat, and it means a replacement.
 *
 * `capturedAt` is overwritten along with the figures, so the row says when the
 * reading it holds was taken rather than when the day was first recorded.
 * There is no `updatedAt`: the figures and the time they were taken are one
 * fact, and a second timestamp would invite the reading that the amounts are
 * from one moment and the day from another.
 *
 * Replacing rather than conflating also means a backfill can be run over a day
 * that has moved: time entries get corrected after the fact, and a reading
 * recorded before the correction is now wrong about a day it cannot
 * recalculate for itself.
 *
 * Nothing checks that the project exists, because the foreign key does. The
 * callers below read it anyway, for the rate — this is the narrow write they
 * both go through.
 */
export async function recordBurnSnapshot(
  input: NewBurnSnapshotInput,
  database: Database = db,
): Promise<BurnSnapshot> {
  const values = burnSnapshotValues(input, new Date().toISOString());

  const [snapshot] = await database
    .insert(burnSnapshots)
    .values(values)
    .onConflictDoUpdate({
      target: [burnSnapshots.projectId, burnSnapshots.onDate],
      set: REFRESHED_FROM_THE_READING,
    })
    .returning();

  return snapshot;
}

/**
 * The order a project's readings are always read in: oldest first.
 *
 * The opposite of every other list in the data layer, and deliberately so. A
 * list of rows is read as "what happened lately" and comes back newest first;
 * a series is read as a line and is drawn left to right. Handing a chart the
 * reversed order would mean every caller reversing it, and the first one to
 * forget would plot the engagement backwards — a burn-down that falls.
 *
 * One key and no tie-break, because the unique index makes a tie impossible: a
 * project has at most one reading per day.
 *
 * A constant rather than an `orderBy` per query, so the list a chart draws and
 * the dates a backfill compares against cannot come back in different orders.
 */
const OLDEST_FIRST = [asc(burnSnapshots.onDate)] as const;

/**
 * Every stored reading of one project, oldest first.
 *
 * The whole burn-down in one query. Scoped to a project, because that is the
 * only way a series is read — a chart is of one engagement, and the portfolio
 * views later in the phase ask for figures rather than for lines.
 *
 * The whole row rather than the nine columns a point needs, because the two
 * extras answer questions a chart asks: `origin` is whether a point can be
 * presented as a measurement, and `capturedAt` is how stale the end of the
 * line is. `recordedBurnPoint` takes what it needs from the row and ignores
 * the rest.
 *
 * The unique index covers this exactly: the project is the leading column and
 * the day is the second, so the rows come back in order without a sort.
 */
export async function listBurnSnapshots(
  projectId: string,
  database: Database = db,
): Promise<BurnSnapshot[]> {
  return database
    .select()
    .from(burnSnapshots)
    .where(eq(burnSnapshots.projectId, projectId))
    .orderBy(...OLDEST_FIRST);
}

/**
 * The columns a backfill reads of a stored reading: the day, and the running
 * totals it recorded.
 *
 * Four of the thirteen. `listBurnSnapshots` would answer the same question and
 * carry every column of every row to do it, which is a year of rows crossing a
 * wire so that a plan can compare forty days.
 *
 * The totals and not only the day, because a reading can be out of date as
 * well as absent — see `BurnBackfillRequest.recorded`. Not the money, though:
 * what a backfill compares is the work, and the whole point of the stored
 * figures is that the money may legitimately have been valued at a rate that
 * has since moved.
 */
const RECORDED_DAY_COLUMNS = {
  onDate: burnSnapshots.onDate,
  entryCount: burnSnapshots.entryCount,
  loggedMinutes: burnSnapshots.loggedMinutes,
  billableMinutes: burnSnapshots.billableMinutes,
};

/**
 * The readings one project already has, oldest first.
 *
 * What a backfill asks before it writes anything.
 *
 * It is the whole list rather than the latest, because the gaps are the point.
 * A project recorded daily for a month, left alone for a week and recorded
 * again has a hole in the middle, and a backfill that asked only how far the
 * history reached would skip straight past it — which is exactly the shape a
 * run that was interrupted leaves behind.
 *
 * The day comes off the unique index; the three totals are read from the rows
 * it points at.
 */
export async function burnSnapshotTotals(
  projectId: string,
  database: Database = db,
): Promise<BurnDay[]> {
  return database
    .select(RECORDED_DAY_COLUMNS)
    .from(burnSnapshots)
    .where(eq(burnSnapshots.projectId, projectId))
    .orderBy(...OLDEST_FIRST);
}

/**
 * Every recorded reading of every project, in project and then date order.
 *
 * `burnSnapshotTotals` across the whole studio, and one query for the same
 * reason the daily totals are: a backfill that asked each project for its
 * readings separately would be a round trip per project before it wrote
 * anything at all.
 *
 * Four columns and none of the money, like the per-project read it is the
 * studio-wide form of. The readings a run leaves alone are the bulk of the
 * table on every run after the first, and carrying their figures across the
 * wire to decide not to touch them is the cost that makes a repair something
 * nobody runs.
 *
 * Unscoped, like the daily totals it is paired with, and listed in `NOTES.md`
 * as a read Phase 8 has to scope by owner.
 */
export async function burnSnapshotDaysByProject(
  database: Database = db,
): Promise<ProjectBurnDay[]> {
  return database
    .select({
      projectId: burnSnapshots.projectId,
      ...RECORDED_DAY_COLUMNS,
    })
    .from(burnSnapshots)
    .orderBy(asc(burnSnapshots.projectId), ...OLDEST_FIRST);
}

/**
 * Why a project's burn could not be recorded for a day.
 *
 * Codes rather than sentences, the arrangement `SnapshotCaptureReason` makes:
 * both of these are reachable while something is running unattended, and the
 * words for a reader belong wherever a reader is told.
 *
 * `no-such-project` is the ordinary race — a project deleted between a list
 * being read and its readings being taken — and it is an answer rather than an
 * exception because a studio-wide run must not abandon forty projects over the
 * one that has gone.
 *
 * `day-not-reached` is a day in the future. Time can be logged against one —
 * a retainer blocked out for next week is not a mistake — but a reading of it
 * would say the engagement had already consumed money nobody has spent, and
 * the line would run off the end of the chart into work that has not happened.
 * It is the same bound `burnDaysThrough` applies to a computed series, applied
 * here so that nothing can store what that would refuse to plot.
 *
 * `unrecordable-figures` is a hand-edited row. The figures a reading records
 * are deliberately permissive about sign, so this is not a negative rate or a
 * contract value below zero — those are recorded as they stand, because the
 * engagement that looks wrong is the one somebody has to look at. It is a
 * value the column cannot hold at all: a fraction of a cent, a fraction of a
 * minute, or an amount past the point where an integer stops being exact and
 * the driver can no longer read the row back.
 */
export type BurnCaptureReason =
  | "no-such-project"
  | "unrecordable-figures"
  | "day-not-reached";

/** The outcome of asking a project for its burn as at one day. */
export type BurnCaptureResult =
  | { readonly ok: true; readonly snapshot: BurnSnapshot }
  | { readonly ok: false; readonly reason: BurnCaptureReason };

/**
 * Whether every figure of a reading is one its column can hold.
 *
 * Asked before the write rather than discovered during it, which is what the
 * `is…` half of each guard in `fields.ts` exists for: the writes below are
 * batched or run across a whole studio, and a throw partway through would roll
 * back readings that were perfectly good.
 *
 * It asks exactly what the guards in `burnSnapshotValues` ask, and the pairing
 * is the point — `recordedCents` for the money so a backwards-burning project
 * is recorded rather than refused, `recordedMinutes` for the durations, and
 * the strict count for the entries. A predicate that was stricter than the
 * guard would refuse rows that would have written; a looser one would leave
 * the throw in place with the refusal unreachable.
 */
function isRecordableBurn(point: BurnPoint): boolean {
  return (
    isRecordableCents(point.contractedCents) &&
    isRecordableCents(point.rate.cents) &&
    isRecordableCents(point.burnedCents) &&
    isRecordableCents(point.chargeableCents) &&
    isRecordableMinutes(point.loggedMinutes) &&
    isRecordableMinutes(point.billableMinutes) &&
    isWholeCount(point.entryCount)
  );
}

/**
 * Takes a reading of one project's burn as at the end of a given day.
 *
 * The daily half of the milestone. Three facts have to be true at the same
 * instant for a reading to mean anything — the minutes logged up to that day,
 * the price the project is agreed at, and the rate an hour is worth — so all
 * three are read inside one immediate transaction. A deferred one takes no
 * write lock until the insert, and a rate edited in between would produce a
 * row whose burn was worked out at a figure its own `rate_cents` column
 * contradicts.
 *
 * The rate comes from `resolveJoinedRate`, which is the one chain in the app
 * that decides what a NULL override means. A reading that resolved it itself
 * would be the second opinion `lib/rates.ts` exists to prevent, and the one it
 * would get wrong is the inheriting project — burned at nothing, for ever,
 * silently.
 *
 * `summariseBurn` does the arithmetic, unchanged, so a stored point and the
 * overview panel are the same figures from the same function. That is what
 * makes the end of a burn-down line up with the number beside it rather than
 * being a near miss nobody can account for.
 *
 * The day is recorded even when nothing has been logged by it: a project with
 * a price and no hours has burned nothing, which is a measurement and the
 * honest left-hand end of a line. What is *not* recorded is a day for a
 * project that does not exist, or a day that has not happened, and both
 * refusals are answers rather than exceptions because the caller is usually
 * recording a studio and must not stop.
 */
export type BurnCaptureOptions = {
  /**
   * The day the clock is on, which decides whether this reading is a
   * measurement. Defaults to today in UTC.
   *
   * It is an argument rather than a reading of the clock inside the function
   * for the reason `through` is: a caller recording a studio should record
   * every project against one answer to "today", and a test should be able to
   * say which day it means.
   */
  readonly today?: string;
};

export async function captureProjectBurn(
  projectId: string,
  onDate: string,
  options: BurnCaptureOptions = {},
  database: Database = db,
): Promise<BurnCaptureResult> {
  const day = calendarDate(onDate, "burn reading day");
  const today = options.today ?? utcCalendarDate(new Date());

  /*
    A day that has not happened cannot be read, however much time has been
    logged against it. Refused rather than clamped to today, because a caller
    asking for a day in the future has a bug in its idea of the date and
    quietly answering a different question would hide it.
  */
  if (day > calendarDate(today, "clock day")) {
    return { ok: false, reason: "day-not-reached" };
  }

  /*
    Measured only if it is a reading of the day it is taken on. A reading of
    last March takes this month's price and this month's rate, because those
    are the only ones stored anywhere — which is precisely a reconstruction,
    and the origin has to say so or the caveat on a chart would be missing from
    the points that need it most.

    A job that records yesterday just after midnight is therefore marked as a
    reconstruction too, when its figures were in fact in force. That is the
    conservative direction: a caveat that over-applies costs a reader a sentence
    and one that under-applies costs them the ability to tell.
  */
  const origin: BurnSnapshotOrigin = day === today ? "recorded" : "backfilled";

  return database.transaction(
    async (tx) => {
      const project = await getProjectWithClient(projectId, tx);
      if (project === null) return { ok: false, reason: "no-such-project" };

      const totals = await projectTimeTotalsThrough(project.id, day, tx);
      const point: BurnPoint = {
        onDate: day,
        ...summariseBurn(
          totals,
          project.contractValueCents,
          resolveJoinedRate(project),
        ),
      };

      if (!isRecordableBurn(point)) {
        return { ok: false, reason: "unrecordable-figures" };
      }

      const snapshot = await recordBurnSnapshot(
        { projectId, point, origin },
        tx,
      );
      return { ok: true, snapshot };
    },
    { behavior: "immediate" },
  );
}

/**
 * What a backfill is told: how far forward to reconstruct.
 *
 * One field, optional, because the only thing a backfill needs to be told is
 * where the past ends — and the answer is nearly always today. It is an
 * argument rather than a reading of the clock inside the loop so that a test
 * can state the day, and so that a studio-wide run reconstructs every project
 * against the same bound however long it takes.
 */
export type BurnBackfillOptions = {
  /** The last day to reconstruct. Defaults to today, in UTC. */
  readonly through?: string;
};

/**
 * What a backfill did to one project.
 *
 * All three numbers, because together they are the sentence. "Wrote 9 days,
 * repaired 2, left 41" says what the run did and what it did not touch;
 * (0, 0, 50) says it was run twice and the second time was a no-op, which is
 * the property anybody running a backfill over live data wants to see
 * demonstrated rather than promised. The repairs are counted apart from the
 * writes because they are a different event: a day that had a reading and now
 * has a better one, rather than a day that had none.
 *
 * A refusal names the project too, because the caller of the studio-wide run
 * is reading a list and needs to know which engagement to go and look at.
 */
export type ProjectBurnBackfill =
  | {
      readonly ok: true;
      readonly projectId: string;
      /** How many days of history were written for the first time. */
      readonly written: number;
      /**
       * How many stored readings were replaced because the entries had
       * outgrown them — time logged days after it was worked.
       */
      readonly repaired: number;
      /** How many of its days already had a reading and were left alone. */
      readonly alreadyRecorded: number;
    }
  | {
      readonly ok: false;
      readonly projectId: string;
      readonly reason: BurnCaptureReason;
    };

/**
 * Writes a run of readings in one statement, skipping any day that already has
 * one.
 *
 * A single multi-row insert rather than a loop of upserts, because a backfill
 * of a year-old engagement is a hundred and fifty days and a hundred and fifty
 * round trips is the difference between a second and a minute.
 *
 * What happens to a day that already has a reading is the caller's decision,
 * because the two writes a backfill makes want opposite answers. For a day the
 * plan found nothing stored for, a conflict means a reading arrived between the
 * plan and the write — from the daily capture, or from another run — and that
 * reading is at least as good as this reconstruction, so it is left alone. For
 * a day the plan found a reading the entries have outgrown, the stored row is
 * provably wrong about the work and replacement is the whole point.
 *
 * It returns how many rows actually landed rather than how many were offered,
 * which is the only honest count when some of them may have been skipped.
 *
 * One timestamp for the whole run: every row of it was captured at the same
 * moment, because they were all worked out from the same read.
 */
async function addBurnSnapshots(
  projectId: string,
  points: readonly BurnPoint[],
  origin: BurnSnapshotOrigin,
  onConflict: "skip" | "replace",
  database: Database,
): Promise<number> {
  // Drizzle refuses an insert with no values, and a plan with nothing to do is
  // the ordinary case on every run after the first.
  if (points.length === 0) return 0;

  const capturedAt = new Date().toISOString();
  const insert = database
    .insert(burnSnapshots)
    .values(
      points.map((point) =>
        burnSnapshotValues({ projectId, point, origin }, capturedAt),
      ),
    );

  const rows = await (onConflict === "skip"
    ? insert.onConflictDoNothing()
    : insert.onConflictDoUpdate({
        target: [burnSnapshots.projectId, burnSnapshots.onDate],
        set: REFRESHED_FROM_THE_READING,
      })
  ).returning();

  return rows.length;
}

/**
 * Reconstructs every missing day of one project's burn-down.
 *
 * The other half of the milestone, and the half that only has to work once per
 * engagement: a table of daily readings is empty for everything that was
 * already running when it was added, and a chart of a six-month project that
 * starts today is no use to anybody.
 *
 * What it can know is exactly the minutes. `worked_on` is a calendar date on
 * every time entry, so the days a project was worked and what each cost are a
 * matter of record. What it cannot know is what the project was agreed for or
 * what an hour was worth on any of those days, because nothing has ever stored
 * either — so it values the whole history at today's figures and marks every
 * row `backfilled` to say so. That is the honest limit rather than a shortcut,
 * and it is why the column exists.
 *
 * Days that already have a reading are left exactly as they are, including
 * ones this would value differently. A reading taken on the day is better
 * evidence than a reconstruction of it, and the arithmetic behind the
 * reconstruction still accounts for those days — see `planBurnBackfill` for
 * why the accumulation has to run over the whole history and the narrowing
 * after it.
 *
 * One immediate transaction: the days, the recorded dates, the project's price
 * and rate, and the writes. A deferred transaction would let a time entry be
 * logged between the read and the write, leaving a reconstruction of a day
 * that is already out of date and no record that it happened.
 *
 * It refuses rather than throwing, for both reasons, because the studio-wide
 * run below must not abandon a hundred projects over one with a bad column.
 */
export async function backfillProjectBurn(
  projectId: string,
  options: BurnBackfillOptions = {},
  database: Database = db,
): Promise<ProjectBurnBackfill> {
  const through = options.through ?? utcCalendarDate(new Date());

  return database.transaction(
    async (tx) => {
      const project = await getProjectWithClient(projectId, tx);
      if (project === null) return { ok: false, projectId, reason: "no-such-project" };

      const days = await dailyProjectTimeTotals(projectId, tx);
      const recorded = await burnSnapshotTotals(projectId, tx);
      const plan = planBurnBackfill({
        days,
        recorded,
        contractedCents: project.contractValueCents,
        rate: resolveJoinedRate(project),
        through,
      });

      /*
        Asked of the whole plan before any of it is written. The figures a
        project's points share — its price, its rate — are the ones a bad
        column spoils, so a plan with one unstorable point almost certainly has
        no storable ones, and writing the prefix would leave a half-built line
        nothing says is half-built.
      */
      if (
        [...plan.points, ...plan.stale].some(
          (point) => !isRecordableBurn(point),
        )
      ) {
        return { ok: false, projectId, reason: "unrecordable-figures" };
      }

      /*
        The two writes, in the order that keeps the stronger claim. The days
        with no reading go in first and skip anything that has appeared since;
        the stale days are then replaced, because a reading the entries have
        outgrown is wrong about the work however it was taken.
      */
      const written = await addBurnSnapshots(
        projectId,
        plan.points,
        "backfilled",
        "skip",
        tx,
      );
      const repaired = await addBurnSnapshots(
        projectId,
        plan.stale,
        "backfilled",
        "replace",
        tx,
      );

      return {
        ok: true,
        projectId,
        written,
        repaired,
        alreadyRecorded: plan.alreadyRecorded,
      };
    },
    { behavior: "immediate" },
  );
}

/**
 * Rows that each name a project, gathered by the project they name, in the
 * order the projects first appear.
 *
 * The studio-wide backfill reads two unscoped lists and has to walk them one
 * project at a time; a `filter` per project per list is the quadratic way to
 * do that, and a studio's history is the one place in the app where the lists
 * are long enough for it to matter.
 *
 * The order the query returned is kept, so a run writes projects in a settled
 * order and an interrupted one has written whole projects.
 */
function groupByProject<T extends { readonly projectId: string }>(
  rows: readonly T[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const mine = grouped.get(row.projectId);
    if (mine === undefined) grouped.set(row.projectId, [row]);
    else mine.push(row);
  }
  return grouped;
}

/** Adds up one figure of a list of results. */
function sumOf<T>(rows: readonly T[], figure: (row: T) => number): number {
  return rows.reduce((total, row) => total + figure(row), 0);
}

/**
 * What a backfill did to the whole studio.
 *
 * The per-project results, and the three figures somebody running it reads
 * first. The totals are sums of the list rather than independent counts, so
 * they cannot disagree with it; they are carried because a studio with sixty
 * engagements is sixty lines, and "wrote 412 days across 47 projects, refused
 * 1" is the line that says whether to go and read them.
 */
export type BurnBackfillReport = {
  /** One result per project that had any time logged, in project order. */
  readonly projects: readonly ProjectBurnBackfill[];
  /** How many days of history were written in total. */
  readonly written: number;
  /** How many stored readings the entries had outgrown and were replaced. */
  readonly repaired: number;
  /** How many days already had a reading and were left alone. */
  readonly alreadyRecorded: number;
  /** How many projects were refused, each for a reason in the list. */
  readonly refused: number;
};

/**
 * Reconstructs every missing day of every project's burn-down.
 *
 * The backfill as it is actually run: once, over a studio that has been
 * logging time since before this table existed. Three queries and then
 * arithmetic — every project with its client's rate, every project's days, and
 * every day already recorded — rather than three queries per project, which is
 * what a loop over `backfillProjectBurn` would be and what turns a one-off
 * repair into something nobody dares run twice.
 *
 * A project with no time logged against it is not reported at all, because
 * there is nothing to reconstruct: a burn-down of an engagement nobody has
 * worked is an empty chart rather than a line at nought, and a row saying so
 * would be a point where no work happened.
 *
 * One immediate transaction for the whole run, like the per-project version
 * and for the same reason, with one addition: a studio reconstructed in one
 * transaction is reconstructed against one set of reads, so two projects
 * cannot be valued at rates from either side of an edit.
 *
 * Every project is attempted even when one is refused. The refusals are in the
 * list with the project named, which is the whole reason they are answers
 * rather than exceptions — a studio where one engagement has a hand-edited
 * rate is still a studio with fifty-nine charts worth drawing.
 */
export async function backfillBurnSnapshots(
  options: BurnBackfillOptions = {},
  database: Database = db,
): Promise<BurnBackfillReport> {
  const through = options.through ?? utcCalendarDate(new Date());

  return database.transaction(
    async (tx) => {
      const projects = await listProjectsWithClient({}, tx);
      const days = await dailyTimeTotalsByProject(tx);
      const recorded = await burnSnapshotDaysByProject(tx);

      const byProject = new Map(projects.map((project) => [project.id, project]));
      const daysByProject = groupByProject(days);
      const recordedByProject = groupByProject(recorded);

      const results: ProjectBurnBackfill[] = [];
      for (const [projectId, projectDays] of daysByProject) {
        const project = byProject.get(projectId);
        /*
          The foreign key makes this unreachable — a day cannot be logged
          against a project that is not there — but a deleted project would
          take its entries with it, and reporting the gap is cheaper than
          reasoning about whether it can open.
        */
        if (project === undefined) {
          results.push({ ok: false, projectId, reason: "no-such-project" });
          continue;
        }

        const plan = planBurnBackfill({
          days: projectDays,
          recorded: recordedByProject.get(projectId) ?? [],
          contractedCents: project.contractValueCents,
          rate: resolveJoinedRate(project),
          through,
        });

        if (
          [...plan.points, ...plan.stale].some(
            (point) => !isRecordableBurn(point),
          )
        ) {
          results.push({
            ok: false,
            projectId,
            reason: "unrecordable-figures",
          });
          continue;
        }

        results.push({
          ok: true,
          projectId,
          written: await addBurnSnapshots(
            projectId,
            plan.points,
            "backfilled",
            "skip",
            tx,
          ),
          repaired: await addBurnSnapshots(
            projectId,
            plan.stale,
            "backfilled",
            "replace",
            tx,
          ),
          alreadyRecorded: plan.alreadyRecorded,
        });
      }

      return {
        projects: results,
        written: sumOf(results, (result) => (result.ok ? result.written : 0)),
        repaired: sumOf(results, (result) => (result.ok ? result.repaired : 0)),
        alreadyRecorded: sumOf(results, (result) =>
          result.ok ? result.alreadyRecorded : 0,
        ),
        refused: results.filter((result) => !result.ok).length,
      };
    },
    { behavior: "immediate" },
  );
}

/**
 * What bringing one project's burn-down up to date did: the reconstruction of
 * the days it had missed, and the reading of today.
 *
 * Both halves reported separately rather than summed into a count of rows,
 * because they are different claims. The backfill's days are reconstructions
 * valued at today's figures; today's reading is a measurement. A caller that
 * wanted to say "41 days of this line were worked out afterwards" could not
 * get that from a total.
 */
export type BurnHistoryUpdate = {
  /** What the reconstruction of the missing days did. */
  readonly backfill: ProjectBurnBackfill;
  /** The reading of the last day, which is today unless one was named. */
  readonly today: BurnCaptureResult;
};

/**
 * Brings one project's burn-down up to date: reconstructs the days it has no
 * reading for, then records the day it is run on.
 *
 * The two halves of the milestone in the order they have to happen, which is
 * the only reason this exists rather than two calls at each caller: today is
 * measured, and then everything before it is reconstructed.
 *
 * It also fixes one answer to "today" for both halves. Run as two calls either
 * side of midnight, a project could be reconstructed through one day and
 * measured on the next, leaving a line with a hole in it that the next run
 * would fill with a reconstruction dated to a day somebody was watching.
 *
 * A refused backfill still lets the capture run, and the result carries both
 * answers rather than one. The two refuse for the same two reasons, so they
 * will usually agree — but a project whose figures no column can hold is one
 * where the *reader* needs both sentences, and a function that stopped at the
 * first would hide the simpler one.
 *
 * This is the operation a page calls. The daily capture across a studio is
 * `captureProjectBurn` per project, and the one-off repair is
 * `backfillBurnSnapshots`; what a reader opening one engagement wants is this,
 * which is both of them narrowed to the project in front of them.
 */
export async function updateProjectBurnHistory(
  projectId: string,
  options: BurnBackfillOptions = {},
  database: Database = db,
): Promise<BurnHistoryUpdate> {
  const through = options.through ?? utcCalendarDate(new Date());

  /*
    The reading of today first, then the reconstruction of what came before it.

    That order is what keeps the two halves from arguing. Today's reading is a
    measurement, and the backfill then finds it already recorded and agreeing
    with the entries, so it leaves it alone — where the other order writes a
    reconstruction of today and has it replaced a moment later, reporting a day
    written that nothing kept.
  */
  const today = await captureProjectBurn(projectId, through, { today: through }, database);

  return {
    today,
    backfill: await backfillProjectBurn(projectId, { through }, database),
  };
}
