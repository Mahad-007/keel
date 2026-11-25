import { THRESHOLD_SETTINGS, type ThresholdKey } from "@/lib/thresholds/settings";

import { invalid, valid, type FieldResult } from "./result";

/**
 * A threshold as typed into a form: a whole number in the setting's own unit,
 * or a blank box meaning "inherit".
 *
 * Its own module rather than a reuse of the money fields, because the only
 * thing the two have in common is that a person types digits into them. A
 * threshold has no decimal part, its bounds are per setting rather than per
 * field type, and — the part that matters — a blank box is a third answer
 * rather than a missing one: it means "judge this project by whatever my client
 * is set to", which is a sentence a zero cannot say.
 *
 * Every rule here is read off `THRESHOLD_SETTINGS`, so the figure the form
 * refuses and the figure the column refuses are the same figure. The two
 * guards are the pair `lib/forms/` and `lib/data/` always keep: same rule,
 * phrased for a person here and thrown there.
 */

/**
 * The unit as a message names it, which is not how a label names it.
 *
 * "a whole percent" reads as an instruction; "percent" alone reads as a noun
 * the sentence has lost its article for. Short enough that writing the two out
 * is clearer than deriving them.
 */
const UNIT_PHRASE = {
  percent: "a whole percent",
  days: "a whole number of days",
} as const;

/**
 * One threshold field, parsed: the figure, or null for a blank box, or a
 * sentence saying what is wrong with what was typed.
 *
 * Three refusals, in the order a person meets them: not a number at all, not a
 * whole one, and out of the range the setting allows. Each names the setting as
 * its own label, because a form showing five of these needs to say which box
 * the message is about.
 *
 * The range message quotes both ends rather than only the one that was passed.
 * A reader who typed 120 into a field that tops out at 100 can work out which
 * end they missed; a reader who typed 0 into a field whose floor is 1 is being
 * told the useful thing, which is that there is a floor at all.
 */
export function optionalThresholdSetting(
  key: ThresholdKey,
  value: string,
): FieldResult<number | null> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(null);

  const { label, unit, min, max } = THRESHOLD_SETTINGS[key];
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return invalid(`${label} must be ${UNIT_PHRASE[unit]}, like ${max}.`);
  }
  if (!Number.isInteger(parsed)) {
    return invalid(`${label} must be ${UNIT_PHRASE[unit]}, with no decimals.`);
  }
  if (parsed < min || parsed > max) {
    return invalid(`${label} must be between ${min} and ${max}.`);
  }
  return valid(parsed);
}

/**
 * The inverse, for prefilling a form from a stored row.
 *
 * NULL is the empty box, which is the same reading the parse direction gives a
 * blank: nothing is set here, so this row inherits. A zero would be a figure
 * somebody chose, and every setting refuses zero anyway — so printing one would
 * put a value in the box that the form beside it would not accept back.
 */
export function thresholdInput(value: number | null): string {
  return value === null ? "" : String(value);
}
