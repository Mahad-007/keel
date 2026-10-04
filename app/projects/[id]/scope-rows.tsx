"use client";

import { useOptimistic } from "react";

import type { Deliverable } from "@/lib/db/schema";
import {
  applyScopeChange,
  readScopeChange,
  type ScopeChange,
} from "@/lib/deliverables/arrange";

import { DeliverableControls } from "./deliverable-controls";
import { DeliverableItem } from "./deliverable-item";
import {
  changeDeliverableStatusAction,
  moveDeliverableAction,
} from "./scope-actions";

/**
 * The lines of a project's scope, and the controls that rearrange them.
 *
 * A client component, which the rest of this page is not. The reason is the
 * order: a press of Up has to show on screen before the server has agreed to
 * it, and nothing that renders on the server can show a list it has not been
 * sent. So the order lives here, and the server's copy arrives as a prop.
 *
 * One press handler for every control on every line, rather than an action
 * bound per row. Each row submits a form carrying the deliverable it names and
 * what was asked for, which is exactly what a browser puts in a submission —
 * and it leaves this component as the only thing that has to know which server
 * action answers which press.
 */
export function ScopeRows({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: readonly Deliverable[];
}) {
  /*
    The list as the reader sees it, which is the server's list plus whatever
    they have just pressed. React keeps the pressed changes until the action
    that was sent for them settles and the re-rendered page arrives, then drops
    them — so a press that the server refuses rolls back on its own, and there
    is no second copy of the order here to get out of step.

    The reducer is the same pure function the tests use, and a move inside it
    goes through the same arithmetic as the write. That is what stops the list
    sliding one way on screen and the other way in the database.
  */
  const [rows, showChange] = useOptimistic<readonly Deliverable[], ScopeChange>(
    deliverables,
    applyScopeChange,
  );

  async function arrange(formData: FormData) {
    const change = readScopeChange(formData);
    /*
      A submission that describes no change it can make: a direction that is not
      one of the two, a form submitted without a button. There is nothing to
      write and nothing to tell the reader — a press that says nothing gets
      nothing done, which is the honest answer.
    */
    if (change === null) return;

    // On screen first. A press that waited for the round trip would make
    // rearranging a list feel like it had to be done one keystroke at a time.
    showChange(change);

    if (change.kind === "move") {
      await moveDeliverableAction(projectId, change.id, change.direction);
      return;
    }
    await changeDeliverableStatusAction(
      projectId,
      change.id,
      change.from,
      change.status,
    );
  }

  return (
    /*
      `role="list"` on a list is normally redundant, and here it is not:
      Tailwind's reset takes the bullets off every list, and WebKit drops the
      list semantics along with them. The sequence is the one thing this element
      exists to convey — and the numbers down the left are hidden from assistive
      technology precisely because the list was meant to carry it.
    */
    <ol
      role="list"
      className="mt-3 border-t border-zinc-200 dark:border-zinc-800"
    >
      {rows.map((deliverable, index) => (
        <DeliverableItem
          key={deliverable.id}
          deliverable={deliverable}
          position={index + 1}
          controls={
            <DeliverableControls
              deliverable={deliverable}
              position={index + 1}
              count={rows.length}
              arrange={arrange}
            />
          }
        />
      ))}
    </ol>
  );
}
