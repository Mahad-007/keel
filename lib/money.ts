import { MINUTES_PER_HOUR } from "@/lib/minutes";

/**
 * Money is integer cents everywhere in the codebase. Floats never touch a
 * currency value — `0.1 + 0.2` problems in an invoice total are not
 * recoverable once they reach a client.
 */

export function formatCents(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Parses "1,234.56" or "$1234.56" into 123456. Throws on anything else. */
export function parseCents(input: string): number {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) {
    throw new Error(`not a currency amount: ${input}`);
  }
  return Math.round(Number(cleaned) * 100);
}

/**
 * Negative zero, written as zero.
 *
 * Rounding a quantity that is a shade below zero lands on `-0`, and JavaScript
 * keeps the sign: `Intl.NumberFormat` renders it as "-0" and `formatCents` as
 * "-$0.00". Both read as a broken page rather than as a number, and neither
 * says anything true that plain zero does not — the input was below zero by
 * less than the unit it is being reported in.
 *
 * Here rather than privately in `lib/scope.ts`, where it was first written,
 * because the problem belongs to the unit rather than to the calculation: any
 * figure rounded to the cent can land on it, and so can every rate and burn
 * figure built on one.
 */
export function withoutNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

/**
 * Cost of `minutes` worked at `rateCents` per hour, rounded to the cent.
 *
 * Rounded rather than truncated, so the figure is the nearest cent to the
 * arithmetic rather than always a shade under it, and never `-0`: an amount
 * that rounds away to nothing is nothing, and "-$0.00" on an invoice line is
 * not a number anybody agreed to.
 *
 * Multiplied before it is divided, which is not the same arithmetic in binary
 * floating point. Dividing first makes the intermediate value inexact and it
 * lands a hair under: eleven minutes at $13.50 an hour is exactly 247.5 cents,
 * but `(11 / 60) * 1350` is 247.49999999999997 and rounds to 247. Two integers
 * multiplied are exact, so this order rounds the true half-cent upwards like
 * every other half-cent in the file — and it is the order `impliedRateCents`
 * already divides in, which is the inverse of this calculation.
 */
export function costOfMinutes(minutes: number, rateCents: number): number {
  return withoutNegativeZero(
    Math.round((minutes * rateCents) / MINUTES_PER_HOUR),
  );
}

/**
 * The inverse of `parseCents`, for putting a stored amount back into a form
 * input. Plain digits and a decimal point — no currency symbol, no thousands
 * separators — so what comes out goes back in through `parseCents` unchanged.
 * `formatCents` is for reading a number; this is for editing one.
 */
export function centsToInput(cents: number): string {
  if (!Number.isInteger(cents)) {
    throw new Error(`not a whole number of cents: ${cents}`);
  }
  const magnitude = Math.abs(cents);
  const sign = cents < 0 ? "-" : "";
  const fraction = String(magnitude % 100).padStart(2, "0");
  return `${sign}${Math.trunc(magnitude / 100)}.${fraction}`;
}
