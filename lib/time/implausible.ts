import { MINUTES_PER_HOUR } from "@/lib/minutes";

import { totalMinutes } from "./days";

/**
 * Entries that cannot be right, found by looking at them together.
 *
 * The log form already refuses what it can decide on its own: a duration that
 * will not parse, a day that is not a date, a stretch longer than the day it
 * is filed under. What it cannot decide is whether a readable figure is a
 * believable one. `13h` on a Tuesday parses, is under the ceiling, and is
 * either a long day or a `13m` with a slipped unit — and the form has no way
 * to tell, because the only thing that distinguishes them is the rest of the
 * week.
 *
 * So the judgement happens here instead, over a set of entries rather than
 * one, and it flags rather than refuses. That is the whole shape of this
 * module: nothing it finds stops a write, because every one of these figures
 * is something somebody could have meant. What it produces is a sentence
 * saying what looks wrong and why, beside the entry it is about.
 *
 * Pure, and generic over the entry, like `groupTimeByDay` next door. Nothing
 * here reads the database or the clock — a reading of a set of entries is
 * arithmetic on the set it is given, which is what makes the boundaries
 * testable without either.
 */

/**
 * The duration one entry has to pass to look implausible: twelve hours.
 *
 * A judgement, unlike `MAX_ENTRY_MINUTES`, and the difference is worth being
 * clear about. Twenty-four hours is arithmetic — a stretch longer than the day
 * it is filed under did not happen on that day — so the form refuses it.
 * Twelve is an opinion about how long a person works, and people do work
 * longer than that: a launch night, a shoot, a deadline. Refusing those would
 * be a tool arguing with somebody who was there.
 *
 * What it is good for is the typo it catches. `13h` for `13m` is sixty times
 * too big and reads as a perfectly ordinary figure, and it poisons every burn
 * number derived from it. Past twelve hours an entry is either remarkable or
 * wrong, and both are worth a second look.
 */
export const IMPLAUSIBLE_ENTRY_MINUTES = 12 * MINUTES_PER_HOUR;

/**
 * What one day holds: twenty-four hours.
 *
 * Arithmetic rather than judgement, and it is the one check here that proves
 * something rather than suspecting it. Entries carry a day and a duration and
 * no time of day, so two of them can never be shown to overlap one at a
 * time — but a day with more minutes logged against it than the day has cannot
 * have happened as written, whichever entries are the wrong ones.
 */
export const DAY_CAPACITY_MINUTES = 24 * MINUTES_PER_HOUR;

/**
 * What detection needs of an entry, which is three columns.
 *
 * The id, because a flag has to say which row it is about. The minutes,
 * because that is what is being judged. And the day, because two of the three
 * checks are about a day rather than an entry — one entry's figure is only
 * implausible in the company of the others filed under the same date.
 *
 * A structural type rather than the schema's `TimeEntry`, for the reason
 * `ListedTimeEntry` is one: this module is arithmetic, and importing the table
 * would make every test of it need a database.
 */
export type SuspectEntry = {
  readonly id: string;
  /** How long it took, in whole minutes. Possibly negative — see below. */
  readonly minutes: number;
  /** The calendar date the work was done on: `YYYY-MM-DD`. */
  readonly workedOn: string;
};

/**
 * Why an entry looks wrong.
 *
 * - `negative`: fewer than no minutes. The form refuses one and
 *   `positiveMinutes` refuses one, so a row holding this was written straight
 *   to the database — which happens, and is the case every caveat in this app
 *   is already written for.
 * - `overlong`: one stretch past twelve hours. The slipped unit, usually.
 * - `overlapping`: the day it is filed under holds more minutes than a day
 *   has, so some of the entries on it must cover the same hours.
 *
 * Codes rather than sentences, the arrangement `DurationReason` and
 * `TimeEntryRefusal` already use: the rule belongs here and the words belong
 * with what shows them. Unlike those two, these are not refusals — nothing
 * here stops a write — so the sentences are explanations rather than
 * instructions.
 */
export type ImplausibleReason = "negative" | "overlong" | "overlapping";

/**
 * Whether an entry records less than no time.
 *
 * Zero is left out, deliberately. The column's rule is that minutes are never
 * zero and the form says so — "that rounds to no time at all" — but a row
 * holding zero is a row that counts for nothing in every total, which is the
 * same as not being there. A negative one is worse than not being there: it
 * subtracts, so a day with one in it reads as shorter than it was and an
 * engagement with one in it looks cheaper than it was.
 */
