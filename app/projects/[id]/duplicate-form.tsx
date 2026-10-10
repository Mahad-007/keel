"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState } from "react";

import {
  FormSummary,
  SubmitButton,
  TextField,
  useFirstErrorFocus,
} from "@/components/form";
import {
  DUPLICATE_FIELD_NAMES,
  DUPLICATE_FIELD_SCOPE,
  DUPLICATE_NO_ANSWER,
  readDuplicateFields,
  type DuplicateFormState,
} from "@/lib/projects/duplicate-form";
import { PROJECT_FIELD_LIMITS } from "@/lib/projects/form";
import { failedFormState } from "@/lib/forms/state";

/**
 * One box and a button: what to call the copy, and the press that makes it.
 *
 * The box is prefilled, so the common case is a press. It is still a box
 * rather than a button on its own, because the one thing a copy cannot
 * inherit is a name worth finding it by — and the moment to type it is while
 * looking at the project it came from, not later in a list of two things
 * called nearly the same.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's message and what was typed,
 * and nothing else can put the cursor back on the field that failed.
 */
export function DuplicateForm({
  duplicate,
  initialState,
}: {
  /**
   * The write, with the project already captured by the page that served this
   * form. Captured there rather than bound here: `.bind` in a client component
   * only prepends the argument to the POST body, where it is exactly as
   * forgeable as a hidden input naming the project would have been.
   */
  duplicate: (
    previous: DuplicateFormState,
    formData: FormData,
  ) => Promise<DuplicateFormState>;
  initialState: DuplicateFormState;
}) {
  /*
    The copy has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would lose
    the name that was typed and — worse — leave the reader unable to tell
    whether a project was created. A dropped connection, a tab suspended
    mid-request and an aborted request all reject, and the project is captured
    by an encrypted closure, so a page left open across a deploy that rotated
    the key rejects too.

    A successful copy rejects as well, which is the trap here: `redirect`
    signals by throwing, and the dispatch hands that rejection on. Catching it
    as a failure would tell somebody their copy may not have been made while
    the browser was on its way to it. `unstable_rethrow` puts every one of
    Next's own control-flow errors back, so only a genuine failure to get an
    answer reaches the sentence below.
  */
  async function attempt(
    previous: DuplicateFormState,
    formData: FormData,
  ): Promise<DuplicateFormState> {
    try {
      return await duplicate(previous, formData);
    } catch (error) {
      unstable_rethrow(error);
      // Nothing a reader can act on beyond checking the list, but worth a line
      // in the console for whoever is looking into why copies are failing.
      console.error("duplicate project: the server never answered", error);
      return failedFormState(readDuplicateFields(formData), DUPLICATE_NO_ANSWER);
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  /*
    Scoped, because the field renders its ids under the same scope. Without it
    the cursor would land on whichever control called `name` the document holds
    first, which on a page with two forms is a coin toss.
  */
  useFirstErrorFocus(state, DUPLICATE_FIELD_NAMES, DUPLICATE_FIELD_SCOPE);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <TextField
        name="name"
        label="Name for the copy"
        hint="Prefilled with this project's name and “(copy)”. Change it to whatever the new engagement is called — two projects with the same name are read twice in every list."
        error={state.errors.name}
        defaultValue={state.fields.name}
        maxLength={PROJECT_FIELD_LIMITS.name}
        scope={DUPLICATE_FIELD_SCOPE}
      />
      <div>
        {/*
          Secondary, for the reason the close button is: it is not what this
          page is for. A reader on the overview tab is reading the project, and
          the control that creates a second one should have to be meant.

          No live region beside it, unlike the template forms. A successful copy
          redirects to the project it made, so there is nothing to announce in
          place — the new page is the announcement.
        */}
        <SubmitButton variant="secondary" pendingLabel="Copying…">
          Duplicate project
        </SubmitButton>
      </div>
    </form>
  );
}
