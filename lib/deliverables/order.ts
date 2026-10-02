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

/**
 * The position a new deliverable takes, given the highest one already used —
 * null when the project has no deliverables yet.
 *
 * New scope goes on the end. Somebody writing down the fourth thing they
 * agreed to is continuing a list, not inserting into one, and a form that
 * silently put it at the top would reorder a list the client has seen.
 *
 * Hand-edited rows can leave the highest position anywhere, including below
 * zero; one above it is still the end of the list, and the next renumber
 * brings the whole thing back to dense.
 */
export function nextSortOrder(highest: number | null): number {
  if (highest === null) return 0;
  return highest + 1;
}

/**
 * The positions a list of ids should hold: dense, from zero, in the order
 * given. The id's place in the array *is* its position, which is the whole
 * invariant this module keeps.
 */
export function positionsFor(
  ids: readonly string[],
): readonly DeliverablePosition[] {
  return ids.map((id, index) => ({ id, sortOrder: index }));
}

/** Keeps an index inside a list, so a move at either end stays put. */
function clamp(index: number, last: number): number {
  return Math.min(Math.max(Math.trunc(index), 0), last);
}

/**
 * The list with one id moved `delta` places — negative towards the front.
 *
 * Clamped rather than refused at the ends: pressing Up on the first
 * deliverable is a reasonable thing to do with a list, and the honest answer
 * is that nothing moves. A caller that needs to know whether anything changed
 * asks `orderChanges`, which compares positions instead of guessing from a
 * return value.
 *
 * An id the list does not contain leaves the order alone. A page showing a
 * deliverable another tab has deleted will ask for exactly that, and
 * rearranging the remaining scope because of it would be worse than doing
 * nothing.
 */
export function moveBy(
  ids: readonly string[],
  id: string,
  delta: number,
): readonly string[] {
  const from = ids.indexOf(id);
  if (from === -1) return ids;

  const to = clamp(from + delta, ids.length - 1);
  if (to === from) return ids;

  const moved = [...ids];
  moved.splice(from, 1);
  moved.splice(to, 0, id);
  return moved;
}

/**
 * Which way "up" is, said once. A list moves a deliverable towards the front
 * of the order, and the front of the order is the top of the page.
 */
export const MOVE_DELTAS = { up: -1, down: 1 } as const;

/** The two directions a move-up/move-down control can ask for. */
export type MoveDirection = keyof typeof MOVE_DELTAS;

/** One step in the named direction — what a move button asks for. */
export function moveOne(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
): readonly string[] {
  return moveBy(ids, id, MOVE_DELTAS[direction]);
}
