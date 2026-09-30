import { zeroedCentsField } from "./cents";
import type { FieldResult } from "./result";

/**
 * A one-off sum as typed into a form — what a whole engagement was contracted
 * for, rather than a price per hour.
 *
 * Its own module rather than the rate's because the two differ in the only
 * thing a money field has to decide for itself: how big a figure is still
 * plausible. A rate of $20,000 is a typo; a contract worth $20,000 is a
 * Tuesday.
 */

/**
 * $10,000,000. A freelance engagement worth more than this is not one this
 * app is being used for, so past this point the likeliest reading is cents
 * typed as dollars or a slipped zero — and a contract value silently a
 * hundred times too large poisons every burn figure derived from it.
 */
export const MAX_AMOUNT_CENTS = 1_000_000_000;

/**
 * Blank means "not agreed yet", which the schema stores as zero — the same
 * reading the list and the project header already give a zero contract value.
 */
export function optionalAmountCents(
  value: string,
  label = "Contract value",
): FieldResult<number> {
  return zeroedCentsField(value, { label, max: MAX_AMOUNT_CENTS });
}
