import type { ScopeLine } from "@/lib/scope";

import type { LoggedEntry } from "./days";

/**
 * What a project's logged time comes to, set against what it was estimated at.
 *
 * Day 015 added up the estimates and Day 021 started recording the hours.
 * Neither number means much alone: an estimate is a guess nobody checks and a
 * time total is a figure with nothing to be large or small against. This is
 * the subtraction — six hours logged against a line estimated at four — and it
 * is the first thing in Keel that can say a project is going wrong while there
 * is still time to do something about it.
 *
 * Two levels, because the two answer different questions. Per deliverable is
 * *which* part of the agreement is eating the budget, which is what a
 * conversation with a client is about. Per project is whether the engagement
 * as a whole is in trouble, which is what gets noticed first. A rollup that
 * only did the second would say "you are twelve hours over" and leave somebody
 * reading forty time entries to find out where.
 *
 * All of it pure, over plain numbers, like `lib/scope.ts` beside it: minutes
 * in, minutes out, no row read and no string formatted. The words these
 * figures are read in are `lib/projects/time-rollup.ts`, and the classifier
 * that turns them into a judgement is Day 033's.
 */

/**
 * What a rollup reads of a time entry: how long, whether it is chargeable,
 * and which line of scope it went against.
 *
 * `LoggedEntry` and one more column, so the day grouping's totals can be
 * reused here rather than re-summed. The attribution is the column that makes
 * this a rollup rather than a total — it is the only thing that says which
 * estimate an hour belongs against.
 *
 * Null is a real answer and not a missing one: the call, the invoicing, the
 * afternoon of email the scope list has no line for. It is kept out of every
 * line's figures and reported on its own, because adding it to the lines would
 * mean picking one to blame.
 */
export type AttributedEntry = LoggedEntry & {
  readonly deliverableId: string | null;
};

/**
 * What a rollup reads of a deliverable: a scope line, plus the two columns
 * that say which line it is.
 *
 * `ScopeLine` rather than its own estimate field, so the estimate a rollup
 * compares against is literally the one `lib/scope.ts` totals — and so the
 * status is read through the same `isDelivered` the scope summary uses. A
 * rollup that decided for itself what "done" meant could call a line finished
 * that the panel above it calls open.
 */
export type RolledUpDeliverable = ScopeLine & {
  readonly id: string;
  readonly title: string;
};

/**
 * How much work a set of entries holds, which is three figures and not one.
 *
 * `loggedMinutes` is what happened. `billableMinutes` is the part of it meant
 * to reach an invoice, and the gap between them is the part somebody has
 * already decided to absorb — against an estimate that distinction is the
 * difference between a line that overran and a line that overran and is being
 * written off.
 *
 * `entryCount` is how many stretches of work the figure was built from. It is
 * here because a rollup is a number with no working: twelve hours against a
 * four-hour estimate is one thing if it is one entry somebody typed wrong and
 * another if it is nineteen.
 */
export type LoggedTotals = {
  readonly entryCount: number;
  readonly loggedMinutes: number;
  readonly billableMinutes: number;
};

/**
 * Logged time set against an estimate: the difference, and the share.
 *
 * Both, because they say different things at different sizes. Twenty minutes
 * over is nothing on a forty-hour line and a disaster on a half-hour one, and
 * the difference alone cannot tell them apart; the share alone turns a line
 * nobody has started into a zero that reads like a line going well.
 *
 * `varianceMinutes` is logged minus estimated, so over is positive and under
 * is negative — the direction a reader expects from a figure called a
 * variance, and the direction that makes a sum of them the project's overrun.
 */
export type EstimateComparison = {
  /** What the line was sized at, in minutes, as the scope list holds it. */
  readonly estimatedMinutes: number;
  /** Logged minus estimated, or null when there is no estimate to compare. */
  readonly varianceMinutes: number | null;
  /** Logged over estimated, unrounded and unclamped, or null when there is no estimate. */
  readonly loggedShare: number | null;
};

/**
 * One line of the rollup: a deliverable, what has been logged against it, and
 * how that sits against its estimate.
 *
 * The title comes along because the table is read by title and not by id, and
 * resolving it here means the rollup and the attribution on a time row are
 * naming the same line from the same read.
 *
 * `delivered` is carried rather than the raw status, because that is the only
 * question asked of it: a line under its estimate and marked done came in
 * under, and a line under its estimate and still open has simply not finished
 * yet. Those read as opposite news and the figures cannot tell them apart.
 */
export type DeliverableRollup = LoggedTotals &
  EstimateComparison & {
    readonly deliverableId: string;
    readonly title: string;
    readonly delivered: boolean;
  };

/**
 * The whole rollup for one project: every line, the time that went against no
 * line, and the project's own totals.
 *
 * The totals are the project's, not the sum of the lines: every entry counts
 * towards them whether or not it was attributed. That is what makes the
 * project figure the one to trust — a reader who attributes nothing still gets
 * a true total, and the lines are then all zero, which is itself the thing to
 * notice.
 *
 * `unmatchedMinutes` should always be nought. It is time attributed to a line
 * this rollup was not given — a deliverable added or dropped between the two
 * reads that built the page — and it is reported because the alternative is a
 * project total that does not equal its parts with nothing on screen saying
 * why.
 */
export type ProjectRollup = LoggedTotals &
  EstimateComparison & {
    /** One line per deliverable, in the order the scope list was agreed in. */
    readonly lines: readonly DeliverableRollup[];
    /** What was logged against the project itself rather than a line. */
    readonly unattributed: LoggedTotals;
    /** Minutes attributed to a line that is not in this rollup. */
    readonly unmatchedMinutes: number;
  };
