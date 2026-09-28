import { centsToInput } from "@/lib/money";

import { optionalCentsField } from "./cents";
import { valid, type FieldResult } from "./result";

/**
 * An hourly rate as typed into a form. The parsing, the range, and the
 * wording of every message are `optionalCentsField`'s; what is left here is
 * the one thing that is specific to a rate — what an empty field means, and
 * how high a rate can go before it is a typo.
 */

/** $10,000/hr. Past this it is a typo — a stray zero, or cents typed as dollars. */
export const MAX_RATE_CENTS = 1_000_000;

/** Blank means "not set yet", which the schema stores as zero. */
export function optionalRateCents(
  value: string,
  label = "Default rate",
): FieldResult<number> {
  const parsed = optionalCentsField(value, { label, max: MAX_RATE_CENTS });
  if (!parsed.ok) return parsed;
  return valid(parsed.value ?? 0);
}

/**
 * The inverse, for prefilling the field when editing an existing row. Zero is
 * "not set yet", and the form says that with a blank input rather than with
 * `0.00` — otherwise every edit of a rate-less client offers to save a rate of
 * nothing as though it were a deliberate figure.
 */
export function rateInput(cents: number): string {
  return cents === 0 ? "" : centsToInput(cents);
}
