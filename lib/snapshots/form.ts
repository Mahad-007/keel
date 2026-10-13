import { readFields } from "@/lib/forms/form-data";
import {
  collect,
  type FieldErrors,
  type ParseResult,
} from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
  type FormState,
} from "@/lib/forms/state";
import { optionalText } from "@/lib/forms/text";

/**
 * The form that takes a snapshot of a project's scope, from submitted strings
 * to something the data layer will accept.
 *
 * One field, and it is optional. What gets recorded is the scope list as it
 * stands at the moment of the press — the form is not where lines are chosen,
 * because a form that asked you to tick eight boxes would be a form that could
 * record something other than what was agreed, which is the one thing a
 * snapshot must not do. So the only thing asked for is what to call the moment.
 *
 * Pure, like every other form module here: fields in, result out, no request
 * and no database.
 */

/**
 * The fields, in the order the form lays them out — which is the order errors
 * are walked in, so the cursor after a rejected submission lands on the first
 * problem a reader would reach on screen. There is one of them today, and the
 * list is still the thing the focus hook is driven by.
 */
export const SNAPSHOT_FIELD_NAMES = ["label"] as const;

export type SnapshotFieldName = (typeof SNAPSHOT_FIELD_NAMES)[number];

/** Every field as submitted, untrimmed. What the form renders back on error. */
export type SnapshotFormFields = Record<SnapshotFieldName, string>;

/**
 * How long the label may be. Exported because the input carries the same
 * number as its `maxLength`: two copies of a limit drift, and the day they do
 * the browser stops somebody at a length the validator would have accepted.
 *
 * Shorter than a template's name, because a label is read in a picker beside a
 * date and a size — "Signed proposal" is the shape of the thing, not a
 * sentence about why it was taken.
 */
export const SNAPSHOT_LABEL_LIMIT = 80;

/**
 * Which form these fields belong to, for the ids they render under.
 *
 * The scope tab holds several forms at once, and the focus hook and the
 * controls have to agree on the scope exactly: a form whose controls are
 * namespaced and whose hook is not puts the cursor in somebody else's box,
 * which is worse than not moving it at all.
 */
export const SNAPSHOT_FIELD_SCOPE = "snapshot";

export const EMPTY_SNAPSHOT_FIELDS: SnapshotFormFields = { label: "" };

export type SnapshotFormState = FormState<SnapshotFieldName>;

export function readSnapshotFields(formData: FormData): SnapshotFormFields {
  return readFields(formData, SNAPSHOT_FIELD_NAMES);
}

/**
 * What the form yields once the field is good: the one column a person
 * decides about a snapshot.
 */
export type SnapshotFormValue = {
  readonly label: string | null;
};

/**
 * The submitted form, checked.
 *
 * The label is optional, which is the opposite of a template's name. A
 * template with no name is an option nobody can pick deliberately; a snapshot
 * with no label is still unambiguous, because it has a date on it and the date
 * is what a comparison is usually asked for. Requiring a label would mean a
 * reader who wants a record of today's scope has to compose a sentence first,
 * and the press they would otherwise have made is the whole feature.
 *
 * Blank collapses to NULL rather than to `""`, so "nobody named it" has one
 * representation in the column and the picker's fallback to the date is driven
 * by a null rather than by a string that happens to be empty.
 */
export function parseSnapshotForm(
  fields: SnapshotFormFields,
): ParseResult<SnapshotFormValue, SnapshotFieldName> {
  const parsed = collect({
    label: optionalText(fields.label, {
      label: "Label",
      max: SNAPSHOT_LABEL_LIMIT,
    }),
  });

  if (!parsed.ok) return parsed;
  return { ok: true, value: parsed.value };
}

/**
 * What a taken snapshot was, which is the one thing a redirecting form never
 * needs to carry.
 *
 * Taking a snapshot does not navigate. The reader is looking at the scope list
 * they have just recorded, and sending them somewhere else would be sending
 * them away from the work to look at a copy of it. So the form stays where it
 * is, and this is how it knows the press landed.
 *
 * The id comes along because a live region needs its text to change for a
 * screen reader to notice it: two snapshots taken minutes apart with the same
 * label would otherwise render identical words, and the second would be
 * announced to nobody.
 *
 * The line count is the fact nobody can see. The scope list above is
 * unchanged by the press — that is the point of it — so without a number the
 * reader has no way to tell a snapshot of nine lines from a snapshot of none.
 */
