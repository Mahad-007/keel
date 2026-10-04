import { readField } from "@/lib/forms/form-data";

import { isMoveDirection, moveOne, type MoveDirection } from "./order";
import {
  deliverableStatusPhrase,
  isDeliverableStatus,
  type DeliverableStatus,
} from "./status";

/**
 * Rearranging a scope list: the two changes a row's controls can ask for, and
 * what the list looks like once one of them has been asked for.
 *
 * It exists because the list on screen has to change before the server has
 * agreed to it. A move that waits for a round trip is a list that jumps a
 * beat after the press, and pressing Up three times to lift a deliverable to
 * the top would be three waits. So the page applies the change locally and
 * sends it, and these are the functions that say what "applies the change"
 * means — pure, so the answer cannot differ between the optimistic list and
 * the one that comes back.
 */

/**
 * What rearranging needs to know about a deliverable, which is less than a row
 * holds: who it is, what it says, and where it stands. The functions here are
 * generic over anything carrying those three, so the page can pass whole rows
 * and a test can pass three fields.
 */
export type ArrangedDeliverable = {
  readonly id: string;
  readonly title: string;
  readonly status: DeliverableStatus;
};

/**
 * One press of one control.
 *
 * A move carries the direction rather than a destination position, because
 * that is what the control means — a press of Up is a step towards the front
 * from wherever the row currently is, and a position computed on the client
 * would be a guess about a list somebody else may have changed.
 *
 * A status change carries where the row is as well as where it is going. The
 * destination is what the list shows immediately; `from` is what lets the
 * write refuse a status the reader was not looking at when they pressed.
 */
export type ScopeChange =
  | {
      readonly kind: "move";
      readonly id: string;
      readonly direction: MoveDirection;
    }
  | {
      readonly kind: "status";
      readonly id: string;
      readonly from: DeliverableStatus;
      readonly status: DeliverableStatus;
    };

/**
 * The list as it reads once a change has been asked for.
 *
 * The move goes through `moveOne`, the same function the data layer reorders
 * with, so the list on screen and the list in the database are rearranged by
 * one piece of arithmetic rather than two that have to agree. A press at the
 * end of the list in the direction pressed leaves the order alone, and so does
 * a change naming a deliverable this list does not have — a row somebody else
 * deleted while the page was open.
 *
 * Nothing renumbers `sortOrder`. The number beside each line is its index in
 * the list as rendered, and the stored position is the data layer's business;
 * writing a guess at it here would put a second, briefly-wrong copy of the
 * order in the same array as the real one.
 */
