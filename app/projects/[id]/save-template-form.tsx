"use client";

import { useActionState } from "react";

import {
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import {
  failedSaveState,
  readTemplateFields,
  SAVE_NO_ANSWER,
  savedTemplateNotice,
  TEMPLATE_FIELD_NAMES,
  TEMPLATE_FIELD_SCOPE,
  type SaveTemplateState,
} from "@/lib/templates/form";

import { TemplateFields } from "./template-fields";

/**
 * The form that files this project's scope list away for reuse.
 *
 * It takes no lines, no checkboxes, and no preview: what gets saved is the
 * list directly above it, as it stands. That is the whole reason this form is
 * on the scope tab rather than on a templates page — the thing being saved is
 * the thing the reader is looking at, and a template editor somewhere else
 * would be a second place to maintain the same list.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's messages and what was typed,
 * and nothing else can put the cursor back on the field that failed.
 */
export function SaveTemplateForm({
  save,
  initialState,
}: {
  /**
   * The write, with the project already captured by the page that served this
   * form. Captured there rather than bound here: `.bind` in a client component
   * only prepends the argument to the POST body, where it is exactly as
   * forgeable as a hidden input naming the project would have been.
   */
  save: (
    previous: SaveTemplateState,
    formData: FormData,
  ) => Promise<SaveTemplateState>;
  initialState: SaveTemplateState;
}) {
  /*
    The save has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would throw
    away the name and the sentence that had just been typed. A dropped
    connection, a tab suspended mid-request and an aborted request all reject,
    and the project is captured by an encrypted closure, so a page left open
    across a deploy that rotated the key rejects too.
  */
  async function attempt(
    previous: SaveTemplateState,
    formData: FormData,
  ): Promise<SaveTemplateState> {
    try {
      return await save(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why saves are failing.
      console.error("save template: the server never answered", error);
      return failedSaveState(readTemplateFields(formData), SAVE_NO_ANSWER);
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  /*
    Scoped, because `TemplateFields` renders its ids under the same scope. The
    cursor would otherwise stay on the button for a bad name, and for a bad
    description it would land in the add-deliverable textarea at the bottom of
    the page — under a message belonging to a different form.
  */
  useFirstErrorFocus(state, TEMPLATE_FIELD_NAMES, TEMPLATE_FIELD_SCOPE);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <TemplateFields state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save as template</SubmitButton>
        {/*
          Rendered empty rather than conditionally, because a live region has
          to be in the document before the text arrives for a screen reader to
          notice it appearing. `status` rather than `alert`: a template was
          saved as asked, which is worth saying and not worth interrupting for.

          Keyed on the template that was written, so saving two templates with
          the same name replaces the node rather than rendering identical text —
          unchanged text is no change at all, and the second save would go
          unannounced.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.saved === null ? null : (
            <span key={state.saved.id}>{savedTemplateNotice(state)}</span>
          )}
        </p>
      </div>
    </form>
  );
}
