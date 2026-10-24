import type { ReactNode } from "react";

/**
 * The amber box a figure's caveat goes in.
 *
 * The quieter sibling of `AlertNote`, and the distinction is what has just
 * happened. A red box means a press was refused and nothing was written. This
 * one means the figures underneath it do not say what they appear to:
 * nothing has failed, nothing is being refused, and a reader should not take
 * them at face value until whatever the sentence names is settled.
 *
 * Usually that is a row somebody wrote straight to the database — an estimate
 * below zero the form would not have accepted. The time rollup's second
 * caveat is not: two of the page's reads can land a moment apart, which puts
 * minutes in a total and in none of its rows, and reloading is the fix. Both
 * are "the arithmetic is right and the reading is not", which is what the
 * colour means.
 *
 * Shared for the reason `AlertNote` is shared — the scope summary, the scope
 * comparison and the time rollup all have one, and a reader who has learned
 * what amber means on one should not find it a different colour on the next.
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
