import type { Deliverable } from "@/lib/db/schema";
import { INITIAL_ADD_DELIVERABLE_STATE } from "@/lib/deliverables/form";

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
          projectId={projectId}
          initialState={INITIAL_ADD_DELIVERABLE_STATE}
        />
      </section>
    </>
  );
}
