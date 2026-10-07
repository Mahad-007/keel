import { isEstimated } from "@/lib/deliverables/list";
import type { DeliverableStatus } from "@/lib/deliverables/status";
import { MINUTES_PER_HOUR } from "@/lib/minutes";

/**
 * What a project's scope adds up to.
 *
 * A deliverables list and a contract value are two numbers agreed separately
 * and almost never checked against each other. The list says how long the work
 * will take; the contract says what it pays. Dividing one by the other is the
 * first honest thing anybody can say about an engagement — and it is usually
 * the moment somebody discovers they agreed to work for half their rate.
 *
 * Everything here is a pure function over plain numbers, so the arithmetic can
 * be tested without a database and reused by the scope panel, the burn
 * summary, and the creep classifier that come later. Nothing in this file
 * reads a row, formats a string, or knows what a page looks like.
 *
 * Two units, and they do not mix: estimates are whole minutes, money is whole
 * cents. Hours exist in this file only as a derived number for a reader to
 * look at, and no calculation is ever done on one.
 */

/**
 * The part of a deliverable a scope total actually reads.
 *
 * A structural subset of the row rather than `Deliverable` itself, so these
 * functions can be called with a literal in a test, with a projected query
 * result, and — later — with a deliverable carried alongside its logged time.
 * Totalling scope does not need a title or a position, and taking them would
 * make every caller build a row it does not have.
 */
export type ScopeLine = {
  /** The estimate in whole minutes. Zero means nobody has sized it. */
  estimatedMinutes: number;
  /** Where the line stands, which is what decides whether it is still to do. */
  status: DeliverableStatus;
};

/**
 * Everything the scope list was estimated at, in whole minutes.
 *
 * A plain sum, with no opinion about the lines in it. Zeroes are added as
 * zeroes and a negative is added as a negative, because this number's only job
 * is to be the total of what is actually in the column — a total that quietly
 * repaired its inputs would disagree with the list a reader is looking at, and
 * the reader would believe the total.
 *
 * What a zero means is a separate question, and `unestimatedCount` is the one
 * that answers it: the total says how much work was sized, and the count says
 * how much of the list the total does not speak for.
 */
export function totalEstimatedMinutes(lines: readonly ScopeLine[]): number {
  return lines.reduce((total, line) => total + line.estimatedMinutes, 0);
}

/**
 * How many lines of the scope list have no estimate on them.
 *
 * The number that says how far to trust every other number in this file. A
 * total of twelve hours across ten deliverables means something quite
 * different when four of them are unsized, and the difference is invisible in
 * the total — so it is reported beside it rather than left for a reader to
 * work out by scrolling the list.
 *
 * `isEstimated` rather than a second `=== 0` written out here, so this count
 * and the words the scope list puts on an unsized line can never come apart.
 * A row the list calls "Not estimated" is a row this counts.
 */
export function unestimatedCount(lines: readonly ScopeLine[]): number {
  return lines.filter((line) => !isEstimated(line.estimatedMinutes)).length;
}

/**
 * Whether a line of scope is finished.
 *
 * One comparison, named, because it is the hinge every "how much is left"
 * number in this file swings on and the choice it encodes is not obvious: a
 * deliverable in progress is **not** partly delivered. Its whole estimate
 * stays in the remaining total until somebody marks it done.
 *
 * The alternative — half credit for a started line — is a number nobody
 * supplied. Progress on a deliverable is a fact about how much time has gone
 * into it, which the scope list does not know and Phase 3 measures properly.
 * Guessing it here would make the remaining estimate drift downwards every
 * time somebody pressed Start, which is the one direction a scope total must
 * never move on its own.
 *
 * A status the list does not recognise — the column is plain TEXT — counts as
 * still to do, which keeps its estimate in the total. Dropping it instead
 * would shrink the work left on the strength of a value nobody can read.
 */
export function isDelivered(line: ScopeLine): boolean {
  return line.status === "done";
}

/**
 * What the scope list says is still to do, in whole minutes.
 *
 * The estimate of every line not marked done — including the ones in
 * progress, for the reason `isDelivered` gives.
 *
 * Built by filtering and then calling `totalEstimatedMinutes`, rather than by
 * a second reduce with its own condition in it. Two sums written out
 * separately is how a scope panel ends up showing a remaining total that does
 * not fit the overall one, and nobody can tell which of the two is wrong.
 */
export function remainingEstimatedMinutes(
  lines: readonly ScopeLine[],
): number {
  return totalEstimatedMinutes(lines.filter((line) => !isDelivered(line)));
}

