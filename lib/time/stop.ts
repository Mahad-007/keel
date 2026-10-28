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
