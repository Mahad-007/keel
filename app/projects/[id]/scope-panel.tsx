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
  return (
    <>
      {deliverables.length === 0 ? (
        <NoDeliverables />
      ) : (
        <DeliverableList deliverables={deliverables} />
      )}
      <section className="mt-10 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Add a deliverable
        </h3>
        <AddDeliverableForm
          projectId={projectId}
          initialState={INITIAL_ADD_DELIVERABLE_STATE}
        />
      </section>
    </>
  );
}
