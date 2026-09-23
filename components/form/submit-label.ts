/**
 * What a submit button says, and what it is called.
 *
 * Both are small enough to inline and neither is obvious enough to trust: the
 * visible label changes under the button while the form is in flight, and the
 * accessible name has to follow it rather than freeze on the idle wording.
 */

/** "Save client" at rest, "Saving…" once the form is on its way. */
export function submitLabel(
  label: string,
  pendingLabel: string,
  pending: boolean,
): string {
  return pending ? pendingLabel : label;
}

/**
 * The accessible name for a button whose meaning comes from the row it sits
 * in. A column of "Restore" buttons is one repeated control to anyone who
 * cannot see which line they are on; naming the subject makes each one
 * "Restore Ada Lovelace" without widening the column.
 *
 * Undefined when there is no subject, so the button keeps its visible text as
 * its name — the default, and the right one for a button that stands alone.
 */
export function submitAriaLabel(
  label: string,
  subject: string | undefined,
): string | undefined {
  const named = subject?.trim() ?? "";
  if (named === "") return undefined;
  return `${label} ${named}`;
}
