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
  position,
  children,
}: {
  /** How the row's contents line up: a line of text, or a form. */
  align?: "baseline" | "start";
  /**
   * Its place in the list as rendered, counting from one.
   *
   * Drawn here rather than left to the browser's list marker so that it lines
   * up with the one under it once the list reaches ten, and so that a row which
   * has unfolded into a form keeps the same left edge as the lines around it.
   *
   * Hidden from assistive technology, which already announces the position from
   * the `<ol>` — hearing "three" twice is worse than not hearing it at all.
   */
  position: number;
  children: ReactNode;
}) {
  return (
    <li
      className={`flex flex-wrap gap-x-4 gap-y-2 border-b border-zinc-100 py-3 dark:border-zinc-900 ${
        align === "baseline" ? "items-baseline" : "items-start"
      }`}
    >
      <span
        aria-hidden="true"
        className="w-5 shrink-0 text-right text-sm tabular-nums text-zinc-400 dark:text-zinc-500"
      >
        {position}
      </span>
      {children}
    </li>
  );
}
