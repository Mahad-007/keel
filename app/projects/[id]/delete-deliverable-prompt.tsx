import { SCOPE_FIELD_NAMES } from "@/lib/deliverables/arrange";
import {
  confirmDeleteId,
  confirmDeleteLabel,
  DELETE_CONFIRM_VALUE,
  deletePromptId,
  describeDeletion,
  keepDeliverableLabel,
} from "@/lib/deliverables/remove";

/**
 * The step in front of deleting a line of a scope list.
 *
 * It sits in the row, under the line it is about to remove, so the reader can
 * read both at once — which is the thing `window.confirm` cannot do. A browser
 * dialogue is a modal interruption carrying one unstyled string, suppressible
 * by a browser that has decided this page shows too many of them, and it hides
 * the very row it is asking about behind itself.
 *
 * Two buttons, neither of them a default: the one that deletes is marked as the
 * destructive one and is not visually the primary action on the page. Keeping is
 * the way out, and it reads as a sentence about the deliverable rather than as
 * "Cancel", which is a word about the dialogue.
 *
 * The cursor lands on *Keep it*, which is the one decision in this component
 * worth arguing about. The step is opened by pressing a button, and a button is
 * pressed with Enter or Space — a held key, a doubled press, or the habit of
 * confirming everything with Enter would then land on whatever has the focus. If
 * that were the deleting button the step would be a formality that fires itself,
 * which is exactly the failure mode of the dialogue it replaces. So the safe
 * answer takes the focus and the destructive one is a deliberate reach.
 */
export function DeleteDeliverablePrompt({
  id,
  title,
  estimatedMinutes,
  confirm,
  onKeep,
}: {
  id: string;
  title: string;
  /** In the sentence, because it is what comes off the project's scope. */
  estimatedMinutes: number;
  /**
   * What to do with the confirming press. The list reads it, takes the line out
   * on screen and sends the write — the same handler the row's other controls
   * submit to, so a deletion is queued behind a move the reader made a moment
   * earlier rather than racing it.
   */
  confirm: (formData: FormData) => void;
  /** The reader is keeping the deliverable. Nothing was written. */
  onKeep: () => void;
}) {
  return (
    /*
      Named by its own question, so a reader arriving here from the Delete
      button is told what they are being asked rather than finding two unlabelled
      buttons. `aria-labelledby` rather than a repeated `aria-label`: the
      sentence is already on screen, and two copies of it drift.
    */
    <form
      action={confirm}
      aria-labelledby={deletePromptId(id)}
      className="mt-2 w-full rounded border border-amber-300 bg-amber-50 px-3 py-2.5 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <input type="hidden" name={SCOPE_FIELD_NAMES.id} value={id} />
      <p
        id={deletePromptId(id)}
        className="max-w-prose text-sm leading-6 text-amber-900 dark:text-amber-100"
      >
        {describeDeletion(title, estimatedMinutes)}
      </p>
      <div className="mt-2.5 flex flex-wrap items-center gap-3">
        {/*
          A submit carrying its own name and value, which is how the list knows
          a deletion was confirmed: the field only exists on this button, so no
          other press and no form submitted another way can produce one.
        */}
        <button
          type="submit"
          id={confirmDeleteId(id)}
          name={SCOPE_FIELD_NAMES.remove}
          value={DELETE_CONFIRM_VALUE}
          aria-label={confirmDeleteLabel(title)}
          aria-describedby={deletePromptId(id)}
          className="rounded bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-800 dark:hover:bg-red-700"
        >
          Delete
        </button>
        <button
          type="button"
          autoFocus
          onClick={onKeep}
          aria-label={keepDeliverableLabel(title)}
          aria-describedby={deletePromptId(id)}
          className="text-sm text-amber-900 underline underline-offset-4 hover:text-amber-950 dark:text-amber-100 dark:hover:text-white"
        >
          Keep it
        </button>
      </div>
    </form>
  );
}
