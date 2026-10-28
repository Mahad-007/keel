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

import { formatMinutes } from "@/lib/minutes";

import { MAX_ENTRY_MINUTES, type LogTimeFormValue } from "./form";

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

/**
 * The shortest stretch a timer can be stopped into.
 *
 * A minute, because that is the unit: an entry of zero minutes is refused by
 * the column, and rightly — it records nothing that happened and every total
 * has to skip it. So a timer started and stopped inside the same minute has
 * nothing to write, and saying so is better than storing a minute nobody
 * worked or silently throwing the press away.
 */
export const MINIMUM_TIMER_MINUTES = 1;

/**
 * Whether a clock has been running long enough to read as a duration.
 *
 * One question asked in three places — the refusal to stop a clock with
 * nothing to log, the figure on screen, and the step in front of a discard —
 * and they have to agree. A panel reading "less than a minute" above a Stop
 * button that works would be the app contradicting itself in two inches of
 * page.
 */
export function hasCountedMinute(minutes: number): boolean {
  return minutes >= MINIMUM_TIMER_MINUTES;
}

/**
 * Why stopping this timer would not produce an entry worth keeping.
 *
 * Two of them, at the two ends. `too-short` is the mis-press: Start, then the
 * realisation that it is the wrong project, then Stop — and the way out is to
 * discard it. `too-long` is the clock left running overnight or over a
 * weekend, where the elapsed figure is real arithmetic and a lie about the
 * work: an entry is a stretch on one calendar day, and a stretch longer than
 * the day it is filed under did not happen on that day.
 *
 * Both are the timer's version of what `loggedMinutes` refuses on the log
 * form, through the same ceiling, so a duration the form will not accept
 * typed cannot arrive by holding a button down instead.
 */
export type TimerStopObstacle = "too-short" | "too-long";

/**
 * What stands in the way of stopping a timer at this elapsed figure, or null
 * when nothing does.
 *
 * Null rather than a boolean, because the two obstacles are different news and
 * only one of them has a way out that keeps the time: a short timer is
 * discarded, and a long one is discarded and then logged by hand against the
 * days it actually spanned.
 */
export function timerStopObstacle(minutes: number): TimerStopObstacle | null {
  if (!hasCountedMinute(minutes)) return "too-short";
  if (minutes > MAX_ENTRY_MINUTES) return "too-long";
  return null;
}

/**
 * What the elapsed figure reads as on screen.
 *
 * The first minute says so in words rather than showing `0m`. A clock reading
 * zero is what a stopped clock reads, and it is the first thing a reader sees
 * after pressing Start — the one moment they are looking for confirmation that
 * the press landed. "Less than a minute" is that confirmation; `0m` is the
 * opposite of it.
 *
 * After that it is `formatMinutes`, the same spelling every other duration in
 * the app is written in, so an hour and a half on the running clock reads as
 * the `1h 30m` it will appear as in the list once it is stopped.
 */
export function elapsedLabel(minutes: number): string {
  if (!hasCountedMinute(minutes)) return "Less than a minute";
  return formatMinutes(minutes);
}

/**
 * The entry a stopped timer becomes: the same five things the log form
 * produces, so stopping a clock and typing a duration write the same row.
 *
 * `LogTimeFormValue` rather than a type of its own, which is the point worth
 * making: a timer is not a second kind of time. It is a different way of
 * arriving at a duration, and everything downstream — the rollups, the burn
 * figures, the invoice — reads one table and cannot tell which way an entry
 * got there.
 *
 * The day is the day the clock *started* on, not the day it stopped. A stretch
 * begun at 23:50 and stopped at 00:20 is half an hour of last night's work,
 * and filing it under the new day would move an evening's work onto a morning
 * nobody worked — the day somebody sat down is the day they will look for it
 * under. It also means the day never depends on where the server is standing,
 * because `startedOn` was written from the clock of whoever pressed Start.
 *
 * The note and the attribution are carried across as they were given at Start.
 * A reader who wants to say more about the work edits the entry afterwards,
 * which is a form that already exists — asking for a note at Stop would put a
 * form in front of the one press that has to be instant.
 */
export function stoppedTimerEntry(
  timer: RunningTimer,
  minutes: number,
): LogTimeFormValue {
  return {
    minutes,
    workedOn: timer.startedOn,
    deliverableId: timer.deliverableId,
    note: timer.note,
    billable: timer.billable,
  };
}
