import { formatCents, parseCents } from "@/lib/money";

import { invalid, valid, type FieldResult } from "./result";

/**
 * A money field as typed into a form: a string that has to become whole cents
 * or a sentence saying why it cannot.
 *
 * `parseCents` does the conversion — a currency value never passes through a
 * float on its way to the database — and this turns its exception into a
 * message and rules out the amounts that parse cleanly but cannot be money:
 * a negative one, and one so large it is a stray zero rather than a figure.
 *
 * Blank comes back as null rather than zero, because what an empty money field
 * means differs by field: an unset rate override is "bill at the client's
 * rate", an unset contract value is "nobody has said yet". Collapsing both to
 * zero here would take that decision away from the field that owns it.
 */

export type CentsOptions = {
  /** How the field is named back to the user: "Contract value". */
  label: string;
  /** The largest amount that is a figure rather than a typo. */
  max: number;
};

export function optionalCentsField(
  value: string,
  { label, max }: CentsOptions,
): FieldResult<number | null> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(null);

  let cents: number;
  try {
    cents = parseCents(trimmed);
  } catch {
    return invalid(`${label} must be an amount, like 150 or 150.00.`);
  }

  if (cents < 0) return invalid(`${label} cannot be negative.`);
  if (cents > max) {
    return invalid(`${label} must be ${formatCents(max)} or less.`);
  }
  return valid(cents);
}
