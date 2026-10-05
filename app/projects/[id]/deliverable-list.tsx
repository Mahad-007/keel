import type { Deliverable } from "@/lib/db/schema";
import { describeScopeList } from "@/lib/deliverables/list";
import type { MoveDirection } from "@/lib/deliverables/order";
import type { DeliverableStatus } from "@/lib/deliverables/status";

import {
  writeDeliverableStatus,
  writeDeliverableMove,
} from "./scope-writes";
import { ScopeRows } from "./scope-rows";

/**
 * A project's scope, in the order it was agreed.
 *
 * An ordered list rather than a table, and the element is doing real work:
 * the sequence is part of what was agreed, not a sort somebody chose, so it
 * has to survive being read aloud and being copied out of the page. A table
 * would also invite a column per attribute, and a scope line is a sentence
 * with two figures beside it rather than a row of cells.
 *
 * The position shown is the line's place in the list as rendered, counting
 * from one — not `sortOrder`, which starts at zero and is the data layer's
 * business. If a hand-edited row ever left a gap in the stored positions, the
 * numbers on screen would still read 1, 2, 3, which is what the two parties
 * would be talking about.
 *
 * The rows themselves are a client component, because they can be rearranged
 * and the rearranging shows before the server has agreed to it. The sentence
 * above them is not: the count does not change when a line moves or is marked
 * done, so there is nothing for it to be optimistic about.
 */
export function DeliverableList({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: readonly Deliverable[];
}) {
  /*
    The project is closed over by these two rather than passed to the actions as
    an argument, and the shape matters more than it looks.

    An argument to a server action is wire data: the call is a POST, and the
    client sends every argument in it. `.bind` on an imported action is no
    different — it concatenates onto `$$bound` and the values are serialised in
    the clear, wherever the `.bind` is written. So a project named that way is
    named by whoever holds the page, and checking a deliverable against it
    compares two values from the same source.

    A `"use server"` function declared *here*, inside a server component, is
    what the compiler rewrites to encrypt its captured variables, so the project
    id crosses to the client and back as ciphertext the caller cannot forge or
    swap. That is what gives the deliverable-belongs-to-project check in the
    actions something real to compare against.

    It still says only which page made the call, not who was holding it. Phase 8
    has to answer that from the session.
  */
  async function move(id: string, direction: MoveDirection) {
    "use server";
    return writeDeliverableMove(projectId, id, direction);
  }

  async function changeStatus(
    id: string,
    from: string,
    status: DeliverableStatus,
  ) {
    "use server";
    return writeDeliverableStatus(projectId, id, from, status);
  }

  return (
    <>
      <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
        {describeScopeList(deliverables.length)}
      </p>
      <ScopeRows
        deliverables={deliverables}
        move={move}
        changeStatus={changeStatus}
      />
    </>
  );
}
