/**
 * One of the small controls on a line of a scope list.
 *
 * A submit button rather than something with an `onClick`, because the row is a
 * form: the press has to say which deliverable it was aimed at and what it
 * asked for, and a button's own name and value is how a browser says that.
 *
 * It is deliberately not `SubmitButton`. That one disables itself while the
 * form is in flight, which is right for a save — an impatient second press
 * creates a second client. Here it would be wrong twice over: the list has
 * already moved, so there is nothing to wait for, and rearranging a list is
 * done in runs. Lifting a deliverable from fifth to first is four presses in
 * under a second, and a control that greyed out between them would drop three.
 *
 * Quiet by design. Each line of the list may carry three of these, and they are
 * not what the page is for — the scope is. They have to be reachable without
 * being the loudest thing in the row.
 */
export function ScopeButton({
  name,
  value,
  label,
  disabled = false,
  children,
}: {
  /** The field this press contributes, which is how the action reads it. */
  name: string;
  value: string;
  /**
   * The accessible name, which carries the deliverable's title: a column of
   * buttons reading "Up" is one control repeated to anyone who cannot see
   * which line they are on.
   */
  label: string;
  /** For a move the list cannot make — the first line cannot go up. */
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={disabled}
      aria-label={label}
      className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-500 hover:text-zinc-900 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:text-zinc-400 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100 dark:disabled:border-zinc-800 dark:disabled:text-zinc-600"
    >
      {children}
    </button>
  );
}
