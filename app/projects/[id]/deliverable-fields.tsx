import { TextAreaField, TextField } from "@/components/form";
import {
  DELIVERABLE_FIELD_LIMITS,
  type DeliverableFormState,
} from "@/lib/deliverables/form";

/**
 * The three things a deliverable is: what was agreed, how big it is, and the
 * detail behind it.
 *
 * Rendered by both forms on the scope tab — the add line at the bottom and the
 * editor that opens inside a row. They have to ask for the same fields with the
 * same words and the same limits: a hint that says "optional" on one and
 * nothing on the other is two different rules as far as the reader is
 * concerned, and the validator behind both is one function.
 *
 * `scope` is what keeps the two apart in the document. Both are mounted at once
 * while a row is open, and two controls carrying `field-title` would mean a
 * label that focuses the wrong box.
 */
export function DeliverableFields({
  state,
  scope,
}: {
  state: DeliverableFormState;
  /** Unique on the page. The row's id for an editor, absent for the add line. */
  scope?: string;
}) {
  return (
    <>
      {/*
        The title and the estimate sit on one row because together they are the
        line being written: a wide box for what was agreed, a narrow one for how
        big it is. The detail goes underneath, where it does not make the common
        case — a title and nothing else — look like a long form.
      */}
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <TextField
          name="title"
          label="Deliverable"
          error={state.errors.title}
          defaultValue={state.fields.title}
          maxLength={DELIVERABLE_FIELD_LIMITS.title}
          placeholder="Wireframes for the booking flow"
          scope={scope}
        />
        <TextField
          name="estimate"
          label="Estimate"
          hint="Hours, like 2 or 1.5."
          inputMode="decimal"
          error={state.errors.estimate}
          defaultValue={state.fields.estimate}
          scope={scope}
        />
      </div>
      <TextAreaField
        name="description"
        label="Detail"
        hint="Optional. What this covers, and anything it deliberately does not."
        rows={2}
        error={state.errors.description}
        defaultValue={state.fields.description}
        maxLength={DELIVERABLE_FIELD_LIMITS.description}
        scope={scope}
      />
    </>
  );
}
