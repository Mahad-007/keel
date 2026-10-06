import type { DeliverablePatch } from "@/lib/data/deliverables";
import type { Deliverable } from "@/lib/db/schema";
import { readField } from "@/lib/forms/form-data";
import type { FieldErrors } from "@/lib/forms/result";
import {
  failedFormState,
  initialFormState,
  rejectedFormState,
} from "@/lib/forms/state";

import {
  deliverableFormFields,
  type DeliverableFieldName,
  type DeliverableFormValue,
  type DeliverableFormFields,
  type DeliverableFormState,
} from "./form";

/**
 * Editing one line of a scope list: what the form holds, and what it hands
 * back.
 *
 * The validation is not here — it is `parseDeliverableForm`, the same function
 * the add line uses, because a title the add refuses is a title an edit must
 * refuse too. What is here is everything an edit needs that an add does not: a
 * form that starts from a stored row, a way of saying which row a submission
 * was aimed at, and an answer that lets the row close itself once the write
 * lands.
 */

/**
 * What a landed edit tells the page.
 *
 * The id, because the row that was editing has to know the answer was its own:
 * a scope list can have several rows and only one of them should close.
 *
 * The title as *saved*, which is not always the title the form was opened with
 * — that is the point of an edit — and is what the sentence said out loud
 * afterwards has to name.
 *
 * `changed` because a form opened and saved untouched is a real thing a reader
 * does, and it deserves a different sentence from one that wrote something.
 * Telling somebody their change was saved when there was no change is a small
 * lie that makes every other confirmation less believable.
 */
export type EditedDeliverable = {
  readonly id: string;
  readonly title: string;
  readonly changed: boolean;
};

/**
 * A form state plus what landed, the same shape the add line uses and for the
 * same reason: an edit in a row does not navigate. The reader is looking at the
 * list they are editing, so there is nowhere to redirect to and the row has to
 * learn from the state that it may close.
 */
export type EditDeliverableState = DeliverableFormState & {
  readonly saved: EditedDeliverable | null;
};

/**
 * What the form starts from: the stored line, nothing wrong with it yet. A
 * function rather than a constant, because unlike a blank add line an edit form
 * is different every time it opens.
 */
export function editDeliverableState(
  deliverable: Deliverable,
): EditDeliverableState {
  const fields = deliverableFormFields(deliverable);
  return { ...initialFormState(fields), saved: null };
}

/**
 * Saving a deliverable, with the project already bound by the page that served
 * the list — the same arrangement as the add line and the presses.
 *
 * The deliverable's id is *not* bound. One action serves every row, and which
 * row a submission was aimed at is what the submission says; the project is
 * what the page says, and the write checks that the two agree. Binding the id
 * instead would make it look protected while a `.bind` in a client component
 * serialises it in the clear anyway.
 */
export type EditDeliverableAction = (
  previous: EditDeliverableState,
  formData: FormData,
) => Promise<EditDeliverableState>;

/**
 * The edit landed. The fields come back as the row now reads rather than as
 * they were submitted, so a form that stays open after a save — one the reader
 * reopens, or one whose close is still a render away — shows the saved line
 * and not an untrimmed copy of what they typed.
 */
export function savedEditState(
  saved: EditedDeliverable,
  fields: DeliverableFormFields,
): EditDeliverableState {
  return { ...initialFormState(fields), saved };
}

/**
 * Validation refused the submission. Nothing was written, and the row stays
 * open holding exactly what was typed: an edit form that closed on a rejection
 * would throw away the work and leave the reader to find the line again.
 */
export function rejectedEditState(
  fields: DeliverableFormFields,
  errors: FieldErrors<DeliverableFieldName>,
): EditDeliverableState {
  return { ...rejectedFormState(fields, errors), saved: null };
}

/** The submission was good and could not be saved. */
export function failedEditState(
  fields: DeliverableFormFields,
  formError: string,
): EditDeliverableState {
  return { ...failedFormState(fields, formError), saved: null };
}

/**
 * What the submitted form actually changes about the stored row — only the
 * columns whose value is different.
 *
 * A patch of every field would also work: the data layer writes what it is
 * given and the row would end up the same. What it would not leave the same is
 * `updatedAt`, which a write bumps. Opening a deliverable to read the detail
 * and pressing Save would then mark it as edited this morning, and a scope list
 * where every line claims to have changed today tells the reader nothing about
 * which one actually did.
 *
 * An empty patch is therefore meaningful rather than a degenerate case: it is
 * how the write knows there is nothing to do and the row can say so.
 */
