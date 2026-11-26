import type { ThresholdOverrides } from "@/lib/thresholds/resolve";
import {
  THRESHOLD_KEYS,
  THRESHOLD_SETTINGS,
  type ThresholdKey,
} from "@/lib/thresholds/settings";

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

/**
 * The five boxes a form lays out, in the spec's own order.
 *
 * The input names are the setting keys themselves, which is the decision that
 * makes the rest of this file short: the submitted field, the error key, the
 * column and the spec entry are all spelled the same, so `readFields` and
 * `collect` need no translation table between them. A separate naming scheme —
 * `threshold_nearly_spent` on the input, `nearlySpentPercent` in the spec —
 * would be a fourth place to keep in step and the one nothing would catch,
 * because a field read under a name nothing submits reads as a blank box, which
 * is a legal answer meaning "inherit".
 */
export const THRESHOLD_FIELD_NAMES = THRESHOLD_KEYS;

/** One of the five threshold inputs, by the name it is submitted under. */
export type ThresholdFieldName = ThresholdKey;

/** Every threshold box as submitted, untrimmed. */
export type ThresholdFormFields = Record<ThresholdFieldName, string>;

/**
 * Five empty boxes: a form that has not been filled in, which is every client
 * and every project until somebody disagrees with a default.
 *
 * Built from `THRESHOLD_KEYS` rather than written out, so the day a sixth
 * setting is added the blank form grows a box instead of a hole — a key missing
 * from here is a field `readFields` never reads and a value the parse never
 * sees.
 *
 * Frozen, because both forms spread it into their own blanks and a caller that
 * mutated it would prefill every new client in the process with somebody's
 * typing.
 */
export const BLANK_THRESHOLD_FIELDS: ThresholdFormFields = Object.freeze(
  Object.fromEntries(
    THRESHOLD_KEYS.map((key) => [key, ""]),
  ) as ThresholdFormFields,
);

/**
 * A stored row as the five boxes that describe it.
 *
 * The group's half of `thresholdInput`, and the reason both exist: an edit form
 * opens on what is stored and has to render it as strings the parse accepts
 * back unchanged, or saving an untouched form rewrites the row. Here that means
 * a NULL column renders empty and an empty box parses back to NULL — "inherit"
 * on the way out and on the way in — so a client who has agreed nothing stays
 * that way through a save that only touched their email.
 *
 * Takes a partial row, so it is satisfied by a stored client, a stored project
 * and a literal in a test alike. An absent key is rendered the same as a NULL
 * one, because the resolution reads them the same.
 */
export function thresholdFormFields(
  row: ThresholdOverrides,
): ThresholdFormFields {
  const fields = {} as ThresholdFormFields;
  for (const key of THRESHOLD_KEYS) {
    fields[key] = thresholdInput(row[key] ?? null);
  }
  return fields;
}
