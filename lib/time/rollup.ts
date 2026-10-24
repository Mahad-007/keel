import { isEstimated } from "@/lib/deliverables/list";
import {
  allDelivered,
  isDelivered,
  totalEstimatedMinutes,
  type ScopeLine,
} from "@/lib/scope";

import { billableMinutes, totalMinutes, type LoggedEntry } from "./days";

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
    /**
     * Whether every line of the scope list is marked done, which is the one
     * thing that tells unspent estimate from a job finished cheaply.
     *
     * Carried rather than left to a reader to work out from `lines`, for the
     * reason `ScopeSummary` carries `deliveredCount`: the rule about the
     * empty list is a decision, and a second caller deciding it again is how
     * two panels come to disagree about one project. Answered by
     * `lib/scope.ts` over the real scope lines, where the status column still
     * is.
     */
    readonly scopeDelivered: boolean;
  };

/**
 * What a set of entries comes to, as the three figures a rollup line carries.
 *
 * Both totals go through the day grouping's functions rather than being summed
 * again here. The chargeable half especially: `isChargeable` is strict about a
 * flag that is not exactly true, and a second reduce written out in this file
 * would be a second reading of the same column — which is how a rollup ends up
 * disagreeing with the day heading over the row that produced it.
 *
 * An empty set comes to three zeroes, which is a real answer. A deliverable
 * nobody has logged against has logged nothing, and that is the figure the
 * table shows beside its estimate.
 */
export function loggedTotals(entries: readonly LoggedEntry[]): LoggedTotals {
  return {
    entryCount: entries.length,
    loggedMinutes: totalMinutes(entries),
    billableMinutes: billableMinutes(entries),
  };
}

/**
 * How far logged time has run past its estimate, in whole minutes.
 *
 * Logged minus estimated, so over is positive and under is negative. That is
 * the direction a reader expects of a figure called a variance, and it is the
 * direction in which a column of them sums to the project's overrun rather
 * than to its underrun.
 *
 * Null when nothing was estimated, which is not the same as nought. A
 * deliverable nobody sized has no number to be over or under, and reporting
 * six hours as "six hours over" would be an accusation built on an estimate
 * nobody gave — the one reading that would send somebody into a client
 * conversation with a figure they cannot defend. The same distinction
 * `impliedRateCents` makes, through the same predicate the scope list words an
 * unsized line with, so a line the table calls "Not estimated" is a line this
 * refuses to compare.
 *
 * A negative estimate is compared anyway, and the arithmetic is left to say
 * what it says. Only a hand-edited row holds one, `summariseScope` already
 * counts them, and the panel's job is to flag the row rather than to quietly
 * drop the comparison — a line silently missing from the variance column is
 * harder to find than a figure that looks wrong.
 */
export function varianceMinutes(
  loggedMinutes: number,
  estimatedMinutes: number,
): number | null {
  if (!isEstimated(estimatedMinutes)) return null;
  return loggedMinutes - estimatedMinutes;
}

/**
 * How much of an estimate the logged time has used, as a fraction of one.
 *
 * A fraction rather than a percentage, because a percentage is a thing you
 * print — and unrounded, because the only thing that prints it is a formatter.
 * The same arrangement `deliveredShare` keeps next door, so the two shares on
 * a project page round once each and in the same place.
 *
 * The share says what the difference cannot. Twenty minutes over is nothing on
 * a forty-hour line and half as much work again on a half-hour one; the
 * variance reads the same in both and the share reads 101% and 167%.
 *
 * Not clamped. A line at 240% is the single most useful number this file
 * produces and capping it at the estimate would be the one thing that hides a
 * runaway deliverable behind a figure that looks merely finished.
 *
 * Null with no positive estimate to divide by, which covers both an unsized
 * line and the hand-edited negative. Zero would say no time has gone into the
 * work, which is a claim about the hours rather than an admission the
 * denominator is missing — and it is the claim that would put an unestimated
 * line at the healthy end of any ranking built on this.
 */
export function loggedShare(
  loggedMinutes: number,
  estimatedMinutes: number,
): number | null {
  if (estimatedMinutes <= 0) return null;
  return loggedMinutes / estimatedMinutes;
}

/**
 * Both readings of one estimate at once: what it was sized at, the
 * difference, and the share.
 *
 * One call rather than two, so a figure and the share beside it are always
 * about the same pair of numbers. The estimate is echoed back for the same
 * reason `summariseScope` echoes the contract value — a variance with no
 * estimate beside it is a number with no working, and a reader cannot check
 * it against the scope list without one.
 *
 * The two nulls do not always agree, which is deliberate. A negative estimate
 * yields a difference and no share: subtracting from it is arithmetic a reader
 * can redo, and dividing by it flips the sign into a figure that reads as
 * healthy. An unsized line yields neither.
 */
export function compareToEstimate(
  loggedMinutes: number,
  estimatedMinutes: number,
): EstimateComparison {
  return {
    estimatedMinutes,
    varianceMinutes: varianceMinutes(loggedMinutes, estimatedMinutes),
    loggedShare: loggedShare(loggedMinutes, estimatedMinutes),
  };
}

