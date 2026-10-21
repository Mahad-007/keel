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
