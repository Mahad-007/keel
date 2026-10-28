"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  AlertNote,
  FormSummary,
  SubmitButton,
  useFirstErrorFocus,
} from "@/components/form";
import { localCalendarDate } from "@/lib/dates";
import type { DeliverableOption } from "@/lib/time/attribution";
import type { NamedDeliverable } from "@/lib/time/entry";
import {
  failedStartTimerState,
  INITIAL_START_TIMER_STATE,
  readStartTimerFields,
  START_TIMER_FIELD_NAMES,
  START_TIMER_NO_ANSWER,
  STARTED_ON_FIELD,
  startedTimerNotice,
  type StartTimerState,
} from "@/lib/time/start";
import {
  DISCARD_TIMER_BUTTON_ID,
  DISCARD_TIMER_LABEL,
  DISCARD_TIMER_NO_ANSWER,
  discardedTimerAnnouncement,
  START_TIMER_BUTTON_ID,
  STOP_TIMER_NO_ANSWER,
  stoppedTimerAnnouncement,
  type DiscardTimerResult,
  type StopTimerResult,
} from "@/lib/time/stop";
import type { RunningTimer } from "@/lib/time/timer";

import { DiscardTimerPrompt } from "./discard-timer-prompt";
import { RunningTimerPanel } from "./running-timer";
import { StartTimerFields, START_TIMER_SCOPE } from "./start-timer-fields";
import { useElapsedMinutes } from "./use-elapsed-minutes";

/**
 * The clock on this tab, in both the states it can be in from here: not
 * running, or running on this project.
 *
 * One component rather than two, and that is the decision worth defending.
 * The two replace each other in the same place on the page, and a press moves
 * between them — Start turns the form into the panel, Stop turns the panel
 * back into the form. Mounted separately, each press would unmount the thing
 * holding the answer to it, and the sentence saying what happened would be set
 * on a component that no longer exists. Kept together, the live region
 * outlives both.
 *
 * It is also the only place that can hold the elapsed figure. The panel shows
 * it, the discard step names it, and the sentence after a discard says what
 * was lost — three readings of one number, which has to be counted once.
 */

/**
 * One thing said out loud, with the key that makes a screen reader notice it.
 *
 * A live region only announces text that *changes*, so two identical sentences
 * in a row — two clocks started against the same line, two discards of a
 * minute apiece — would be announced once. The key replaces the node inside
 * the region rather than rewriting it.
 */
type Announcement = {
  readonly key: string;
  readonly text: string;
};

/** Which press is in flight, for the labels and for refusing a second one. */
type Acting = "stop" | "discard" | null;

