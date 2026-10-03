"use client";

import { useActionState, useEffect } from "react";

import {
  fieldId,
  FormSummary,
  SubmitButton,
  TextAreaField,
  TextField,
  useFirstErrorFocus,
} from "@/components/form";
import {
  addedNotice,
  DELIVERABLE_FIELD_LIMITS,
  DELIVERABLE_FIELD_NAMES,
  type AddDeliverableState,
} from "@/lib/deliverables/form";

import { addDeliverableAction } from "./scope-actions";

/**
 * The line at the bottom of a scope list where the next deliverable is typed.
 *
 * Inline rather than a page of its own, because scope arrives in a run: four
 * things were agreed in the same conversation, and a form that costs a
 * navigation each way turns that into four round trips. The list stays
 * visible above it, which is the other half of the point — you write the next
 * line while looking at the ones before it.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's messages and what was typed,
 * and nothing else can put the cursor back on the field that failed.
 */
export function AddDeliverableForm({
  projectId,
  initialState,
}: {
  projectId: string;
  initialState: AddDeliverableState;
}) {
  // The id is fixed for as long as this page is mounted, so the binding is
  // just the action with its first argument already supplied.
  const add = addDeliverableAction.bind(null, projectId);
  const [state, formAction] = useActionState(add, initialState);

  useFirstErrorFocus(state, DELIVERABLE_FIELD_NAMES);

  /*
    Back to the first box once a line lands. Scope is typed in a run, and
    after a submit the cursor is on the button — so without this, adding the
    second deliverable means reaching for the mouse or tabbing backwards past
    three controls.

    Emptying the boxes is not done here: React resets a form with a function
    action once the action settles, which restores every uncontrolled control
    to the value it has just re-rendered — blank after an add, and what was
    typed after a rejection.
  */
  useEffect(() => {
    if (state.added === null) return;
    document.getElementById(fieldId("title"))?.focus();
  }, [state]);

  return (
    <form
      action={formAction}
      noValidate
      className="mt-4 flex flex-col gap-4"
    >
      <FormSummary state={state} />
      {/*
        The title and the estimate sit on one row because they are the line
        being written: a wide box for what was agreed, a narrow one for how
        big it is. The detail goes underneath, where it does not make the
        common case — a title and nothing else — look like a long form.
      */}
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <TextField
          name="title"
          label="Deliverable"
          error={state.errors.title}
          defaultValue={state.fields.title}
          maxLength={DELIVERABLE_FIELD_LIMITS.title}
          placeholder="Wireframes for the booking flow"
        />
        <TextField
          name="estimate"
          label="Estimate"
          hint="Hours, like 2 or 1.5."
          inputMode="decimal"
          error={state.errors.estimate}
          defaultValue={state.fields.estimate}
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
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Add deliverable</SubmitButton>
        {/*
          Rendered empty rather than conditionally, because a live region has
          to be in the document before the text arrives for a screen reader to
          notice it appearing. `status` rather than `alert`: a line was added
          as asked, which is worth saying and not worth interrupting for.

          The sentence is keyed on the deliverable that was written, so adding
          two lines with the same title replaces the node inside the region
          rather than rendering identical text. Unchanged text is no change at
          all, and the second add would go unannounced.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.added === null ? null : (
            <span key={state.added.id}>{addedNotice(state)}</span>
          )}
        </p>
      </div>
    </form>
  );
}
