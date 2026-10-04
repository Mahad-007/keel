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

const SHAPE = "rounded border px-2 py-1 text-xs font-medium";

const AVAILABLE =
  "border-zinc-300 text-zinc-700 hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100";

const UNAVAILABLE =
  "cursor-not-allowed border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600";

export function ScopeButton({
  name,
  value,
  label,
  unavailable = false,
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
  unavailable?: boolean;
  children: string;
}) {
  return (
    /*
      `aria-disabled` rather than `disabled`, which is the difference between a
      control that cannot act and one that is not there. A disabled button is
      dropped from the tab order the moment it is disabled — so pressing Up
      until a line reaches the top takes the focus off the button with it, and a
      reader working by keyboard is suddenly at the top of the document with no
      idea where they were. This one keeps the focus, keeps the name, and the
      press it reports is one the list knows changes nothing and answers with a
      sentence saying so.
    */
    <button
      type="submit"
      name={name}
      value={value}
      aria-label={label}
      aria-disabled={unavailable || undefined}
      className={`${SHAPE} ${unavailable ? UNAVAILABLE : AVAILABLE}`}
    >
      {children}
    </button>
  );
}
