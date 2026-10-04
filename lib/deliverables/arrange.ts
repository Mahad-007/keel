import type { MoveDirection } from "./order";
import type { DeliverableStatus } from "./status";

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
