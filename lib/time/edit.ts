import type { TimeEntryPatch } from "@/lib/data/time-entries";
import { readField } from "@/lib/forms/form-data";
import type { FieldErrors } from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
} from "@/lib/forms/state";
import { formatMinutes } from "@/lib/minutes";

import type { DeliverableOption } from "./attribution";
import { UNSHOWN_DELIVERABLE_LABEL, type ListedTimeEntry } from "./entry";
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

/**
 * What to say once an edit lands, which the reader may otherwise not notice at
 * all: the row closes back into a line of the list, and a line that now reads
 * slightly differently is not an event anybody is told about.
 *
 * Two sentences, because there are two things that can have happened. A save
 * that wrote something names the entry as it now stands — which is the only
 * way to confirm an edit to a thing with no title, since "Saved" over a list
 * of forty rows says nothing about which one. A save that wrote nothing says
 * *that*, because the alternative is the kind of confirmation that teaches
 * people not to read confirmations.
 */
export function savedTimeNotice(state: EditTimeState): string | null {
  if (state.saved === null) return null;
  if (!state.saved.changed) {
    return `No changes to save — that entry is as it was: ${state.saved.name}.`;
  }
  return `Saved ${state.saved.name}.`;
}

/**
 * The sentences a refused save comes back with, in the form that renders above
 * the fields rather than under one of them: none of them is about anything the
 * reader typed.
 *
 * Each one says what to do next, because "something went wrong" leaves a
 * reader pressing Save again. Three of these end in reloading — the page is
 * describing a list that has since moved on, and no amount of pressing will
 * make it describe the current one.
 *
 * `billed` is the one that cannot be fixed by reloading or retrying, and it is
 * the reason this set is longer than the scope tab's. An invoice has copied
 * the figure into a line somebody has been sent, so the edit will never be
 * accepted as it stands; the way out is a credit note, which is a different
 * act in a different place.
 */
export const EDIT_TIME_PROBLEMS = {
  /** The entry is gone, or belongs to a project this page is not showing. */
  missing:
    "That entry is not on this project any more, so nothing was saved. Reload to see what this project has logged.",
  /** An invoice has billed it, and the edit moves something it charged for. */
  billed:
    "An invoice has billed that time, so its duration, day, attribution and chargeable flag can no longer change. Nothing was saved. A credit note frees the entry, after which it can be edited again.",
  /** The line of scope was dropped while the form sat open. */
  missingDeliverable:
    "That deliverable is no longer on this project, so nothing was saved. Reload the page and pick again, or attribute the time to the project itself.",
  /** The write itself failed — the driver, the disk, the network. */
  failed: "Could not save that change. Nothing was written — try again.",
} as const;

/**
 * What the picker says when a save names a line the project does not have.
 *
 * The editor's own wording of `LOG_TIME_UNKNOWN_DELIVERABLE`, and the one
 * sentence of the shared validation that has to differ: the log line tells a
 * reader to log the time against the project instead, and there is nothing to
 * log here — the hour is already on the record, and what they are choosing is
 * what it counts against.
 *
 * It is a field error rather than one of `EDIT_TIME_PROBLEMS`, because it sits
 * beside the picker that is wrong and the reader's next act is in that
 * control. `EDIT_TIME_PROBLEMS.missingDeliverable` is the same situation found
 * a moment later, by the write rather than by the check, where there is no
 * field left to put a sentence under.
 *
 * Reachable from the editor and not from the log line, because the editor's
 * picker deliberately offers the entry's own attribution even when the
 * project's list does not hold it — see `editAttributionOptions`.
 */
export const EDIT_TIME_UNKNOWN_DELIVERABLE =
  "That deliverable is no longer on this project. Reload the page and pick again, or attribute the time to the project itself.";

/**
 * What to say when an edit never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not claim nothing was written, because from the client there is no
 * way to know: the request may have been lost on the way out, or the answer
 * lost on the way back with the row already saved. Unlike the log line it can
 * safely suggest reloading rather than warning against a retry — saving the
 * same edit twice writes the same row, where logging the same hour twice
 * writes two of them.
 */
export const EDIT_TIME_NO_ANSWER =
  "Could not tell whether that edit was saved — the answer never arrived. Reload to see what this project has logged.";

