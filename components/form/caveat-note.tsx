import type { ReactNode } from "react";

/**
 * The amber box a figure's caveat goes in.
 *
 * The quieter sibling of `AlertNote`, and the distinction is what has just
 * happened. A red box means a press was refused and nothing was written. This
 * one means the numbers underneath it are arithmetic over a row somebody wrote
 * straight to the database: nothing has failed, nothing is being refused, and
 * a reader should not take the figures at face value until that row is fixed.
 *
 * Shared for the reason `AlertNote` is shared — the app has two of these, the
 * scope summary's and the scope comparison's, and a reader who has learned
 * what amber means on one should not find it a different colour on the other.
 *
 * No `role`: unlike a refusal, this is not a response to something the reader
 * just did. It is a property of the data that was true when the page was
 * served, so it is read in order like any other paragraph.
 */
export function CaveatNote({
  className,
  children,
}: {
  /** Spacing from whatever it sits under, which only the caller knows. */
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={`max-w-prose rounded border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100 ${className ?? ""}`}
    >
      {children}
    </p>
  );
}
