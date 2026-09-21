import { invalid, valid, type FieldResult } from "./result";

/**
 * Text fields as a form submits them: always a string, usually with stray
 * whitespace, and blank rather than absent when the user skipped one.
 *
 * Both validators trim first, so a field holding only spaces counts as empty.
 * A length ceiling is required on every field — an unbounded text column is a
 * column someone eventually pastes a novel into.
 */

export type TextOptions = {
  /** How the field is named back to the user: "Name", "Company". */
  label: string;
  max: number;
};

function tooLong(label: string, max: number): string {
  return `${label} must be ${max} characters or fewer.`;
}

/** Blank is an error. The value comes back trimmed. */
export function requiredText(
  value: string,
  { label, max }: TextOptions,
): FieldResult<string> {
  const trimmed = value.trim();
  if (trimmed === "") return invalid(`${label} is required.`);
  if (trimmed.length > max) return invalid(tooLong(label, max));
  return valid(trimmed);
}

/** Blank becomes null, so the database stores absence as NULL, not `""`. */
export function optionalText(
  value: string,
  { label, max }: TextOptions,
): FieldResult<string | null> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(null);
  if (trimmed.length > max) return invalid(tooLong(label, max));
  return valid(trimmed);
}
