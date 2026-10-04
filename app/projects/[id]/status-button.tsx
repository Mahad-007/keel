"use client";

import { useFormPending } from "@/components/form";
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
 * The control that moves one deliverable through its status cycle.
 *
 * It is the one control in a row that has to wait for itself. The move buttons
 * ask for a step from wherever the line now is, so pressing one four times is
 * four steps however they interleave — but a status press names the status it
 * expects to find, which is how it avoids overruling somebody else's change.
 * Press "Start" and then "Mark done" fast enough and the second press describes
 * a row the server has not finished writing yet, and the write it was protecting
 * against is the reader's own.
 *
 * So while a press is on its way the control says so by greying, and the list
 * drops a second press on the same line rather than sending one that would be
 * refused. Greying is `aria-disabled` rather than `disabled`, for the reason it
 * is everywhere in this row: a control that leaves the tab order under the
 * reader's finger takes their place in the list with it.
 *
 * It reads the pending state from the form it sits in, which is why the row has
 * two: `useFormStatus` reports on the nearest form above, and that form holds
 * this button and nothing else.
 */
export function StatusButton({
  deliverable,
}: {
  deliverable: ArrangedDeliverable;
}) {
  const saving = useFormPending();

  return (
    <ScopeButton
      name={SCOPE_FIELD_NAMES.status}
      /*
        Computed from the row as the reader sees it, which during a press is the
        optimistic copy: the verb and the status it asks for move together, so the
        press after this one asks for the step after this one.
      */
      value={nextDeliverableStatus(deliverable.status)}
      label={statusButtonLabel(deliverable.title, deliverable.status)}
      unavailable={saving}
    >
      {deliverableStatusVerb(deliverable.status)}
    </ScopeButton>
  );
}
