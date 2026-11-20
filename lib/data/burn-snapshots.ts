import { asc, eq } from "drizzle-orm";

import {
  DEFAULT_BURN_SNAPSHOT_ORIGIN,
  type BurnSnapshotOrigin,
} from "@/lib/burndown/origin";
import type { BurnPoint } from "@/lib/burndown/series";
import { db, type Database } from "@/lib/db";
import { burnSnapshots, type BurnSnapshot } from "@/lib/db/schema";
import { newId } from "@/lib/id";

import {
  calendarDate,
  recordedCents,
  recordedMinutes,
  requiredText,
  wholeCount,
} from "./fields";

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
      /*
        Every column but the id and the pair that identify the day. The id
        stays as it was so that anything holding a reference to the reading
        still resolves to the day it named — the row is the same reading,
        better informed.
      */
      set: {
        contractValueCents: values.contractValueCents,
        rateCents: values.rateCents,
        rateSource: values.rateSource,
        entryCount: values.entryCount,
        loggedMinutes: values.loggedMinutes,
        billableMinutes: values.billableMinutes,
        burnedCents: values.burnedCents,
        chargeableCents: values.chargeableCents,
        origin: values.origin,
        capturedAt: values.capturedAt,
      },
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
 * The days one project already has a reading for, oldest first.
 *
 * What a backfill asks before it writes anything: the dates, and nothing else.
 * `listBurnSnapshots` would answer the same question and carry thirteen
 * columns of every row to do it, which is a year of rows crossing a wire so
 * that a plan can compare forty strings.
 *
 * It is the whole list rather than the latest, because the gaps are the point.
 * A project recorded daily for a month, left alone for a week and recorded
 * again has a hole in the middle, and a backfill that asked only how far the
 * history reached would skip straight past it — which is exactly the shape a
 * run that was interrupted leaves behind.
 *
 * Covered by the unique index, which holds both columns: the dates come
 * straight off it without the table being touched.
 */
export async function burnSnapshotDates(
  projectId: string,
  database: Database = db,
): Promise<string[]> {
  const rows = await database
    .select({ onDate: burnSnapshots.onDate })
    .from(burnSnapshots)
    .where(eq(burnSnapshots.projectId, projectId))
    .orderBy(...OLDEST_FIRST);

  return rows.map((row) => row.onDate);
}

/** One recorded day, with the project it belongs to. */
export type RecordedBurnDay = {
  readonly projectId: string;
  /** The day a reading exists for: `YYYY-MM-DD`. */
  readonly onDate: string;
};

/**
 * Every recorded day of every project, in project and then date order.
 *
 * `burnSnapshotDates` across the whole studio, and one query for the same
 * reason the daily totals are: a backfill that asked each project for its
 * recorded days separately would be a round trip per project before it wrote
 * anything at all.
 *
 * Two columns and no figures. The studio-wide backfill needs to know which
 * days to leave alone, not what those days said, and the readings it does not
 * touch are the bulk of the table on every run after the first.
 *
 * Unscoped, like the daily totals it is paired with, and listed in `NOTES.md`
 * as a read Phase 8 has to scope by owner.
 */
export async function burnSnapshotDaysByProject(
  database: Database = db,
): Promise<RecordedBurnDay[]> {
  return database
    .select({
      projectId: burnSnapshots.projectId,
      onDate: burnSnapshots.onDate,
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
 * `unrecordable-figures` is a hand-edited row. The figures a reading records
 * are deliberately permissive about sign, so this is not a negative rate or a
 * contract value below zero — those are recorded as they stand, because the
 * engagement that looks wrong is the one somebody has to look at. It is a
 * value the column cannot hold at all: a fraction of a cent, a fraction of a
 * minute, or an amount past the point where an integer stops being exact and
 * the driver can no longer read the row back.
 */
export type BurnCaptureReason = "no-such-project" | "unrecordable-figures";

/** The outcome of asking a project for its burn as at one day. */
export type BurnCaptureResult =
  | { readonly ok: true; readonly snapshot: BurnSnapshot }
  | { readonly ok: false; readonly reason: BurnCaptureReason };
