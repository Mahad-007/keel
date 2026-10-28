/**
 * The two presses that end a running clock, and the sentences they come back
 * with.
 *
 * Stopping writes a stretch of work. Discarding writes nothing. They are both
 * one press on the same panel and they are not variations on each other, which
 * is why their results have nothing in common: one of them produces an entry
 * to say something about and the other produces an absence.
 *
 * Pure, like the rest of `lib/time/`. The writes are in
 * `lib/data/active-timers.ts` and the actions that call them are beside the
 * page.
 */

import { formatDate } from "@/lib/dates";
import { formatMinutes } from "@/lib/minutes";

import { MAX_ENTRY_MINUTES } from "./form";
import { timeWriteProblem, type TimeWriteResult } from "./remove";
import { MINIMUM_TIMER_MINUTES } from "./timer";

/**
 * What a stopped clock became, for the sentence said out loud afterwards.
 *
 * The id is here for the reason `LoggedTime` carries one: a live region needs
 * its text to change for a screen reader to notice it, and two half-hours
 * stopped against the same line on the same day would otherwise render the
 * same words twice.
 *
 * The rest is read off the entry as written rather than off the timer, so the
 * figure announced is the figure stored — and the day is the day the clock
 * started on, which is the one thing about a stopped timer a reader is likely
 * to be surprised by.
 */
export type StoppedTimer = {
  readonly id: string;
  readonly minutes: number;
  readonly workedOn: string;
  /** The line it went against, or null for work on the project itself. */
  readonly deliverableTitle: string | null;
  readonly billable: boolean;
};

/**
 * What stopping a clock hands back: the entry it became, or the one sentence
 * worth saying about why it is still running.
 *
 * Not a form state, because a press is not a form being filled in: there is no
 * field to put a message under and nothing the reader typed to render back.
 * The same shape as `TimeWriteResult` next door, with a payload, because this
 * press has something to report on success and a deletion does not.
 */
export type StopTimerResult =
  | { readonly ok: true; readonly stopped: StoppedTimer }
  | { readonly ok: false; readonly problem: string };

export function stopTimerProblem(problem: string): StopTimerResult {
  return { ok: false, problem };
}

/**
 * The sentences a refused Stop comes back with.
 *
 * Each says what to do next, because "something went wrong" leaves a reader
 * pressing the same button again — and this is the button that is holding
 * their afternoon.
 *
 * `tooShort` is the mis-press: Start, then the realisation it was the wrong
 * project, then Stop. It points at Discard rather than rounding the seconds up
 * to a minute, because a minute nobody worked is on the next invoice and the
 * reader did not ask for one.
 */
export const STOP_TIMER_PROBLEMS = {
  /** The clock has gone — stopped or discarded since the page was drawn. */
  missing:
    "That clock is not running any more, so nothing was logged. Reload to see what this project has.",
  /** Not a minute old yet, so there is nothing worth an entry. */
  tooShort: `A clock has to run for ${MINIMUM_TIMER_MINUTES} minute before there is anything to log. Leave it going, or discard it if it was started by mistake.`,
  /** The write itself failed — the driver, the disk, the network. */
  failed: "Could not stop the clock. Nothing was written — try again.",
} as const;

/** The ceiling in hours, for the sentence that has to name it. */
const MAX_ENTRY_HOURS = MAX_ENTRY_MINUTES / 60;

/**
 * What to say about a clock that has been running longer than a day.
 *
 * It names the figure, because the figure is the explanation: somebody who
 * left a timer going over a weekend is being told a number they will
 * recognise, and a refusal without it reads as the app having an opinion about
 * their hours.
 *
 * The way out is to discard it and log the work by hand, which is a real
 * instruction rather than a brush-off: an entry belongs to one calendar day,
 * and a stretch that spanned three of them has to be split across the days it
 * was worked. Nothing here can do that split — only the person who was there
 * knows which hours fell where.
 */
export function timerRunningTooLong(minutes: number): string {
  return `That clock has been running for ${formatMinutes(minutes)}, which is longer than the ${MAX_ENTRY_HOURS} hours one entry can hold — it would all be logged on a single day. Discard it and log the work against the days it was actually done.`;
}

/**
 * What to say when the press never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim either way, because from here there is no way to know: the
 * request may have been lost on the way out, or the answer lost on the way
 * back with the entry already written. Reloading is the only honest
 * instruction, and it matters more on this press than on most — "try again"
 * would be an invitation to log the same stretch twice, and a duplicated hour
 * is money that will be defended line by line.
 */
export const STOP_TIMER_NO_ANSWER =
  "Could not tell whether the clock was stopped — the answer never arrived. Reload to see what this project has logged before pressing Stop again.";

/**
 * What to say once a clock has been stopped.
 *
 * The panel with the clock in it is replaced by the Start form and a row
 * appears in the list below, neither of which a screen reader is told about.
 * This is the sentence that goes in a live region.
 *
 * Four things, in the order a reader would check them. The duration first,
 * because it is what was measured and the only figure nobody typed. The line
 * next, since it was chosen before the work rather than after it and is the
 * easiest thing to have left on the wrong one. The day because it is the day
 * the clock *started*, which is the one surprise a timer can hold — a stretch
 * begun before midnight is filed under the evening it began. And a
 * non-chargeable entry says so, for the same reason the log form's sentence
 * does.
 */
