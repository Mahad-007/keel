import { CheckboxField, SelectField, TextAreaField } from "@/components/form";
import type { DeliverableOption } from "@/lib/time/attribution";
import { NO_DELIVERABLE_LABEL } from "@/lib/time/attribution";
import { BILLABLE_VALUE, readsAsBillable } from "@/lib/time/form";
import {
  START_TIMER_FIELD_LIMITS,
  type StartTimerFormState,
} from "@/lib/time/start";

/**
 * The three things worth saying before a clock starts: which line of scope the
 * work is going into, what it is, and whether it is chargeable.
 *
 * The same three controls the log form asks for, with the same words and the
 * same limits, because they fill the same three columns. What is missing is
 * the pair that makes an entry: the duration, which the clock is about to
 * measure, and the day, which is a fact about pressing Start rather than a
 * decision and travels in a hidden field.
 *
 * Every field carries the timer's scope. Both forms are on the time tab at
 * once — the log line below, this above it — and two controls named
 * `field-deliverable` would mean a label that focuses the wrong box and an
 * error message pointing at somebody else's field.
 */

/** Unique on the tab, which is all `fieldId` asks of a scope. */
export const START_TIMER_SCOPE = "timer";

export function StartTimerFields({
  state,
  options,
}: {
  state: StartTimerFormState;
  /** The deliverables this project has, for the attribution picker. */
  options: readonly DeliverableOption[];
}) {
  return (
    <>
      {/*
        No picker on a project with nothing agreed yet, for the reason the log
        form leaves it out: a `<select>` holding only "the project itself" asks
        a question with one answer, and it reads as a scope list that has gone
        missing rather than one that was never written. The field submits blank
        either way, which is what the only option would have submitted.

        Unless there is a message about it — a refusal with nowhere to put its
        sentence is the state a form must never be in.
      */}
      {options.length === 0 && state.errors.deliverable === undefined ? null : (
        <SelectField
          name="deliverable"
          label="Against"
          hint="Which line of the scope list this work goes into. It can be changed on the entry after the clock stops."
          placeholder={NO_DELIVERABLE_LABEL}
          options={options.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          defaultValue={state.fields.deliverable}
          error={state.errors.deliverable}
          scope={START_TIMER_SCOPE}
        />
      )}
      <TextAreaField
        name="note"
        label="What you are doing"
        hint="Optional, and easier to write now than to remember later. It becomes the note on the entry when the clock stops."
        rows={2}
        error={state.errors.note}
        defaultValue={state.fields.note}
        maxLength={START_TIMER_FIELD_LIMITS.note}
        scope={START_TIMER_SCOPE}
      />
      <CheckboxField
        name="billable"
        label="Chargeable"
        hint="Unticked, the time is still recorded against the project and never reaches an invoice."
        value={BILLABLE_VALUE}
        defaultChecked={readsAsBillable(state.fields.billable)}
        error={state.errors.billable}
        scope={START_TIMER_SCOPE}
      />
    </>
  );
}
