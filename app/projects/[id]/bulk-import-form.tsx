"use client";

import { useActionState } from "react";

import {
  FormSummary,
  SubmitButton,
  TextAreaField,
  useFirstErrorFocus,
} from "@/components/form";
import {
  canImport,
  MAX_IMPORT_CHARS,
  MAX_IMPORT_LINES,
} from "@/lib/deliverables/import";
import {
  IMPORT_FIELD_NAMES,
  IMPORT_INTENT,
  IMPORT_NO_ANSWER,
  INTENT_FIELD_NAME,
  readImportFields,
  refusedImportState,
  STAMP_FIELD_NAME,
  type ImportScopeState,
} from "@/lib/deliverables/import-form";

import { ImportPreviewTable } from "./import-preview";

/**
 * What the box always says, because it is the question a reader has before
 * pasting: what counts as a line, and where the estimate goes.
 *
 * The example is worth the words. "A bar separates the title from the
 * estimate" is a rule to apply; `Wireframes | 6` is a line to copy, and the
 * reader can see from it that the estimate is in hours without being told.
 */
const PASTE_HINT = `One deliverable per line. To size a line, put the hours after a vertical bar — “Wireframes | 6” — or paste two columns straight out of a spreadsheet. A line with no estimate is added unestimated. Up to ${MAX_IMPORT_LINES} lines at a time.`;

/**
 * The box a scope list is pasted into, and the two presses it takes to import
 * it.
 *
 * Preview reads the paste and writes nothing; Import writes exactly what the
 * preview showed. Two presses rather than one because a paste is a dozen rows
 * at once and a misread separator is invisible until they exist — and once
 * they exist, undoing them is a dozen deletes. The second button only appears
 * under a preview, so the order cannot be got wrong from the page.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` is what holds the preview between the two presses, along
 * with what was pasted and any sentence about why nothing landed.
 */
export function BulkImportForm({
  importScope,
  initialState,
}: {
  /**
   * The write, with the project already captured by the page that served this
   * form. Captured there rather than bound here: a `.bind` in a client
   * component only prepends the argument to the POST body, where it is exactly
   * as forgeable as a hidden input naming the project would have been.
   */
  importScope: (
    previous: ImportScopeState,
    formData: FormData,
  ) => Promise<ImportScopeState>;
  initialState: ImportScopeState;
}) {
  /*
    The press has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would
    throw away the paste — the one thing this form exists to hold on to, and
    the one thing that is not recoverable from anywhere else once the clipboard
    has moved on. A dropped connection, a tab suspended mid-request and an
    aborted request all reject, and the project is captured by an encrypted
    closure, so a page left open across a deploy that rotated the key rejects
    too.

    The fields come from the submission rather than the previous state, so what
    comes back is what was in the box when the press was made. The preview from
    last time comes back with it: it may be stale, but it describes the text
    that is still in the box, and the sentence above it says nothing landed.
  */
  async function attempt(
    previous: ImportScopeState,
    formData: FormData,
  ): Promise<ImportScopeState> {
    try {
      return await importScope(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why imports are failing.
      console.error("import scope: the server never answered", error);
      return refusedImportState(
        readImportFields(formData),
        previous.previewed,
        IMPORT_NO_ANSWER,
      );
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  useFirstErrorFocus(state, IMPORT_FIELD_NAMES);

  const previewed = state.previewed;

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <TextAreaField
        name="lines"
        label="Pasted scope list"
        hint={PASTE_HINT}
        rows={8}
        maxLength={MAX_IMPORT_CHARS}
        defaultValue={state.fields.lines}
        error={state.errors.lines}
      />
      {previewed === null ? null : (
        <>
          {/*
            The stamp of the text the table below describes. It goes back with
            the next press so the server can tell whether the box has moved
            since — committing a paste nobody looked at is the one thing a
            preview step exists to prevent.
          */}
          <input
            type="hidden"
            name={STAMP_FIELD_NAME}
            value={previewed.stamp}
          />
          <ImportPreviewTable preview={previewed.preview} />
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingLabel="Reading…"
          variant={previewed === null ? "primary" : "secondary"}
          name={INTENT_FIELD_NAME}
          value="preview"
        >
          {previewed === null ? "Preview" : "Preview again"}
        </SubmitButton>
        {/*
          The commit button only exists once there is something to commit, and
          only when that something can be committed: a paste with an unreadable
          line in it is imported whole or not at all, and a button that would
          always refuse is a button that teaches the reader to distrust it. The
          sentence above the table says what to fix.

          The server checks the same things again regardless. A form is a POST
          endpoint, and a button that is not rendered is not a button that
          cannot be posted.
        */}
        {previewed !== null && canImport(previewed.preview) ? (
          <SubmitButton
            pendingLabel="Importing…"
            name={INTENT_FIELD_NAME}
            value={IMPORT_INTENT}
          >
            Import these deliverables
          </SubmitButton>
        ) : null}
      </div>
    </form>
  );
}
