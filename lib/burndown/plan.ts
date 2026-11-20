import type { EffectiveRate } from "@/lib/rates";

import {
  burnDaysThrough,
  burnSeries,
  type BurnDay,
  type BurnPoint,
} from "./series";

/**
 * Which days of a project's history are missing a stored burn reading, and
 * what would be written for them.
 *
 * A burn-down table that only ever records today starts empty, and stays empty
 * for every engagement that was already running when it was added. The milestone
 * is therefore two halves: a reading taken each day from here on, and a
 * reconstruction of what the readings would have said for every day already in
 * the time entries. This file is the planning half of the second, kept pure so
 * that what gets written can be asserted without a database — the writing half
 * is `lib/data/burn-snapshots.ts`.
 *
 * The planning is not a filter over the past. A reconstruction has to value
 * each past day at the *cumulative* minutes up to it, so the series is built
 * over every day a project ever logged and only then narrowed to the days
 * nothing has recorded yet. Narrowing first would hand every gap a running
 * total that started at the gap, and a backfilled stretch would read as though
 * the engagement had begun again in the middle.
 */

/**
 * What a backfill is asked: the days a project logged, what it is agreed for,
 * what an hour is worth, which days are already recorded, and the last day
 * worth reconstructing.
 *
 * One object rather than five positional arguments, because four of the five
 * are either a number or a list of strings and a transposed pair would be
 * silently plausible. It also lets the one that needs saying out loud say it:
 * `recorded` is days that must be left alone, not days to write.
 */
export type BurnBackfillRequest = {
  /** Every day the project logged work, in any order, with that day's totals. */
  readonly days: readonly BurnDay[];
  /** The days already in the table, which this will not touch. */
  readonly recorded: readonly string[];
  /** What the project is agreed for now, in cents. */
  readonly contractedCents: number;
  /** What an hour is worth now, and which row says so. */
  readonly rate: EffectiveRate;
  /** The last day to reconstruct: today, in `YYYY-MM-DD`. */
  readonly through: string;
};

/**
 * What a backfill would do to one project: the readings to write, and how many
 * days it is leaving as they are.
 *
 * The second figure is not a count of the first's complement, and it is worth
 * carrying for exactly that reason: "wrote 9 days, left 41" is the sentence a
 * person running a backfill over a year-old studio needs, and it is the one
 * that says the operation is idempotent. A second run writes nothing and
 * leaves everything, which is what a report of (0, 50) means.
 */
export type BurnBackfillPlan = {
  /** The points to store, in calendar order, oldest first. */
  readonly points: readonly BurnPoint[];
  /** How many of the project's days already had a reading. */
  readonly alreadyRecorded: number;
};

/**
 * The points of a series whose day is not in a list of days already recorded.
 *
 * Separate from the plan below, and run *after* the series is valued rather
 * than over the days that went into it, which is the whole subtlety of a
 * backfill: a point is a running total, so a point for Thursday can only be
 * worked out from Monday and Tuesday as well. Dropping Monday from the input
 * because it is already stored would leave Thursday's reading saying the
 * engagement had spent only Thursday.
 *
 * A Set rather than `includes` per point, because this runs once per project
 * over every day it has ever logged: a two-year engagement against two years
 * of stored readings is half a million comparisons written the other way.
 *
 * Order is the series order it was given, which `burnSeries` has already put
 * into calendar order — so the rows go in oldest first, and a backfill that is
 * interrupted has written a prefix of the history rather than a scatter of it.
 */
export function withoutRecordedDays(
  points: readonly BurnPoint[],
  recorded: readonly string[],
): BurnPoint[] {
  const already = new Set(recorded);
  return points.filter((point) => !already.has(point.onDate));
}

/**
 * What to write to reconstruct one project's burn-down, and what to leave.
 *
 * The three steps in the one order that is correct, which is why they are one
 * function rather than three calls at every caller:
 *
 *   1. drop the days that have not happened yet, before anything is totalled;
 *   2. value the whole history, cumulatively, at today's price and rate;
 *   3. drop the days something has already recorded.
 *
 * Any other order is wrong in a way that looks right. Narrowing to the missing
 * days first gives each gap a running total that starts at the gap. Applying
 * the bound last leaves the final point carrying minutes from days that were
 * dropped, so the line ends above its own last point.
 *
 * It values the past at the present, and that is the honest limit of a
 * backfill rather than a shortcut: no column anywhere recorded what this
 * project was agreed for in March, so there is nothing truer available. The
 * rows it produces are stored with `origin: "backfilled"` for exactly that
 * reason — the figure is a reconstruction, and the column is what lets a chart
 * say so rather than presenting it as a measurement.
 *
 * `alreadyRecorded` counts the days of this project's history that were left
 * alone, which is what makes a second run reportable: nothing written, every
 * day accounted for. It counts days of the bounded series rather than the
 * `recorded` list it was handed, because that list can hold days the project
 * logged no work on — a reading taken on a quiet Tuesday — and those are not
 * days this plan had anything to say about.
 */
export function planBurnBackfill(
  request: BurnBackfillRequest,
): BurnBackfillPlan {
  const days = burnDaysThrough(request.days, request.through);
  const points = burnSeries(days, request.contractedCents, request.rate);
  const pending = withoutRecordedDays(points, request.recorded);

  return {
    points: pending,
    alreadyRecorded: points.length - pending.length,
  };
}
