import {
  SCOPE_FIELD_NAMES,
  statusButtonLabel,
  type ArrangedDeliverable,
} from "@/lib/deliverables/arrange";
import {
  deliverableStatusVerb,
  nextDeliverableStatus,
} from "@/lib/deliverables/status";

import { ScopeButton } from "./scope-button";

/**
 * The controls on one line of a scope list: what it is doing, and where it sits.
 *
 * One form for the whole row rather than one per button. A browser submits the
 * pressed button's name and value and nobody else's, so a single form can carry
 * three controls and the submission still says exactly which was pressed — and
 * the two hidden fields it needs are then written once instead of three times.
 *
 * The form's action belongs to the list rather than to the row: the list is what
 * holds the optimistic copy of the order, so it is the only thing that can show
 * a press before the server has agreed to it.
 */
export function DeliverableControls({
  deliverable,
  arrange,
}: {
  deliverable: ArrangedDeliverable;
  /** What to do with a press. The list reads it and applies it on screen. */
  arrange: (formData: FormData) => void;
}) {
  return (
    <form action={arrange} className="flex shrink-0 items-center gap-1">
      {/*
        Which line was pressed, and what it said at the time. The project is not
        here: the list binds that into the action, so no field of this form can
        name a project the reader was not looking at.

        `from` is the row's status as rendered, and it is the whole of the
        protection against two people pressing at once — the write refuses a
        status press made against a row that has since moved on, rather than
        quietly overruling whoever got there first.
      */}
      <input
        type="hidden"
        name={SCOPE_FIELD_NAMES.id}
        value={deliverable.id}
      />
      <input
        type="hidden"
        name={SCOPE_FIELD_NAMES.from}
        value={deliverable.status}
      />
      <ScopeButton
        name={SCOPE_FIELD_NAMES.status}
        value={nextDeliverableStatus(deliverable.status)}
        label={statusButtonLabel(deliverable.title, deliverable.status)}
      >
        {deliverableStatusVerb(deliverable.status)}
      </ScopeButton>
    </form>
  );
}
