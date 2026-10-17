import { invalid, valid, type FieldResult } from "./result";

/**
 * A field whose value has to be one of a known set — a picked client, a
 * status, anything a `<select>` offers.
 *
 * The options are checked on the server even though the browser only ever
 * offered valid ones. A form is a POST endpoint: the submitted value can name
 * a row that was deleted while the form sat open, or one that was never on
 * offer at all. Which set is legitimate is the caller's to decide and this
 * function's to enforce, and doing it here means the id reaching the data
 * layer has already been proven to be one of them.
 */

export type ChoiceOptions = {
  /** How the field is named back to the user: "Client". */
  label: string;
  /**
   * What to say when the submitted value is not on the list. The default is
   * phrased for a developer's typo; a field where the usual cause is a stale
   * page should say so in its own words.
   */
  unknown?: string;
};

export function requiredChoice<T extends string>(
  value: string,
  allowed: readonly T[],
  { label, unknown }: ChoiceOptions,
): FieldResult<T> {
  const trimmed = value.trim();
  if (trimmed === "") return invalid(`${label} is required.`);

  if (!(allowed as readonly string[]).includes(trimmed)) {
    return invalid(unknown ?? `${label} is not one of the options offered.`);
  }
  return valid(trimmed as T);
}

/**
 * A picker whose first line means "none of these", and means it.
 *
 * The difference from `requiredChoice` is what blank is for. There, an empty
 * value is a field the reader skipped and the message says so. Here it is an
 * answer: time logged against no deliverable is project-level work — a call, a
 * handover, an afternoon of nothing that fits a line of the scope list — and
 * that is a true thing about the entry rather than a gap in it.
 *
 * Null rather than the empty string, so the one representation of "no
 * deliverable" is the one the column holds. A blank id travelling further
 * would be a third state meaning what NULL already means, and `optionalText`
 * in the data layer would collapse it anyway — one conversion, at the edge.
 *
 * Anything else is still checked against the list, for the reason
 * `requiredChoice` is: a form is a POST endpoint, and the id in it can name a
 * row deleted while the page sat open or one that was never offered.
 */
export function optionalChoice<T extends string>(
  value: string,
  allowed: readonly T[],
  { label, unknown }: ChoiceOptions,
): FieldResult<T | null> {
  const trimmed = value.trim();
  if (trimmed === "") return valid(null);

  if (!(allowed as readonly string[]).includes(trimmed)) {
    return invalid(unknown ?? `${label} is not one of the options offered.`);
  }
  return valid(trimmed as T);
}
