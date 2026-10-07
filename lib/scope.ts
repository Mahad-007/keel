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