/**
 * What the scope list says has been delivered, in whole minutes.
 *
 * The other half of `remainingEstimatedMinutes`, and deliberately its mirror
 * image: both filter on the same predicate and both total through the same
 * sum, so the two always add up to `totalEstimatedMinutes` whatever is in the
 * list. That identity is what lets a panel show all three numbers without a
 * reader having to check the arithmetic.
 *
 * Note what this is not: it is the estimate of the delivered work, not what
 * the delivered work cost. Those two differing is the entire subject of
 * Phase 4, and conflating them here would hide it.
 */
export function deliveredEstimatedMinutes(
  lines: readonly ScopeLine[],
): number {
  return totalEstimatedMinutes(lines.filter(isDelivered));
}

/**
 * Negative zero, written as zero.
 *
 * Rounding a quantity that is a shade below zero lands on `-0`, and JavaScript
 * keeps the sign: `Intl.NumberFormat` renders it as "-0" and `formatCents` as
 * "-$0.00". Both read as a broken page rather than as a number, and neither
 * says anything true that plain zero does not — the input was below zero by
 * less than the unit being reported in.
 *
 * Only the two rounded figures in this file need it, and both are reachable
 * only from a hand-edited row. One helper rather than the comparison written
 * out twice, so the next rounded figure added here does not have to rediscover
 * the problem.
 */
function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Hundredths of an hour — 36 seconds — which is as fine as a quoted estimate
 * is ever meant to be read. A scope list of ten deliverables summing to
 * 1.6833333333333333 hours is a number that has stopped being an estimate.
 */
const HOURS_PRECISION = 100;

/**
 * Whole minutes as the hours an estimate gets quoted in.
 *
 * The one place in this file where a number stops being an integer, and it is
 * a derived figure for a person to read rather than a value anything else
 * computes from. Minutes stay the unit: the implied rate below divides the
 * contract by *minutes*, not by this, so the rounding here cannot find its way
 * into an amount of money.
 *
 * Nothing in the database holds hours and nothing ever should. "Forty hours"
 * is how the work was discussed; 2400 is what was stored.
 */
export function estimatedHours(minutes: number): number {
  return withoutNegativeZero(
    Math.round((minutes / MINUTES_PER_HOUR) * HOURS_PRECISION) /
      HOURS_PRECISION,
  );
}

/**
 * What a contract value works out to per hour, given the estimate — the
 * number this whole file exists for.
 *
 * A fixed-price project does not have a rate; it has a price and a guess at
 * how long the work will take, agreed in separate conversations. Divide one by
 * the other and you get the rate the engagement is actually being billed at,
 * which is the number that tells somebody they agreed to work for half of
 * what they charge. It is the inverse of `costOfMinutes`, and a round trip
 * through the two lands back where it started.
 *
 * Whole cents per hour, because that is what a rate is everywhere else in the
 * codebase — the client's default, the project override. Rounded rather than
 * truncated, so the figure is the nearest cent to the division rather than
 * always a shade under it.
 *
 * The round trip is exact when the estimate is a whole number of hours, which
 * is how estimates are given. It is not exact otherwise, and cannot be: an
 * estimate of seven minutes against a $100 contract implies $857.14 an hour,
 * and the two cents a year of that rounding throws away have nowhere to go.
 * The error is bounded by half a cent an hour plus half a cent for every hour
 * estimated, which no engagement will notice — but it is why the rate is a
 * figure to read and not a number to bill from.
 *
 * Null, not zero, when there is no positive estimate to divide by:
 *
 *   - **No estimate at all.** Nobody has sized the work, so the contract
 *     implies nothing about an hourly rate. Zero would say the engagement
 *     pays nothing per hour, which is a claim about the money rather than an
 *     admission that the estimate is missing — and it is the claim that would
 *     put a project at the top of a worst-rates list for the sole reason that
 *     nobody had filled the estimates in.
 *   - **A total below zero.** Only a hand-edited row gets there, and dividing
 *     by it returns a rate with its sign flipped — a client appearing to be
 *     paid for the work. There is no rate to report, so none is.
 *
 * A contract value of zero is different, and is reported as a rate of zero: a
 * project agreed at no charge really does pay nothing an hour, and that is a
 * fact about the engagement rather than a gap in the data. A rate of zero is
 * always written as a positive zero, so no project is ever described as
 * paying "-$0.00/hr".
 */
