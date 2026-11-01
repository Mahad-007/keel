import { readFields } from "@/lib/forms/form-data";

/**
 * The state the timesheet's bulk form is rendered from, between the press and
 * the answer.
 *
 * Its own module rather than part of `bulk.ts`, the same split the pasted
 * scope list has: one file decides what a submitted grid *means*, and this one
 * decides what the form looks like afterwards. The parse rules are the thing
 * with the edge cases; the state is the thing a component imports.
 *
 * The field names are not fixed here, and that is the one way this differs
 * from every other form in the app. A grid's fields are its cells, so the set
 * of them is a fact about the week and the projects on it — `bulkCellNames`
 * builds the list, and everything here takes it as an argument rather than
 * declaring it.
 */

/**
 * Every cell of the grid as submitted, keyed by field name.
 *
 * Keyed by name rather than by position for the reason `bulkCellName` gives: a
 * position is a fact about the screen, and a row inserted above would move
 * every cell below it.
 */
export type BulkTimeFields = Record<string, string>;

/**
 * A grid with nothing typed into it, which is what it is rendered from and
 * what it goes back to after a save.
 *
 * Built from the names rather than left empty, because the component reads
 * `fields[name]` for each box's `defaultValue`: a missing key and an empty
 * string render the same box, but only one of them survives a round trip
 * through a rejected submission without turning into `undefined`.
 */
export function blankBulkFields(names: readonly string[]): BulkTimeFields {
  const fields: BulkTimeFields = {};
  for (const name of names) fields[name] = "";
  return fields;
}

/**
 * The submitted grid, read as strings.
 *
 * Exactly the names the caller asks for and nothing else. That is the check
 * that matters on this form: the names come from the week and the projects the
 * page captured, so a field naming another engagement or a day in another week
 * is not refused — it is never read. A submission can carry anything; only the
 * cells the grid offered reach a validator.
 */
export function readBulkFields(
  formData: FormData,
  names: readonly string[],
): BulkTimeFields {
  return readFields(formData, names);
}
