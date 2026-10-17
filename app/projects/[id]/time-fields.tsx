import {
  CheckboxField,
  DateField,
  SelectField,
  TextAreaField,
  TextField,
} from "@/components/form";
import type { DeliverableOption } from "@/lib/time/attribution";
import { NO_DELIVERABLE_LABEL } from "@/lib/time/attribution";
import {
  BILLABLE_VALUE,
  LOG_TIME_FIELD_LIMITS,
  readsAsBillable,
  type LogTimeFormState,
} from "@/lib/time/form";

/**
 * The five things a logged stretch of work is: how long, which day, which line
 * of scope, what was done, and whether it is chargeable.
 *
 * Its own component because Day 023 adds an editor for an entry already
 * logged, and the two forms have to ask for the same things with the same
 * words, the same hints and the same limits. A hint that says one thing on the
 * log line and another in the editor is two different rules as far as the
 * reader is concerned, and the validator behind both is one function.
 */

/**
 * The hint under the duration box, and the only place the syntax is written
 * down for somebody who has not got it wrong yet.
 *
 * Three spellings, because they are the three the field is built around: units
 * for the ordinary case, minutes alone for a short stretch, and the bare
 * number that is the one convention a reader could not guess. `90` is last
 * because it is the one that needs the explanation.
 */
const DURATION_HINT = "How long it took: 1h30m, 45m, or 90 for ninety minutes.";

export function LogTimeFields({
  state,
  options,
}: {
  state: LogTimeFormState;
  /** The deliverables this project has, for the attribution picker. */
  options: readonly DeliverableOption[];
}) {
  return (
    <>
      {/*
        The duration and the day share a row because together they are the
        entry: how much, and when. The duration is the wider of the two and
        comes first, because it is the field being filled in — the day is
        already right nine times out of ten.
      */}
      <div className="grid gap-4 sm:grid-cols-[1fr_11rem]">
        <TextField
          name="duration"
          label="Time"
          hint={DURATION_HINT}
          error={state.errors.duration}
          defaultValue={state.fields.duration}
          placeholder="1h30m"
        />
        <DateField
          name="workedOn"
          label="Day"
          error={state.errors.workedOn}
          defaultValue={state.fields.workedOn}
        />
      </div>
      {/*
        No picker on a project with nothing agreed yet. A `<select>` holding
        only "the project itself" is a control with one option: it asks a
        question that has one answer, and it would read as a scope list that
        has gone missing rather than as one that was never written.

        Nothing is lost by leaving it out — the field submits blank, which is
        what the only option would have submitted, and the empty state on the
        scope tab is where a reader is told what deliverables are for.

        Unless there is a message about it, which is the one case where a
        control with one option has something to say. A submission naming a
        deliverable this project has none of is refused by the validator, and
        a refusal with nowhere to put its sentence is the state a form must
        never be in: the summary would count a bad field, nothing on screen
        would say which, and the cursor would have nowhere to go.
      */}
      {options.length === 0 && state.errors.deliverable === undefined ? null : (
        <SelectField
          name="deliverable"
          label="Against"
          hint="Which line of the scope list this went into. Time against the project itself still counts towards its burn — it just is not attributed to anything that was estimated."
          placeholder={NO_DELIVERABLE_LABEL}
          options={options.map((option) => ({
            value: option.id,
            label: option.label,
          }))}
          defaultValue={state.fields.deliverable}
          error={state.errors.deliverable}
        />
      )}
      <TextAreaField
        name="note"
        label="What you did"
        hint="Optional, and worth it. This is what an invoice line is written from, and what answers “what was that hour for?” three months later."
        rows={2}
        error={state.errors.note}
        defaultValue={state.fields.note}
        maxLength={LOG_TIME_FIELD_LIMITS.note}
      />
      <CheckboxField
        name="billable"
        label="Chargeable"
        hint="Unticked, the time is still recorded against the project and never reaches an invoice."
        value={BILLABLE_VALUE}
        defaultChecked={readsAsBillable(state.fields.billable)}
        error={state.errors.billable}
      />
    </>
  );
}
