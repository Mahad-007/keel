import { readFields } from "@/lib/forms/form-data";
import type { FieldErrors } from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";

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

/**
 * What a press that landed wrote.
 *
 * The ids are here because a live region needs its text to change for a screen
 * reader to notice it. Two presses that each logged two hours in one cell
 * would otherwise render the same sentence twice, and the second would be
 * announced to nobody — so the notice is keyed on the first id written.
 *
 * The total is taken from the rows as written rather than from what was
 * submitted, so a reader who typed `90` is told they logged 1h 30m and one who
 * typed `0.6m` is told they logged a minute. That is the only confirmation
 * that the duration convention worked out the way they meant.
 */
export type BulkSaved = {
  /** The entries written, in grid order. Never empty. */
  readonly entryIds: readonly string[];
  /** What they came to altogether, in whole minutes. */
  readonly minutes: number;
};

/**
 * The form's whole state: the grid as typed, a message per cell that failed,
 * one sentence for a problem belonging to no cell, and what the last press
 * wrote.
 *
 * `FormState<string>` rather than a union of field names, because the fields
 * are the week's cells and there is no literal type for those — see the module
 * comment. Everything the shared form primitives do with a state works
 * regardless: the summary counts errors, and a cell finds its own message by
 * name.
 *
 * `saved` is non-null only immediately after a press that wrote. The form does
 * not navigate — writing up a week is followed by checking the figures that
 * appeared, not by going somewhere — so this is how it knows to say what
 * happened.
 */
export type BulkTimeState = FormState<string> & {
  readonly saved: BulkSaved | null;
};

/**
 * An untouched grid: every box empty, nothing wrong, nothing written yet.
 *
 * A function rather than a constant, because the cells depend on the week the
 * page is showing. Stepping to another week serves a different set of names,
 * and a constant could not hold them.
 */
export function initialBulkState(names: readonly string[]): BulkTimeState {
  return { ...initialFormState(blankBulkFields(names)), saved: null };
}

/**
 * The press wrote. The grid comes back empty, ready for whatever is next.
 *
 * Emptied rather than left holding what was typed, and that is the one
 * decision on this form worth defending. A grid that kept its figures after a
 * save would be a grid where every box still reads `2h` beside a cell that now
 * reads `2h` — and the next press would log the whole week a second time. Time
 * is money, so a duplicate here ends up on an invoice somebody will defend
 * line by line.
 *
 * The cells themselves are not the record of what happened. The sheet
 * underneath is, and it is re-read the moment the page is revalidated.
 */
export function savedBulkState(
  saved: BulkSaved,
  names: readonly string[],
): BulkTimeState {
  return { ...initialBulkState(names), saved };
}

/**
 * Validation refused the submission. Nothing was written, and the grid keeps
 * every figure that was typed into it.
 *
 * Keeping them is not a nicety on this form: a reader who filled in fifteen
 * cells and got one message back would otherwise lose the fourteen that were
 * fine, and there is nowhere to get them from but memory.
 */
export function rejectedBulkState(
  fields: BulkTimeFields,
  errors: FieldErrors<string>,
): BulkTimeState {
  return { ...rejectedFormState(fields, errors), saved: null };
}

/**
 * The submission was good and nothing was written anyway — the project deleted
 * in another tab, a driver that refused the transaction.
 *
 * The grid keeps its figures for the same reason, and more pressingly: the
 * sentence for most of these says to try again, and there is nothing to try
 * again with if the boxes have been cleared.
 */
export function failedBulkState(
  fields: BulkTimeFields,
  formError: string,
): BulkTimeState {
  return { ...failedFormState(fields, formError), saved: null };
}

/**
 * The things that can stop a sheet that no single cell is to blame for.
 *
 * Each is reachable from a page that was right when it rendered — a press with
 * nothing typed, a project closed down in another tab, a transaction the
 * driver refused — so each says what to do rather than only what went wrong.
 *
 * All three say that nothing was written, and on this form that is the
 * sentence that matters most. The press covers a dozen cells at once, so a
 * reader who cannot tell whether it half-landed has no way to try again
 * without risking a duplicate of whatever did — and the transaction is what
 * makes "nothing was written" true rather than hopeful.
 */
export const BULK_PROBLEMS = {
  nothingTyped:
    "Nothing to save yet. Type how long something took into the day it was worked on — a blank cell is left exactly as it was.",
  missingProject:
    "One of those projects no longer exists, so nothing was saved. Reload the sheet — that row has gone with it — and fill in what is left.",
  failed:
    "Could not save that time. The whole sheet is written in one go, so nothing landed at all — try again.",
} as const;

/**
 * What to say when the press never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was written, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with a dozen entries already stored. The transaction
 * guarantees the sheet landed whole or not at all, which is a real guarantee
 * and still not one the browser can read.
 *
 * Nor does it say "try again", which is the instruction that would log the
 * whole week twice. That is the worst outcome this form has: a duplicated
 * week is money, and it is money on an invoice somebody will defend line by
 * line. So it asks the reader to reload and look at the figures, which is the
 * one thing that answers the question.
 */
export const BULK_NO_ANSWER =
  "Could not tell whether that sheet was saved — the answer never arrived. It was either written whole or not at all; reload the week and look at the figures before filling it in again.";
