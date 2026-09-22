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

/** Cost of `minutes` worked at `rateCents` per hour, rounded to the cent. */
export function costOfMinutes(minutes: number, rateCents: number): number {
  return Math.round((minutes / 60) * rateCents);
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
