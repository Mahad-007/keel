/**
 * Deleting one entry from a time list, and the step in front of it.
 *
 * A time entry is deleted outright. There is no archive for one and there
 * should not be: a stretch of work that happened and should not be charged for
 * is a non-chargeable entry, which keeps the record, the attribution and the
 * minutes. What is left to delete is a mistake — the wrong project, the
 * duplicate of a double-pressed button, the forty minutes typed as forty
 * hours — and keeping those is how a time list stops being read.
 *
 * So the press is asked for twice, and the step that asks is a sentence and
 * two buttons rendered in the row rather than a `window.confirm`. The reasons
 * are the ones written out in `lib/deliverables/remove.ts`: a browser dialogue
 * cannot say what is being deleted, it is suppressible, and it hides the row
 * it is asking about behind itself.
 */

import { readField } from "@/lib/forms/form-data";

/** The control that asks for the deletion, which only opens the step below. */
export function deleteTimeButtonLabel(name: string): string {
  return `Delete ${name}`;
}

/**
 * The control that actually deletes, named so that it cannot be mistaken for
 * the one that opened the step. Both are in the document at once — the row's
 * controls stay put while the step is open — and the same words twice over
 * would be two identical buttons to anyone reading the row aloud.
 */
export function confirmDeleteTimeLabel(name: string): string {
  return `Delete ${name} from this project's time`;
}

/**
 * The way out. Named as what it does rather than as "cancel", which is a word
 * about the dialogue instead of about the entry.
 */
export function keepTimeEntryLabel(name: string): string {
  return `Keep ${name}`;
}

/**
 * What the step says, which is the whole reason it is not `window.confirm`.
 *
 * It names the entry, says the record goes with it, and — for chargeable
 * time — offers the thing the reader probably meant. That last clause is the
 * one worth arguing for: by far the most common reason to delete a logged hour
 * is that it should not be charged for, and the answer to that is the
 * chargeable flag, which keeps the work on the record and off the invoice.
 * Deleting it instead loses the only evidence the engagement cost what it did.
 *
 * It is left out for an entry already marked non-chargeable, because then
 * there is nothing to offer: the reader has already done it, and a page that
 * suggests it anyway reads as a page that has not looked at the row.
 */
export function describeTimeDeletion(name: string, billable: boolean): string {
  const question = `Delete ${name}? The record of the work goes with it, and this cannot be undone.`;
  if (!billable) return question;
  return `${question} If the time was worked but should not be charged for, untick Chargeable instead — that keeps it on the project and off the invoice.`;
}

/**
 * The ids the step and the row's own button are known by.
 *
 * Derived from the entry rather than generated, because they are needed from
 * outside the components that render them: opening the step moves the cursor
 * into it, and closing it has to put the cursor back on the button that opened
 * it. Neither is a thing a parent can do by holding a ref — the step is not
 * mounted when the press happens, and the button is unmounted again by the
 * time the step closes on a stale list.
 *
 * Prefixed with what they belong to, the same as the edit button's, so a page
 * holding both lists cannot have a scope row and a time row claim one id.
 */
export function timeDeletePromptId(id: string): string {
  return `time-${id}-delete-prompt`;
}

/** The button inside the step, which the cursor moves to when it opens. */
export function confirmDeleteTimeId(id: string): string {
  return `time-${id}-delete-confirm`;
}

/** The button in the row that opens the step, and takes the cursor back. */
export function deleteTimeButtonId(id: string): string {
  return `time-${id}-delete`;
}

/**
 * The names the step's form submits under.
 *
 * `id` is the same word the edit form uses, deliberately: both answer the
 * question "which entry is this about?", and there is no reason for a reader
 * of either to learn a second word for it. They are separate forms, so there
 * is nothing to collide.
 *
 * `remove` exists only on the confirming button, which is what makes a
 * deletion impossible to arrive at by accident: no other press on the page
 * produces the field, so a submission carrying it came from the step.
 */
export const DELETE_TIME_FIELD_NAMES = { id: "id", remove: "remove" } as const;

/**
 * What the confirming button submits, which only has to be something: the
 * reader below treats any non-empty value as "delete this", because the
 * field's presence is the whole message.
 */
export const DELETE_TIME_CONFIRM_VALUE = "yes";

/**
 * Which entry a confirmed deletion was aimed at, or null if the submission
 * does not describe one.
 *
 * Null rather than a thrown error, because every cause is the same kind of
 * thing — a form submitted some other way, a step whose row has gone, a
 * submission with no id in it. There is nothing for the reader to fix and
 * nothing to tell them: the honest response to a press that says nothing is to
 * do nothing.
 *
 * The confirming field is checked as well as the id, so a form that carries
 * only an entry id cannot delete anything. That matters more here than on the
 * scope tab, where the row's own controls share a form with the step: here the
 * step is the only form a row has, and without this check every field in it
 * would be a deletion waiting to happen.
 */
export function readTimeDeletion(formData: FormData): string | null {
  const id = readField(formData, DELETE_TIME_FIELD_NAMES.id).trim();
  if (id === "") return null;
  if (readField(formData, DELETE_TIME_FIELD_NAMES.remove) === "") return null;
  return id;
}
