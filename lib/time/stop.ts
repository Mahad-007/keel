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
