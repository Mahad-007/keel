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

/**
 * Narrows an unknown string to a direction.
 *
 * `Object.hasOwn` rather than an `in` check, so that a submitted
 * `__proto__` — a string every object answers to — is not mistaken for a
 * direction, which would look up a delta that is not a number at all.
 */
export function isMoveDirection(value: unknown): value is MoveDirection {
  return typeof value === "string" && Object.hasOwn(MOVE_DELTAS, value);
}

/**
 * The strict form, for the move itself. A direction arrives as a form field or
 * a URL param, which TypeScript cannot vouch for; anything that is not one of
 * the two has to stop here rather than resolve to an undefined delta and
 * silently send the deliverable to the top of the list.
 */
export function parseMoveDirection(value: unknown): MoveDirection {
  if (!isMoveDirection(value)) {
    throw new Error(
      `unknown move direction: ${JSON.stringify(value)} (expected one of ${Object.keys(MOVE_DELTAS).join(", ")})`,
    );
  }
  return value;
}

/**
 * One step in the named direction — what a move button asks for.
 *
 * The direction is parsed rather than trusted. Its type says it is one of two
 * strings, and the value will have come from a form; a delta of `undefined`
 * would clamp to zero and move the deliverable to the top of the list, which
 * is the one outcome worse than an error.
 */
export function moveOne(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
): readonly string[] {
  return moveBy(ids, id, MOVE_DELTAS[parseMoveDirection(direction)]);
}

/**
 * Only the positions that would actually change, given where the deliverables
 * sit now and the order they should be in.
 *
 * Dense renumbering means a naive reorder writes every row in the project,
 * when moving the last two deliverables changes two of them. Comparing first
 * keeps a move to the rows that moved — which matters less for the write than
 * for `updatedAt`: bumping the timestamp of eight untouched deliverables makes
 * every one of them look edited.
 *
 * Ids with no current position are dropped before the list is numbered, not
 * after. There is no row to write for a deliverable that no longer exists, and
 * numbering around it would leave the gap it was holding — a list of three with
 * a phantom id in the middle would come back as 0, 2, 3, which is exactly the
 * invariant this module exists to keep.
 *
 * `desired` must still name every id in `current`. An order that leaves one out
 * does not say where it belongs, so the id keeps the position it had and can
 * collide with a renumbered one; `orderMismatch` is what refuses such a request
 * before it gets here.
 */
export function orderChanges(
  current: readonly DeliverablePosition[],
  desired: readonly string[],
): readonly DeliverablePosition[] {
  const held = new Map(current.map(({ id, sortOrder }) => [id, sortOrder]));
  const placeable = desired.filter((id) => held.has(id));
  return positionsFor(placeable).filter(
    ({ id, sortOrder }) => held.get(id) !== sortOrder,
  );
}

/** The ids that appear more than once, in the order they first repeat. */
function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) repeated.add(id);
    seen.add(id);
  }
  return [...repeated];
}

/**
 * Why a requested order cannot be applied, or null if it can.
 *
 * A reorder is a statement about the whole list: these deliverables, in this
 * sequence. Anything else is ambiguous rather than partially right — an order
 * that leaves one out does not say whether it belongs at the top or the
 * bottom, and one that names a deliverable twice does not say which copy is
 * meant. Applying such a request would silently invent a position.
 *
 * A sentence rather than a thrown error, so the data layer decides what to do
 * with it. The wording is for a developer: every one of these means the caller
 * built the list wrong, which is a bug and not something a user can retype.
 */
export function orderMismatch(
  current: readonly string[],
  desired: readonly string[],
): string | null {
  const repeated = duplicates(desired);
  if (repeated.length > 0) {
    return `reorder lists the same deliverable twice: ${repeated.join(", ")}`;
  }

  const held = new Set(current);
  const unknown = desired.filter((id) => !held.has(id));
  if (unknown.length > 0) {
    return `reorder names deliverables that are not in this project: ${unknown.join(", ")}`;
  }

  const listed = new Set(desired);
  const missing = current.filter((id) => !listed.has(id));
  if (missing.length > 0) {
    return `reorder leaves out deliverables: ${missing.join(", ")}`;
  }

  return null;
}

/**
 * Whether the deliverable at this place in the list can move in this
 * direction — what decides whether a move control is offered or greyed out.
 *
 * `position` counts from one, as the list renders it, because that is the
 * number the control sits next to. Off the end of the list in either
 * direction is no, not a clamp: a position the list does not contain is a page
 * describing deliverables that have since changed, and offering to move
 * something that is not there would be offering a press that does nothing.
 *
 * The delta is read from `MOVE_DELTAS` rather than compared against the ends
 * directly, so "up is towards the front" is still only said in one place. A
 * control that disagreed with the move about which way up is would be the
 * worst kind of wrong: it would grey out the press that works and offer the
 * one that does not.
 */
export function canMove(
  position: number,
  count: number,
  direction: MoveDirection,
): boolean {
  const from = Math.trunc(position) - 1;
  if (from < 0 || from >= count) return false;

  const to = from + MOVE_DELTAS[parseMoveDirection(direction)];
  return to >= 0 && to < count;
}
