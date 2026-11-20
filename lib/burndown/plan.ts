import type { EffectiveRate } from "@/lib/rates";

import type { BurnDay, BurnPoint } from "./series";

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
