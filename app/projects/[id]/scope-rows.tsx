"use client";

import type { Deliverable } from "@/lib/db/schema";
import { readScopeChange } from "@/lib/deliverables/arrange";

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
  async function arrange(formData: FormData) {
    const change = readScopeChange(formData);
    /*
      A submission that describes no change it can make: a direction that is not
      one of the two, a form submitted without a button. There is nothing to
      write and nothing to tell the reader — a press that says nothing gets
      nothing done, which is the honest answer.
    */
    if (change === null) return;

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
      {deliverables.map((deliverable, index) => (
        <DeliverableItem
          key={deliverable.id}
          deliverable={deliverable}
          position={index + 1}
          controls={
            <DeliverableControls
              deliverable={deliverable}
              position={index + 1}
              count={deliverables.length}
              arrange={arrange}
            />
          }
        />
      ))}
    </ol>
  );
}
