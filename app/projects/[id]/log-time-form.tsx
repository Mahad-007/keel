"use client";

import { useActionState, useEffect } from "react";

import {
  fieldId,
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import type { DeliverableOption } from "@/lib/time/attribution";
import {
  failedLogTimeState,
  LOG_TIME_FIELD_NAMES,
  LOG_TIME_NO_ANSWER,
  loggedTimeNotice,
  readLogTimeFields,
  type LogTimeState,
} from "@/lib/time/form";

import { LogTimeFields } from "./time-fields";

/**
 * The form a stretch of work is logged with.
 *
 * It stays on the page and does not navigate, because logging time is not one
 * act: somebody writing up a Tuesday evening has three or four entries to
 * file, and a redirect after each would reload the page, throw the cursor
 * away, and make them find this form again every time.
 *
 * A client component for the same reason every other form here is one.
 * `useActionState` keeps a rejected submission's messages and what was typed,
 * and nothing else can put the cursor back on the field that failed.
 */
export function LogTimeForm({
  log,
  initialState,
  options,
}: {
  /**
   * The write, with the project and its scope list already captured by the
   * page that served this form. Captured there rather than bound here: a
   * `.bind` in a client component only prepends the arguments to the POST
   * body, which would let a caller choose both the project an hour is billed
   * to and the list its own submission is checked against.
   */
  log: (previous: LogTimeState, formData: FormData) => Promise<LogTimeState>;
  initialState: LogTimeState;
  /** The deliverables on offer, already labelled with their estimates. */
  options: readonly DeliverableOption[];
}) {
  /*
    The write has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would
    throw away the duration, the note and the day that had just been typed —
    the one thing this form exists to hold on to. A dropped connection, a tab
    suspended mid-request and an aborted request all reject, and the project is
    captured by an encrypted closure, so a page left open across a deploy that
    rotated the key rejects too.

    The fields come from the submission rather than the previous state, so what
    comes back is what was in the boxes when the press was made.
  */
  async function attempt(
    previous: LogTimeState,
    formData: FormData,
  ): Promise<LogTimeState> {
    try {
      return await log(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why entries are failing.
      console.error("log time: the server never answered", error);
      return failedLogTimeState(
        readLogTimeFields(formData),
        LOG_TIME_NO_ANSWER,
      );
    }
  }

  const [state, formAction] = useActionState(attempt, initialState);

  useFirstErrorFocus(state, LOG_TIME_FIELD_NAMES);

  /*
    Back to the duration box once an entry lands. Time is written up in a run,
    and after a submit the cursor is on the button — so without this, logging
    the second stretch of the evening means reaching for the mouse or tabbing
    backwards past four controls.

    Emptying the boxes is not done here: React resets a form with a function
    action once the action settles, which restores every uncontrolled control
    to the value it has just re-rendered — blank after an entry lands, the day
    it kept, and what was typed after a rejection.
  */
  useEffect(() => {
    if (state.logged === null) return;
    document.getElementById(fieldId("duration"))?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="mt-4 flex flex-col gap-4">
      <FormSummary state={state} />
      <LogTimeFields state={state} options={options} />
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Logging…">Log time</SubmitButton>
        {/*
          Rendered empty rather than conditionally, because a live region has
          to be in the document before the text arrives for a screen reader to
          notice it appearing. `status` rather than `alert`: an entry was
          logged as asked, which is worth saying and not worth interrupting
          for.

          Keyed on the entry that was written, so two identical half-hours
          against the same line replace the node inside the region rather than
          rendering identical text. Unchanged text is no change at all, and
          the second entry would go unannounced.
        */}
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          {state.logged === null ? null : (
            <span key={state.logged.id}>{loggedTimeNotice(state)}</span>
          )}
        </p>
      </div>
    </form>
  );
}
