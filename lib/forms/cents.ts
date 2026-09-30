import { centsToInput, formatCents, parseCents } from "@/lib/money";

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

/**
 * The same field where blank means zero rather than nothing — a rate nobody has
 * set, a contract value nobody has agreed. The schema stores both as zero, and
 * the field itself has no third answer to give.
 *
 * The other reading, where blank and zero are different statements, is
 * `optionalCentsField`'s null. Which of the two a field wants is the one thing
 * it has to decide for itself; everything else about parsing an amount is
 * shared.
 */
export function zeroedCentsField(
  value: string,
  options: CentsOptions,
): FieldResult<number> {
  const parsed = optionalCentsField(value, options);
  if (!parsed.ok) return parsed;
  return valid(parsed.value ?? 0);
}

/**
 * The inverse of `zeroedCentsField`, for prefilling a form from a stored row.
 * Zero renders as an empty box rather than as `0.00`, which would read as a
 * figure somebody chose — the same reading the parse direction gives a blank.
 */
export function zeroedCentsInput(cents: number): string {
  return cents === 0 ? "" : centsToInput(cents);
}

/**
 * The inverse of `optionalCentsField`. Null is the empty box; zero is `0.00`,
 * because where blank means "not set" a zero was somebody's decision and the
 * form has to offer it back as one.
 */
export function optionalCentsInput(cents: number | null): string {
  return cents === null ? "" : centsToInput(cents);
}