export function TimerControls({
  running,
  initialMinutes,
  options,
  deliverables,
  start,
  stop,
  discard,
}: {
  /** The clock running on this project, or null if none is. */
  running: RunningTimer | null;
  /** The elapsed figure the server computed, for the first render. */
  initialMinutes: number;
  /** The deliverables this project has, for the attribution picker. */
  options: readonly DeliverableOption[];
  /** The same list, for naming what a running clock is attributed to. */
  deliverables: readonly NamedDeliverable[];
  /**
   * The three writes, with the project and its scope list already captured by
   * the page that served this. Captured there rather than bound here: a
   * `.bind` in a client component only prepends the arguments to the POST
   * body, which would let a caller choose both the project a clock runs
   * against and the list its own submission is checked against.
   */
  start: (
    previous: StartTimerState,
    formData: FormData,
  ) => Promise<StartTimerState>;
  stop: (id: string) => Promise<StopTimerResult>;
  discard: (id: string) => Promise<DiscardTimerResult>;
}) {
  /*
    The write has to come back with a state even when the call itself fails.

    `useActionState` has no answer for a rejected action: the rejection escapes
    the dispatch and takes the page to an error boundary, which here would lose
    the note that had just been typed. A dropped connection, a tab suspended
    mid-request and an aborted request all reject, and the project is captured
    by an encrypted closure, so a page left open across a deploy that rotated
    the key rejects too.

    The day is put on the submission here rather than into a hidden field,
    because here is the only place certain to be right: a field filled in when
    the page mounted would still hold yesterday for a page left open across
    midnight, and the day this press means is the day it is now. It is the
    browser's clock either way — the one that belongs to the person pressing.
  */
  async function attempt(
    previous: StartTimerState,
    formData: FormData,
  ): Promise<StartTimerState> {
    formData.set(STARTED_ON_FIELD, localCalendarDate(new Date()));
    try {
      return await start(previous, formData);
    } catch (error) {
      // Nothing a reader can act on beyond reloading, but worth a line in the
      // console for whoever is looking into why clocks are not starting.
      console.error("start timer: the server never answered", error);
      return failedStartTimerState(
        readStartTimerFields(formData),
        START_TIMER_NO_ANSWER,
      );
    }
  }

  const [state, formAction] = useActionState(
    attempt,
    INITIAL_START_TIMER_STATE,
  );
  const [said, setSaid] = useState<Announcement | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [acting, setActing] = useState<Acting>(null);

  /*
    The scope matters here and is easy to leave off. Both forms on this tab ask
    for `deliverable`, `note` and `billable`, so without it the cursor after a
    refused Start would land in the log line at the bottom of the page, under a
    message about a form an inch from the top.
  */
  useFirstErrorFocus(state, START_TIMER_FIELD_NAMES, START_TIMER_SCOPE);

  /*
    Where the cursor goes once the panel has been replaced by the form.

    A press that stops or discards takes the button the reader was using with
    it, and the browser answers that by dropping focus to the document — so
    the next Tab starts at the top of the page rather than at the clock they
    were just working with. It cannot be done in the handler: the control to
    move to is the one rendered *instead*, and it is not in the document until
    React has caught up. So the handler leaves a note here and the effect acts
    on it.
  */
  const moveFocus = useRef(false);
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    document.getElementById(START_TIMER_BUTTON_ID)?.focus();
  });

  const minutes = useElapsedMinutes(running?.startedAt ?? null, initialMinutes);

  /*
    A clock that started gets its sentence from the form's own state, because
    that is where the answer arrives. It is routed into the one announcement
    the presses also use, so the region has a single source: otherwise a stop's
    sentence and a start's would both be live at once, and whichever rendered
    last would win silently.
  */
  useEffect(() => {
    if (state.started === null) return;
    const notice = startedTimerNotice(state);
    if (notice === null) return;
    setSaid({ key: state.started.id, text: notice });
    setProblem(null);
  }, [state]);

  async function pressStop() {
    if (running === null || acting !== null) return;
    /*
      A new press clears the last complaint first of all. Leaving it up would
      leave a red box above a panel that has since done what it was told, and
      the reader would read it as being about the press they just made.
    */
    setProblem(null);
    setActing("stop");
    try {
      const result = await stop(running.id);
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      moveFocus.current = true;
      setSaid({
        key: result.stopped.id,
        text: stoppedTimerAnnouncement(result.stopped),
      });
    } catch (error) {
      console.error("stop timer: the server never answered", error);
      setProblem(STOP_TIMER_NO_ANSWER);
    } finally {
      setActing(null);
    }
  }

  async function pressDiscard() {
    if (running === null || acting !== null) return;
    setProblem(null);
    setActing("discard");
    /*
      The figure is read before the write, because the row is about to go and
      the sentence afterwards has to say how much was thrown away. Reading it
      after would be reading a clock that has stopped ticking.
    */
    const lost = minutes;
    try {
      const result = await discard(running.id);
      if (!result.ok) {
        setProblem(result.problem);
        return;
      }
      setConfirming(false);
      moveFocus.current = true;
      setSaid({
        key: `discarded-${running.id}`,
        text: discardedTimerAnnouncement(lost),
      });
    } catch (error) {
      console.error("discard timer: the server never answered", error);
      setProblem(DISCARD_TIMER_NO_ANSWER);
    } finally {
      setActing(null);
    }
  }

  return (
    <div>
      {problem === null ? null : (
        <AlertNote className="mt-4">{problem}</AlertNote>
      )}
      {running === null ? (
        <form
          action={formAction}
          noValidate
          className="mt-4 flex flex-col gap-4"
        >
          <FormSummary state={state} />
          <StartTimerFields state={state} options={options} />
          <div>
            <SubmitButton id={START_TIMER_BUTTON_ID} pendingLabel="Starting…">
              Start a clock
            </SubmitButton>
          </div>
        </form>
      ) : (
        <>
          <RunningTimerPanel
            timer={running}
            minutes={minutes}
            deliverables={deliverables}
          >
            <button
              type="button"
              onClick={pressStop}
              disabled={acting !== null}
              className="rounded bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              {acting === "stop" ? "Stopping…" : "Stop and log it"}
            </button>
            {/*
              The step is opened rather than the clock being discarded
              outright. It is the one press on this panel that cannot be
              undone, and the sentence it opens names the figure that would go
              with it.
            */}
            <button
              type="button"
              id={DISCARD_TIMER_BUTTON_ID}
              onClick={() => setConfirming(true)}
              disabled={acting !== null || confirming}
              className="text-sm text-zinc-600 underline underline-offset-4 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {DISCARD_TIMER_LABEL}
            </button>
          </RunningTimerPanel>
          {confirming ? (
            <DiscardTimerPrompt
              minutes={minutes}
              onDiscard={pressDiscard}
              onKeep={() => {
                setConfirming(false);
                document.getElementById(DISCARD_TIMER_BUTTON_ID)?.focus();
              }}
              pending={acting !== null}
            />
          ) : null}
        </>
      )}
      {/*
        Rendered empty rather than conditionally, because a live region has to
        be in the document before the text arrives for a screen reader to
        notice it appearing. `status` rather than `alert`: everything it says
        is the answer to a press that worked.
      */}
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-sm text-zinc-600 dark:text-zinc-400"
      >
        {said === null ? null : <span key={said.key}>{said.text}</span>}
      </p>
    </div>
  );
}
