"use client";

import { useActionState } from "react";

import {
  FormSummary,
  SelectField,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import {
  APPLY_FIELD_NAMES,
  APPLY_NO_ANSWER,
  appliedTemplateNotice,
  failedApplyState,
  readApplyFields,
  type ApplyTemplateState,
} from "@/lib/templates/apply-form";
import type { TemplateOption } from "@/lib/templates/options";

/**
 * What the picker always says, because it is the question a reader has before
 * pressing: where do the lines go, and what happens to the ones already there.
 *
 * "to the end" is the load-bearing phrase. A reader who suspects a template
 * might replace the list will not press the button on a project that already
 * has scope on it, which is exactly the project templates are most useful on.
 */
const APPLY_HINT =
  "Its deliverables are added to the end of this project's scope list, each one pending and estimated as the template has it. Nothing already on the list is changed, and you can edit the new lines afterwards.";

/**
 * The picker that adds a saved template's lines to this project.
 *
 * One control and one button. The alternative — a dialog listing the lines
 * with tick boxes — would be a worse version of the scope list that is already
 * on this page: the lines land as ordinary deliverables, so anything the reader
 * wanted to change about them is one click away in the list above.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` holds what the picker was set to and the sentence that
 * followed the press.
 */
export function ApplyTemplateForm({
  apply,
  initialState,
  options,
}: {
  /**
   * The write, with the project and the offered template ids already captured
   * by the page. Captured there rather than bound here: a `.bind` in a client
   * component only prepends the arguments to the POST body, which would let a
   * caller choose both the project and the list its own submission is checked
   * against.
   */
  apply: (
    previous: ApplyTemplateState,
    formData: FormData,
  ) => Promise<ApplyTemplateState>;
  initialState: ApplyTemplateState;
  /** The templates on offer, already labelled with their size. */
  options: readonly TemplateOption[];
}) {
  /*
    The apply has to come back with a state even when the call itself fails, for
    the same reason the other forms on this page do: an unhandled rejection
    escapes the dispatch and takes the page to an error boundary, which here
    would replace the scope list with an error — and leave the reader unable to
    see whether the lines landed, which is the one thing they need to know.
  */
  async function attempt(
    previous: ApplyTemplateState,
    formData: FormData,
  ): Promise<ApplyTemplateState> {
    try {
      return await apply(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why applies are failing.
      console.error("apply template: the server never answered", error);
      return failedApplyState(readApplyFields(formData), APPLY_NO_ANSWER);
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  useFirstErrorFocus(state, APPLY_FIELD_NAMES);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <SelectField
        name="template"
        label="Template"
        hint={APPLY_HINT}
        placeholder="Choose a template"
        options={options.map((option) => ({
          value: option.id,
          label: option.label,
        }))}
        defaultValue={state.fields.template}
        error={state.errors.template}
      />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Adding…">Apply template</SubmitButton>
        {/*
          Empty rather than conditional, so the live region is in the document
          before the sentence arrives.

          Keyed on the first deliverable the press wrote, not on the template:
          applying the same template twice says the same sentence, and an
          identical keyed node holding identical text is no change to the DOM,
          so the second apply would be announced to nobody. Every apply writes
          at least one row — an empty template is refused — so there is always
          an id here.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.applied === null ? null : (
            <span key={state.applied.deliverableIds[0]}>
              {appliedTemplateNotice(state)}
            </span>
          )}
        </p>
      </div>
    </form>
  );
}