/**
 * The entries filed under the line each went against, in the order they
 * arrived in.
 *
 * A map built in one pass rather than a filter per deliverable, so a project
 * with thirty lines and two years of entries does not read the whole list
 * thirty times to draw one table.
 *
 * Only attributed entries are in it. Time logged against the project itself is
 * not missing from this map, it is not a member of it — the key would have to
 * be null, and a bucket keyed on the absence of a line is the one bucket a
 * caller would forget to exclude when summing the lines up.
 *
 * The order inside each bucket is the caller's, which is the data layer's:
 * newest work first. Nothing here sorts, for the reason `groupTimeByDay` gives
 * — a list that re-sorted its input would quietly disagree with whatever the
 * query asked for.
 */
export function entriesByDeliverable<T extends AttributedEntry>(
  entries: readonly T[],
): Map<string, T[]> {
  const byDeliverable = new Map<string, T[]>();
  for (const entry of entries) {
    if (entry.deliverableId === null) continue;
    const bucket = byDeliverable.get(entry.deliverableId);
    if (bucket === undefined) byDeliverable.set(entry.deliverableId, [entry]);
    else bucket.push(entry);
  }
  return byDeliverable;
}

/**
 * The entries that went against no line of scope.
 *
 * Its own function rather than a null key in the map above, because this is
 * an answer and not a gap — the call, the invoicing, the afternoon of email —
 * and the rollup reports it as a row of its own with no estimate beside it.
 * Nothing is wrong with a project whose unattributed figure is large; what
 * would be wrong is folding those minutes into a line that did not take them.
 */
export function unattributedEntries<T extends AttributedEntry>(
  entries: readonly T[],
): T[] {
  return entries.filter((entry) => entry.deliverableId === null);
}

/**
 * One line of the rollup: a deliverable and the time already filed under it.
 *
 * The entries are that line's, not the project's. Taking the bucket rather
 * than the whole list and filtering again is what keeps `rollUpProject` to one
 * pass over the time entries however many deliverables a project has — and the
 * bucket is the one `entriesByDeliverable` built, so the filing rule lives in
 * exactly one place.
 *
 * `delivered` is read through `isDelivered` rather than compared here, so a
 * line this calls finished is a line the scope summary calls finished. The two
 * sit on the same project page and would be read against each other.
 */
export function rollUpDeliverable(
  deliverable: RolledUpDeliverable,
  entries: readonly AttributedEntry[],
): DeliverableRollup {
  const totals = loggedTotals(entries);
  return {
    deliverableId: deliverable.id,
    title: deliverable.title,
    delivered: isDelivered(deliverable),
    ...totals,
    ...compareToEstimate(totals.loggedMinutes, deliverable.estimatedMinutes),
  };
}

/**
 * Time attributed to a line this rollup was not given, in whole minutes.
 *
 * It should always be nought, and it is computed anyway. The scope list and
 * the time list are two reads, and a deliverable added or dropped between them
 * leaves entries pointing at a line the table has no row for. Those minutes
 * are in the project's total and in none of its lines, so without this figure
 * the column would not add up and nothing on screen would say why — which is
 * worse than the stale page that caused it, because a reader would conclude
 * the arithmetic is wrong.
 *
 * Deleting a deliverable nulls the attribution through the foreign key, so the
 * usual way here is the opposite order: the entries were read first, a line
 * was added, and the scope list read after it holds a row the entries predate.
 * Either way the answer is to reload, which is what the sentence beside this
 * says — the same reading `entryAttribution` gives an unnameable row.
 */
export function unmatchedMinutes(
  entries: readonly AttributedEntry[],
  deliverableIds: ReadonlySet<string>,
): number {
  return totalMinutes(
    entries.filter(
      (entry) =>
        entry.deliverableId !== null && !deliverableIds.has(entry.deliverableId),
    ),
  );
}

/**
 * The whole rollup for one project: every line of scope with its time against
 * its estimate, the time that went against no line, and the project's own
 * totals.
 *
 * The two arguments come from different tables, which is exactly why the
 * comparison is never made: the estimates are on the scope list and the hours
 * are on the time list, and nothing until now has divided one by the other.
 * One call, one read of each, and every figure on the table is consistent with
 * every other by construction.
 *
 * Every deliverable gets a row, including the ones nothing has been logged
 * against. A rollup that only listed the lines with time on them would be a
 * list of the work that is happening, and the interesting row is often the
 * eight-hour line three weeks in that nobody has started.
 *
 * The project's totals are taken over all the entries rather than summed from
 * the rows. That is the figure to trust: it is true whether or not anybody
 * attributes their time, where a sum of the rows silently drops the
 * unattributed and the unmatched. The parts are reported beside it so a reader
 * can see where the difference went.
 *
 * The project's estimate is `totalEstimatedMinutes` of the same lines — the
 * Day 015 figure, from the Day 015 function, so the total at the bottom of
 * this table is the one the scope summary shows on the tab next door.
 */
export function rollUpProject(
  deliverables: readonly RolledUpDeliverable[],
  entries: readonly AttributedEntry[],
): ProjectRollup {
  const byDeliverable = entriesByDeliverable(entries);
  const lines = deliverables.map((deliverable) =>
    rollUpDeliverable(deliverable, byDeliverable.get(deliverable.id) ?? []),
  );

  const totals = loggedTotals(entries);
  return {
    lines,
    unattributed: loggedTotals(unattributedEntries(entries)),
    unmatchedMinutes: unmatchedMinutes(
      entries,
      new Set(deliverables.map((deliverable) => deliverable.id)),
    ),
    scopeDelivered: allDelivered(deliverables),
    ...totals,
    ...compareToEstimate(
      totals.loggedMinutes,
      totalEstimatedMinutes(deliverables),
    ),
  };
}
