import type { TimeEntryPatch } from "@/lib/data/time-entries";
import type { FieldErrors } from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
} from "@/lib/forms/state";
import { formatMinutes } from "@/lib/minutes";

import type { ListedTimeEntry } from "./entry";
import {
  BILLABLE_VALUE,
  type LogTimeFieldName,
  type LogTimeFormFields,
  type LogTimeFormState,
  type LogTimeFormValue,
} from "./form";

/**
 * Editing a stretch of work already logged: what the form opens holding, and
 * what it hands back.
 *
 * The validation is not here. It is `parseLogTimeForm`, the same function the
 * log line uses, because a duration the log refuses is a duration an edit must
 * refuse too — and because the fields are rendered by the same component, so a
 * second validator would be a second set of rules behind one set of hints.
 *
 * What is here is everything an edit needs that logging does not: a form that
 * starts from a stored row, a way of saying which row a submission was aimed
 * at, the patch that is only the columns that actually moved, and an answer
 * that lets the row close itself once the write lands.
 */

/**
 * The stored entry as the form's five boxes.
 *
 * The duration goes in as `formatMinutes` writes it — `1h 30m`, `45m`, `2h` —
 * and that is a round trip rather than a coincidence: `parseDuration` strips
 * whitespace and reads both units, so every string this produces parses back
 * to the minutes it came from. Which is the property an edit form lives or
 * dies by. A reader who opens an entry, changes the note and saves must not
 * find the duration rewritten underneath them, and a prefill that did not
 * round-trip would do exactly that on every save.
 *
 * `90` would round-trip too, and is worse to be handed: the field accepts a
 * bare number as minutes, so an entry of six hours would open showing `360`
 * and a reader correcting it to `6.5` would log six and a half minutes. The
 * written form is unambiguous in the box as well as to the parser.
 *
 * The chargeable box carries the value a ticked checkbox submits, or nothing.
 * A checkbox has no third state, and `readsAsBillable` reads anything that is
 * not the exact value as unticked — so blank is how this says "not chargeable"
 * in the same words the browser would.
 */
export function timeEntryFormFields(
  entry: ListedTimeEntry,
): LogTimeFormFields {
  return {
    duration: formatMinutes(entry.minutes),
    workedOn: entry.workedOn,
    deliverable: entry.deliverableId ?? "",
    note: entry.note ?? "",
    billable: entry.billable ? BILLABLE_VALUE : "",
  };
}

/**
 * What a landed edit tells the page.
 *
 * The id, because the row that was editing has to know the answer is its own:
 * a time list can be forty rows long and only one of them should close.
 *
 * The name as *saved*, which is not the name the form was opened with — that
 * is the point of an edit — and is what the sentence said out loud afterwards
 * has to use. Named rather than carried as five columns, because an entry has
 * no title and `entryName` is the one place that decides how one is referred
 * to; two spellings of that would mean the row and the confirmation calling
 * the same entry different things.
 *
 * `changed` because a form opened and saved untouched is a real thing a reader
 * does, and it deserves a different sentence from one that wrote something.
 * Telling somebody their change was saved when there was no change is a small
 * lie that makes every other confirmation less believable.
 */
export type SavedTimeEntry = {
  readonly id: string;
  readonly name: string;
  readonly changed: boolean;
};

/**
 * A form state plus what landed, the same shape the log line uses and for the
 * same reason: an edit in a row does not navigate. The reader is looking at
 * the list they are editing, so there is nowhere to redirect to and the row
 * has to learn from the state that it may close.
 */
export type EditTimeState = LogTimeFormState & {
  readonly saved: SavedTimeEntry | null;
};

/**
 * What the form starts from: the stored entry, nothing wrong with it yet.
 *
 * A function rather than a constant, because unlike the blank log line an
 * edit form is different every time it opens.
 */
export function editTimeState(entry: ListedTimeEntry): EditTimeState {
  return { ...initialFormState(timeEntryFormFields(entry)), saved: null };
}

/**
 * The edit landed. The fields come back as the row now reads rather than as
 * they were submitted, so a form that stays open after a save — one the reader
 * reopens, or one whose close is still a render away — shows the saved entry
 * and not an untrimmed copy of what they typed.
 */
export function savedTimeState(
  saved: SavedTimeEntry,
  fields: LogTimeFormFields,
): EditTimeState {
  return { ...initialFormState(fields), saved };
}

/**
 * Validation refused the submission. Nothing was written, and the row stays
 * open holding exactly what was typed: an edit form that closed on a rejection
 * would throw away the work and leave the reader to find the entry again in a
 * list of forty.
 */
export function rejectedTimeEditState(
  fields: LogTimeFormFields,
  errors: FieldErrors<LogTimeFieldName>,
): EditTimeState {
  return { ...rejectedFormState(fields, errors), saved: null };
}

/** The submission was good and nothing was written anyway. */
export function failedTimeEditState(
  fields: LogTimeFormFields,
  formError: string,
): EditTimeState {
  return { ...failedFormState(fields, formError), saved: null };
}

/**
 * What the submitted form actually changes about the stored entry — only the
 * columns whose value is different.
 *
 * A patch of all five fields would also work: the data layer writes what it is
 * given and the row would end up the same. Two things would not be the same.
 * `updatedAt`, which a write bumps — so opening an entry to read the note and
 * pressing Save would mark it as edited this morning, and a list where every
 * row claims to have changed today cannot say which one did. And the billed
 * check, which refuses a patch naming any column an invoice copied a figure
 * out of: a patch of everything would refuse every save on a billed entry,
 * including one that changes nothing.
 *
 * An empty patch is therefore meaningful rather than a degenerate case: it is
 * how the write knows there is nothing to do and the row can say so.
 */
export function timeEntryChanges(
  before: ListedTimeEntry,
  value: LogTimeFormValue,
): TimeEntryPatch {
  /*
    The three optional fields are read through their absent value rather than
    compared as they arrive. All three are optional on the input type because
    logging time may leave them out, and leaving one out means what the form's
    empty box means: no note, no attribution, chargeable. Comparing an absent
    key against the column directly would put `undefined` in the patch, which
    the data layer skips and this file would still count as a change.
  */
  const note = value.note ?? null;
  const deliverableId = value.deliverableId ?? null;
  const billable = value.billable ?? true;

  const patch: TimeEntryPatch = {};
  if (value.minutes !== before.minutes) patch.minutes = value.minutes;
  if (value.workedOn !== before.workedOn) patch.workedOn = value.workedOn;
  if (note !== before.note) patch.note = note;
  if (deliverableId !== before.deliverableId) {
    patch.deliverableId = deliverableId;
  }
  if (billable !== before.billable) patch.billable = billable;
  return patch;
}

/** Whether a submitted form asks for any change at all. */
export function changesTimeEntry(patch: TimeEntryPatch): boolean {
  return Object.keys(patch).length > 0;
}
