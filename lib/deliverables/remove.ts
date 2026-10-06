import { describeEstimate, isEstimated } from "./list";

/**
 * Deleting one line of a scope list, and the step in front of it.
 *
 * A deliverable is deleted outright — there is no archive for one, because a
 * line that was really part of the engagement and is finished is `done`, and
 * one that was dropped is a scope change. What is left to delete is a line
 * typed by mistake, and nothing brings it back. So the press is asked for
 * twice.
 *
 * Not through `window.confirm`, and the reasons are worth writing down because
 * it is the obvious thing to reach for:
 *
 *   - It is a modal interruption the page cannot style, position or word
 *     beyond a single string, so it cannot say what the estimate was or where
 *     the line sat. "Are you sure?" with no detail is the dialogue people learn
 *     to dismiss without reading.
 *   - It blocks the main thread and is suppressible: a browser that has decided
 *     this page shows too many dialogues returns `false` without asking, which
 *     silently turns "delete" into "nothing happened".
 *   - It is unreachable from a server component and useless in a test — it has
 *     to be stubbed to assert anything, so what gets tested is the stub.
 *
 * The step here is a sentence and two buttons rendered in the row itself,
 * directly under the line being deleted. It costs one more press, it says what
 * will be lost, and the page it appears in is the page the reader was already
 * reading.
 */

/** The control that asks for the deletion, which only opens the step below. */
export function deleteButtonLabel(title: string): string {
  return `Delete “${title}”`;
}

/**
 * The control that actually deletes, named so that it cannot be mistaken for
 * the one that opened the step. Both are in the document at once — the row's
 * controls stay put while the prompt is open — and "Delete “Wireframes”" twice
 * over would be two identical buttons to anyone reading the controls aloud.
 */
export function confirmDeleteLabel(title: string): string {
  return `Delete “${title}” from the scope list`;
}

/** The way out. Named as what it does rather than as "cancel", which is a
 * word about the dialogue instead of about the deliverable. */
export function keepDeliverableLabel(title: string): string {
  return `Keep “${title}”`;
}

/**
 * What the step says, which is the whole reason it is not `window.confirm`.
 *
 * It names the line, the estimate that goes with it, and that nothing comes
 * back. The estimate is in the sentence because it is the part a reader cannot
 * see once the row is gone and the part that moves every scope figure on the
 * project — deleting a line sized at two days is a different act from deleting
 * one nobody has estimated.
 */
export function describeDeletion(
  title: string,
  estimatedMinutes: number,
): string {
  const estimate = isEstimated(estimatedMinutes)
    ? ` Its estimate of ${describeEstimate(estimatedMinutes)} comes off the project's scope with it.`
    : " It has no estimate, so no scope figure changes.";
  return `Delete “${title}”?${estimate} This cannot be undone.`;
}

/**
 * What to say out loud once a line is gone.
 *
 * The row vanishes from under the reader with no page load, which on screen is
 * obvious and to anyone working from a screen reader is silence: removing a
 * node announces nothing, and the focus that was on the Delete button is now on
 * nothing at all. So the deletion gets a sentence, and the sentence counts what
 * is left — the one fact the reader has lost the ability to check at a glance,
 * and the one that says the list did what it was told rather than more.
 */
export function deletedAnnouncement(title: string, remaining: number): string {
  if (remaining === 0) {
    return `Deleted “${title}”. The scope list is now empty.`;
  }
  if (remaining === 1) return `Deleted “${title}”. One deliverable left.`;
  return `Deleted “${title}”. ${remaining} deliverables left.`;
}