export function stoppedTimerAnnouncement(stopped: StoppedTimer): string {
  const against =
    stopped.deliverableTitle === null
      ? "the project itself"
      : `“${stopped.deliverableTitle}”`;
  const charge = stopped.billable ? "" : " Marked as not chargeable.";
  return `Logged ${formatMinutes(stopped.minutes)} against ${against} on ${formatDate(stopped.workedOn)}.${charge}`;
}

/**
 * The step in front of discarding a clock, and the labels around it.
 *
 * Discarding is the one press on this panel that cannot be undone and leaves
 * nothing behind: a stopped clock is a row in the time list, which can be
 * edited or deleted afterwards, and a discarded one is gone with the minutes
 * it held. So the press is asked for twice, and the step that asks is a
 * sentence and two buttons rather than a `window.confirm` — for the reasons
 * written out in `lib/deliverables/remove.ts`, and one more that is specific
 * to this panel: the sentence has to name how long the clock has been running,
 * and a browser dialogue cannot be told.
 */

/** The control in the panel that opens the step. */
export const DISCARD_TIMER_LABEL = "Discard";

/**
 * What the step says, which is the whole reason it is not `window.confirm`.
 *
 * It names the elapsed figure, because that is what is about to be thrown
 * away and the reader may not have looked at the clock since they started it.
 * And it offers the thing they probably meant: by far the most common reason
 * to discard is that the clock was started on the wrong project or left
 * running by mistake, and if the work was real then stopping it keeps the
 * record and the entry can be corrected afterwards.
 *
 * The offer is left out below a minute, because then there is nothing to keep
 * and Stop would refuse anyway — suggesting it would send a reader to a button
 * that will not work.
 */
export function describeTimerDiscard(minutes: number): string {
  if (minutes < MINIMUM_TIMER_MINUTES) {
    return "Discard this clock? It has not been running long enough to log anything, so nothing is lost.";
  }
  return `Discard this clock? The ${formatMinutes(minutes)} it has counted is not logged anywhere and cannot be recovered. If the work was real, stop the clock instead — the entry can be corrected afterwards.`;
}

/** The confirming control, named so it cannot be mistaken for the opener. */
export const CONFIRM_DISCARD_TIMER_LABEL =
  "Discard this clock without logging the time";

/** The way out, named as what it does rather than as "cancel". */
export const KEEP_TIMER_LABEL = "Keep the clock running";

/** The ids the step and the button that opens it are known by. */
export const TIMER_DISCARD_PROMPT_ID = "timer-discard-prompt";

/** The button inside the step, which the cursor moves to when it opens. */
export const CONFIRM_DISCARD_TIMER_ID = "timer-discard-confirm";

/** The button in the panel that opens the step, and takes the cursor back. */
export const DISCARD_TIMER_BUTTON_ID = "timer-discard";

/**
 * The button that starts a clock, which is what the panel is replaced by.
 *
 * Named here rather than in `start.ts` because the presses that need it are
 * the ones in this module: stopping and discarding both take the panel away,
 * and the cursor has to land somewhere that is in the document afterwards.
 */
export const START_TIMER_BUTTON_ID = "timer-start";

/**
 * What discarding hands back: nothing to say, or the one sentence worth saying
 * about why the clock is still running.
 *
 * `TimeWriteResult` rather than a type of its own, which is the deletion
 * press's result from next door. It is the right shape for the same reason: a
 * press with nothing to report on success, because what it produced is an
 * absence, and the panel on screen has already shown it. The sentence a reader
 * hears is built in the browser from the figure it was already displaying.
 */
export type DiscardTimerResult = TimeWriteResult;

/**
 * The sentences a refused discard comes back with.
 *
 * Two, because there are only two ways it can fail: the clock has gone since
 * the page was drawn, or the write did not land. There is no equivalent of the
 * stop refusals — no elapsed figure is too short or too long to throw away.
 */
export const DISCARD_TIMER_PROBLEMS = {
  missing:
    "That clock is not running any more, so there was nothing to discard. Reload to see what this project has.",
  failed: "Could not discard the clock. Nothing was written — try again.",
} as const;

/**
 * What to say once a clock has been discarded.
 *
 * It says the minutes went, naming them, because a reader who confirmed this
 * by keyboard has had the step vanish and the Start form appear in its place
 * with nothing announced. Naming the figure is also the honest end of the
 * exchange: the step warned that this much time would be lost, and this
 * confirms that is what happened.
 */
export function discardedTimerAnnouncement(minutes: number): string {
  if (minutes < MINIMUM_TIMER_MINUTES) {
    return "Discarded the clock. Nothing was logged.";
  }
  return `Discarded the clock. The ${formatMinutes(minutes)} it had counted was not logged.`;
}

/**
 * What to say when a discard never got an answer.
 *
 * It does not claim either way, like every other no-answer sentence here. The
 * instruction is to reload rather than to press again, because a second press
 * on a clock that is already gone reports the missing refusal — which reads as
 * a failure when in fact the first press worked.
 */
export const DISCARD_TIMER_NO_ANSWER =
  "Could not tell whether the clock was discarded — the answer never arrived. Reload to see whether it is still running.";

/** A refused discard, in the shape the panel reads. */
export function discardTimerProblem(problem: string): DiscardTimerResult {
  return timeWriteProblem(problem);
}
