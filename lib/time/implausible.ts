import { MINUTES_PER_HOUR } from "@/lib/minutes";

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
