/**
 * The validators the data layer applies on the way into a column. They throw
 * rather than returning a result: by the time a value reaches `lib/data/`, a
 * form has already checked it and turned mistakes into messages, so anything
 * wrong here is a programming error and should be loud.
 *
 * `lib/forms/` is the other half of this — same rules, but phrased for a
 * person and collected into field errors instead of thrown.
 */

/**
 * A column that must hold something. Trims first, so a value of only spaces
 * counts as absent rather than being stored as whitespace.
 */
export function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") throw new Error(`${field} is required`);
  return trimmed;
}

/**
 * A nullable column. Absent, null, and blank all collapse to NULL, so that
 * "no value" has exactly one representation in the database and a query for it
 * does not have to test for `''` as well.
 */
export function optionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