export type TakenSnapshot = {
  readonly id: string;
  readonly label: string | null;
  readonly lineCount: number;
};

export type TakeSnapshotState = SnapshotFormState & {
  readonly taken: TakenSnapshot | null;
};

/**
 * What the form starts from. A constant rather than a function, because
 * nothing about a snapshot is prefilled — the label is a note about this
 * moment, and suggesting one would be suggesting a reason the reader did not
 * give.
 */
export const INITIAL_TAKE_SNAPSHOT_STATE: TakeSnapshotState = {
  ...initialFormState(EMPTY_SNAPSHOT_FIELDS),
  taken: null,
};

/**
 * A snapshot was recorded. The box comes back empty.
 *
 * Emptied rather than echoed, which is the opposite of what a rejection does
 * and for the same reason the import box empties: the label has been filed,
 * and a box still holding it is one press away from a second snapshot of a
 * scope list that has not moved.
 */
export function takenSnapshotState(taken: TakenSnapshot): TakeSnapshotState {
  return { ...initialFormState(EMPTY_SNAPSHOT_FIELDS), taken };
}

/** Validation refused the submission. Nothing was recorded. */
export function rejectedSnapshotState(
  fields: SnapshotFormFields,
  errors: FieldErrors<SnapshotFieldName>,
): TakeSnapshotState {
  return { ...rejectedFormState(fields, errors), taken: null };
}

/** The submission was good and nothing was recorded anyway. */
export function failedSnapshotState(
  fields: SnapshotFormFields,
  formError: string,
): TakeSnapshotState {
  return { ...failedFormState(fields, formError), taken: null };
}

/**
 * The things that can stop a snapshot that the form itself cannot see.
 *
 * Each one is reachable from a page that was right when it rendered, so each
 * says what to do rather than only what went wrong.
 *
 * `emptyScope` is the one a reader will actually meet: the button is not
 * rendered on a project with no deliverables, so getting here means the last
 * line was deleted in another tab while this page sat open.
 */
export const SNAPSHOT_PROBLEMS = {
  emptyScope:
    "There is nothing to record yet — a snapshot is a copy of this project's deliverables, and it has none. Add the first line above and this becomes a one-press job.",
  missingProject:
    "That project no longer exists, so there is no scope list to record.",
  unrecordableScope:
    "A deliverable on this project has an estimate that is not a whole number of minutes, which a snapshot cannot record. Open that line, give it an estimate in hours, and try again.",
  unrecordableValue:
    "This project's contract value is not an amount a snapshot can record. Open the project's edit form, correct the amount, and try again.",
  failed: "Could not record that snapshot. Nothing was written — try again.",
} as const;

/**
 * What to say when the press never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was recorded, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the snapshot already written. Nor does it say "try
 * again", which is the instruction that would take two snapshots of the same
 * moment.
 */
export const SNAPSHOT_NO_ANSWER =
  "Could not tell whether that snapshot was recorded — the answer never arrived. Reload and check the list of snapshots before pressing again.";

/**
 * What to say after a snapshot is taken, or null when there is nothing to say.
 *
 * The press changes nothing a reader can see: the scope list above is
 * untouched, which is the whole point of a record. So the sentence has to
 * carry the whole result — how many lines went into it, and what it was filed
 * under, which is how it will be found in the picker a month from now.
 *
 * An unlabelled snapshot is described by what it is rather than by a label it
 * does not have. "Recorded a snapshot of 9 deliverables" is true and findable;
 * "Recorded “”" is neither.
 */
export function takenSnapshotNotice(state: TakeSnapshotState): string | null {
  if (state.taken === null) return null;

  const { label, lineCount } = state.taken;
  const lines =
    lineCount === 1 ? "one deliverable" : `${lineCount} deliverables`;
  const of = `a snapshot of this project's ${lines}`;
  return label === null
    ? `Recorded ${of}, dated today.`
    : `Recorded ${of} as “${label}”.`;
}
