import type { Deliverable } from "@/lib/db/schema";
import {
  INITIAL_ADD_DELIVERABLE_STATE,
  type AddDeliverableState,
} from "@/lib/deliverables/form";

import { writeNewDeliverable } from "./scope-writes";

import { AddDeliverableForm } from "./add-deliverable-form";
import { DeliverableList } from "./deliverable-list";
import { NoDeliverables } from "./scope-empty";

/**
 * The scope tab: what was agreed, and the line where the next one is written.
 *
 * The list is above the form rather than beside it, which is the order the
 * work happens in — you read what is already down, then add what is missing.
 * The form stays on the page whether or not there is a list, so an empty
 * project is one keystroke from not being empty.
 */
export function ScopePanel({
  projectId,
  deliverables,
}: {
  projectId: string;
  deliverables: readonly Deliverable[];
}) {
  /*
    The first line of a scope list is a different act from the fifth: one is
    starting the list, the other is continuing it. The heading says which,
    because it sits directly under an empty state that has just asked for the
    first one and should not then be followed by a generic invitation.
  */
  const empty = deliverables.length === 0;

  /*
    The project is captured here rather than bound onto the action, for the same
    reason the presses are: `.bind` serialises what it carries in the clear, so
    the project a line gets written to would be whatever the caller sent. A
    `"use server"` function declared in a server component is the form the
    compiler rewrites to encrypt its captured variables.

    It was previously bound inside the client form, which `useActionState`
    accepts quite happily and which left the project forgeable — the one check
    in front of the write being that some project by that id exists.
  */
  async function add(previous: AddDeliverableState, formData: FormData) {
    "use server";
    return writeNewDeliverable(projectId, previous, formData);
  }

  return (
    <>
      {empty ? (
        <NoDeliverables />
      ) : (
        <DeliverableList projectId={projectId} deliverables={deliverables} />
      )}
      <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {empty ? "Add the first deliverable" : "Add a deliverable"}
        </h3>
        <AddDeliverableForm
          add={add}
          initialState={INITIAL_ADD_DELIVERABLE_STATE}
        />
      </section>
    </>
  );
}
