"use client";

import { useActionState } from "react";

import {
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import {
  failedSnapshotState,
  readSnapshotFields,
  SNAPSHOT_FIELD_NAMES,
  SNAPSHOT_FIELD_SCOPE,
  SNAPSHOT_NO_ANSWER,
  takenSnapshotNotice,
  type TakeSnapshotState,
} from "@/lib/snapshots/form";

import { SnapshotFields } from "./snapshot-fields";

/**
 * The form that records this project's scope as it stands.
 *
 * It takes no lines and offers no choices: what gets recorded is the list
 * directly above it, at the moment of the press. That is the whole reason this
 * form is on the scope tab rather than anywhere else — the thing being
 * recorded is the thing the reader is looking at.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's message and what was typed,
 * and nothing else can put the cursor back on the field that failed.
 */
export function TakeSnapshotForm({
  take,
  initialState,
}: {
  /**
   * The write, with the project already captured by the page that served this
   * form. Captured there rather than bound here: `.bind` in a client component
   * only prepends the argument to the POST body, where it is exactly as
   * forgeable as a hidden input naming the project would have been.
   */
  take: (
    previous: TakeSnapshotState,
    formData: FormData,
  ) => Promise<TakeSnapshotState>;
  initialState: TakeSnapshotState;
}) {
  /*
    The press has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would
    throw away the label that had just been typed. A dropped connection, a tab
    suspended mid-request and an aborted request all reject, and the project is
    captured by an encrypted closure, so a page left open across a deploy that
    rotated the key rejects too.
  */
  async function attempt(
    previous: TakeSnapshotState,
    formData: FormData,
  ): Promise<TakeSnapshotState> {
    try {
      return await take(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why presses are failing.
      console.error("take snapshot: the server never answered", error);
      return failedSnapshotState(
        readSnapshotFields(formData),
        SNAPSHOT_NO_ANSWER,
      );
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  /*
    Scoped, because `SnapshotFields` renders its ids under the same scope. The
    cursor would otherwise land in whichever box on this tab happens to be
    named `label`, under a message belonging to a different form.
  */
  useFirstErrorFocus(state, SNAPSHOT_FIELD_NAMES, SNAPSHOT_FIELD_SCOPE);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <SnapshotFields state={state} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Recording…">Take a snapshot</SubmitButton>
        {/*
          Rendered empty rather than conditionally, because a live region has
          to be in the document before the text arrives for a screen reader to
          notice it appearing. `status` rather than `alert`: a snapshot was
          recorded as asked, which is worth saying and not worth interrupting
          for.

          Keyed on the snapshot that was written, so two presses on an
          unchanged scope list replace the node rather than rendering identical
          text — unchanged text is no change at all, and the second press would
          go unannounced.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.taken === null ? null : (
            <span key={state.taken.id}>{takenSnapshotNotice(state)}</span>
          )}
        </p>
      </div>
    </form>
  );
}
