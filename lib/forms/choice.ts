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
