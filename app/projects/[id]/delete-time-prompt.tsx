import {
  confirmDeleteTimeId,
  confirmDeleteTimeLabel,
  DELETE_TIME_CONFIRM_VALUE,
  DELETE_TIME_FIELD_NAMES,
  describeTimeDeletion,
  keepTimeEntryLabel,
  timeDeletePromptId,
} from "@/lib/time/remove";

/**
 * The step in front of deleting one entry from a time list.
 *
 * It sits in the row, under the entry it is about to remove, so the reader can
 * read both at once — which is the thing `window.confirm` cannot do. A browser
 * dialogue is a modal interruption carrying one unstyled string, suppressible
 * by a browser that has decided this page shows too many of them, and it hides
 * the very row it is asking about behind itself.
 *
 * Two buttons, neither of them a default: the one that deletes is marked as
 * the destructive one and is not visually the primary action on the page.
 * Keeping is the way out, and it reads as a sentence about the entry rather
 * than as "Cancel", which is a word about the dialogue.
 *
 * The cursor lands on *Keep it*, which is the one decision here worth arguing
 * about. The step is opened by pressing a button, and a button is pressed with
 * Enter or Space — a held key, a doubled press, or the habit of confirming
 * everything with Enter would then land on whatever has the focus. If that
 * were the deleting button the step would be a formality that fires itself,
 * which is exactly the failure mode of the dialogue it replaces.
 */
export function DeleteTimePrompt({
  id,
  name,
  billable,
  confirm,
  onKeep,
}: {
  id: string;
  /** The entry as the whole page names it — see `entryName`. */
  name: string;
  /**
   * Whether this time is chargeable, which decides whether the step offers the
   * checkbox instead. Unticking it is what a reader deleting a logged hour
   * usually meant, and offering it to somebody who has already done it reads
   * as a page that has not looked at the row.
   */
  billable: boolean;
  /**
   * What to do with the confirming press. The list reads it, takes the row out
   * on screen and sends the write.
   */
  confirm: (formData: FormData) => void;
  /** The reader is keeping the entry. Nothing was written. */
  onKeep: () => void;
}) {
  return (
    /*
      Named by its own question, so a reader arriving here from the Delete
      button is told what they are being asked rather than finding two
      unlabelled buttons. `aria-labelledby` rather than a repeated
      `aria-label`: the sentence is already on screen, and two copies drift.
    */
    <form
      action={confirm}
      aria-labelledby={timeDeletePromptId(id)}
      className="mt-2 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <input type="hidden" name={DELETE_TIME_FIELD_NAMES.id} value={id} />
      <p
        id={timeDeletePromptId(id)}
        className="max-w-prose text-sm leading-6 text-amber-900 dark:text-amber-100"
      >
        {describeTimeDeletion(name, billable)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {/*
          A submit carrying its own name and value, which is how the list knows
          a deletion was confirmed: the field only exists on this button, so no
          other press and no form submitted another way can produce one.
        */}
        <button
          type="submit"
          id={confirmDeleteTimeId(id)}
          name={DELETE_TIME_FIELD_NAMES.remove}
          value={DELETE_TIME_CONFIRM_VALUE}
          aria-label={confirmDeleteTimeLabel(name)}
          aria-describedby={timeDeletePromptId(id)}
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
        >
          Delete
        </button>
        <button
          type="button"
          autoFocus
          onClick={onKeep}
          aria-label={keepTimeEntryLabel(name)}
          aria-describedby={timeDeletePromptId(id)}
          className="text-sm text-amber-900 underline underline-offset-4 hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
