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
import { formatMinutes } from "@/lib/minutes";

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

/**
 * What to say out loud once an entry is gone.
 *
 * The row vanishes from under the reader with no page load, which on screen is
 * obvious and to anyone working from a screen reader is silence: removing a
 * node announces nothing, and the focus that was on the Delete button is now
 * on nothing at all. So the deletion gets a sentence.
 *
 * It counts what is left in minutes rather than in entries, which is where
 * this parts company with the scope list's version. A scope list is a list of
 * things and "three deliverables left" is the fact a reader has lost the
 * ability to check; a time list is a list of minutes, and the figure the whole
 * page is for is the total. Being told "nine entries left" after deleting a
 * mis-typed forty hours would be the one number that does not answer the
 * question the deletion was about.
 */
export function deletedTimeAnnouncement(
  name: string,
  remainingMinutes: number,
): string {
  if (remainingMinutes <= 0) {
    return `Deleted ${name}. No time is logged against this project now.`;
  }
  return `Deleted ${name}. ${formatMinutes(remainingMinutes)} left on this project.`;
}

/**
 * What a deletion hands back: nothing to say, or the one sentence worth saying
 * about why the entry is still there.
 *
 * Not a form state, because a press is not a form being filled in. There is no
 * field to put a message under and nothing the reader typed to render back —
 * the entry either went or it did not, and if it did not, the list on screen
 * has already put it back. The sentence is there to explain that.
 */
export type TimeWriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly problem: string };

/** The write landed. The revalidated page is the rest of the answer. */
export const TIME_WRITE_DONE: TimeWriteResult = { ok: true };

export function timeWriteProblem(problem: string): TimeWriteResult {
  return { ok: false, problem };
}

/**
 * The sentences a refused deletion comes back with.
 *
 * Each says what to do next, because "something went wrong" leaves a reader
 * pressing the same button again.
 *
 * `billed` is the one that no press will ever get past, and it is the reason
 * the step is offered on a billed row at all rather than the controls simply
 * being absent: the row *does* hide its controls, so reaching this means the
 * invoice arrived while the step was open. That reader pressed Delete on an
 * entry that was deletable a second ago, and they are owed the explanation
 * rather than a row that silently refuses to go.
 */
export const DELETE_TIME_PROBLEMS = {
  /** The entry is gone, or belongs to a project this page is not showing. */
  missing:
    "That entry is not on this project any more, so nothing was deleted. Reload to see what this project has logged.",
  /** An invoice has billed it since the page was drawn. */
  billed:
    "An invoice has billed that time, so it cannot be deleted. A credit note frees the entry, after which it can be removed.",
  /** The write itself failed — the driver, the disk, the network. */
  failed: "Could not delete that entry. Nothing was written — try again.",
} as const;

/**
 * What to say about a deletion whose answer never arrived.
 *
 * It does not claim either way, because from here there is no way to know: the
 * request may have been lost on the way out, or the answer lost on the way back
 * with the row already gone. Reloading is the only honest instruction — the
 * server knows, and the page can go and ask it.
 */
export const DELETE_TIME_NO_ANSWER =
  "Could not tell whether that entry was deleted — the answer never arrived. Reload to see what this project has logged.";

/**
 * The list as it reads once a deletion has been asked for.
 *
 * It exists because the list on screen has to change before the server has
 * agreed to it. A row that waited for the round trip would sit there for a
 * beat after the reader confirmed, which on the one press that cannot be taken
 * back is the worst place in the app to leave somebody unsure whether it
 * worked.
 *
 * Pure, and the same function the day totals are then recomputed from, so the
 * figures in the headings cannot disagree with the rows under them while the
 * write is in flight. React drops the change when the action settles, so a
 * deletion the server refuses rolls back on its own.
 *
 * An entry the list does not have leaves it alone, which is the honest answer
 * to a press made on a page that has since moved on.
 */
export function timeListWithout<T extends { readonly id: string }>(
  entries: readonly T[],
  id: string,
): readonly T[] {
  return entries.filter((entry) => entry.id !== id);
}