export function impliedRateCents(
  contractValueCents: number,
  estimatedMinutes: number,
): number | null {
  if (estimatedMinutes <= 0) return null;
  return withoutNegativeZero(
    Math.round((contractValueCents * MINUTES_PER_HOUR) / estimatedMinutes),
  );
}

/**
 * How many lines of the scope list are done.
 *
 * The count and the share answer the same question two ways, and a panel
 * wants both: "four of five deliverables, a quarter of the estimated work" is
 * the sentence, and either half of it alone is misleading. The count is what
 * somebody can check against the list in front of them; the share is what
 * says how much is actually left.
 */
export function deliveredCount(lines: readonly ScopeLine[]): number {
  return lines.filter(isDelivered).length;
}

/**
 * How much of the estimate has been delivered, as a fraction of one.
 *
 * Measured in estimated minutes rather than in lines, because the lines are
 * not the same size: four deliverables done out of five is three quarters of
 * the way through if the fifth one was the month-long piece. Weighting by the
 * estimate is the only reading that matches what is left to do.
 *
 * A fraction rather than a percentage, because a percentage is a thing you
 * print. And unrounded, because the only caller is a formatter — rounding here
 * and again there would move the figure twice.
 *
 * Null when nothing has been estimated: there is no denominator, and zero
 * would say the work has not started when the truth is that nobody can tell.
 * This is the same distinction `impliedRateCents` makes, for the same reason.
 *
 * Not clamped to the range. A list with a negative row in it can produce a
 * share above one or below zero, and that is the clearest sign available that
 * the estimates need looking at — clamping would hide the bad row behind a
 * plausible-looking percentage.
 */
export function deliveredShare(lines: readonly ScopeLine[]): number | null {
  const total = totalEstimatedMinutes(lines);
  if (total <= 0) return null;
  return deliveredEstimatedMinutes(lines) / total;
}

/**
 * Everything a scope panel needs about one project, worked out once.
 *
 * The individual functions above are the ones worth testing and the ones a
 * later calculation will reach for; this is the shape a page reads. Computing
 * it in one call rather than nine means the numbers on screen are all from the
 * same list — and that a reader who notices the totals do not add up has found
 * a bug here, not a page that summed two different reads of the database.
 *
 * Both units are carried where there are two of them: the minutes are the
 * truth and the hours are what the sentence says. Nothing downstream has to
 * divide by sixty, which is where that kind of number goes wrong.
 */
export type ScopeSummary = {
  /** How many deliverables the scope was written as. */
  lineCount: number;
  /** How many of them have no estimate, and so are missing from the totals. */
  unestimatedCount: number;
  /** How many are done, to be read beside the share rather than instead. */
  deliveredCount: number;
  /** The whole estimate, in minutes. */
  estimatedMinutes: number;
  /** The whole estimate, in hours, for reading. */
  estimatedHours: number;
  /** The estimate of everything not marked done, in minutes. */
  remainingMinutes: number;
  /** The same, in hours. */
  remainingHours: number;
  /** The estimate of everything marked done, in minutes. */
  deliveredMinutes: number;
  /** Share of the estimate delivered, or null with nothing estimated. */
  deliveredShare: number | null;
  /** What the project was agreed for, in cents, as it was handed in. */
  contractValueCents: number;
  /** Cents per hour the contract implies, or null with nothing estimated. */
  impliedRateCents: number | null;
};

/**
 * The whole summary of one project's scope: its deliverables, and what it was
 * agreed for.
 *
 * The two arguments are the two halves of the comparison, and they come from
 * different tables — which is exactly why nobody ever makes it. One call, one
 * list, one contract value, and all the numbers are consistent with each
 * other by construction.
 *
 * `contractValueCents` is echoed back rather than left for the caller to pass
 * around beside the result. A panel showing the implied rate has to show the
 * amount it came from, or the rate is a number with no working.
 */
export function summariseScope(
  lines: readonly ScopeLine[],
  contractValueCents: number,
): ScopeSummary {
  const estimatedMinutes = totalEstimatedMinutes(lines);
  const remainingMinutes = remainingEstimatedMinutes(lines);

  return {
    lineCount: lines.length,
    unestimatedCount: unestimatedCount(lines),
    deliveredCount: deliveredCount(lines),
    estimatedMinutes,
    estimatedHours: estimatedHours(estimatedMinutes),
    remainingMinutes,
    remainingHours: estimatedHours(remainingMinutes),
    deliveredMinutes: deliveredEstimatedMinutes(lines),
    deliveredShare: deliveredShare(lines),
    contractValueCents,
    impliedRateCents: impliedRateCents(contractValueCents, estimatedMinutes),
  };
}
