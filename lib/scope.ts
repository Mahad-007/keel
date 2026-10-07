import { isEstimated } from "@/lib/deliverables/list";
import type { DeliverableStatus } from "@/lib/deliverables/status";

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
