/**
 * The running clock: what it is, how long it has been going, and what it
 * becomes when it stops.
 *
 * Pure, like every other module in `lib/time/`. The row lives in
 * `active_timers` and the writes live in `lib/data/active-timers.ts`; the
 * arithmetic that turns an instant and a clock reading into whole minutes is
 * here, where it can be tested against a fixed `now` instead of against
 * whatever the machine running the tests thinks the time is.
 */

/**
 * The value the `slot` column always holds, and the reason the table can hold
 * at most one row: a unique index on a column with one possible value.
 *
 * It is a word rather than a number because a column of `1`s invites being
 * read as a count, and it is here rather than in the schema because the schema
 * imports its constants from `lib/` everywhere else. Phase 8 replaces the
 * default with the owner's id, at which point the index means "one timer per
 * user" and this constant goes away.
 */
export const RUNNING_TIMER_SLOT = "only";

/**
 * What a running timer is, as everything outside the data layer sees it.
 *
 * A structural type rather than the schema's `ActiveTimer`, for the reason
 * `ListedTimeEntry` is one: these functions are arithmetic and sentences, and
 * a module that imported the table would make every test of them need a
 * database. `slot` is not here, because it is a constraint rather than a fact
 * about the work — nothing a reader is shown depends on it.
 */
export type RunningTimer = {
  readonly id: string;
  readonly projectId: string;
  /** The line of scope the work is going against, or null for the project. */
  readonly deliverableId: string | null;
  /** What is being done, in a person's words, or null when they did not say. */
  readonly note: string | null;
  readonly billable: boolean;
  /** The instant the clock started, as a full ISO timestamp. */
  readonly startedAt: string;
  /** The calendar date the entry will be filed under: `YYYY-MM-DD`. */
  readonly startedOn: string;
};

/** One minute, in the units `Date.getTime` counts. */
const MS_PER_MINUTE = 60_000;

/**
 * How many whole minutes a timer has been running, given the clock.
 *
 * Floored, not rounded, and that is the decision in this function. A clock
 * that reads a minute at thirty-one seconds would let ten short timers in a
 * day bill ten minutes that nobody worked, and the figure this produces goes
 * on an invoice. Flooring gives up at most fifty-nine seconds per timer and
 * can never charge for a second that did not pass.
 *
 * Whole minutes because that is the repo's unit of time: the entry this
 * becomes is stored in minutes, so a clock that counted anything finer would
 * only be rounding later, somewhere less visible.
 *
 * Zero for a start in the future, rather than a negative. The usual cause is a
 * machine whose clock has been corrected since the timer started, and the
 * honest reading of "the clock says this has not begun yet" is that no time
 * has passed — a negative would propagate into an entry the column refuses and
 * a sentence saying the work took minus four minutes.
 *
 * Zero, too, for a `startedAt` that is not a timestamp. Nothing this app
 * writes produces one, so it means a hand-edited row; the alternative is `NaN`
 * travelling into every figure on the page, and a timer that reads nothing is
 * a timer somebody can see is wrong.
 */
export function elapsedMinutes(startedAt: string, now: Date): number {
  const started = new Date(startedAt).getTime();
  if (Number.isNaN(started)) return 0;

  const elapsed = now.getTime() - started;
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0;
  return Math.floor(elapsed / MS_PER_MINUTE);
}
