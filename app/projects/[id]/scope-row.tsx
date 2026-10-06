import type { ReactNode } from "react";

/**
 * The shell one line of a scope list sits in, whether it is being read or
 * edited.
 *
 * It exists so the two cannot drift. A row that unfolds into a form has to keep
 * the same rule above it, the same padding, and the same width as the lines
 * around it — otherwise opening an editor makes the list jump, and the eight
 * lines the reader was comparing stop lining up.
 *
 * `items-baseline` is what aligns the position number with the first line of
 * the title rather than with the middle of a row that may be three lines tall.
 * It is wrong for a row holding a form, which is why the editor passes
 * `align="start"`.
 */
export function ScopeRow({
  align = "baseline",
  children,
}: {
  /** How the row's contents line up: a line of text, or a form. */
  align?: "baseline" | "start";
  children: ReactNode;
}) {
  return (
    <li
      className={`flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-100 py-3 dark:border-zinc-900 ${
        align === "baseline" ? "items-baseline" : "items-start"
      }`}
    >
      {children}
    </li>
  );
}
