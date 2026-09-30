import { optionalCentsField, zeroedCentsField } from "./cents";
import type { FieldResult } from "./result";

/**
 * An hourly rate as typed into a form. The parsing, the range check, the
 * wording of every message and both inverses are `cents.ts`'s; what is left
 * here is the only thing specific to a rate — how high one can go before it is
 * a typo, and what an empty field means in each of the two places a rate is
 * asked for.
 */

/** $10,000/hr. Past this it is a typo — a stray zero, or cents typed as dollars. */
export const MAX_RATE_CENTS = 1_000_000;

/** Blank means "not set yet", which the schema stores as zero. */
export function optionalRateCents(
  value: string,
  label = "Default rate",
): FieldResult<number> {
  return zeroedCentsField(value, { label, max: MAX_RATE_CENTS });
}

/**
 * A project's rate override, where a blank field is a third answer rather
 * than a missing one.
 *
 * Null means "bill this at whatever the client bills at" and zero means "bill
 * this at nothing" — a project on a fixed price, where the hours are not
 * charged for. Both are deliberate, and folding blank into zero the way
 * `optionalRateCents` does would make the first unsayable.
 */
export function overrideRateCents(
  value: string,
  label = "Rate override",
): FieldResult<number | null> {
  return optionalCentsField(value, { label, max: MAX_RATE_CENTS });
}
