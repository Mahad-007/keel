import {
  moveButtonLabel,
  SCOPE_FIELD_NAMES,
  statusButtonLabel,
  type ArrangedDeliverable,
} from "@/lib/deliverables/arrange";
import { editButtonLabel } from "@/lib/deliverables/edit";
import { canMove, MOVE_DIRECTIONS, MOVE_LABELS } from "@/lib/deliverables/order";
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
 * The action belongs to the list rather than to the row: the list is what holds
 * the optimistic copy of the order, so it is the only thing that can show a
 * press before the server has agreed to it — and it is what sends the presses in
 * the order they were made, which is why no control here has to wait for itself.
 */
export function DeliverableControls({
  deliverable,
  position,
  count,
  arrange,
  onEdit,
}: {
  deliverable: ArrangedDeliverable;
  /** Its place in the list as rendered, counting from one. */
  position: number;
  /** How many lines the list has, which is what decides the two ends. */
  count: number;
  /** What to do with a press. The list reads it and applies it on screen. */
  arrange: (formData: FormData) => void;
  /** Open this row for editing. Nothing is submitted and nothing is written. */
  onEdit: () => void;
}) {
  return (
    <form action={arrange} className="flex shrink-0 items-center gap-1">
      {/*
        Which line was pressed, and what it said at the time. The project is not
        here, and it is not in the list either: the page closes it over and hands
        the list an action that already carries it, so neither a field of this
        form nor an argument from the list can name a project the reader was not
        looking at.

        `from` is the row's status as rendered, and it is the whole of the
        protection against two people pressing at once — the write refuses a
        status press made against a row that has since moved on, rather than
        quietly overruling whoever got there first.
      */}
      <input type="hidden" name={SCOPE_FIELD_NAMES.id} value={deliverable.id} />
      <input
        type="hidden"
        name={SCOPE_FIELD_NAMES.from}
        value={deliverable.status}
      />
      {/*
        The status control says what it will do rather than what the line is —
        the words beside the line already say that. Both come from the row as the
        reader sees it, which during a press is the optimistic copy, so the verb
        and the status it asks for move together.
      */}
      <ScopeButton
        name={SCOPE_FIELD_NAMES.status}
        value={nextDeliverableStatus(deliverable.status)}
        label={statusButtonLabel(deliverable.title, deliverable.status)}
      >
        {deliverableStatusVerb(deliverable.status)}
      </ScopeButton>
      {/*
        Both move controls are drawn on every line, and the one that cannot act
        is greyed rather than missing. A column of buttons that appears and
        disappears as lines move is harder to use than one that is always in the
        same place — and the first line of a list has no "up" to offer, which is
        a fact about the list worth showing rather than hiding.
      */}
      {/*
        Edit comes after the controls that change the list and before the one
        that ends it, which is the order of consequence: a status press and a
        move are a keystroke each and reversible, an edit is a form, and a
        deletion is final. A reader tabbing along the row meets them in that
        order rather than meeting Delete on the way to Up.
      */}
      <ScopeButton onPress={onEdit} label={editButtonLabel(deliverable.title)}>
        Edit
      </ScopeButton>
      {MOVE_DIRECTIONS.map((direction) => (
        <ScopeButton
          key={direction}
          name={SCOPE_FIELD_NAMES.direction}
          value={direction}
          label={moveButtonLabel(deliverable.title, direction)}
          unavailable={!canMove(position, count, direction)}
        >
          {MOVE_LABELS[direction]}
        </ScopeButton>
      ))}
    </form>
  );
}