export function negativeEntry(entry: Pick<SuspectEntry, "minutes">): boolean {
  return entry.minutes < 0;
}

/**
 * Whether one stretch of work is longer than a stretch of work plausibly is.
 *
 * Strictly past the threshold, so a twelve-hour entry is not flagged. Twelve
 * hours is a day somebody had, and it is a round figure that gets typed on
 * purpose — flagging it would put a caveat on the honest long day as well as
 * on the typo, which is how a flag stops being read.
 *
 * A negative duration is not caught here. It is a flag of its own, and the
 * comparison is the right way round for that to be true: `-900` is not longer
 * than twelve hours, so an entry cannot come back flagged as both.
 */
export function overlongEntry(entry: Pick<SuspectEntry, "minutes">): boolean {
  return entry.minutes > IMPLAUSIBLE_ENTRY_MINUTES;
}

/**
 * How many minutes each day in a set of entries holds.
 *
 * Keyed by the day rather than returned as a list, because the flagging below
 * walks the entries and asks about the day each one is on — a list would have
 * to be searched once per entry, which is quadratic on a project with a year
 * of time against it.
 *
 * Summed through `totalMinutes`, the one piece of addition every figure in
 * this app goes through, so a day that looks overfull here holds the same
 * number the heading above it prints.
 *
 * What a "day" means is the caller's: a project's own list makes this that
 * project's day, and the filtered log across four engagements makes it the
 * whole of somebody's Tuesday. The second is the stronger reading of the
 * overlap check and the first is the one the project page can act on, and the
 * function is the same either way.
 */
export function dayTotals(
  entries: readonly Pick<SuspectEntry, "minutes" | "workedOn">[],
): Map<string, number> {
  const byDay = new Map<string, { readonly minutes: number }[]>();
  for (const entry of entries) {
    const day = byDay.get(entry.workedOn);
    if (day === undefined) byDay.set(entry.workedOn, [entry]);
    else day.push(entry);
  }

  return new Map(
    [...byDay].map(([workedOn, day]) => [workedOn, totalMinutes(day)]),
  );
}

/**
 * Whether a day holds more minutes than a day has.
 *
 * Strictly past twenty-four hours, so a day logged as exactly full is not
 * flagged. It is a figure nobody arrives at by accident — three entries that
 * happen to total 1440 is a coincidence, and somebody who worked a clear
 * twenty-four hours has had a day worth remembering rather than a day worth
 * querying.
 *
 * This is the one check in the module that proves something. An entry past
 * twelve hours might be true; a day past twenty-four cannot be, whichever of
 * the entries on it is the wrong one.
 */
export function overfullDay(minutes: number): boolean {
  return minutes > DAY_CAPACITY_MINUTES;
}

/**
 * One thing that looks wrong with one entry.
 *
 * A union rather than a bare reason, because the overlap carries a figure the
 * entry itself does not hold: the sentence about it has to name what the day
 * comes to, and that is a fact about every entry on the day rather than about
 * this one. Carried on the problem rather than looked up again when the
 * sentence is written, so the figure in the words is the figure the flag was
 * raised from.
 */
export type EntryProblem =
  | { readonly reason: "negative" }
  | { readonly reason: "overlong" }
  | {
      readonly reason: "overlapping";
      /** What the day the entry is filed under comes to, in whole minutes. */
      readonly dayMinutes: number;
    };

/**
 * Everything that looks wrong with one entry, given what its day comes to.
 *
 * The entry's own problem first, then the day's, which is the order a reader
 * can act in: the duration on this row is something they can correct, and the
 * day being overfull is a fact about several rows that may well be fixed by
 * correcting this one.
 *
 * Both can be true at once. A thirteen-hour entry on a day that already held
 * eighteen is two separate things worth saying — the figure is implausible,
 * and the day it is on is impossible — and collapsing them would drop the
 * half the reader has not noticed.
 *
 * An empty array is the usual answer and a real one: nothing looks wrong with
 * this entry, which is what nearly every entry in a time list deserves.
 */
export function entryProblems(
  entry: Pick<SuspectEntry, "minutes">,
  dayMinutes: number,
): EntryProblem[] {
  const problems: EntryProblem[] = [];
  if (negativeEntry(entry)) problems.push({ reason: "negative" });
  if (overlongEntry(entry)) problems.push({ reason: "overlong" });
  if (overfullDay(dayMinutes)) {
    problems.push({ reason: "overlapping", dayMinutes });
  }
  return problems;
}