export function applyScopeChange<T extends ArrangedDeliverable>(
  rows: readonly T[],
  change: ScopeChange,
): readonly T[] {
  if (change.kind === "status") {
    return rows.map((row) =>
      row.id === change.id ? { ...row, status: change.status } : row,
    );
  }

  const order = moveOne(
    rows.map((row) => row.id),
    change.id,
    change.direction,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  return order.flatMap((id) => {
    const row = byId.get(id);
    return row === undefined ? [] : [row];
  });
}

/**
 * The names a row's controls submit under.
 *
 * Written down once because they are read in two places that cannot see each
 * other: the hidden inputs and buttons in the row, and the parser below. A
 * typo in one of them would not fail to compile — it would make every press on
 * that row do nothing.
 *
 * `id` is in the form rather than bound into an action per row because one form
 * carries all of a row's controls: a press has to say which deliverable it was
 * aimed at, and the direction or status says what to do with it. The project is
 * *not* in the form — the page binds that, so a submitted field cannot name a
 * project the reader was not looking at.
 */
export const SCOPE_FIELD_NAMES = {
  id: "id",
  direction: "direction",
  status: "status",
  from: "from",
} as const;

/**
 * What a press of one of a row's controls asked for, or null if the submission
 * does not describe a change this list can make.
 *
 * A browser sends the pressed button's name and value and nobody else's, which
 * is what lets one form per row carry three controls: a move button contributes
 * a direction, the status button a destination status, and whichever was pressed
 * is the only one in the submission.
 *
 * Null rather than a thrown error, because every cause is the same kind of
 * thing — a form submitted some other way, a direction that is not one of the
 * two, a status the list does not know. There is nothing for the reader to fix
 * and nothing to tell them: the honest response to a press that says nothing is
 * to do nothing.
 */
export function readScopeChange(formData: FormData): ScopeChange | null {
  const id = readField(formData, SCOPE_FIELD_NAMES.id).trim();
  if (id === "") return null;

  const direction = readField(formData, SCOPE_FIELD_NAMES.direction);
  if (direction !== "") {
    if (!isMoveDirection(direction)) return null;
    return { kind: "move", id, direction };
  }

  const status = readField(formData, SCOPE_FIELD_NAMES.status);
  const from = readField(formData, SCOPE_FIELD_NAMES.from);
  if (!isDeliverableStatus(status) || !isDeliverableStatus(from)) return null;
  return { kind: "status", id, from, status };
}

/** Which end of the list a press that moved nothing had already reached. */
const END_OF_LIST: Record<MoveDirection, string> = {
  up: "first",
  down: "last",
};

/**
 * What to say out loud once a change has been applied, or null when there is
 * nothing to say.
 *
 * The list rearranges itself under the reader without the page reloading. On
 * screen that is the whole message — the line is visibly one place higher —
 * and to anyone working from a screen reader it is silence, because moving a
 * node does not announce anything. So each press gets a sentence, and the
 * sentence names the deliverable and where it ended up: "moved up" is no use
 * on a press that was the third in a row.
 *
 * `rows` is the list as it reads *before* the press, which is what the page
 * has. The position announced is counted in the list the change produces, by
 * the same function that produces it, so the number said out loud cannot
 * disagree with the number drawn down the left.
 *
 * A press that moved nothing says so rather than claiming a move. The controls
 * at the ends of the list are disabled, so it takes a stale page to get here —
 * and a reader who has just pressed Up deserves better than silence followed
 * by a list that did not change.
 */
export function announceScopeChange<T extends ArrangedDeliverable>(
  rows: readonly T[],
  change: ScopeChange,
): string | null {
  const row = rows.find((one) => one.id === change.id);
  if (row === undefined) return null;

  if (change.kind === "status") {
    return `“${row.title}” is now ${deliverableStatusPhrase(change.status)}.`;
  }

  const moved = applyScopeChange(rows, change);
  const was = rows.indexOf(row) + 1;
  const now = moved.indexOf(row) + 1;
  if (now === was) {
    return `“${row.title}” is already ${END_OF_LIST[change.direction]}.`;
  }
  return `Moved “${row.title}” to position ${now} of ${moved.length}.`;
}

/**
 * What a scope write hands back: nothing to say, or the one sentence worth
 * saying about why the list did not change.
 *
 * Not a form state, because these presses are not a form being filled in.
 * There is no field to put a message under and nothing the reader typed to
 * render back — a press either happened or it did not, and if it did not, the
 * list on screen has already snapped back to what the database says. The
 * sentence is there to explain that snap.
 */
export type ScopeWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: string };

/** The write landed. The revalidated page is the rest of the answer. */
export const SCOPE_WRITE_DONE: ScopeWriteResult = { ok: true };

export function scopeWriteProblem(problem: string): ScopeWriteResult {
  return { ok: false, problem };
}

/**
 * The sentences a refused press comes back with.
 *
 * Each one says what to do next, because "something went wrong" leaves a
 * reader pressing the same button again. Two of these end in "reload": the page
 * is describing a scope list that has since changed, and no amount of pressing
 * will make it describe the current one.
 */
export const SCOPE_PROBLEMS = {
  /** The row is gone, or belongs to a project this page is not showing. */
  missing:
    "That deliverable is not on this project any more, so nothing was changed. Reload to see what the scope list says now.",
  /** The press described a direction or a status that is not one of ours. */
  unknown:
    "That is not a change this list can make, so nothing was changed. Reload to see what the scope list says now.",
  /** The write itself failed — the driver, the disk, the network. */
  failed: "Could not save that change. Nothing was written — try again.",
} as const;