export function deliverableChanges(
  before: Deliverable,
  value: DeliverableFormValue,
): DeliverablePatch {
  /*
    The two optional fields are read through their absent value rather than
    compared as they arrive. Both are optional on the input type because adding
    a deliverable may leave them out, and leaving them out means the same thing
    the form's empty box means — no detail, nothing estimated. Comparing an
    absent key against the column directly would put `undefined` in the patch,
    which the data layer skips and this file would still count as a change.
  */
  const description = value.description ?? null;
  const estimatedMinutes = value.estimatedMinutes ?? 0;

  const patch: DeliverablePatch = {};
  if (value.title !== before.title) patch.title = value.title;
  if (description !== before.description) patch.description = description;
  if (estimatedMinutes !== before.estimatedMinutes) {
    patch.estimatedMinutes = estimatedMinutes;
  }
  return patch;
}

/** Whether a submitted form asks for any change at all. */
export function changesDeliverable(patch: DeliverablePatch): boolean {
  return Object.keys(patch).length > 0;
}

/**
 * What to say once an edit lands, which the reader may otherwise not notice at
 * all: the row closes back into a line of the list, and a line that now reads
 * slightly differently is not an event anybody is told about.
 *
 * Two sentences, because there are two things that can have happened. A save
 * that wrote something names the line and says so. A save that wrote nothing
 * says *that*, because the alternative — "Saved" over a row nothing happened to
 * — is the kind of confirmation that teaches people not to read confirmations.
 */
export function savedNotice(state: EditDeliverableState): string | null {
  if (state.saved === null) return null;
  if (!state.saved.changed) {
    return `No changes to save — “${state.saved.title}” is as it was.`;
  }
  return `Saved “${state.saved.title}”.`;
}

/**
 * What to say when an edit never got an answer — the connection dropped, the
 * tab was suspended mid-request, the request was aborted.
 *
 * It does not say nothing was written, because from here there is no way to
 * know: the request may have been lost on the way out, or the answer lost on
 * the way back with the row already saved. Unlike the add line it can safely
 * suggest trying again — saving the same edit twice writes the same row, where
 * adding the same deliverable twice makes two of them — but reloading is the
 * instruction that answers the question, because the list is what the server
 * says.
 */
export const EDIT_NO_ANSWER =
  "Could not tell whether that edit was saved — the answer never arrived. Reload to see what the scope list says now.";

/**
 * The field an edit submission names its row in.
 *
 * Written down once because it is read in two places that cannot see each
 * other: the hidden input in the form, and the write that reads it. A typo in
 * one of them compiles and makes every save fail as though the row were gone.
 *
 * The same name the row's controls use, which is deliberate — both answer the
 * question "which deliverable is this press about?" and there is no reason for
 * a reader of either to learn a second word for it.
 */
export const EDIT_FIELD_NAMES = { id: "id" } as const;

/**
 * Which deliverable a submission was aimed at, or the empty string if it did
 * not say.
 *
 * Trimmed, because an id is matched against a stored one and whitespace around
 * it is not a different row. Empty is left for the caller to refuse: the write
 * answers it with the same sentence it answers an unknown id with, since from
 * the reader's side both mean the line is not there to save.
 */
export function readEditId(formData: FormData): string {
  return readField(formData, EDIT_FIELD_NAMES.id).trim();
}

/**
 * What the control that opens an edit is called.
 *
 * The title is in the name for the same reason it is in the move buttons': a
 * scope list of eight lines holds eight buttons saying "Edit", and to anyone
 * who cannot see which line they are on that is one control repeated.
 */
export function editButtonLabel(title: string): string {
  return `Edit “${title}”`;
}

/**
 * What the open editor is called, which is not the same as the button that
 * opened it: the form replaces the line, so a reader arriving in it needs to be
 * told which line they are now inside.
 */
export function editFormLabel(title: string): string {
  return `Editing “${title}”`;
}

/** The way out of an open editor without writing anything. */
export function cancelEditLabel(title: string): string {
  return `Stop editing “${title}”`;
}
