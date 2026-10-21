import type { ReactNode } from "react";

/**
 * The shell one entry of a time list sits in, whether it is being read or
 * edited.
 *
 * It exists so the two cannot drift. A row that unfolds into a form has to
 * keep the same rule above it, the same padding and the same width as the rows
 * around it — otherwise opening an editor makes the list jump and the column
 * of durations the reader was scanning stops lining up.
 *
 * `items-baseline` is what puts the duration on the same line as the first
 * line of the note rather than in the middle of a row that may be three lines
 * tall. It is wrong for a row holding a form, which is why the editor passes
 * `align="start"`.
 */
export function TimeRow({
  align = "baseline",
  children,
}: {
  /** How the row's contents line up: a line of text, or a form. */
  align?: "baseline" | "start";
  children: ReactNode;
}) {
  return (
    <li
      className={`flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-100 py-2.5 last:border-b-0 dark:border-zinc-900 ${
        align === "baseline" ? "items-baseline" : "items-start"
      }`}
    >
      {children}
    </li>
  );
}