/**
 * What to say to a press the list would not act on because an editor is
 * waiting on a save.
 *
 * The press has to be refused — closing the editor would throw away both the
 * correction and the answer on its way back to it — and a control that does
 * nothing and says nothing is the worst version of that. On screen the Save
 * button reads "Saving…" and the refusal explains itself; to anyone working
 * from a screen reader, pressing Edit and getting silence is a page that has
 * stopped responding.
 *
 * It says to press again rather than to wait, because that is the act: the
 * hold lasts as long as one request and the same press works a moment later.
 */
export const EDIT_TIME_STILL_SAVING =
  "That edit is still saving, so nothing else can open yet. Press again in a moment.";

/**
 * Saving an entry, with the project and its scope list already captured by
 * the page that served the list.
 *
 * The entry's id is *not* captured. One action serves every row, and which row
 * a submission was aimed at is what the submission says; the project is what
 * the page says, and the write checks that the two agree. Capturing the id
 * instead would make it look protected while a `.bind` in a client component
 * serialises it in the clear anyway.
 */
export type EditTimeAction = (
  previous: EditTimeState,
  formData: FormData,
) => Promise<EditTimeState>;

/**
 * The field an edit submission names its row in.
 *
 * Written down once because it is read in two places that cannot see each
 * other: the hidden input in the form, and the write that reads it. A typo in
 * one of them compiles and makes every save fail as though the entry were
 * gone.
 */
export const EDIT_TIME_FIELD_NAMES = { id: "id" } as const;

/**
 * Which entry a submission was aimed at, or the empty string if it did not
 * say.
 *
 * Trimmed, because an id is matched against a stored one and whitespace around
 * it is not a different row. Empty is left for the caller to refuse: the write
 * answers it with the same sentence it answers an unknown id with, since from
 * the reader's side both mean the entry is not there to save.
 */
export function readTimeEntryId(formData: FormData): string {
  return readField(formData, EDIT_TIME_FIELD_NAMES.id).trim();
}

/**
 * What the control that opens an edit is called.
 *
 * The entry's name is in it for the reason every control in a list carries
 * one: forty rows hold forty buttons saying "Edit", and to anybody who cannot
 * see which row they are on that is one control repeated. An entry has no
 * title to use, so the name is built — see `entryName`.
 */
export function editTimeButtonLabel(name: string): string {
  return `Edit ${name}`;
}

/**
 * The id the control that opens an edit is known by.
 *
 * Needed from outside the row, because the cursor has to come back here when
 * an editor closes — and by then the button is being rendered again for the
 * first time, since the editor had replaced it. There is no ref to hold onto
 * across that, so the id is derived from the entry instead.
 *
 * Prefixed with what it belongs to, because the scope tab derives ids the same
 * way and both lists could one day be on one page. An entry id is unique, so
 * these cannot collide between rows.
 */
export function editTimeButtonId(id: string): string {
  return `time-${id}-edit`;
}

/**
 * What the open editor is called, which is not the same as the button that
 * opened it: the form replaces the row, so a reader arriving in it needs to be
 * told which entry they are now inside.
 */
export function editTimeFormLabel(name: string): string {
  return `Editing ${name}`;
}

/** The way out of an open editor without writing anything. */
export function cancelTimeEditLabel(name: string): string {
  return `Stop editing ${name}`;
}

/**
 * The lines an editor's picker offers, which is the project's list plus — if
 * the project's list does not hold it — the line this entry is already
 * attributed to.
 *
 * Without the extra option the picker would fall back to its placeholder, and
 * "no deliverable" is a real answer rather than an empty one: saving the form
 * untouched would then null an attribution nobody asked to remove, and the
 * only record of which line the hour went against would be gone.
 *
 * The extra option is deliberately one the validator refuses. It is not in the
 * list the write checks against, so a save keeps the selection and comes back
 * with the sentence beside the picker saying that line is no longer on the
 * project — which is the truth, and which leaves the reader to pick a line
 * that exists or move the time onto the project itself. Silence and a nulled
 * column would have been the alternative.
 *
 * Only reachable from a page whose two reads disagreed: deleting a deliverable
 * nulls the attribution through the foreign key, so an entry naming a line the
 * project does not have is one read a moment either side of that delete.
 */
export function editAttributionOptions(
  entry: Pick<ListedTimeEntry, "deliverableId">,
  options: readonly DeliverableOption[],
): readonly DeliverableOption[] {
  const { deliverableId } = entry;
  if (deliverableId === null) return options;
  if (options.some((option) => option.id === deliverableId)) return options;

  return [...options, { id: deliverableId, label: UNSHOWN_DELIVERABLE_LABEL }];
}
