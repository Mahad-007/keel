/**
 * Where each deliverable sits in its project's list, and how that changes.
 *
 * Reordering is pure arithmetic over a list of ids, so it lives here rather
 * than in the data layer: every interesting case — moving the first item up,
 * moving an item that was deleted in another tab, an order that names a
 * deliverable twice — can be tested without a database, and the data layer is
 * left with nothing to do but read the ids, apply one of these functions, and
 * write back what changed.
 *
 * Positions are dense integers from zero. Gaps and fractional positions are
 * the usual alternative — they make a single move one write — but they drift
 * apart from "nth in the list", and the scope snapshots and templates later in
 * the roadmap copy an order around between projects. A list of ten
 * deliverables is not a table that needs the trick.
 */

/** One deliverable's place in the list: its id and the position it holds. */
export type DeliverablePosition = {
  readonly id: string;
  readonly sortOrder: number;
};
