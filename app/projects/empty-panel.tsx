import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The dashed panel that stands in for content that is not there: an empty
 * list, a section a later phase fills in.
 *
 * A heading naming the situation, a paragraph or two explaining it, and — when
 * there is one — a single way out. Shared so that the places a page can be
 * empty differ in what they say without also drifting in how they look; a page
 * whose empty panels are subtly different sizes reads as a mistake.
 */
export function EmptyPanel({
  heading,
  action,
  children,
}: {
  heading: string;
  /** Omitted where there is nothing useful to do about it yet. */
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <div className="mt-4 rounded border border-dashed border-zinc-300 px-6 py-10 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {heading}
      </p>
      <div className="mt-1 max-w-prose space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        {children}
      </div>
      {action === undefined ? null : (
        <Link
          href={action.href}
          className="mt-4 inline-block text-sm font-medium text-zinc-900 underline underline-offset-4 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-400"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
