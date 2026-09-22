import { centsToInput, formatCents, parseCents } from "@/lib/money";

import { invalid, valid, type FieldResult } from "./result";

/**
 * An hourly rate as typed into a form. `parseCents` does the conversion — a
 * rate never becomes a float on the way to the database — and this wrapper
 * turns its exception into a message and rules out the values that parse
 * cleanly but cannot be a rate.
 */

/** $10,000/hr. Past this it is a typo — a stray zero, or cents typed as dollars. */
export const MAX_RATE_CENTS = 1_000_000;

/** Blank means "not set yet", which the schema stores as zero. */
export function optionalRateCents(
  value: string,
  label = "Default rate",
): FieldResult<number> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(0);

  let cents: number;
  try {
    cents = parseCents(trimmed);
  } catch {
    return invalid(`${label} must be an amount, like 150 or 150.00.`);
  }

  if (cents < 0) return invalid(`${label} cannot be negative.`);
  if (cents > MAX_RATE_CENTS) {
    return invalid(`${label} must be ${formatCents(MAX_RATE_CENTS)} or less.`);
  }
  return valid(cents);
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
