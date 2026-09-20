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
