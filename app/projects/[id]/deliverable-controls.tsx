import {
  moveButtonLabel,
  SCOPE_FIELD_NAMES,
  type ArrangedDeliverable,
} from "@/lib/deliverables/arrange";
import { canMove, MOVE_LABELS } from "@/lib/deliverables/order";

import { ScopeButton } from "./scope-button";
import { StatusButton } from "./status-button";

/**
 * The controls on one line of a scope list: what it is doing, and where it sits.
 *
 * Two forms, not one and not three. A browser submits the pressed button's name
 * and value and nobody else's, so one form can carry several controls and the
 * submission still says exactly which was pressed — but a form is also the unit
 * React reports "in flight" over. The status control has to know when its own
 * press is still on its way, because the next press depends on the answer to the
 * last one; the move controls must not be told anything of the kind, because
 * moves are pressed in runs and each is a step from wherever the line now is.
 *
 * The action belongs to the list rather than to the row: the list is what holds
 * the optimistic copy of the order, so it is the only thing that can show a
 * press before the server has agreed to it.
 */
export function DeliverableControls({
  deliverable,
  position,
  count,
  arrange,
}: {
  deliverable: ArrangedDeliverable;
  /** Its place in the list as rendered, counting from one. */
  position: number;
  /** How many lines the list has, which is what decides the two ends. */
  count: number;
  /** What to do with a press. The list reads it and applies it on screen. */
  arrange: (formData: FormData) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <form action={arrange}>
        {/*
          Which line was pressed, and what it said at the time. The project is
          not here: the list binds that into the action, so no field of this form
          can name a project the reader was not looking at.

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
        <StatusButton deliverable={deliverable} />
      </form>
      <form action={arrange} className="flex items-center gap-1">
        <input
          type="hidden"
          name={SCOPE_FIELD_NAMES.id}
          value={deliverable.id}
        />
        {/*
          Both move controls are drawn on every line, and the one that cannot act
          is greyed rather than missing. A column of buttons that appears and
          disappears as lines move is harder to use than one that is always in
          the same place — and the first line of a list has no "up" to offer,
          which is a fact about the list worth showing rather than hiding.
        */}
        {(["up", "down"] as const).map((direction) => (
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
    </div>
  );
}
