import { MINUTES_PER_HOUR } from "@/lib/minutes";

/**
 * How long something took, as a person writes it down.
 *
 * Nobody logs work in minutes. They write `1h30m`, or `90`, or `2h`, or
 * `45m` — and the column holds whole minutes, so one of those has to become
 * the other somewhere. This is that somewhere, and it is the only place in the
 * app that reads a duration out of a person's handwriting.
 *
 * Separate from `lib/minutes.ts`, which converts decimal *hours* for the
 * estimate field and refuses anything else. The two fields are asked
 * differently on purpose: an estimate is a judgement in hours ("about a day
 * and a half"), and a log is a measurement in whatever unit the clock was read
 * in ("ten past two to half three"). Sharing one parser would mean teaching
 * the estimate field to read `90` as an hour and a half, or this one to read
 * it as ninety hours.
 *
 * Nothing here throws. A duration a reader typed is wrong far more often than
 * any other field on the form — it is the one field with a syntax — so the
 * parser's answer has to carry *which* kind of wrong, and the form turns that
 * into the sentence that says what to type instead. `parseHours` throws
 * because there is only one way to get an hours field wrong; there are four
 * here, and three of them have a different thing to say.
 */

/**
 * Why a duration could not be read.
 *
 * - `blank`: nothing was typed. The field is required, and that is a sentence
 *   about a missing field rather than about a bad one.
 * - `bare-fraction`: `1.5`, with no unit. It is a minute and a half to this
 *   parser and an hour and a half to the person who typed it, and there is no
 *   way to tell which — see `parseDuration`.
 * - `clock`: `1:30`, which is a time of day as often as it is a duration.
 * - `unreadable`: everything else.
 *
 * Codes rather than sentences, the same arrangement as `TimeEntryRefusal`: the
 * words belong with the form that shows them, and the rule belongs here.
 */
export type DurationReason =
  | "blank"
  | "bare-fraction"
  | "clock"
  | "unreadable";

/**
 * A duration read, or why it was not.
 *
 * The minutes can be negative, which is not an oversight: `-30` is read and
 * handed back as minus thirty rather than refused here. A duration below zero
 * is a thing the reader has to be told about in those words, and that sentence
 * is the form's — this is the parser, and it is reporting what was written.
 */
export type DurationParse =
  | { readonly ok: true; readonly minutes: number }
  | { readonly ok: false; readonly reason: DurationReason };

/**
 * What the parser works on: lower-cased, with every space taken out.
 *
 * All the whitespace rather than only the ends, so `1h 30m` and `1h30m` are
 * the same duration — the space between the parts is typing, not meaning, and
 * `parseHours` already treats it that way. Lower-cased so `1H30M` is the same
 * too: a reader with caps lock on has not made a mistake worth a message.
 */
function normalise(input: string): string {
  return input.trim().toLowerCase().replace(/\s/g, "");
}

/** A number on its own, with no unit after it. */
const BARE_MINUTES = /^-?\d+$/;

/**
 * The written form: an hours part, a minutes part, either of them optional.
 *
 * Both parts optional and in that order, which is three decisions. `1h` and
 * `45m` are durations on their own, so neither part can be required. `30m1h`
 * is not one, so the order is fixed — a reader who wrote it backwards has
 * written something nobody says aloud, and guessing at it would mean also
 * guessing at `1m30h`. And the sign is on the front of the whole thing rather
 * than on each part, so `-1h30m` is minus ninety minutes rather than minus
 * sixty plus thirty.
 */
const UNIT_PARTS = /^(-?)(?:(\d+)h)?(?:(\d+)m)?$/;

/**
 * The written form read, or null if this is not that form at all.
 *
 * Null rather than a reason, because "not hours and minutes" is not yet an
 * answer — `90` reaches here too, and so does `1,5`, and each of those has
 * somewhere else to go. Only `parseDuration` knows what is left once every
 * form has been tried.
 */
function parseUnitParts(cleaned: string): DurationParse | null {
  const match = UNIT_PARTS.exec(cleaned);
  if (match === null) return null;

  const [, sign, hours, mins] = match;
  // Both parts absent is the regex matching a bare sign, or nothing at all.
  if (hours === undefined && mins === undefined) return null;

  const total =
    (hours === undefined ? 0 : Number(hours) * MINUTES_PER_HOUR) +
    (mins === undefined ? 0 : Number(mins));
  return { ok: true, minutes: sign === "-" ? -total : total };
}

/**
 * A duration as minutes, or why it could not be read.
 *
 * A bare number is minutes. That is the one convention here worth arguing
 * about — `90` could be ninety hours — and minutes win because of what the
 * field is for: a stretch of work just finished, typed in the unit a timer
 * reads in. Nobody logs ninety hours as a single entry, and somebody who
 * means an hour and a half has `1h30m` and `1.5h` to say it with.
 */
export function parseDuration(input: string): DurationParse {
  const cleaned = normalise(input);

  /*
    Nothing typed is its own answer rather than an unreadable one. The sentence
    a reader needs is "say how long it took", not "that is not a duration" —
    and the field is required, so this is the branch a reader meets by pressing
    the button too early rather than by typing something odd.
  */
  if (cleaned === "") return { ok: false, reason: "blank" };

  if (BARE_MINUTES.test(cleaned)) return { ok: true, minutes: Number(cleaned) };

  const units = parseUnitParts(cleaned);
  if (units !== null) return units;

  return { ok: false, reason: "unreadable" };
}
